import type { Role } from '@/config/roles'

export type AuditEntityType =
  | 'asset' | 'assignment' | 'upgrade' | 'part' | 'part_movement'
  | 'license' | 'server_license' | 'employee' | 'user'
  | 'branch' | 'department' | 'category' | 'categoryGroup' | 'asset_status' | 'settings' | 'subscription'
  | 'part_category'

export const AUDIT_ACTIONS = [
  'created', 'updated', 'status_changed', 'assigned', 'returned',
  'transferred', 'upgrade_added', 'disposed', 'sent_to_repair', 'repair_completed',
  'terminated', 'reactivated', 'role_assigned', 'deleted',
  'key_revealed', 'license_decoupled', 'license_retired_with_asset', 'key_rotated',
  'activated', 'subscription_created', 'subscription_updated', 'subscription_assignees_changed',
  'part_received', 'part_installed', 'part_uninstalled', 'part_scrapped', 'part_returned', 'gpu_created',
  'part_serviced',
  /**
   * Generic audit action for createModelSku when categoryId !== 'gpu'.
   * GPU SKUs continue to write 'gpu_created' for byte-for-byte backwards compatibility
   * of the existing audit trail. Any future models-behavior category (e.g. 'dock')
   * writes this action instead so new categories don't inherit GPU semantics.
   */
  'model_sku_created',
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export function isAuditAction(v: string): v is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(v)
}

export interface AuditLog {
  id: string
  entityType: AuditEntityType
  entityId: string
  action: AuditAction
  actorUid: string
  actorRole: Role
  /**
   * Denormalized display name of the actor at the time of the write.
   * Present on all NEW docs (post-denormalization). Old docs written before
   * this feature land will have this field absent (undefined) — callers must
   * treat undefined the same as null (no name known).
   */
  actorName?: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  comment: string | null
  at: string
}

export interface AuditSpec {
  entityType: AuditEntityType
  entityId: string
  action: AuditAction
  actorUid: string
  actorRole: Role
  /**
   * Pass `actor.displayName` here to have withAudit denormalize it into the
   * audit_log doc. Optional — omitting it is backwards-compatible.
   */
  actorName?: string | null
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  comment?: string | null
}

export interface AuditedResult<T> {
  value: T
  auditId: string
}
