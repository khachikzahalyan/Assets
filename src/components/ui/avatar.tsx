import { RoleIcon } from '@/components/ui/RoleIcon'
import type { Role } from '@/config/roles'

export interface AvatarUser {
  initials: string
  avatarColor: string
}

export interface AvatarProps {
  user: AvatarUser
  size?: 'sm' | 'md' | 'lg'
  /** When provided, renders a RoleIcon badge instead of initials. */
  role?: Role | null
}

const SIZE_PX = { sm: 28, md: 36, lg: 48 } as const

export function Avatar({ user, size = 'md', role }: AvatarProps) {
  if (role) {
    return (
      <span className="inline-flex flex-shrink-0">
        <RoleIcon role={role} size={SIZE_PX[size]} />
      </span>
    )
  }
  const sizes = {
    sm: 'w-7 h-7 text-10.5',
    md: 'w-9 h-9 text-12',
    lg: 'w-12 h-12 text-14',
  }
  return (
    <span className={`inline-flex items-center justify-center rounded-full text-white font-bold tracking-tight ${user.avatarColor} ${sizes[size]}`}>
      {user.initials}
    </span>
  )
}
