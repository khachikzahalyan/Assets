import type { Role } from '@/config/roles'
import { RoleIcon } from '@/components/ui/RoleIcon'

export interface EmployeeAvatarProps {
  /** Kept for backward-compat with callers; no longer used for rendering. */
  firstName?: string
  lastName?: string
  id?: string
  size?: 'sm' | 'md' | 'lg'
  /** Explicit role for the avatar icon; defaults to 'employee' when omitted. */
  role?: Role
}

const SIZE_PX = { sm: 28, md: 36, lg: 48 } as const

export function EmployeeAvatar({ size = 'md', role }: EmployeeAvatarProps) {
  return (
    <span aria-hidden="true" className="inline-flex flex-shrink-0">
      <RoleIcon role={role ?? 'employee'} size={SIZE_PX[size]} />
    </span>
  )
}
