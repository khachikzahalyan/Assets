import type {
  Employee, EmployeeListQuery,
  EmployeeRepository, CreateEmployeeInput, UpdateEmployeeInput,
  LastSuperAdminCheck, ActiveAssetsCheck,
} from '@/domain/employee'
import { EmployeeArchiveError, EmployeeEmailTerminatedError } from '@/domain/employee'
import type { Actor } from '@/domain/asset'
import { withAudit, type AuditContext, createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { OnEmployeeDeptChange } from './firestoreEmployeeRepository'

function fullName(e: { firstName: string; lastName: string }): string {
  return `${e.firstName} ${e.lastName}`.trim()
}

/** In-memory read/write adapter for tests/dev. Mutates the shared employees array. */
export class InMemoryEmployeeRepository implements EmployeeRepository {
  constructor(
    private readonly employees: Employee[],
    private readonly former: Employee[] = [],
    private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
    private readonly lastSuperAdminCheck?: LastSuperAdminCheck,
    private readonly activeAssetsCheck?: ActiveAssetsCheck,
    private readonly onDeptChange?: OnEmployeeDeptChange,
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

  async listFormerEmployees(query: EmployeeListQuery = {}): Promise<Employee[]> {
    // Primary: in-place terminated docs in employees array
    const inPlaceTerminated = this.employees.filter(e => e.status === 'terminated')

    // Legacy: former array (backward compat for old move-semantics data)
    // Deduplicate: employees doc wins over former doc with same id
    const byId = new Map<string, Employee>()
    for (const e of this.former) byId.set(e.id, e)
    for (const e of inPlaceTerminated) byId.set(e.id, e) // overwrites if same id

    const search = (query.search ?? '').trim().toLowerCase()
    return Array.from(byId.values()).filter(e => {
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

  async findByEmail(email: string): Promise<Employee | null> {
    const needle = email.trim().toLowerCase()
    // Search active employees first
    const inEmp = this.employees.find(e => e.email.toLowerCase() === needle)
    if (inEmp) return inEmp
    // Legacy fallback: former array
    return this.former.find(e => e.email.toLowerCase() === needle) ?? null
  }

  async isEmailTaken(email: string, exceptId?: string): Promise<boolean> {
    const needle = email.trim().toLowerCase()
    return this.employees.some(e => e.email.toLowerCase() === needle && e.id !== exceptId)
  }

  async createEmployee(input: CreateEmployeeInput, actor: Actor) {
    if (this.employees.some(e => e.id === input.id)) throw new Error(`Employee already exists: ${input.id}`)

    // Check terminated email BEFORE generic email-taken check
    const emailMatch = await this.findByEmail(input.email)
    if (emailMatch) {
      if (emailMatch.status === 'terminated') {
        throw new EmployeeEmailTerminatedError(emailMatch.id, input.email)
      }
      throw new Error(`Email already in use: ${input.email}`)
    }

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
        actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
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

    // Build before-snapshot covering exactly the fields present in the patch.
    const beforeSnapshot: Record<string, unknown> = {}
    if (patch.email !== undefined) beforeSnapshot.email = before.email
    if (patch.position !== undefined) beforeSnapshot.position = before.position
    if (patch.phone !== undefined) beforeSnapshot.phone = before.phone
    if (patch.departmentId !== undefined) beforeSnapshot.departmentId = before.departmentId
    if (patch.branchId !== undefined) beforeSnapshot.branchId = before.branchId
    if (patch.firstName !== undefined) beforeSnapshot.firstName = before.firstName
    if (patch.lastName !== undefined) beforeSnapshot.lastName = before.lastName

    const r = await withAudit(this.audit,
      {
        entityType: 'employee', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
        before: beforeSnapshot,
        after: stripUndefined(patch) as Record<string, unknown>,
      },
      async () => { this.employees[idx] = next; return { value: next } },
    )

    // Propagate department change to assigned assets (denormalized deptId field).
    if (patch.departmentId !== undefined && this.onDeptChange) {
      await this.onDeptChange(id, patch.departmentId ?? null)
    }

    return r
  }

  async archiveEmployee(id: string, actor: Actor) {
    const idx = this.employees.findIndex(e => e.id === id)
    if (idx < 0) throw new Error(`Employee not found: ${id}`)
    if (id === actor.uid) throw new EmployeeArchiveError('self-archive')
    if (this.lastSuperAdminCheck && await this.lastSuperAdminCheck(id)) {
      throw new EmployeeArchiveError('last-super-admin')
    }
    if (this.activeAssetsCheck && await this.activeAssetsCheck(id)) {
      throw new EmployeeArchiveError('active-assets')
    }
    const before = this.employees[idx]!
    const now = new Date().toISOString()
    // In-place status flip: update the record in employees array (do NOT splice/move)
    const terminated: Employee = { ...before, status: 'terminated', terminatedAt: now, updatedAt: now }
    return withAudit(this.audit,
      {
        entityType: 'employee', entityId: id, action: 'terminated',
        actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
        before: { status: before.status }, after: { status: 'terminated' },
      },
      async () => { this.employees[idx] = terminated; return { value: terminated } },
    )
  }

  async restoreEmployee(id: string, actor: Actor) {
    // Primary path: find in employees array (in-place terminated)
    const empIdx = this.employees.findIndex(e => e.id === id)
    if (empIdx >= 0) {
      const before = this.employees[empIdx]!
      const now = new Date().toISOString()
      const restored: Employee = { ...before, status: 'active', terminatedAt: null, updatedAt: now }
      return withAudit(this.audit,
        {
          entityType: 'employee', entityId: id, action: 'reactivated',
          actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
          before: { status: 'terminated' }, after: { status: 'active' },
        },
        async () => { this.employees[empIdx] = restored; return { value: restored } },
      )
    }

    // Legacy fallback: find in former array (old move-semantics data)
    const formerIdx = this.former.findIndex(e => e.id === id)
    if (formerIdx < 0) throw new Error(`Former employee not found: ${id}`)
    const before = this.former[formerIdx]!
    const now = new Date().toISOString()
    const restored: Employee = { ...before, status: 'active', terminatedAt: null, updatedAt: now }
    return withAudit(this.audit,
      {
        entityType: 'employee', entityId: id, action: 'reactivated',
        actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
        before: { status: 'terminated' }, after: { status: 'active' },
      },
      async () => { this.former.splice(formerIdx, 1); this.employees.push(restored); return { value: restored } },
    )
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
