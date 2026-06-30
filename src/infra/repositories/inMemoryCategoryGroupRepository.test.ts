import { describe, it, expect } from 'vitest'
import { InMemoryCategoryGroupRepository } from './inMemoryCategoryGroupRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import { EntityInUseError } from '@/domain/shared'
import type { CategoryGroup } from '@/domain/category'

const actor = { uid: 'u1', role: 'super_admin' as const }

function seed(): CategoryGroup[] {
  return [
    {
      id: 'g1', name: 'Устройства', behavior: 'devices',
      lucideIcon: 'monitor', color: 'blue', order: 2,
      createdAt: 't', updatedAt: 't',
    },
    {
      id: 'g2', name: 'Мебель', behavior: 'furniture',
      lucideIcon: 'armchair', color: 'green', order: 1,
      createdAt: 't', updatedAt: 't',
    },
  ]
}

describe('InMemoryCategoryGroupRepository', () => {
  it('listCategoryGroups returns groups sorted by order then name', async () => {
    const repo = new InMemoryCategoryGroupRepository(seed())
    const groups = await repo.listCategoryGroups()
    expect(groups.map(g => g.id)).toEqual(['g2', 'g1']) // order 1 before order 2
  })

  it('createCategoryGroup defaults behavior to devices, lucideIcon to package, color to gray', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryCategoryGroupRepository([], {}, inMemoryAuditContext(store))
    const { value, auditId } = await repo.createCategoryGroup({ name: 'Network' }, actor)
    expect(value.behavior).toBe('devices')
    expect(value.lucideIcon).toBe('package')
    expect(value.color).toBe('gray')
    expect(value.order).toBe(0) // groups.length was 0
    expect(value.name).toBe('Network')
    expect(auditId).toBeTruthy()
    expect(store.logs.length).toBe(1)
    expect(store.logs[0]!.entityType).toBe('categoryGroup')
    expect(store.logs[0]!.action).toBe('created')
  })

  it('isNameTaken is case-insensitive and respects exceptId', async () => {
    const repo = new InMemoryCategoryGroupRepository(seed())
    expect(await repo.isNameTaken('устройства')).toBe(true)      // matches 'Устройства'
    expect(await repo.isNameTaken('Устройства', 'g1')).toBe(false) // excluded by exceptId
    expect(await repo.isNameTaken('Unknown')).toBe(false)
  })

  it('countReferences counts categories with matching categoryGroupId', async () => {
    const repo = new InMemoryCategoryGroupRepository(
      seed(),
      { categories: [{ categoryGroupId: 'g1' }, { categoryGroupId: 'g1' }, { categoryGroupId: 'g2' }] },
    )
    expect(await repo.countReferences('g1')).toBe(2)
    expect(await repo.countReferences('g2')).toBe(1)
    expect(await repo.countReferences('g3')).toBe(0)
  })

  it('deleteCategoryGroup is blocked with EntityInUseError when a category references the group', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryCategoryGroupRepository(
      seed(),
      { categories: [{ categoryGroupId: 'g1' }] },
      inMemoryAuditContext(store),
    )
    let caught: unknown
    try { await repo.deleteCategoryGroup('g1', actor) } catch (e) { caught = e }
    expect(caught instanceof EntityInUseError).toBe(true)
    expect(store.logs.length).toBe(0) // no audit on blocked delete
  })

  it('deleteCategoryGroup succeeds when no categories reference the group', async () => {
    const store = createInMemoryAuditStore()
    const data = seed()
    const repo = new InMemoryCategoryGroupRepository(data, {}, inMemoryAuditContext(store))
    const { value } = await repo.deleteCategoryGroup('g2', actor)
    expect(value.id).toBe('g2')
    expect(data.find(g => g.id === 'g2')).toBeUndefined()
    expect(store.logs.length).toBe(1)
    expect(store.logs[0]!.action).toBe('deleted')
  })

  it('createCategoryGroup assigns sequential order defaults for multiple groups', async () => {
    const repo = new InMemoryCategoryGroupRepository([])
    const { value: g1 } = await repo.createCategoryGroup({ name: 'Group A' }, actor)
    const { value: g2 } = await repo.createCategoryGroup({ name: 'Group B' }, actor)
    expect(g1.order).toBe(0)  // groups.length was 0 at time of creation
    expect(g2.order).toBe(1)  // groups.length was 1 after g1 pushed
    expect(g2.order).toBeGreaterThan(g1.order)
  })

  it('updateCategoryGroup renames a group and rejects duplicate name', async () => {
    const store = createInMemoryAuditStore()
    const data = seed()
    const repo = new InMemoryCategoryGroupRepository(data, {}, inMemoryAuditContext(store))

    const { value } = await repo.updateCategoryGroup('g1', { name: 'Electronics' }, actor)
    expect(value.name).toBe('Electronics')
    expect(store.logs.length).toBe(1)
    expect(store.logs[0]!.action).toBe('updated')

    // Renaming g2 to the same name as g1 should be rejected
    await expect(
      repo.updateCategoryGroup('g2', { name: 'Electronics' }, actor),
    ).rejects.toThrow('Name already in use')
    // Audit count must not grow on a rejected update
    expect(store.logs.length).toBe(1)
  })
})
