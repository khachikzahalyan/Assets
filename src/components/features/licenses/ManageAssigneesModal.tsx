/**
 * ManageAssigneesModal — assign/unassign employees for a subscription.
 * Changes are committed immediately via onUpdateAssignees (audited).
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { IconBtn, Icon, DIALOG_BACKDROP_BLUR, MODAL_SHEET } from '@/components/ui'
import { RoleIcon } from '@/components/ui/RoleIcon'
import type { Employee } from '@/domain/employee'
import { pluralEmp } from './licenseHelpers'

const MANAGE_TITLE_ID = 'manage-assignees-modal-title'

export interface ManageAssigneesModalProps {
  subId: string
  subName: string
  seatsTotal: number
  initialAssignedIds: string[]
  employees: Employee[]
  onUpdateAssignees: (subId: string, ids: string[]) => Promise<void>
  onClose: () => void
}

export function ManageAssigneesModal({
  subId,
  subName,
  seatsTotal,
  initialAssignedIds,
  employees,
  onUpdateAssignees,
  onClose,
}: ManageAssigneesModalProps) {
  const { t } = useTranslation('licenses')
  const [search, setSearch] = useState('')
  const [assigned, setAssigned] = useState<string[]>(() => initialAssignedIds)
  const searchRef = useRef<HTMLInputElement>(null)

  // Focus the search on open — DESKTOP ONLY (owner rule): on mobile autofocus
  // pops the on-screen keyboard over the freshly opened dialog.
  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) return
    const id = setTimeout(() => searchRef.current?.focus(), 30)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Only ACTIVE employees are offered for assignment. Assigned ids that no
  // longer resolve to an active employee (terminated, or the record was
  // deleted) still hold a seat — they render as removable "ghost" rows above
  // the list so the seat can be released. (Bug 2026-07-30: a terminated
  // assignee was invisible here while the card kept counting their seat.)
  const activeEmployees = useMemo(
    () => employees.filter(e => e.status === 'active'),
    [employees],
  )
  const ghostSeats = useMemo(
    () => assigned
      .filter(id => !activeEmployees.some(e => e.id === id))
      .map(id => ({ id, employee: employees.find(e => e.id === id) ?? null })),
    [assigned, activeEmployees, employees],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return activeEmployees
    return activeEmployees.filter(e =>
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
      (e.position ?? '').toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q),
    )
  }, [activeEmployees, search])

  const toggle = (empId: string) => {
    const next = assigned.includes(empId)
      ? assigned.filter(id => id !== empId)
      : [...assigned, empId]
    setAssigned(next)
    void onUpdateAssignees(subId, next)
  }

  return ReactDOM.createPortal(
    <div
      className={DIALOG_BACKDROP_BLUR}
      style={{ animation: 'backdropFade 160ms ease both' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`relative w-full max-w-lg bg-surface rounded-xl shadow-2xl shadow-black/60 light:shadow-slate-300/60 border border-border flex flex-col max-h-[90vh] ${MODAL_SHEET}`}
        style={{ animation: 'modalPop 200ms cubic-bezier(.22,1,.36,1) both' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={MANAGE_TITLE_ID}
      >
        {/* Pull-handle — mobile only */}
        <div className="max-md:block hidden mx-auto h-1 w-9 rounded-full bg-white/20 light:bg-black/10 mb-3 mt-2" />
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-md bg-surface-2 text-text-tertiary inline-flex items-center justify-center flex-shrink-0">
              <Icon name="users" size={15} />
            </span>
            <div className="min-w-0">
              <div id={MANAGE_TITLE_ID} className="text-15 font-bold text-text-primary tracking-tight truncate">{subName}</div>
              <div className="text-12 text-text-subtle mt-0.5 truncate">
                {t('manage.subtitle', { count: assigned.length, total: seatsTotal })}
              </div>
            </div>
          </div>
          <IconBtn icon="x" onClick={onClose} size="sm" title={t('manage.done')} />
        </header>

        {/* Search */}
        <div className="px-4 pt-3 pb-2 border-b border-border flex-shrink-0">
          <div className="relative">
            <Icon name="search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('manage.searchPlaceholder')}
              aria-label={t('manage.searchPlaceholder')}
              className="w-full h-9 pl-7 pr-3 text-13.5 rounded-lg bg-bg border border-border text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 transition-all"
            />
          </div>
        </div>

        {/* Employee list */}
        <div className="overflow-y-auto flex-1 py-1">
          {/* Ghost seats: assigned but terminated/deleted — removable only */}
          {ghostSeats.map(({ id, employee }) => {
            const name = employee
              ? `${employee.firstName} ${employee.lastName}`.trim()
              : t('manage.ghostEmployee')
            return (
              <button
                key={`ghost_${id}`}
                type="button"
                onClick={() => toggle(id)}
                aria-pressed="true"
                title={t('manage.done')}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors bg-rose-500/[0.06] hover:bg-rose-500/10"
              >
                <RoleIcon role="employee" size={32} className="flex-shrink-0 opacity-50 grayscale" />
                <div className="flex-1 min-w-0">
                  <div className="text-13.5 font-semibold text-text-secondary truncate">{name}</div>
                  {employee && (
                    <div className="text-12 text-text-subtle font-mono truncate">{employee.email}</div>
                  )}
                </div>
                {employee && (
                  <span className="text-10.5 font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 light:text-rose-700 border border-rose-500/30 flex-shrink-0">
                    {t('manage.terminatedBadge')}
                  </span>
                )}
                <Icon name="check" size={15} className="ml-1 shrink-0 text-accent" />
              </button>
            )
          })}

          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-13.5 text-text-subtle">
              {t('manage.notFound')}
            </div>
          ) : (
            filtered.map(e => {
              const isSel = assigned.includes(e.id)
              const fullName = `${e.firstName} ${e.lastName}`.trim()
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggle(e.id)}
                  aria-pressed={isSel}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isSel ? 'bg-accent/10 hover:bg-accent/15' : 'hover:bg-surface-2'
                  }`}
                >
                  <RoleIcon role="employee" size={32} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-13.5 font-semibold text-text-primary truncate">{fullName}</div>
                    <div className="text-12 text-text-subtle font-mono truncate">{e.email}</div>
                  </div>
                  {e.position && (
                    <div className="text-12 text-text-subtle flex-shrink-0 hidden sm:block max-w-[8.125rem] truncate text-right">
                      {e.position}
                    </div>
                  )}
                  {isSel && <Icon name="check" size={15} className="ml-1 shrink-0 text-accent" />}
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <footer className="px-4 py-3 border-t border-border flex items-center justify-between gap-3 flex-shrink-0">
          <span className="text-12.5 text-text-subtle min-w-0 truncate">{t('manage.assignedSuffix', { phrase: pluralEmp(assigned.length) })}</span>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-5 rounded-lg bg-gradient-to-b from-accent-light to-accent text-white text-13.5 font-semibold shadow-sm shadow-accent/20 light:shadow-[#F97316]/20 hover:shadow-md hover:shadow-accent/30 light:hover:shadow-[#F97316]/20 transition-all flex-shrink-0"
          >
            {t('manage.done')}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
