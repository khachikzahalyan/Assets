import { describe, it, expect } from 'vitest'
import { InMemoryAuditLogRepository } from './inMemoryAuditLogRepository'
import type { AuditLog } from '@/domain/audit'

function log(over: Partial<AuditLog>): AuditLog {
  return {
    id: over.id ?? 'al_x',
    entityType: over.entityType ?? 'asset',
    entityId: over.entityId ?? 'a_1',
    action: over.action ?? 'created',
    actorUid: over.actorUid ?? 'u_1',
    actorRole: over.actorRole ?? 'super_admin',
    before: over.before ?? null,
    after: over.after ?? null,
    comment: over.comment ?? null,
    at: over.at ?? '2026-06-01T10:00:00.000Z',
  }
}

const seed: AuditLog[] = [
  log({ id: 'al_1', entityType: 'asset', action: 'created', actorUid: 'u_1', at: '2026-06-01T10:00:00.000Z' }),
  log({ id: 'al_2', entityType: 'asset', action: 'updated', actorUid: 'u_2', at: '2026-06-02T10:00:00.000Z' }),
  log({ id: 'al_3', entityType: 'employee', action: 'created', actorUid: 'u_1', at: '2026-06-03T10:00:00.000Z' }),
  log({ id: 'al_4', entityType: 'assignment', action: 'assigned', actorUid: 'u_2', at: '2026-06-04T10:00:00.000Z' }),
]

const Q = {
  entityType: 'all' as const, action: 'all' as const, actorUid: 'all' as const,
  fromDate: null, toDate: null, search: '', pageSize: 10,
}

describe('InMemoryAuditLogRepository', () => {
  it('returns all rows sorted by at DESC on first page', async () => {
    const repo = new InMemoryAuditLogRepository([...seed])
    const page = await repo.listAuditLogs(Q, null)
    expect(page.rows.map(r => r.id)).toEqual(['al_4', 'al_3', 'al_2', 'al_1'])
    expect(page.nextCursor).toBeNull()
  })

  it('filters by entityType', async () => {
    const repo = new InMemoryAuditLogRepository([...seed])
    const page = await repo.listAuditLogs({ ...Q, entityType: 'asset' }, null)
    expect(page.rows.map(r => r.id)).toEqual(['al_2', 'al_1'])
  })

  it('filters by action', async () => {
    const repo = new InMemoryAuditLogRepository([...seed])
    const page = await repo.listAuditLogs({ ...Q, action: 'created' }, null)
    expect(page.rows.map(r => r.id)).toEqual(['al_3', 'al_1'])
  })

  it('filters by actorUid', async () => {
    const repo = new InMemoryAuditLogRepository([...seed])
    const page = await repo.listAuditLogs({ ...Q, actorUid: 'u_1' }, null)
    expect(page.rows.map(r => r.id)).toEqual(['al_3', 'al_1'])
  })

  it('filters by inclusive date range', async () => {
    const repo = new InMemoryAuditLogRepository([...seed])
    const page = await repo.listAuditLogs(
      { ...Q, fromDate: '2026-06-02T00:00:00.000Z', toDate: '2026-06-03T23:59:59.999Z' }, null)
    expect(page.rows.map(r => r.id)).toEqual(['al_3', 'al_2'])
  })

  it('narrows by free-text search over entityId + actorUid', async () => {
    const repo = new InMemoryAuditLogRepository([...seed])
    const page = await repo.listAuditLogs({ ...Q, search: 'u_2' }, null)
    expect(page.rows.map(r => r.id)).toEqual(['al_4', 'al_2'])
  })

  it('paginates with an opaque cursor', async () => {
    const repo = new InMemoryAuditLogRepository([...seed])
    const p1 = await repo.listAuditLogs({ ...Q, pageSize: 2 }, null)
    expect(p1.rows.map(r => r.id)).toEqual(['al_4', 'al_3'])
    expect(p1.nextCursor).not.toBeNull()
    const p2 = await repo.listAuditLogs({ ...Q, pageSize: 2 }, p1.nextCursor)
    expect(p2.rows.map(r => r.id)).toEqual(['al_2', 'al_1'])
    expect(p2.nextCursor).toBeNull()
  })

  it('loads distinct actors as reference data', async () => {
    const repo = new InMemoryAuditLogRepository([...seed])
    const ref = await repo.loadReferenceData()
    expect(ref.actors.map(a => a.uid).sort()).toEqual(['u_1', 'u_2'])
  })

  it('uses injected actor display names when provided', async () => {
    const repo = new InMemoryAuditLogRepository([...seed], { u_1: 'Khach', u_2: 'Anna' })
    const ref = await repo.loadReferenceData()
    const byUid = Object.fromEntries(ref.actors.map(a => [a.uid, a.displayName]))
    expect(byUid['u_1']).toBe('Khach')
    expect(byUid['u_2']).toBe('Anna')
  })

  it('breaks at-timestamp ties by id DESC', async () => {
    // Two logs share the exact same `at` value — the one with the lexicographically
    // greater id must appear first in the sorted output.
    const tied = [
      log({ id: 'al_b', at: '2026-06-05T10:00:00.000Z', actorUid: 'u_1' }),
      log({ id: 'al_a', at: '2026-06-05T10:00:00.000Z', actorUid: 'u_1' }),
      log({ id: 'al_c', at: '2026-06-05T10:00:00.000Z', actorUid: 'u_1' }),
    ]
    const repo = new InMemoryAuditLogRepository(tied)
    const page = await repo.listAuditLogs(Q, null)
    expect(page.rows.map(r => r.id)).toEqual(['al_c', 'al_b', 'al_a'])
  })

  it('applies combined filters (entityType + actorUid) correctly', async () => {
    // Only al_1 is entityType='asset' AND actorUid='u_1'.
    // al_2 is asset but u_2; al_3 is employee and u_1 — both must be excluded.
    const repo = new InMemoryAuditLogRepository([...seed])
    const page = await repo.listAuditLogs({ ...Q, entityType: 'asset', actorUid: 'u_1' }, null)
    expect(page.rows.map(r => r.id)).toEqual(['al_1'])
  })
})
