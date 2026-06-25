import type {
  Employee, EmployeeStatus, EmployeeListQuery,
  EmployeeRepository, CreateEmployeeInput, UpdateEmployeeInput,
  LastSuperAdminCheck,
} from '@/domain/employee'
import { EmployeeArchiveError } from '@/domain/employee'
import type { Actor } from '@/domain/asset'
import { withAudit, type AuditContext, createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

function fullName(e: { firstName: string; lastName: string }): string {
  return `${e.firstName} ${e.lastName}`.trim()
}

/** In-memory read/write adapter for tests/dev. Mutates the shared employees array. */
export class InMemoryEmployeeRepository implements EmployeeRepository {
  constructor(
    private readonly employees: Employee[],
    private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
    private readonly lastSuperAdminCheck?: LastSuperAdminCheck,
  ) {}

  async listEmployees(query: EmployeeListQuery = {}): Promise<Employee[]> {
    const search = (query.search ?? '').trim().toLowerCase()
    return this.employees.filter(e => {
      if (query.status && query.status !== 'all' && e.status !== query.status) return false
      if (query.branchId && query.branchId !== 'all' && e.branchId !== query.branchId) return false
      if (query.departmentId && query.departmentId !== 'all' && e.departmentId !== query.departmentId) return false
      if (search) {
        const hay = [fullName(e), e.email, e.position].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(search)) return false
      }
      return true
    })
  }

  async getEmployee(id: string): Promise<Employee | null> {
    return this.employees.find(e => e.id === id) ?? null
  }

  async isEmailTaken(email: string, exceptId?: string): Promise<boolean> {
    const needle = email.trim().toLowerCase()
    return this.employees.some(e => e.email.toLowerCase() === needle && e.id !== exceptId)
  }

  async createEmployee(input: CreateEmployeeInput, actor: Actor) {
    if (this.employees.some(e => e.id === input.id)) throw new Error(`Employee already exists: ${input.id}`)
    if (await this.isEmailTaken(input.email)) throw new Error(`Email already in use: ${input.email}`)
    const now = new Date().toISOString()
    const employee: Employee = {
      id: input.id,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone ?? null,
      position: input.position ?? null,
      branchId: input.branchId ?? null,
      departmentId: input.departmentId ?? null,
      status: 'active',
      terminatedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    return withAudit(this.audit,
      {
        entityType: 'employee', entityId: input.id, action: 'created',
        actorUid: actor.uid, actorRole: actor.role,
        after: { id: input.id, email: input.email } as Record<string, unknown>,
      },
      async () => { this.employees.push(employee); return { value: employee } },
    )
  }

  async updateEmployee(id: string, patch: UpdateEmployeeInput, actor: Actor) {
    const idx = this.employees.findIndex(e => e.id === id)
    if (idx < 0) throw new Error(`Employee not found: ${id}`)
    if (patch.email && await this.isEmailTaken(patch.email, id)) {
      throw new Error(`Email already in use: ${patch.email}`)
    }
    const before = this.employees[idx]!
    const next: Employee = {
      ...before,
      ...stripUndefined(patch),
      updatedAt: new Date().toISOString(),
    }
    return withAudit(this.audit,
      {
        entityType: 'employee', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { email: before.email, position: before.position } as Record<string, unknown>,
        after: stripUndefined(patch) as Record<string, unknown>,
      },
      async () => { this.employees[idx] = next; return { value: next } },
    )
  }

  async setStatus(id: string, status: EmployeeStatus, actor: Actor) {
    const idx = this.employees.findIndex(e => e.id === id)
    if (idx < 0) throw new Error(`Employee not found: ${id}`)
    const before = this.employees[idx]!
    if (status === 'terminated') {
      if (id === actor.uid) throw new EmployeeArchiveError('self-archive')
      if (this.lastSuperAdminCheck && await this.lastSuperAdminCheck(id)) {
        throw new EmployeeArchiveError('last-super-admin')
      }
    }
    const now = new Date().toISOString()
    const next: Employee = {
      ...before,
      status,
      terminatedAt: status === 'terminated' ? now : null,
      updatedAt: now,
    }
    return withAudit(this.audit,
      {
        entityType: 'employee', entityId: id, action: status === 'terminated' ? 'terminated' : 'reactivated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { status: before.status }, after: { status },
      },
      async () => { this.employees[idx] = next; return { value: next } },
    )
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
