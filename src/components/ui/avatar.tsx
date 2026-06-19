export interface AvatarUser {
  initials: string
  avatarColor: string
}

export interface AvatarProps {
  user: AvatarUser
  size?: 'sm' | 'md' | 'lg'
}

export function Avatar({ user, size = 'md' }: AvatarProps) {
  const sizes = {
    sm: 'w-7 h-7 text-[10.5px]',
    md: 'w-9 h-9 text-[12px]',
    lg: 'w-12 h-12 text-[14px]',
  }
  return (
    <span className={`inline-flex items-center justify-center rounded-full text-white font-bold tracking-tight ${user.avatarColor} ${sizes[size]}`}>
      {user.initials}
    </span>
  )
}
