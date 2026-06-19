import { describe, it, expect } from 'vitest'
import { withAudit, createInMemoryAuditStore, inMemoryAuditContext } from './withAudit'

describe('withAudit (in-memory)', () => {
  it('commits value + exactly one audit entry atomically', async () => {
    const store = createInMemoryAuditStore()
    const ctx = inMemoryAuditContext(store)
    const res = await withAudit(ctx,
      { entityType: 'asset', entityId: 'a1', action: 'created', actorUid: 'u1', actorRole: 'asset_admin', after: { x: 1 } },
      async () => ({ value: { id: 'a1' }, after: { x: 1 } }),
    )
    expect(res.value).toEqual({ id: 'a1' })
    expect(res.auditId).toBeTruthy()
    expect(store.logs).toHaveLength(1)
    expect(store.logs[0]).toMatchObject({ entityId: 'a1', action: 'created', actorUid: 'u1', actorRole: 'asset_admin' })
    expect(store.logs[0]!.at).toBeTruthy()
  })

  it('rolls back: a throwing mutate writes NO audit entry', async () => {
    const store = createInMemoryAuditStore()
    const ctx = inMemoryAuditContext(store)
    await expect(withAudit(ctx,
      { entityType: 'asset', entityId: 'a2', action: 'created', actorUid: 'u1', actorRole: 'asset_admin' },
      async () => { throw new Error('boom') },
    )).rejects.toThrow('boom')
    expect(store.logs).toHaveLength(0)
  })

  it('spec.before/after override mutate-returned before/after', async () => {
    const store = createInMemoryAuditStore()
    const ctx = inMemoryAuditContext(store)
    await withAudit(ctx,
      { entityType: 'asset', entityId: 'a3', action: 'updated', actorUid: 'u1', actorRole: 'tech_admin', before: { s: 'old' }, after: { s: 'new' } },
      async () => ({ value: 1, before: { ignored: true }, after: { ignored: true } }),
    )
    expect(store.logs[0]!.before).toEqual({ s: 'old' })
    expect(store.logs[0]!.after).toEqual({ s: 'new' })
  })
})
