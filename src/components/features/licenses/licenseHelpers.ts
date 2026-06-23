/**
 * Shared helpers for the Licenses page UI.
 * Pure functions — no React, no Firebase.
 */
import { formatLicenseDate } from './formatLicenseDate'

// ── Date helpers ──────────────────────────────────────────────────────────────

export function daysUntil(iso: string | null | undefined): number {
  if (!iso) return Infinity
  const ms = new Date(iso).getTime()
  if (isNaN(ms)) return Infinity
  return Math.ceil((ms - Date.now()) / 86_400_000)
}

export { formatLicenseDate as fmtDate }

// ── Russian pluralisation for "сотрудник" ─────────────────────────────────────

export function pluralEmp(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return `${n} сотрудников`
  if (mod10 === 1) return `${n} сотрудник`
  if (mod10 >= 2 && mod10 <= 4) return `${n} сотрудника`
  return `${n} сотрудников`
}

// ── Avatar helpers ─────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-accent-light',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-indigo-500',
  'bg-teal-500',
] as const

export function avatarColorFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = ((h * 31) + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length] ?? 'bg-slate-500'
}

export function initialsOf(firstName: string, lastName: string): string {
  const a = (firstName ?? '').trim()[0] ?? ''
  const b = (lastName ?? '').trim()[0] ?? ''
  return (a + b).toUpperCase()
}
