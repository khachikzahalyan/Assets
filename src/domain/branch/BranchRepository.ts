import type { Branch, BranchType, BranchListQuery } from './types'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'

export interface CreateBranchInput {
  name: string
  type: BranchType
  city?: string | null
  address?: string | null
}
export interface UpdateBranchInput {
  name?: string
  type?: BranchType
  city?: string | null
  address?: string | null
}

export interface BranchRepository {
  listBranches(query?: BranchListQuery): Promise<Branch[]>
  getBranch(id: string): Promise<Branch | null>
  isNameTaken(name: string, exceptId?: string): Promise<boolean>
  /** Count of docs referencing this branch (assets.branchId, employees.branchId, assignments.assignedToBranchId). */
  countReferences(id: string): Promise<number>
  createBranch(input: CreateBranchInput, actor: Actor): Promise<AuditedResult<Branch>>
  updateBranch(id: string, patch: UpdateBranchInput, actor: Actor): Promise<AuditedResult<Branch>>
  /** Throws EntityInUseError when countReferences > 0; otherwise deletes + one audit entry. */
  deleteBranch(id: string, actor: Actor): Promise<AuditedResult<{ id: string }>>
}
