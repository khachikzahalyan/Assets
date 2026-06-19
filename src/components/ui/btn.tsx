import { type ReactNode } from 'react'

export interface BtnProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  title?: string
}

export function Btn({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  className = '',
  disabled,
  type = 'button',
  title,
}: BtnProps) {
  const variants = {
    primary:   'bg-[#F97316] text-white shadow-sm shadow-[#F97316]/20 hover:bg-[#EA580C] hover:shadow-md ring-1 ring-[#C2410C]/20 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(249,115,22,0.40)]',
    secondary: 'bg-[#1B1F24] border border-[#2A2F36] hover:border-[#3A4048] hover:bg-[#22272E] text-[#F8FAFC] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed',
    ghost:     'text-[#CBD5E1] hover:bg-[#22272E] hover:text-[#F8FAFC] disabled:opacity-50 disabled:cursor-not-allowed',
    danger:    'bg-[#1B1F24] border border-rose-800/60 text-[#FDA4AF] hover:bg-rose-950/40 hover:border-rose-700/60 shadow-sm disabled:opacity-50',
  }
  const sizes = {
    sm: 'h-7 px-2.5 text-[12px] gap-1',
    md: 'h-9 px-3.5 text-sm gap-1.5',
    lg: 'h-10 px-4 text-sm gap-1.5',
  }
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`inline-flex items-center justify-center rounded-lg font-medium tracking-tight transition-all duration-150 ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
