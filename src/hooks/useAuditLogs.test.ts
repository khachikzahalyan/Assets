/**
 * useAuditLogs — cursor-pagination state machine tests.
 *
 * Covers: initial fetch, next() advances to page 2, prev() walks back to page 1,
 * query change resets the cursor stack to page 1 (no stale cursor leakage).
 *
 * Does NOT cover UI rendering — that belongs to the AuditPage component test (Task 10).
 * Uses InMemoryAuditLogRepository so there is no network, no timers, no flakiness.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useAuditLogs } from './useAuditLogs'
import { InMemoryAuditLogRepository } from '@/infra/repositories/inMemoryAuditLogRepository'
import type { AuditLog, AuditLogQuery, AuditLogRepository } from '@/domain/audit'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeLog(id: string, at: string): AuditLog {
  return {
    id,
    entityType: 'asset',
    entityId: `asset_${id}`,
    action: 'created',
    actorUid: 'u_1',
    actorRole: 'super_admin',
    before: null,
    after: null,
    comment: null,
    at,
  }
}

/**
 * Six logs ordered newest → oldest so the repo sorts them DESC.
 * With pageSize 2 this gives 3 pages.
 */
const SIX_LOGS: AuditLog[] = [
  makeLog('al_1', '2026-06-01T10:00:00.000Z'),
  makeLog('al_2', '2026-06-02T10:00:00.000Z'),
  makeLog('al_3', '2026-06-03T10:00:00.000Z'),
  makeLog('al_4', '2026-06-04T10:00:00.000Z'),
  makeLog('al_5', '2026-06-05T10:00:00.000Z'),
  makeLog('al_6', '2026-06-06T10:00:00.000Z'),
]

