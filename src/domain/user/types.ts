import type { Role } from '@/config/roles'

/** 'invited' is a VIRTUAL status - an /employees record with no user account yet
 *  (never signed in). Such rows never exist in /users; RolesPage synthesizes them
 *  so roles can be granted BEFORE first sign-in (owner rule). */
export const USER_STATUSES = ['no-role', 'active', 'terminated', 'invited'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export function isUserStatus(v: string): v is UserStatus {
  return (USER_STATUSES as readonly string[]).includes(v)
}

/**
 * A user account. Mirrors Firestore users/{uid}.
 * INVARIANT: `id` === the person's Firebase Auth uid.
 * `role` is null while status is 'no-role' (awaiting a super_admin grant).
 * Timestamps are ISO strings in the domain.
 */
export interface User {
  id: string
  email: string
  displayName: string
  role: Role | null
  status: UserStatus
  /** When the no-role record was first created (self-claim). May be absent on legacy docs. */
  createdAt: string | null
}

export interface PendingUser extends User {
  status: 'no-role'
  role: null
}
