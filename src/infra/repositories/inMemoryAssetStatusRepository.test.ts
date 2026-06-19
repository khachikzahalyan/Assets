import { describe, it, expect } from 'vitest'
import { InMemoryAssetStatusRepository } from './inMemoryAssetStatusRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import { SystemEntityProtectedError, EntityInUseError } from '@/domain/shared'
import type { AssetStatus } from '@/domain/asset_status'

const actor = { uid: 'u', role: 'super_admin' as const }
const seed = (): AssetStatus[] => [
  { id: 'st_warehouse', name: 'Warehouse', color: 'gray', isFinal: false, isSystem: true, sortOrder: 0, createdAt: 't', updatedAt: 't' },
  { id: 'st_disposed', name: 'Disposed', color: 'red', isFinal: true, isSystem: true, sortOrder: 3, createdAt: 't', updatedAt: 't' },
]

describe('InMemoryAssetStatusRepository', () => {
  it('refuses to delete a system status (no audit)', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryAssetStatusRepository(seed(), {}, inMemoryAuditContext(store))
    let caught: unknown
    try { await repo.deleteAssetStatus('st_warehouse', actor) } catch (e) { caught = e }
    expect(caught instanceof SystemEntityProtectedError).toBe(true)
    expect(store.logs.length).toBe(0)
  })
  it('does NOT change isFinal on a system status update (display fields only)', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryAssetStatusRepository(seed(), {}, inMemoryAuditContext(store))
    const { value } = await repo.updateAssetStatus('st_warehouse', { name: 'Stock', isFinal: true }, actor)
    expect(value.name).toBe('Stock')
    expect(value.isFinal).toBe(false)
    expect(store.logs.length).toBe(1)
  })
  it('creates a non-system status (always isSystem:false) with one audit, deletable when unreferenced', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryAssetStatusRepository(seed(), {}, inMemoryAuditContext(store))
    const { value } = await repo.createAssetStatus({ name: 'Lost', color: 'amber', isFinal: true, sortOrder: 4 }, actor)
    expect(value.isSystem).toBe(false)
    expect(store.logs.length).toBe(1)
    await repo.deleteAssetStatus(value.id, actor)
    expect(store.logs.length).toBe(2)
    expect(store.logs[1]!.action).toBe('deleted')
  })
  it('blocks delete of a non-system status that is in use', async () => {
    const data = seed()
    const repo0 = new InMemoryAssetStatusRepository(data, {})
    const { value } = await repo0.createAssetStatus({ name: 'Lost', color: 'amber', isFinal: false, sortOrder: 4 }, actor)
    const repo = new InMemoryAssetStatusRepository(data, { assets: [{ statusId: value.id }] })
    let caught: unknown
    try { await repo.deleteAssetStatus(value.id, actor) } catch (e) { caught = e }
    expect(caught instanceof EntityInUseError).toBe(true)
  })
  it('lists sorted by sortOrder', async () => {
    const repo = new InMemoryAssetStatusRepository(seed())
    const list = await repo.listAssetStatuses()
    expect(list.map(s => s.id)).toEqual(['st_warehouse', 'st_disposed'])
  })
  it('rejects duplicate name on create', async () => {
    const repo = new InMemoryAssetStatusRepository(seed())
    await expect(repo.createAssetStatus({ name: 'warehouse', color: 'gray', isFinal: false, sortOrder: 5 }, actor)).rejects.toThrow()
  })
})
