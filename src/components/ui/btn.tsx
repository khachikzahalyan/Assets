import { type ReactNode, type ButtonHTMLAttributes, type MouseEvent } from 'react'

export interface BtnProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  children: ReactNode
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
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
  ...rest
}: BtnProps) {
  const variants = {
    primary:   'bg-accent text-white shadow-sm shadow-accent/20 hover:bg-accent-hover hover:shadow-md ring-1 ring-accent-dark/20 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(249,115,22,0.40)]',
    secondary: 'bg-surface border border-border hover:border-border-strong hover:bg-surface-2 text-text-primary shadow-sm disabled:opacity-50 disabled:cursor-not-allowed',
    ghost:     'text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed',
    danger:    'bg-surface border border-rose-800/60 text-[#FDA4AF] hover:bg-rose-950/40 hover:border-rose-700/60 shadow-sm disabled:opacity-50',
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
      {...rest}
    >
      {children}
    </button>
  )
}
