import type { Role } from '@/config/roles'

export type AuditEntityType =
  | 'asset' | 'assignment' | 'upgrade' | 'license' | 'server_license' | 'employee' | 'user'
  | 'branch' | 'department' | 'category' | 'asset_status' | 'settings'

export const AUDIT_ACTIONS = [
  'created', 'updated', 'status_changed', 'assigned', 'returned',
  'transferred', 'upgrade_added', 'disposed', 'sent_to_repair', 'repair_completed',
  'terminated', 'reactivated', 'role_assigned', 'deleted',
  'key_revealed', 'license_decoupled', 'license_retired_with_asset', 'key_rotated',
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
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  comment?: string | null
}

export interface AuditedResult<T> {
  value: T
  auditId: string
}
