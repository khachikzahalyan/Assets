import type { Role } from '@/config/roles'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import type { PendingUser, User, UserStatus } from './types'

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

/**
 * Filter for the full-roster read. All fields optional → returns everyone.
 * Filter fields are honored by both adapters and reserved for future server-side
 * filtering/pagination; the current RolesPage fetches all + filters client-side
 * (matching the PendingUsersPage convention).
 */
export interface UserListQuery {
  /** Restrict to a single role. Omit for all. `'no-role'` matches role === null. */
  role?: Role | 'no-role'
  status?: UserStatus
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
  /** Count ACTIVE super_admins, optionally excluding one uid. Used by lockout guards. */
  countSuperAdmins(exceptUid?: string): Promise<number>
  /**
   * ACTIVE employees with NO user account yet (email not present in /users),
   * mapped to virtual User rows with status 'invited' and role =
   * preassignedRole ?? 'employee'. Lets /roles show and manage people who have
   * never signed in. Optional: legacy adapters/mocks may omit it.
   */
  listInvitedEmployees?(): Promise<User[]>
  /**
   * Pre-assign a role to an INVITED employee (no account yet): writes
   * employees/{id}.preassignedRole (audited). The beforeCreate trigger applies
   * it when the person first signs in. Optional: legacy adapters may omit it.
   */
  preassignRole?(employeeId: string, role: Role, actor: Actor): Promise<AuditedResult<User>>
}
