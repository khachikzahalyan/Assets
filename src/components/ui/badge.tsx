import { type ReactNode } from 'react'

export interface BadgeProps {
  children: ReactNode
  tone?: 'slate' | 'indigo' | 'emerald' | 'rose' | 'amber'
  className?: string
}

export function Badge({ children, tone = 'slate', className = '' }: BadgeProps) {
  const tones = {
    slate:   'bg-[#22272E] text-[#CBD5E1]',
    indigo:  'bg-[rgba(249,115,22,0.12)] text-[#FB923C]',
    emerald: 'bg-emerald-950/60 text-emerald-300',
    rose:    'bg-rose-950/60 text-[#FDA4AF]',
    amber:   'bg-amber-950/60 text-amber-300',
  }
  return (
    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10.5px] font-bold tabular-nums ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}
