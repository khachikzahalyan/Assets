import { describe, it, expect } from 'vitest'
import { InMemoryUserRepository } from './inMemoryUserRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { User } from '@/domain/user'
import type { Employee } from '@/domain/employee'
import type { Actor } from '@/domain/asset'

const actor: Actor = { uid: 'super1', role: 'super_admin' }

function pending(id: string): User {
  return { id, email: `${id}@x.com`, displayName: id, role: null, status: 'no-role', createdAt: '2026-01-01T00:00:00.000Z' }
}

describe('InMemoryUserRepository', () => {
  it('lists only no-role users', async () => {
    const users: User[] = [pending('a'), { ...pending('b'), role: 'employee', status: 'active' }]
    const repo = new InMemoryUserRepository(users, [])
    const out = await repo.listPendingUsers()
    expect(out.map(u => u.id)).toEqual(['a'])
  })

  it('assignRole flips role+status and writes ONE audit row', async () => {
    const store = createInMemoryAuditStore()
    const users: User[] = [pending('a')]
    const repo = new InMemoryUserRepository(users, [], inMemoryAuditContext(store))
    const r = await repo.assignRole({ uid: 'a', role: 'asset_admin' }, actor)
    expect(r.value.role).toBe('asset_admin')
    expect(r.value.status).toBe('active')
    expect(store.logs).toHaveLength(1)
    expect(store.logs[0]).toMatchObject({ entityType: 'user', action: 'role_assigned' })
  })

  it('assignRole employee+create makes an employee doc (second audit row)', async () => {
    const store = createInMemoryAuditStore()
    const users: User[] = [pending('a')]
    const employees: Employee[] = []
    const repo = new InMemoryUserRepository(users, employees, inMemoryAuditContext(store))
    await repo.assignRole(
      { uid: 'a', role: 'employee', employee: { mode: 'create', create: { firstName: 'I', lastName: 'P', email: 'a@x.com' } } },
      actor,
    )
    expect(employees.map(e => e.id)).toContain('a')
    expect(store.logs.map(l => l.action)).toEqual(expect.arrayContaining(['role_assigned', 'created']))
  })

  it('assignRole employee+create with empty email throws and does NOT grant the role', async () => {
    const store = createInMemoryAuditStore()
    const users: User[] = [pending('a')]
    const employees: Employee[] = []
    const repo = new InMemoryUserRepository(users, employees, inMemoryAuditContext(store))
    await expect(
      repo.assignRole(
        { uid: 'a', role: 'employee', employee: { mode: 'create', create: { firstName: 'I', lastName: 'P', email: '   ' } } },
        actor,
      ),
    ).rejects.toThrow(/employee email required/)
    // The role was NEVER granted: the user stays pending and retryable.
    expect(users[0]!.role).toBe(null)
    expect(users[0]!.status).toBe('no-role')
    // No employee doc and no audit row were written.
    expect(employees).toHaveLength(0)
    expect(store.logs).toHaveLength(0)
  })

  it('assignRole employee+link does NOT create an employee doc', async () => {
    const users: User[] = [pending('a')]
    const employees: Employee[] = []
    const repo = new InMemoryUserRepository(users, employees)
    await repo.assignRole({ uid: 'a', role: 'employee', employee: { mode: 'link' } }, actor)
    expect(employees).toHaveLength(0)
  })
})