const BASE_QUERY: AuditLogQuery = {
  entityType: 'all',
  action: 'all',
  actorUid: 'all',
  fromDate: null,
  toDate: null,
  search: '',
  pageSize: 2,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stable singleton repo — the hook requires a stable reference. */
function makeRepo(logs = SIX_LOGS) {
  return new InMemoryAuditLogRepository([...logs])
}

/**
 * Wait for a specific page number to appear in the hook result.
 * This is more reliable than chasing the loading boolean because the in-memory
 * repo resolves promises so fast that loading=true may be gone before waitFor
 * gets to check it.
 */
async function waitForPage(result: { current: { page: number; loading: boolean } }, page: number) {
  await waitFor(() => {
    expect(result.current.page).toBe(page)
    expect(result.current.loading).toBe(false)
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAuditLogs — pagination state machine', () => {
  it('starts on page 1 and shows the first page of rows', async () => {
    // Arrange
    const repo = makeRepo()

    // Act
    const { result } = renderHook(() => useAuditLogs(repo, BASE_QUERY))

    // Assert — wait for initial load to finish
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.page).toBe(1)
    expect(result.current.hasPrev).toBe(false)
    expect(result.current.hasNext).toBe(true)
    // DESC order: al_6, al_5
    expect(result.current.rows.map(r => r.id)).toEqual(['al_6', 'al_5'])
  })

  it('next() advances to page 2 and enables hasPrev', async () => {
    // Arrange
    const repo = makeRepo()
    const { result } = renderHook(() => useAuditLogs(repo, BASE_QUERY))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Act
    result.current.next()
    await waitForPage(result, 2)

    // Assert
    expect(result.current.hasPrev).toBe(true)
    expect(result.current.hasNext).toBe(true)
    expect(result.current.rows.map(r => r.id)).toEqual(['al_4', 'al_3'])
  })

  it('prev() from page 2 walks back to page 1 and shows original rows', async () => {
    // Arrange
    const repo = makeRepo()
    const { result } = renderHook(() => useAuditLogs(repo, BASE_QUERY))
    await waitFor(() => expect(result.current.loading).toBe(false))
    result.current.next()
    await waitForPage(result, 2)

    // Act
    result.current.prev()
    await waitForPage(result, 1)

    // Assert
    expect(result.current.hasPrev).toBe(false)
    expect(result.current.rows.map(r => r.id)).toEqual(['al_6', 'al_5'])
  })

  it('prev() is a no-op when already on page 1', async () => {
    // Arrange
    const repo = makeRepo()
    const { result } = renderHook(() => useAuditLogs(repo, BASE_QUERY))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const rowsBefore = result.current.rows.map(r => r.id)

    // Act — call prev() while on page 1; the cursor stack has length 1 so it
    // returns the same stack unchanged; no re-fetch is triggered.
    result.current.prev()
    // Allow one microtask tick; loading must stay false and page must stay 1.
    await new Promise(r => setTimeout(r, 0))

    // Assert — page unchanged, same rows
    expect(result.current.loading).toBe(false)
    expect(result.current.page).toBe(1)
    expect(result.current.rows.map(r => r.id)).toEqual(rowsBefore)
  })

  it('last page has hasNext = false', async () => {
    // Arrange — pageSize 6 so everything fits on one page
    const repo = makeRepo()
    const { result } = renderHook(() =>
      useAuditLogs(repo, { ...BASE_QUERY, pageSize: 6 }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Assert
    expect(result.current.hasNext).toBe(false)
    expect(result.current.rows).toHaveLength(6)
  })

  it('changing the query resets cursor stack to page 1', async () => {
    // Arrange — navigate to page 2, then change a filter
    const repo = makeRepo()
    let query = BASE_QUERY
    const { result, rerender } = renderHook(() => useAuditLogs(repo, query))
    await waitFor(() => expect(result.current.loading).toBe(false))

    result.current.next()
    await waitForPage(result, 2)

    // Act — change a filter (actorUid); rerender with new query reference
    query = { ...BASE_QUERY, actorUid: 'u_nonexistent' }
    rerender()
    // Wait for the cursor reset to propagate and the new fetch to settle.
    await waitFor(() => {
      expect(result.current.page).toBe(1)
      expect(result.current.loading).toBe(false)
    })

    // Assert — back to page 1, no stale cursor
    expect(result.current.hasPrev).toBe(false)
    // No rows match the nonexistent actor
    expect(result.current.rows).toHaveLength(0)
    expect(result.current.hasNext).toBe(false)
  })

  it('reload() re-fetches the current page without resetting pagination', async () => {
    // Arrange — navigate to page 2 so reload can prove it stays there (not reset to 1)
    const repo = makeRepo()
    const { result } = renderHook(() => useAuditLogs(repo, BASE_QUERY))
    await waitFor(() => expect(result.current.loading).toBe(false))
    result.current.next()
    await waitForPage(result, 2)
    const page2Rows = result.current.rows.map(r => r.id)

    // Act
    result.current.reload()
    // reload() increments tick, which re-runs the fetch effect with the same cursor.
    // Wait for the fetch to settle back on page 2.
    await waitFor(() => {
      expect(result.current.page).toBe(2)
      expect(result.current.loading).toBe(false)
    })

    // Assert — same page 2 rows returned; page did not reset to 1
    expect(result.current.rows.map(r => r.id)).toEqual(page2Rows)
  })

  it('loadReferenceData is called exactly once across page turns (not per-page)', async () => {
    // Arrange — spy repo that counts loadReferenceData calls
    let loadRefCallCount = 0
    const baseRepo = makeRepo()
    const spyRepo: AuditLogRepository = {
      listAuditLogs: (...args) => baseRepo.listAuditLogs(...args),
      loadReferenceData: async () => {
        loadRefCallCount++
        return baseRepo.loadReferenceData()
      },
    }

    const { result } = renderHook(() => useAuditLogs(spyRepo, BASE_QUERY))

    // Wait for initial load (both page + ref effects settle)
    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(result.current.ref).not.toBeNull())
    const afterInitialLoad = loadRefCallCount

    // Act — navigate to page 2
    result.current.next()
    await waitForPage(result, 2)

    // Act — navigate back to page 1
    result.current.prev()
    await waitForPage(result, 1)

    // Assert — loadReferenceData must not have been called again for page turns;
    // only the initial mount call (possibly plus one if the effect ran twice due to StrictMode)
    // should have fired. The key invariant: count did NOT increment during next()/prev().
    expect(loadRefCallCount).toBe(afterInitialLoad)
    expect(loadRefCallCount).toBeGreaterThanOrEqual(1)
  })

  it('exposes reference data alongside rows', async () => {
    // Arrange — two distinct actors
    const logs: AuditLog[] = [
      makeLog('al_a', '2026-06-01T10:00:00.000Z'),
      { ...makeLog('al_b', '2026-06-02T10:00:00.000Z'), actorUid: 'u_2' },
    ]
    const repo = new InMemoryAuditLogRepository(logs, { u_1: 'Alice', u_2: 'Bob' })

    // Act
    const { result } = renderHook(() =>
      useAuditLogs(repo, { ...BASE_QUERY, pageSize: 10 }),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Assert
    expect(result.current.ref).not.toBeNull()
    const uids = result.current.ref!.actors.map(a => a.uid).sort()
    expect(uids).toEqual(['u_1', 'u_2'])
  })
})
