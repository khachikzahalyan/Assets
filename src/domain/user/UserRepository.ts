import type { Role } from '@/config/roles'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import type { PendingUser, User } from './types'

/** Optional employee link/create directive when promoting to the `employee` role. */
export interface PromoteEmployeeOpts {
  /** 'link' = do not create a doc (link existing or none); 'create' = create employees/{uid}. */
  mode: 'link' | 'create'
  /** Required when mode === 'create'. */
  create?: { firstName: string; lastName: string; email: string }
}

export interface AssignRoleInput {
  uid: string
  role: Role
  /** Only honored when role === 'employee'. */
  employee?: PromoteEmployeeOpts
}

/** Filter for the full-roster read. All fields optional → returns everyone. */
export interface UserListQuery {
  /** Restrict to a single role. Omit for all. `'no-role'` matches role === null. */
  role?: Role | 'no-role'
  status?: import('./types').UserStatus
}

/**
 * Thrown by assignRole when a change would leave the system with zero super_admins
 * or when a super_admin tries to demote their OWN super_admin role (lockout guard).
 * Callers should surface input.lockoutReason to the user, not a generic failure.
 */
export class RoleLockoutError extends Error {
  constructor(public readonly reason: 'self-demotion' | 'last-super-admin') {
    super(`Role change blocked: ${reason}`)
    this.name = 'RoleLockoutError'
  }
}

export interface UserRepository {
  /** super_admin only — users awaiting a role (status === 'no-role'). */
  listPendingUsers(): Promise<PendingUser[]>
  /** super_admin only — the full user roster, newest first, optionally filtered. */
  listUsers(query?: UserListQuery): Promise<User[]>
  /**
   * super_admin only — assign a role and flip status to 'active', auditing the
   * change (entityType:'user', action:'role_assigned'). If role==='employee' and
   * employee opts say 'create', also create employees/{uid} (separately audited).
   * GUARD: throws RoleLockoutError('self-demotion') if actor demotes their own
   * super_admin role; throws RoleLockoutError('last-super-admin') if the change
   * would drop the super_admin count to zero.
   */
  assignRole(input: AssignRoleInput, actor: Actor): Promise<AuditedResult<User>>
}
