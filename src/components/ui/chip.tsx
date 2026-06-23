import { type ReactNode } from 'react'

export type ChipColor =
  | 'gray'
  | 'green'
  | 'blue'
  | 'red'
  | 'amber'
  | 'orange'
  | 'indigo'
  | 'violet'
  | 'teal'
  | 'cyan'

export interface ChipProps {
  color?: ChipColor
  dot?: boolean
  size?: 'sm' | 'md'
  children: ReactNode
}

export function Chip({ color = 'gray', dot = false, size = 'md', children }: ChipProps) {
  const palette: Record<ChipColor, string> = {
    gray:   'bg-surface-2 text-text-tertiary border-border',
    green:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    blue:   'bg-sky-500/10 text-sky-300 border-sky-500/30',
    red:    'bg-rose-500/10 text-rose-300 border-rose-500/30',
    amber:  'bg-amber-500/15 text-amber-300 border-amber-500/30',
    orange: 'bg-accent/10 text-accent-light border-accent/30',
    indigo: 'bg-[rgba(249,115,22,0.12)] text-accent border-[rgba(249,115,22,0.30)]',
    violet: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    teal:   'bg-teal-500/15 text-teal-300 border-teal-500/30',
    cyan:   'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  }
  const dotColor: Record<ChipColor, string> = {
    gray:   'bg-slate-400',
    green:  'bg-emerald-500',
    blue:   'bg-sky-500',
    red:    'bg-rose-500',
    amber:  'bg-amber-500',
    orange: 'bg-orange-500',
    indigo: 'bg-accent',
    violet: 'bg-violet-500',
    teal:   'bg-teal-500',
    cyan:   'bg-cyan-500',
  }
  const sizing = size === 'sm'
    ? 'px-1.5 py-0.5 text-[10.5px] tracking-tight'
    : 'px-2 py-0.5 text-[13px] tracking-wide'
  return (
    <span className={`inline-flex items-center gap-1 rounded-md ${sizing} font-semibold border ${palette[color] ?? palette.gray}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColor[color] ?? dotColor.gray}`} />}
      {children}
    </span>
  )
}
