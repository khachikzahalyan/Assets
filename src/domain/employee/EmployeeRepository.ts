import type { Employee, EmployeeStatus, EmployeeListQuery } from './types'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'

export interface CreateEmployeeInput {
  /** The record key === the person's Firebase Auth uid. */
  id: string
  firstName: string
  lastName: string
  email: string
  position?: string | null
  branchId?: string | null
  departmentId?: string | null
}

export interface UpdateEmployeeInput {
  firstName?: string
  lastName?: string
  email?: string
  position?: string | null
  branchId?: string | null
  departmentId?: string | null
}

export interface EmployeeRepository {
  listEmployees(query?: EmployeeListQuery): Promise<Employee[]>
  getEmployee(id: string): Promise<Employee | null>
  /** Case-insensitive uniqueness check. */
  isEmailTaken(email: string, exceptId?: string): Promise<boolean>
  createEmployee(input: CreateEmployeeInput, actor: Actor): Promise<AuditedResult<Employee>>
  updateEmployee(id: string, patch: UpdateEmployeeInput, actor: Actor): Promise<AuditedResult<Employee>>
  /** Terminate (stamps terminatedAt) or reactivate (clears it). */
  setStatus(id: string, status: EmployeeStatus, actor: Actor): Promise<AuditedResult<Employee>>
}
