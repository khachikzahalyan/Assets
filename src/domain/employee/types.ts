export const EMPLOYEE_STATUSES = ['active', 'terminated'] as const
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number]

export function isEmployeeStatus(v: string): v is EmployeeStatus {
  return (EMPLOYEE_STATUSES as readonly string[]).includes(v)
}

/**
 * A person. Mirrors Firestore employees/{uid}.
 * INVARIANT: `id` === the person's Firebase Auth uid === users/{uid} id.
 * This makes the self-service rules (assignment.employeeId == request.auth.uid) correct.
 * Timestamps are ISO strings in the domain.
 */
export interface Employee {
  /** === the person's Firebase Auth uid === users/{uid} id (see interface invariant). */
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  position: string | null
  branchId: string | null
  departmentId: string | null
  status: EmployeeStatus
  terminatedAt: string | null
  createdAt: string
  updatedAt: string
}

export type SortValue =
  | 'updated_desc'
  | 'updated_asc'
  | 'name_asc'
  | 'name_desc'
  | 'dept_asc'
  | 'assets_desc'

export interface EmployeeListQuery {
  status?: EmployeeStatus | 'all'
  branchId?: string | 'all'
  departmentId?: string | 'all'
  search?: string
  sort?: SortValue
}
