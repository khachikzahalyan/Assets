import { describe, it, expect } from 'vitest'
import { InMemoryBranchRepository } from './inMemoryBranchRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import { isCatalogError } from '@/domain/shared'
import type { Branch } from '@/domain/branch'

const actor = { uid: 'u_super', role: 'super_admin' as const }
function seed(): Branch[] {
  return [
    { id: 'b1', name: 'Main Office', type: 'branch', city: 'Yerevan', address: null, createdAt: 't', updatedAt: 't' },
    { id: 'b2', name: 'Central WH', type: 'warehouse', city: null, address: null, createdAt: 't', updatedAt: 't' },
  ]
}

describe('InMemoryBranchRepository', () => {
  it('lists, filters by type, and searches', async () => {
    const repo = new InMemoryBranchRepository(seed())
    expect((await repo.listBranches()).length).toBe(2)
    expect((await repo.listBranches({ type: 'warehouse' })).map(b => b.id)).toEqual(['b2'])
    expect((await repo.listBranches({ search: 'main' })).map(b => b.id)).toEqual(['b1'])
  })

  it('creates with one audit entry and rejects duplicate name (case-insensitive)', async () => {
    const store = createInMemoryAuditStore()
    const data = seed()
    const repo = new InMemoryBranchRepository(data, {}, inMemoryAuditContext(store))
    const { value, auditId } = await repo.createBranch({ name: 'North', type: 'branch' }, actor)
    expect(value.name).toBe('North')
    expect(auditId).toBeTruthy()
    expect(store.logs.length).toBe(1)
    expect(store.logs[0]!.entityType).toBe('branch')
    expect(store.logs[0]!.action).toBe('created')
    await expect(repo.createBranch({ name: 'main office', type: 'branch' }, actor)).rejects.toThrow()
  })

  it('updates with one audit entry', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryBranchRepository(seed(), {}, inMemoryAuditContext(store))
    const { value } = await repo.updateBranch('b1', { city: 'Gyumri' }, actor)
    expect(value.city).toBe('Gyumri')
    expect(store.logs.length).toBe(1)
    expect(store.logs[0]!.action).toBe('updated')
  })

  it('counts references and BLOCKS delete when in use', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryBranchRepository(
      seed(),
      { assets: [{ branchId: 'b1' }], employees: [{ branchId: 'b1' }] },
      inMemoryAuditContext(store),
    )
    expect(await repo.countReferences('b1')).toBe(2)
    let caught: unknown
    try { await repo.deleteBranch('b1', actor) } catch (e) { caught = e }
    expect(isCatalogError(caught)).toBe(true)
    expect(store.logs.length).toBe(0)
  })

  it('deletes an unreferenced branch with one audit entry', async () => {
    const store = createInMemoryAuditStore()
    const data = seed()
    const repo = new InMemoryBranchRepository(data, {}, inMemoryAuditContext(store))
    const { value } = await repo.deleteBranch('b2', actor)
    expect(value.id).toBe('b2')
    expect(data.find(b => b.id === 'b2')).toBeUndefined()
    expect(store.logs.length).toBe(1)
    expect(store.logs[0]!.action).toBe('deleted')
  })
})
