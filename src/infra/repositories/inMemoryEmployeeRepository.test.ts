import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryEmployeeRepository } from './inMemoryEmployeeRepository'
import type { Employee } from '@/domain/employee'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

const ACTOR = { uid: 'admin_1', role: 'asset_admin' as const }

describe('InMemoryEmployeeRepository', () => {
  let emps: Employee[]
  let store: ReturnType<typeof createInMemoryAuditStore>
  let repo: InMemoryEmployeeRepository

  beforeEach(() => {
    emps = []
    store = createInMemoryAuditStore()
    repo = new InMemoryEmployeeRepository(emps, inMemoryAuditContext(store))
  })

  it('createEmployee stores uid-keyed doc + writes 1 created audit', async () => {
    const r = await repo.createEmployee(
      { id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', branchId: 'br_1' },
      ACTOR,
    )
    expect(r.value.id).toBe('uid_1')
    expect(r.value.status).toBe('active')
    expect(emps).toHaveLength(1)
    expect(store.logs.filter(l => l.action === 'created' && l.entityType === 'employee')).toHaveLength(1)
  })

  it('createEmployee rejects a duplicate email (case-insensitive)', async () => {
    await repo.createEmployee({ id: 'uid_1', firstName: 'A', lastName: 'B', email: 'i@x.com' }, ACTOR)
    await expect(
      repo.createEmployee({ id: 'uid_2', firstName: 'C', lastName: 'D', email: 'I@X.COM' }, ACTOR),
    ).rejects.toThrow()
  })

  it('createEmployee rejects a duplicate id', async () => {
    await repo.createEmployee({ id: 'uid_1', firstName: 'A', lastName: 'B', email: 'a@x.com' }, ACTOR)
    await expect(
      repo.createEmployee({ id: 'uid_1', firstName: 'C', lastName: 'D', email: 'c@x.com' }, ACTOR),
    ).rejects.toThrow()
  })

  it('updateEmployee patches + writes 1 updated audit; blocks email collision', async () => {
    await repo.createEmployee({ id: 'uid_1', firstName: 'A', lastName: 'B', email: 'a@x.com' }, ACTOR)
    await repo.createEmployee({ id: 'uid_2', firstName: 'C', lastName: 'D', email: 'c@x.com' }, ACTOR)
    const r = await repo.updateEmployee('uid_1', { position: 'Инженер' }, ACTOR)
    expect(r.value.position).toBe('Инженер')
    expect(store.logs.filter(l => l.action === 'updated')).toHaveLength(1)
    await expect(repo.updateEmployee('uid_1', { email: 'c@x.com' }, ACTOR)).rejects.toThrow()
  })

  it('setStatus terminated stamps terminatedAt + writes terminated audit; reactivate clears it', async () => {
    await repo.createEmployee({ id: 'uid_1', firstName: 'A', lastName: 'B', email: 'a@x.com' }, ACTOR)
    const term = await repo.setStatus('uid_1', 'terminated', ACTOR)
    expect(term.value.status).toBe('terminated')
    expect(term.value.terminatedAt).not.toBeNull()
    expect(store.logs.filter(l => l.action === 'terminated')).toHaveLength(1)
    const re = await repo.setStatus('uid_1', 'active', ACTOR)
    expect(re.value.terminatedAt).toBeNull()
    expect(store.logs.filter(l => l.action === 'reactivated')).toHaveLength(1)
  })

  it('listEmployees filters by status/branch/search', async () => {
    await repo.createEmployee({ id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', branchId: 'br_1' }, ACTOR)
    await repo.createEmployee({ id: 'uid_2', firstName: 'Анна', lastName: 'Сидорова', email: 'a@x.com', branchId: 'br_2' }, ACTOR)
    await repo.setStatus('uid_2', 'terminated', ACTOR)
    expect(await repo.listEmployees({ status: 'active' })).toHaveLength(1)
    expect(await repo.listEmployees({ branchId: 'br_2' })).toHaveLength(1)
    expect(await repo.listEmployees({ search: 'петров' })).toHaveLength(1)
    expect(await repo.listEmployees()).toHaveLength(2)
  })

  it('getEmployee returns null for unknown id', async () => {
    expect(await repo.getEmployee('nope')).toBeNull()
  })
})
