import { describe, it, expect } from 'vitest'
import { InMemoryDepartmentRepository } from './inMemoryDepartmentRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import { isCatalogError } from '@/domain/shared'
import type { Department } from '@/domain/department'

const actor = { uid: 'u', role: 'super_admin' as const }
const seed = (): Department[] => [
  { id: 'd1', name: 'IT', createdAt: 't', updatedAt: 't' },
  { id: 'd2', name: 'HR', createdAt: 't', updatedAt: 't' },
]

describe('InMemoryDepartmentRepository', () => {
  it('lists and searches', async () => {
    const repo = new InMemoryDepartmentRepository(seed())
    expect((await repo.listDepartments()).length).toBe(2)
    expect((await repo.listDepartments({ search: 'hr' })).map(d => d.id)).toEqual(['d2'])
  })
  it('creates with one audit + rejects dup name (case-insensitive)', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryDepartmentRepository(seed(), {}, inMemoryAuditContext(store))
    await repo.createDepartment({ name: 'Finance' }, actor)
    expect(store.logs.length).toBe(1)
    expect(store.logs[0]!.entityType).toBe('department')
    expect(store.logs[0]!.action).toBe('created')
    await expect(repo.createDepartment({ name: 'it' }, actor)).rejects.toThrow()
  })
  it('updates with one audit', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryDepartmentRepository(seed(), {}, inMemoryAuditContext(store))
    const { value } = await repo.updateDepartment('d1', { name: 'IT & Ops' }, actor)
    expect(value.name).toBe('IT & Ops')
    expect(store.logs[0]!.action).toBe('updated')
  })
  it('blocks delete when referenced (no audit)', async () => {
    const store = createInMemoryAuditStore()
    const repo = new InMemoryDepartmentRepository(seed(), { assets: [{ deptId: 'd1' }] }, inMemoryAuditContext(store))
    expect(await repo.countReferences('d1')).toBe(1)
    let caught: unknown
    try { await repo.deleteDepartment('d1', actor) } catch (e) { caught = e }
    expect(isCatalogError(caught)).toBe(true)
    expect(store.logs.length).toBe(0)
  })
  it('counts employee references too', async () => {
    const repo = new InMemoryDepartmentRepository(seed(), { employees: [{ departmentId: 'd1' }] })
    expect(await repo.countReferences('d1')).toBe(1)
  })
  it('deletes unreferenced with one audit', async () => {
    const store = createInMemoryAuditStore()
    const data = seed()
    const repo = new InMemoryDepartmentRepository(data, {}, inMemoryAuditContext(store))
    await repo.deleteDepartment('d2', actor)
    expect(data.find(d => d.id === 'd2')).toBeUndefined()
    expect(store.logs[0]!.action).toBe('deleted')
  })
})
