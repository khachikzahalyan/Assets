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

  it('assignRole employee+link persists employeeId from the matching HR record', async () => {
    // Owner-facing bug: an employee granted the role via LINK never got
    // users/{uid}.employeeId, so self-service (and the rules) blocked their
    // assets. The link must be stamped at grant time by matching email.
    const emp: Employee = {
      id: 'pending_hr1', firstName: 'Khachik', lastName: 'Z', email: 'khachik@x.com',
      phone: null, position: null, branchId: null, departmentId: null,
      status: 'active', preassignedRole: null, terminatedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const users: User[] = [{ ...pending('acc1'), email: 'khachik@x.com' }]
    const repo = new InMemoryUserRepository(users, [emp])
    const r = await repo.assignRole({ uid: 'acc1', role: 'employee', employee: { mode: 'link' } }, actor)
    expect(r.value.employeeId).toBe('pending_hr1')
  })

  it('assignRole employee+create stamps employeeId === uid (doc id convention)', async () => {
    const users: User[] = [{ ...pending('a'), email: 'a@x.com' }]
    const repo = new InMemoryUserRepository(users, [])
    const r = await repo.assignRole(
      { uid: 'a', role: 'employee', employee: { mode: 'create', create: { firstName: 'I', lastName: 'P', email: 'a@x.com' } } },
      actor,
    )
    expect(r.value.employeeId).toBe('a')
  })

  it('assignRole to a non-employee role leaves employeeId unset', async () => {
    const users: User[] = [{ ...pending('a'), email: 'a@x.com' }]
    const repo = new InMemoryUserRepository(users, [])
    const r = await repo.assignRole({ uid: 'a', role: 'asset_admin' }, actor)
    expect(r.value.employeeId).toBeUndefined()
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

  // ── Invited employees (role granted BEFORE first sign-in) ──────────────────
  function emp(id: string, email: string, extra: Partial<Employee> = {}): Employee {
    return {
      id, firstName: id, lastName: 'X', email, phone: null, position: null,
      branchId: null, departmentId: null, status: 'active', terminatedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...extra,
    }
  }

  it('listInvitedEmployees returns active employees with no matching user account', async () => {
    const users: User[] = [{ ...pending('acc'), email: 'has@x.com', role: 'employee', status: 'active' }]
    const employees: Employee[] = [emp('e1', 'has@x.com'), emp('e2', 'nope@x.com')]
    const repo = new InMemoryUserRepository(users, employees)
    const invited = await repo.listInvitedEmployees!()
    // e1 has an account (has@x.com) → excluded; e2 is invited
    expect(invited.map(u => u.id)).toEqual(['e2'])
    expect(invited[0]).toMatchObject({ status: 'invited', role: 'employee', email: 'nope@x.com' })
  })

  it('listInvitedEmployees reflects a pre-assigned role and excludes terminated', async () => {
    const employees: Employee[] = [
      emp('e2', 'boss@x.com', { preassignedRole: 'asset_admin' }),
      emp('e3', 'gone@x.com', { status: 'terminated' }),
    ]
    const repo = new InMemoryUserRepository([], employees)
    const invited = await repo.listInvitedEmployees!()
    expect(invited.map(u => u.id)).toEqual(['e2'])
    expect(invited[0]!.role).toBe('asset_admin')
  })

  it('preassignRole writes preassignedRole on the employee + an audit row', async () => {
    const store = createInMemoryAuditStore()
    const employees: Employee[] = [emp('e2', 'boss@x.com')]
    const repo = new InMemoryUserRepository([], employees, inMemoryAuditContext(store))
    const r = await repo.preassignRole!('e2', 'asset_admin', actor)
    expect(r.value).toMatchObject({ id: 'e2', role: 'asset_admin', status: 'invited' })
    expect(employees[0]!.preassignedRole).toBe('asset_admin')
    expect(store.logs[0]).toMatchObject({ entityType: 'employee', action: 'role_assigned' })
  })
})
