import type { User, PendingUser, UserRepository, AssignRoleInput, UserListQuery } from '@/domain/user'
import { RoleLockoutError } from '@/domain/user'
import type { Employee } from '@/domain/employee'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import { withAudit, type AuditContext, createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

/** In-memory read/write adapter for tests/dev. Mutates the shared users/employees arrays. */
export class InMemoryUserRepository implements UserRepository {
  constructor(
    private readonly users: User[],
    private readonly employees: Employee[] = [],
    private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
  ) {}

  async listPendingUsers(): Promise<PendingUser[]> {
    return this.users.filter((u): u is PendingUser => u.status === 'no-role')
  }

  async listUsers(query?: UserListQuery): Promise<User[]> {
    let rows = [...this.users]
    if (query?.role === 'no-role') rows = rows.filter(u => u.role === null)
    else if (query?.role) rows = rows.filter(u => u.role === query.role)
    if (query?.status) rows = rows.filter(u => u.status === query.status)
    return rows.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }

  /** Count active super_admins, optionally excluding one uid (the one being changed). */
  private countSuperAdmins(exceptUid?: string): number {
    return this.users.filter(u =>
      u.role === 'super_admin' && u.status === 'active' && u.id !== exceptUid,
    ).length
  }

  async assignRole(input: AssignRoleInput, actor: Actor): Promise<AuditedResult<User>> {
    const idx = this.users.findIndex(u => u.id === input.uid)
    if (idx < 0) throw new Error(`User not found: ${input.uid}`)
    const before = this.users[idx]!

    // ── Lockout guard ──────────────────────────────────────────────────────
    const isDemotingASuper = before.role === 'super_admin' && input.role !== 'super_admin'
    if (isDemotingASuper) {
      if (input.uid === actor.uid) throw new RoleLockoutError('self-demotion')
      // would this drop active super_admins to zero?
      if (this.countSuperAdmins(input.uid) === 0) throw new RoleLockoutError('last-super-admin')
    }

    const next: User = { ...before, role: input.role, status: 'active' }

    // STEP 1 — create the employee doc FIRST. If this throws (e.g. empty email),
    // we bail BEFORE granting the role, so the user stays pending/retryable and no
    // partial promotion is left behind.
    if (input.role === 'employee' && input.employee?.mode === 'create') {
      const create = input.employee.create
      if (!create) throw new Error('employee.create payload required when mode === "create"')
      const email = typeof create.email === 'string' ? create.email.trim() : ''
      if (!email) throw new Error('employee email required')
      if (!this.employees.some(e => e.id === input.uid)) {
        const now = new Date().toISOString()
        const employee: Employee = {
          id: input.uid,
          firstName: create.firstName,
          lastName: create.lastName,
          email,
          phone: null,
          position: null,
          branchId: null,
          departmentId: null,
          status: 'active',
          terminatedAt: null,
          createdAt: now,
          updatedAt: now,
        }
        await withAudit(this.audit,
          {
            entityType: 'employee', entityId: input.uid, action: 'created',
            actorUid: actor.uid, actorRole: actor.role,
            after: { id: input.uid, email },
          },
          async () => { this.employees.push(employee); return { value: employee } },
        )
      }
    }

    // STEP 2 — grant the role.
    const result = await withAudit(this.audit,
      {
        entityType: 'user', entityId: input.uid, action: 'role_assigned',
        actorUid: actor.uid, actorRole: actor.role,
        before: { role: before.role, status: before.status },
        after: { role: input.role, status: 'active' },
      },
      async () => { this.users[idx] = next; return { value: next } },
    )

    return { value: result.value, auditId: result.auditId }
  }
}
