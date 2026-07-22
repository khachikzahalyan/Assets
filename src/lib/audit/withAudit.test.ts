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

  it('writes actorName to the audit log when spec includes it', async () => {
    const store = createInMemoryAuditStore()
    const ctx = inMemoryAuditContext(store)
    await withAudit(ctx,
      { entityType: 'asset', entityId: 'a4', action: 'created', actorUid: 'u1', actorRole: 'asset_admin', actorName: 'Иван Петров' },
      async () => ({ value: 1 }),
    )
    expect(store.logs[0]!.actorName).toBe('Иван Петров')
  })

  it('leaves actorName key absent when spec omits it (legacy shape)', async () => {
    const store = createInMemoryAuditStore()
    const ctx = inMemoryAuditContext(store)
    await withAudit(ctx,
      { entityType: 'asset', entityId: 'a5', action: 'updated', actorUid: 'u2', actorRole: 'super_admin' },
      async () => ({ value: 1 }),
    )
    expect('actorName' in store.logs[0]!).toBe(false)
  })

  it('writes actorName: null when spec passes null explicitly', async () => {
    const store = createInMemoryAuditStore()
    const ctx = inMemoryAuditContext(store)
    await withAudit(ctx,
      { entityType: 'branch', entityId: 'b1', action: 'created', actorUid: 'u3', actorRole: 'super_admin', actorName: null },
      async () => ({ value: 1 }),
    )
    expect(store.logs[0]!.actorName).toBeNull()
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
