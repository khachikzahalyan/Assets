import type { Assignment } from './types'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'

export interface AssignInput {
  assetId: string
  mode: Assignment['mode']
  /** Required when mode === 'employee'. */
  employeeId?: string
  /** Required when mode === 'branch'. */
  branchId?: string
  /** Storage path of an already-uploaded act scan, or null. */
  actStoragePath?: string | null
  transferComment?: string | null
  /** Employee email + display name — used ONLY to enqueue mail (employee mode). */
  employeeEmail?: string | null
  employeeName?: string | null
  /** Asset inventory code — included in the mail body. */
  invCode?: string | null
}

export interface AssignmentRepository {
  /** Assign an asset (employee|branch). Atomic: assignment doc + asset cache + mail (employee) + 1 audit entry. */
  assign(input: AssignInput, actor: Actor): Promise<AuditedResult<Assignment>>
  /** Return the asset's active assignment to the warehouse. Atomic: endedAt + asset cache + 1 audit entry. */
  returnAsset(assetId: string, actor: Actor): Promise<AuditedResult<Assignment>>
  /** All assignment history for an asset, newest first. */
  listAssignments(assetId: string): Promise<Assignment[]>
  /** The single active (endedAt == null) assignment for an asset, or null. */
  getActiveAssignment(assetId: string): Promise<Assignment | null>
}
