import { employeeInitials, employeeAvatarColor } from './employeeFormat'

export interface EmployeeAvatarProps {
  firstName: string
  lastName: string
  id: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'w-7 h-7 text-[12.5px]',
  md: 'w-9 h-9 text-[14px]',
  lg: 'w-12 h-12 text-[16px]',
} as const

export function EmployeeAvatar({ firstName, lastName, id, size = 'md' }: EmployeeAvatarProps) {
  const initials = employeeInitials(firstName, lastName)
  const colorClass = employeeAvatarColor(id)

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-full text-white font-bold tracking-tight select-none flex-shrink-0 ${colorClass} ${SIZES[size]}`}
    >
      {initials}
    </span>
  )
}
