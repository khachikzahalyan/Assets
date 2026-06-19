import type { Department, DepartmentListQuery } from './types'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'

export interface CreateDepartmentInput { name: string }
export interface UpdateDepartmentInput { name?: string }

export interface DepartmentRepository {
  listDepartments(query?: DepartmentListQuery): Promise<Department[]>
  getDepartment(id: string): Promise<Department | null>
  isNameTaken(name: string, exceptId?: string): Promise<boolean>
  /** Count of docs referencing this department (assets.deptId, employees.departmentId). */
  countReferences(id: string): Promise<number>
  createDepartment(input: CreateDepartmentInput, actor: Actor): Promise<AuditedResult<Department>>
  updateDepartment(id: string, patch: UpdateDepartmentInput, actor: Actor): Promise<AuditedResult<Department>>
  /** Throws EntityInUseError when countReferences > 0; otherwise deletes + one audit entry. */
  deleteDepartment(id: string, actor: Actor): Promise<AuditedResult<{ id: string }>>
}
