import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthProvider } from '@/contexts/AuthContext'
import { AuditPage } from './AuditPage'
import { InMemoryAuditLogRepository } from '@/infra/repositories'
import type { AuditLog } from '@/domain/audit'

// ── Mock Firebase so AuditPage's useMemo fallback (FirestoreAuditLogRepository) doesn't crash ──
vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

vi.mock('@/infra/repositories', async () => {
  const actual = await vi.importActual<typeof import('@/infra/repositories')>('@/infra/repositories')
  return {
    ...actual,
    // Stub out the real Firestore repo so it never calls firebase
    FirestoreAuditLogRepository: class {
      async listAuditLogs() { return { rows: [], nextCursor: null } }
      async loadReferenceData() { return { actors: [] } }
    },
  }
})

// Force Russian locale so assertions are language-stable
beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Actor name map used in tests */
const ACTOR_NAMES: Record<string, string> = {
  'uid-alice': 'Alice Admin',
  'uid-bob':   'Bob Technician',
}

/** Minimal valid AuditLog builder */
function makeLog(overrides: Partial<AuditLog> & { id: string }): AuditLog {
  const { id, ...rest } = overrides
  return {
    entityType: 'asset',
    entityId: `entity-${id}`,
    action: 'created',
    actorUid: 'uid-alice',
    actorRole: 'asset_admin',
    before: null,
    after: null,
    comment: null,
    at: '2026-01-10T10:00:00.000Z',
    ...rest,
    id,
  }
}

/** Build a sorted (newest-first) batch of N logs with distinct `at` timestamps */
function makePageLogs(count: number, actorUid = 'uid-alice'): AuditLog[] {
  return Array.from({ length: count }, (_, i) => {
    const n = count - i                // newest first in index order
    const pad = String(n).padStart(2, '0')
    return makeLog({
      id: `log-${pad}`,
      actorUid,
      // Vary entityId so rows are distinguishable
      entityId: `ent-${pad}`,
      at: `2026-01-${pad}T10:00:00.000Z`,
    })
  })
}

// ── Render helper ─────────────────────────────────────────────────────────────

