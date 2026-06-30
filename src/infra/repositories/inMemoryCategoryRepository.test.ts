import { describe, it, expect } from 'vitest'
import { InMemoryCategoryRepository } from './inMemoryCategoryRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import { EntityInUseError } from '@/domain/shared'
import type { Category } from '@/domain/category'

const actor = { uid: 'u', role: 'super_admin' as const }
const seed = (): Category[] => [
  { id: 'c1', name: 'Laptop', group: 'devices', categoryGroupId: 'devices', hasSpecs: true, lucideIcon: 'laptop', createdAt: 't', updatedAt: 't' },
  { id: 'c2', name: 'Chair', group: 'furniture', categoryGroupId: 'furniture', hasSpecs: false, lucideIcon: 'armchair', createdAt: 't', updatedAt: 't' },
]

describe('InMemoryCategoryRepository', () => {
  it('lists, filters by group, searches', async () => {
    const repo = new InMemoryCategoryRepository(seed())
    expect((await repo.listCategories()).length).toBe(2)
    expect((await repo.listCategories({ group: 'furniture' })).map(c => c.id)).toEqual(['c2'])
    expect((await repo.listCategories({ search: 'lap' })).map(c => c.id)).toEqual(['c1'])
  })

  it('listCategories filters by categoryGroupId', async () => {
    const repo = new InMemoryCategoryRepository(seed())
    const devicesOnly = await repo.listCategories({ categoryGroupId: 'devices' })
    expect(devicesOnly.map(c => c.id)).toEqual(['c1'])
    const furnitureOnly = await repo.listCategories({ categoryGroupId: 'furniture' })
    expect(furnitureOnly.map(c => c.id)).toEqual(['c2'])
    const noneMatch = await repo.listCategories({ categoryGroupId: 'grp_unknown' })
    expect(noneMatch).toHaveLength(0)
  })
  it('creates with one audit + rejects dup name', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryCategoryRepository(seed(), {}, inMemoryAuditContext(store))
    await repo.createCategory({ name: 'Server', group: 'network', hasSpecs: true }, actor)
    expect(store.logs.length).toBe(1)
    expect(store.logs[0]!.entityType).toBe('category')
    await expect(repo.createCategory({ name: 'laptop', group: 'devices', hasSpecs: true }, actor)).rejects.toThrow()
  })
  it('updates name with one audit', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryCategoryRepository(seed(), { assets: [{ categoryId: 'c1' }] }, inMemoryAuditContext(store))
    const { value } = await repo.updateCategory('c1', { name: 'Laptop Pro' }, actor)
    expect(value.name).toBe('Laptop Pro')
    expect(store.logs.length).toBe(1)
    expect(store.logs[0]!.action).toBe('updated')
  })
  it('blocks delete when referenced (no audit)', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryCategoryRepository(seed(), { assets: [{ categoryId: 'c1' }] }, inMemoryAuditContext(store))
    let caught: unknown
    try { await repo.deleteCategory('c1', actor) } catch (e) { caught = e }
    expect(caught instanceof EntityInUseError).toBe(true)
    expect(store.logs.length).toBe(0)
  })
  it('deletes unreferenced with one audit', async () => {
    const store = createInMemoryAuditStore()
    const data = seed()
    const repo = new InMemoryCategoryRepository(data, {}, inMemoryAuditContext(store))
    await repo.deleteCategory('c2', actor)
    expect(data.find(c => c.id === 'c2')).toBeUndefined()
    expect(store.logs[0]!.action).toBe('deleted')
  })
})
