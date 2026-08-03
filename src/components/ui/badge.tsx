import { type ReactNode } from 'react'

export interface BadgeProps {
  children: ReactNode
  tone?: 'slate' | 'indigo' | 'emerald' | 'rose' | 'amber'
  className?: string
}

export function Badge({ children, tone = 'slate', className = '' }: BadgeProps) {
  const tones = {
    slate:   'bg-surface-2 text-text-secondary',
    indigo:  'bg-[rgba(249,115,22,0.12)] text-accent-light',
    emerald: 'bg-emerald-950/60 light:bg-emerald-50 text-emerald-300 light:text-emerald-700',
    rose:    'bg-rose-950/60 light:bg-rose-50 text-[#FDA4AF] light:text-rose-700',
    amber:   'bg-amber-950/60 light:bg-amber-50 text-amber-300 light:text-amber-700',
  }
  return (
    <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-10.5 font-bold tabular-nums ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}
