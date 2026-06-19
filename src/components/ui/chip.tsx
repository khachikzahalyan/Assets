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
    gray:   'bg-slate-800 text-[#64748B] border-slate-700/80',
    green:  'bg-emerald-950/60 text-emerald-300 border-emerald-700/40',
    blue:   'bg-sky-950/60 text-sky-300 border-sky-700/40',
    red:    'bg-rose-950/60 text-rose-300 border-rose-700/40',
    amber:  'bg-amber-950/60 text-amber-300 border-amber-700/40',
    orange: 'bg-orange-950/60 text-orange-300 border-orange-700/40',
    indigo: 'bg-[rgba(249,115,22,0.12)] text-[#FB923C] border-[rgba(249,115,22,0.25)]',
    violet: 'bg-violet-950/60 text-violet-300 border-violet-700/40',
    teal:   'bg-teal-950/60 text-teal-300 border-teal-700/40',
    cyan:   'bg-cyan-950/60 text-cyan-300 border-cyan-700/40',
  }
  const dotColor: Record<ChipColor, string> = {
    gray:   'bg-slate-400',
    green:  'bg-emerald-500',
    blue:   'bg-sky-500',
    red:    'bg-rose-500',
    amber:  'bg-amber-500',
    orange: 'bg-orange-500',
    indigo: 'bg-[#F97316]',
    violet: 'bg-violet-500',
    teal:   'bg-teal-500',
    cyan:   'bg-cyan-500',
  }
  const sizing = size === 'sm'
    ? 'px-1.5 py-0.5 text-[10.5px]'
    : 'px-2 py-0.5 text-[11px]'
  return (
    <span className={`inline-flex items-center gap-1 rounded-md ${sizing} font-semibold tracking-tight border ${palette[color] ?? palette.gray}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColor[color] ?? dotColor.gray}`} />}
      {children}
    </span>
  )
}
