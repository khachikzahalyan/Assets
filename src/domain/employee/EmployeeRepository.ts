import type { Employee, EmployeeListQuery } from './types'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'

/**
 * Thrown by setStatus when archiving would lock the actor out of the system:
 * - 'self-archive': the actor is terminating their own employee record.
 * - 'last-super-admin': terminating this employee would leave zero active super_admins.
 */
export class EmployeeArchiveError extends Error {
  constructor(public readonly reason: 'self-archive' | 'last-super-admin') {
    super(`Employee archive blocked: ${reason}`)
    this.name = 'EmployeeArchiveError'
  }
}

/** Returns true if terminating `targetUid` would leave zero ACTIVE super_admins. */
export type LastSuperAdminCheck = (targetUid: string) => Promise<boolean>

export interface CreateEmployeeInput {
  /** The record key === the person's Firebase Auth uid. */
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  position?: string | null
  branchId?: string | null
  departmentId?: string | null
}

export interface UpdateEmployeeInput {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string | null
  position?: string | null
  branchId?: string | null
  departmentId?: string | null
}

export interface EmployeeRepository {
  listEmployees(query?: EmployeeListQuery): Promise<Employee[]>
  /** Read the archive set (former_employees). */
  listFormerEmployees(query?: EmployeeListQuery): Promise<Employee[]>
  getEmployee(id: string): Promise<Employee | null>
  /** Case-insensitive uniqueness check. */
  isEmailTaken(email: string, exceptId?: string): Promise<boolean>
  createEmployee(input: CreateEmployeeInput, actor: Actor): Promise<AuditedResult<Employee>>
  updateEmployee(id: string, patch: UpdateEmployeeInput, actor: Actor): Promise<AuditedResult<Employee>>
  /** Move active → former (terminate). Atomic. Audits 'terminated'.
   *  Throws EmployeeArchiveError on self-archive or last-super-admin. */
  archiveEmployee(id: string, actor: Actor): Promise<AuditedResult<Employee>>
  /** Move former → active (reactivate). Atomic. Audits 'reactivated'. */
  restoreEmployee(id: string, actor: Actor): Promise<AuditedResult<Employee>>
}
