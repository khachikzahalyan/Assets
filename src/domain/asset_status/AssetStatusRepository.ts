import type { AssetStatus, AssetStatusListQuery } from './types'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'

export interface CreateAssetStatusInput {
  name: string
  color: string
  isFinal: boolean
  sortOrder: number
}

export interface UpdateAssetStatusInput {
  name?: string
  color?: string
  isFinal?: boolean
  sortOrder?: number
}

export interface AssetStatusRepository {
  listAssetStatuses(query?: AssetStatusListQuery): Promise<AssetStatus[]>
  getAssetStatus(id: string): Promise<AssetStatus | null>
  isNameTaken(name: string, exceptId?: string): Promise<boolean>
  /** Count of assets with this statusId. */
  countReferences(id: string): Promise<number>
  /** New statuses are ALWAYS created with isSystem:false. */
  createAssetStatus(input: CreateAssetStatusInput, actor: Actor): Promise<AuditedResult<AssetStatus>>
  /** For a system status, isFinal/isSystem changes are ignored (display fields only). */
  updateAssetStatus(id: string, patch: UpdateAssetStatusInput, actor: Actor): Promise<AuditedResult<AssetStatus>>
  /** Throws SystemEntityProtectedError for system statuses; EntityInUseError when referenced. */
  deleteAssetStatus(id: string, actor: Actor): Promise<AuditedResult<{ id: string }>>
}
