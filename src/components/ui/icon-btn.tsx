import { Icon } from './icon'

export interface IconBtnProps {
  icon: string
  onClick?: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg'
  tone?: 'slate' | 'rose' | 'indigo'
  className?: string
  disabled?: boolean
}

export function IconBtn({
  icon,
  onClick,
  title,
  size = 'md',
  tone = 'slate',
  className = '',
  disabled,
}: IconBtnProps) {
  const tones = {
    slate:  'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#22272E]',
    rose:   'text-[#FDA4AF] hover:text-[#FDA4AF] hover:bg-rose-950/40',
    indigo: 'text-[#F97316] hover:text-[#FB923C] hover:bg-[rgba(249,115,22,0.12)]',
  }
  const sizes = { sm: 'w-7 h-7', md: 'w-8 h-8', lg: 'w-9 h-9' }
  const iconSize = { sm: 13, md: 15, lg: 17 }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed ${sizes[size]} ${tones[tone]} ${className}`}
    >
      <Icon name={icon} size={iconSize[size]} />
    </button>
  )
}