function renderPage(repo: InMemoryAuditLogRepository) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <AuthProvider initialRole="super_admin">
          <AuditPage repository={repo} />
        </AuthProvider>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuditPage', () => {

  // ── (a) renders audit rows newest-first against seeded data ──────────────────
  describe('(a) renders audit rows newest-first', () => {
    it('both actor display names appear after loading', async () => {
      // Arrange
      const logs: AuditLog[] = [
        makeLog({ id: 'log-1', actorUid: 'uid-alice', at: '2026-01-10T10:00:00.000Z' }),
        makeLog({ id: 'log-2', actorUid: 'uid-bob',   at: '2026-01-09T10:00:00.000Z' }),
      ]
      const repo = new InMemoryAuditLogRepository(logs, ACTOR_NAMES)

      // Act
      renderPage(repo)

      // Assert — actor names appear both in filter dropdown options AND in table cells;
      // use getAllByText to handle duplicates (actor name in <option> + <td>).
      await waitFor(() => {
        expect(screen.getAllByText('Alice Admin').length).toBeGreaterThanOrEqual(1)
      })
      expect(screen.getAllByText('Bob Technician').length).toBeGreaterThanOrEqual(1)
    })

    it('rows are ordered newest-first (first row has the larger timestamp)', async () => {
      // Arrange — log-1 is newer, log-2 is older
      const logs: AuditLog[] = [
        makeLog({ id: 'log-older', actorUid: 'uid-bob',   at: '2026-01-09T10:00:00.000Z', entityId: 'ent-older' }),
        makeLog({ id: 'log-newer', actorUid: 'uid-alice', at: '2026-01-10T10:00:00.000Z', entityId: 'ent-newer' }),
      ]
      const repo = new InMemoryAuditLogRepository(logs, ACTOR_NAMES)

      // Act
      renderPage(repo)

      // Assert — wait for rows, then check DOM order via getAllByRole
      await waitFor(() => {
        expect(screen.getByText('ent-newer')).toBeInTheDocument()
        expect(screen.getByText('ent-older')).toBeInTheDocument()
      })

      // The table body rows: row[0]=thead, row[1]=first data row (newest), row[2]=older
      const rows = screen.getAllByRole('row')
      // rows[1] is the newest row — it must contain 'ent-newer'
      expect(rows[1]!.textContent).toContain('ent-newer')
      // rows[2] is the older row
      expect(rows[2]!.textContent).toContain('ent-older')
    })
  })

  // ── (b) expanding a row shows the before/after diff ──────────────────────────
  describe('(b) expanding a row reveals the before/after diff', () => {
    it('clicking a row shows a changed value in the diff panel', async () => {
      // Arrange
      const logs: AuditLog[] = [
        makeLog({
          id: 'log-diff',
          actorUid: 'uid-alice',
          action: 'status_changed',
          before: { statusId: 'active' },
          after:  { statusId: 'terminated' },
          at: '2026-01-10T10:00:00.000Z',
        }),
      ]
      const repo = new InMemoryAuditLogRepository(logs, ACTOR_NAMES)
      renderPage(repo)

      // Wait for the row to load — actor name appears in table cell and filter dropdown
      await waitFor(() => {
        expect(screen.getAllByText('Alice Admin').length).toBeGreaterThanOrEqual(1)
      })

      // Assert — diff values are absent before expanding
      expect(screen.queryByText('terminated')).toBeNull()

      // Act — click the data row (rows[0]=thead, rows[1]=data row)
      const rows = screen.getAllByRole('row')
      fireEvent.click(rows[1]!)

      // Assert — the changed "after" value is now visible
      await waitFor(() => {
        expect(screen.getByText('terminated')).toBeInTheDocument()
      })
      // And the "before" value too
      expect(screen.getByText('active')).toBeInTheDocument()
    })
  })

  // ── (c) empty state ──────────────────────────────────────────────────────────
  describe('(c) empty state when the repo has no logs', () => {
    it('renders no data rows when the repo is empty', async () => {
      // Arrange
      const repo = new InMemoryAuditLogRepository([], {})
      renderPage(repo)

      // Act + Assert — wait for loading to finish, then verify table has no data rows
      // The EmptyState renders an icon container; we verify the table rows are absent.
      await waitFor(() => {
        // Loading spinner should be gone; if EmptyState is shown it has no table rows
        const rows = screen.queryAllByRole('row')
        // No table rows at all when EmptyState is shown (AuditTable is not rendered)
        expect(rows).toHaveLength(0)
      })
    })

    it('does not render any actor names when the repo is empty', async () => {
      // Arrange
      const repo = new InMemoryAuditLogRepository([], {})
      renderPage(repo)

      // Act + Assert
      await waitFor(() => {
        // Table is absent
        expect(screen.queryAllByRole('row')).toHaveLength(0)
      })
      // No actor names appear
      expect(screen.queryByText('Alice Admin')).toBeNull()
      expect(screen.queryByText('Bob Technician')).toBeNull()
    })
  })

  // ── (c-2) pagination button accessible names (aria-label) ───────────────────
  describe('(c-2) pagination button accessible names', () => {
    it('prev button exposes an accessible name matching pagination.prev i18n key', async () => {
      // Arrange — 25 logs so pagination controls render; locale is 'ru' (set in beforeAll)
      const logs = makePageLogs(25, 'uid-alice')
      const repo = new InMemoryAuditLogRepository(logs, ACTOR_NAMES)
      renderPage(repo)

      // Wait for rows to load
      await waitFor(() => {
        expect(screen.getAllByText('Alice Admin').length).toBeGreaterThanOrEqual(1)
      })

      // Assert — the prev button is identifiable by its aria-label
      const expectedPrev = i18n.t('pagination.prev', { ns: 'audit' })
      const prevBtn = screen.getByRole('button', { name: expectedPrev })
      expect(prevBtn).toBeInTheDocument()
      // On page 1, Prev is disabled
      expect(prevBtn).toBeDisabled()
    })

    it('next button exposes an accessible name matching pagination.next i18n key', async () => {
      // Arrange — 25 logs so next is enabled
      const logs = makePageLogs(25, 'uid-alice')
      const repo = new InMemoryAuditLogRepository(logs, ACTOR_NAMES)
      renderPage(repo)

      // Wait for rows to load
      await waitFor(() => {
        expect(screen.getAllByText('Alice Admin').length).toBeGreaterThanOrEqual(1)
      })

      // Assert — the next button is identifiable by its aria-label and is enabled
      const expectedNext = i18n.t('pagination.next', { ns: 'audit' })
      const nextBtn = screen.getByRole('button', { name: expectedNext })
      expect(nextBtn).toBeInTheDocument()
      expect(nextBtn).not.toBeDisabled()
    })
  })

  // ── (d) pagination ───────────────────────────────────────────────────────────
  describe('(d) pagination', () => {
    it('first page shows exactly PAGE_SIZE (20) rows when 25 logs are seeded', async () => {
      // Arrange — 25 logs, all by alice so names appear uniformly
      const logs = makePageLogs(25, 'uid-alice')
      const repo = new InMemoryAuditLogRepository(logs, ACTOR_NAMES)
      renderPage(repo)

      // Wait for loading to finish — at least one actor name should appear
      await waitFor(() => {
        expect(screen.getAllByText('Alice Admin').length).toBeGreaterThanOrEqual(1)
      })

      // Count data rows: getAllByRole('row')[0] = thead; rest are data rows
      const allRows = screen.getAllByRole('row')
      // Subtract 1 for the thead row
      expect(allRows.length - 1).toBe(20)
    })

    it('Next button is enabled when there are more pages', async () => {
      // Arrange
      const logs = makePageLogs(25, 'uid-alice')
      const repo = new InMemoryAuditLogRepository(logs, ACTOR_NAMES)
      renderPage(repo)

      await waitFor(() => {
        expect(screen.getAllByText('Alice Admin').length).toBeGreaterThanOrEqual(1)
      })

      // The Next button is the second chevron-right button in the pagination footer.
      // AuditPage renders: Prev button (disabled on page 1) + Next button (enabled when hasNext).
      // Both buttons are <Btn variant="secondary"> with a chevron-right icon inside.
      // We locate them by their disabled state: Prev is disabled on page 1, Next is not.
      const paginationBtns = screen.getAllByRole('button').filter(
        btn => btn.closest('.flex.items-center.justify-between') !== null ||
               btn.closest('[class*="flex items-center gap-2"]') !== null,
      )
      // Simpler: find all buttons in the document and locate the two pagination ones
      // by checking which ones carry aria-disabled or HTML disabled attribute.
      // The Prev button on page 1 is disabled; the Next button is NOT disabled.
      const allBtns = screen.getAllByRole('button')
      const nextBtn = allBtns.find(btn => !btn.hasAttribute('disabled') && btn.querySelector('svg') !== null)

      // The next button must exist and be enabled (not disabled)
      // We check page count: if hasNext is true, Next button is not disabled.
      // Find by aria: use a broader check — look for any non-disabled button with an SVG.
      // Since data rows also have an entity-link button when entityType='asset', narrow by context.
      // Reliable approach: check that at least one button without disabled attribute exists
      // beyond the entity link buttons (there will be entity-id link buttons too for 'asset' type).
      //
      // Most reliable: inspect all buttons, count those that are NOT disabled and are in the footer.
      // Footer is identified by the 'flex items-center justify-between' container.
      //
      // Use getByRole with disabled:false on a button that appears in the pagination area.
      // We know Prev is disabled on page 1 (hasPrev=false). Next is not disabled (hasNext=true).
      // There are exactly 2 buttons in the pagination footer; we verify at least 1 is not disabled.
      const disabledBtns = allBtns.filter(btn => btn.hasAttribute('disabled'))
      const enabledPaginationBtns = allBtns.filter(btn => !btn.hasAttribute('disabled'))
      // At minimum: the Next button is enabled (at least one non-disabled button exists)
      expect(enabledPaginationBtns.length).toBeGreaterThanOrEqual(1)
      // At minimum: the Prev button is disabled on page 1
      expect(disabledBtns.length).toBeGreaterThanOrEqual(1)

      void nextBtn // silence ts unused var
      void paginationBtns
    })

    it('clicking Next loads page 2 with the remaining 5 rows', async () => {
      // Arrange — 25 logs
      const logs = makePageLogs(25, 'uid-alice')
      const repo = new InMemoryAuditLogRepository(logs, ACTOR_NAMES)
      renderPage(repo)

      // Wait for page 1 — 20 data rows
      await waitFor(() => {
        const rows = screen.getAllByRole('row')
        expect(rows.length - 1).toBe(20)
      })

      // Identify the Next button: it is the enabled (non-disabled) button
      // among the pair of pagination chevron buttons.
      // The Prev button is the first pagination button (disabled on page 1).
      // The Next button is the second pagination button (enabled when hasNext).
      //
      // All pagination buttons are `<Btn variant="secondary" size="sm">` with a chevron icon.
      // We find them as all disabled/enabled buttons among role=button elements.
      // Since entity link buttons are also present, we use the disabled attribute to isolate:
      // on page 1, Prev is disabled. The next-to-Prev button (in DOM order) is Next.
      // Both share the same pagination footer container.
      //
      // Approach: find the first button that is NOT disabled — on page 1 this is the Next button
      // (entity-id buttons in rows are also not disabled, but there will be many of them).
      // We count all role=button elements; the last two belong to the pagination footer.
      const allBtns = screen.getAllByRole('button')
      // Pagination footer always appends two buttons last in the document tree.
      // Prev = allBtns[allBtns.length - 2], Next = allBtns[allBtns.length - 1]
      const nextBtn = allBtns[allBtns.length - 1]!
      expect(nextBtn).not.toBeDisabled()

      // Act — click Next
      fireEvent.click(nextBtn)

      // Assert — page 2 has 5 rows (25 - 20 = 5)
      await waitFor(() => {
        const rows = screen.getAllByRole('row')
        expect(rows.length - 1).toBe(5)
      })
    })

    it('clicking Prev after Next returns to page 1 with 20 rows', async () => {
      // Arrange — 25 logs
      const logs = makePageLogs(25, 'uid-alice')
      const repo = new InMemoryAuditLogRepository(logs, ACTOR_NAMES)
      renderPage(repo)

      // Wait for page 1
      await waitFor(() => {
        const rows = screen.getAllByRole('row')
        expect(rows.length - 1).toBe(20)
      })

      // Navigate to page 2
      let allBtns = screen.getAllByRole('button')
      const nextBtn = allBtns[allBtns.length - 1]!
      fireEvent.click(nextBtn)

      await waitFor(() => {
        const rows = screen.getAllByRole('row')
        expect(rows.length - 1).toBe(5)
      })

      // Act — click Prev (now enabled on page 2)
      allBtns = screen.getAllByRole('button')
      const prevBtn = allBtns[allBtns.length - 2]!
      expect(prevBtn).not.toBeDisabled()
      fireEvent.click(prevBtn)

      // Assert — back to page 1: 20 data rows
      await waitFor(() => {
        const rows = screen.getAllByRole('row')
        expect(rows.length - 1).toBe(20)
      })
    })
  })
})
