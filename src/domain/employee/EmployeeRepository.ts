import type { Employee, EmployeeListQuery } from './types'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'

/**
 * Thrown by archiveEmployee when the operation is blocked:
 * - 'self-archive': the actor is terminating their own employee record.
 * - 'last-super-admin': terminating this employee would leave zero active super_admins.
 * - 'active-assets': the employee still has assets assigned and must return them first.
 */
export class EmployeeArchiveError extends Error {
  constructor(public readonly reason: 'self-archive' | 'last-super-admin' | 'active-assets') {
    super(`Employee archive blocked: ${reason}`)
    this.name = 'EmployeeArchiveError'
  }
}

/**
 * Thrown by createEmployee when the email belongs to a terminated employee.
 * The caller should offer a restore flow rather than creating a duplicate record.
 */
export class EmployeeEmailTerminatedError extends Error {
  constructor(
    public readonly employeeId: string,
    public readonly email: string,
  ) {
    super(`Employee with this email is terminated: ${email}`)
    this.name = 'EmployeeEmailTerminatedError'
  }
}

/** Returns true if terminating `targetUid` would leave zero ACTIVE super_admins. */
export type LastSuperAdminCheck = (targetUid: string) => Promise<boolean>

/** Returns true if `employeeId` currently has one or more active asset assignments. */
export type ActiveAssetsCheck = (employeeId: string) => Promise<boolean>

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
  /** Returns union of in-place terminated employees + legacy former_employees docs (deduplicated). */
  listFormerEmployees(query?: EmployeeListQuery): Promise<Employee[]>
  getEmployee(id: string): Promise<Employee | null>
  /** Case-insensitive search across active employees; falls back to legacy former_employees. */
  findByEmail(email: string): Promise<Employee | null>
  /** Case-insensitive uniqueness check. */
  isEmailTaken(email: string, exceptId?: string): Promise<boolean>
  createEmployee(input: CreateEmployeeInput, actor: Actor): Promise<AuditedResult<Employee>>
  updateEmployee(id: string, patch: UpdateEmployeeInput, actor: Actor): Promise<AuditedResult<Employee>>
  /** Flip status to terminated in-place (no collection move). Audits 'terminated'.
   *  Throws EmployeeArchiveError on self-archive, last-super-admin, or active-assets. */
  archiveEmployee(id: string, actor: Actor): Promise<AuditedResult<Employee>>
  /** Flip status back to active (primary) or move from legacy former_employees (fallback). Audits 'reactivated'. */
  restoreEmployee(id: string, actor: Actor): Promise<AuditedResult<Employee>>
}
