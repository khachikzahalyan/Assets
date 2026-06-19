import type { User, PendingUser, UserRepository, AssignRoleInput } from '@/domain/user'
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

  async assignRole(input: AssignRoleInput, actor: Actor): Promise<AuditedResult<User>> {
    const idx = this.users.findIndex(u => u.id === input.uid)
    if (idx < 0) throw new Error(`User not found: ${input.uid}`)
    const before = this.users[idx]!
    const next: User = { ...before, role: input.role, status: 'active' }

    const result = await withAudit(this.audit,
      {
        entityType: 'user', entityId: input.uid, action: 'role_assigned',
        actorUid: actor.uid, actorRole: actor.role,
        before: { role: before.role, status: before.status },
        after: { role: input.role, status: 'active' },
      },
      async () => { this.users[idx] = next; return { value: next } },
    )

    if (input.role === 'employee' && input.employee?.mode === 'create') {
      const create = input.employee.create
      if (!create) throw new Error('employee.create payload required when mode === "create"')
      if (!this.employees.some(e => e.id === input.uid)) {
        const now = new Date().toISOString()
        const employee: Employee = {
          id: input.uid,
          firstName: create.firstName,
          lastName: create.lastName,
          email: create.email,
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
            after: { id: input.uid, email: create.email },
          },
          async () => { this.employees.push(employee); return { value: employee } },
        )
      }
    }

    return { value: result.value, auditId: result.auditId }
  }
}
