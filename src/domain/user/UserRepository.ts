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

export interface UserRepository {
  /** super_admin only — users awaiting a role (status === 'no-role'). */
  listPendingUsers(): Promise<PendingUser[]>
  /**
   * super_admin only — assign a role and flip status to 'active', auditing the
   * change (entityType:'user', action:'role_assigned'). If role==='employee' and
   * employee opts say 'create', also create employees/{uid} (separately audited).
   */
  assignRole(input: AssignRoleInput, actor: Actor): Promise<AuditedResult<User>>
}
