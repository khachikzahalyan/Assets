/**
 * DestPicker — portal chip + popover for picking an asset destination.
 *
 * Ported from Warehouse/prototypes/employees.html lines 1599-1799.
 * All data (employees, departments, branches) is injected via props — no globals.
 *
 * Desktop: anchored fixed-position portal popover (z-60).
 * Mobile (owner rule, 2026-07-28): opens its OWN MobileSheet (z-9000) above any
 * parent modal — the cramped fixed popover was inaccessible inside HandoverModal.
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import { DatePicker } from '@/components/ui'
import { rafThrottle } from '@/lib/rafThrottle'
import { useDismissOnOutside } from '@/hooks/useDismissOnOutside'
import { useIsMobile } from '@/hooks/useIsMobile'
import { MobileSheet } from '@/components/ui/MobileSheet'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Destination =
  | { kind: 'warehouse' }
  | { kind: 'employee'; id: string; label: string }
  | { kind: 'department'; id: string; label: string }
  | { kind: 'branch'; id: string; label: string }
  | { kind: 'temporary'; tempKind: 'audit' | 'intern'; expiresAt: string; label: string }

export interface DestPickerProps {
  value: Destination
  onChange: (d: Destination) => void
  currentEmpId: string
  employees: { id: string; name: string; status: string }[]
  departments: { id: string; name: string }[]
  branches: { id: string; name: string }[]
  forceDropUp?: boolean
}

// ── Internal types ────────────────────────────────────────────────────────────

type SubKind = 'employee' | 'department' | 'branch' | 'temporary'

interface PopoverPos {
  top?: number
  bottom?: number
  left?: number
  right?: number
  width: number | string
}

// ── Accent config — matches prototype exactly ─────────────────────────────────

const KIND_ACCENT = {
  warehouse: {
    icon: 'warehouse',
    iconCls: 'bg-surface-2 text-text-tertiary',
    chipCls: 'bg-bg ring-border text-text-tertiary hover:bg-surface-2',
  },
  employee: {
    icon: 'user-round',
    iconCls: 'bg-accent/10 text-accent',
    chipCls: 'bg-accent/10 ring-accent text-accent hover:bg-accent/15',
  },
  department: {
    icon: 'layout-list',
    iconCls: 'bg-amber-500/15 text-amber-300 light:text-amber-700',
    chipCls: 'bg-amber-500/10 ring-amber-500/30 text-amber-300 light:text-amber-700 hover:bg-amber-500/15',
  },
  branch: {
    icon: 'git-branch',
    iconCls: 'bg-teal-50 text-teal-700',
    chipCls: 'bg-teal-50 ring-teal-200 text-teal-700 hover:bg-teal-100',
  },
  temporary: {
    icon: 'timer',
    iconCls: 'bg-rose-500/15 text-rose-300 light:text-rose-700',
    chipCls: 'bg-rose-500/10 ring-rose-500/30 text-rose-300 light:text-rose-700 hover:bg-rose-500/15',
  },
} as const

// ── Date helpers (module scope — stable across renders) ───────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const plusDaysISO = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return toISO(d) }

// Structural equality for a PopoverPos — lets setPos bail out when a scroll frame
// produces the same geometry, avoiding a re-render per scroll event.
const samePopoverPos = (a: PopoverPos | null, b: PopoverPos): boolean =>
  a !== null &&
  a.top === b.top &&
  a.bottom === b.bottom &&
  a.left === b.left &&
  a.right === b.right &&
  a.width === b.width

// ── Component ─────────────────────────────────────────────────────────────────

export function DestPicker({
  value,
  onChange,
  currentEmpId,
  employees,
  departments,
  branches,
  forceDropUp = false,
}: DestPickerProps) {
  const { t } = useTranslation('employees')
  const [open, setOpen] = useState(false)
  const [sub, setSub] = useState<SubKind | null>(null)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState<PopoverPos | null>(null)

  const [tempKind, setTempKind] = useState<'audit' | 'intern' | null>(null)
  const [returnDate, setReturnDate] = useState(() => plusDaysISO(7))

  const isMobile = useIsMobile()

  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const popoverHeight = 180
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = forceDropUp || spaceBelow < popoverHeight + 8
    const next: PopoverPos = openUp
      ? {
          bottom: window.innerHeight - rect.top + 4,
          right: window.innerWidth - rect.right,
          width: 240,
        }
      : {
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right,
          width: 240,
        }
    setPos((prev) => (samePopoverPos(prev, next) ? prev : next))
  }, [forceDropUp])

  useLayoutEffect(() => {
    if (!open) {
      setSub(null)
      setQuery('')
      setPos(null)
      setTempKind(null)
      setReturnDate(plusDaysISO(7))
      return
    }
    // Mobile uses MobileSheet — no positioning needed
    if (isMobile) return
    updatePos()
  }, [open, isMobile, updatePos])

  // Outside-press close — desktop only; MobileSheet handles its own backdrop
  useDismissOnOutside([wrapRef, popoverRef], () => setOpen(false), open && !isMobile)

  useEffect(() => {
    if (!open) return
    if (isMobile) return  // MobileSheet handles ESC and no scroll needed
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onScrollResize = rafThrottle(updatePos)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScrollResize, true)
    window.addEventListener('resize', onScrollResize)
    return () => {
      onScrollResize.cancel()
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScrollResize, true)
      window.removeEventListener('resize', onScrollResize)
    }
  }, [open, isMobile, updatePos])

  const commit = (next: Destination) => {
    onChange(next)
    setOpen(false)
  }

  const activeEmps = employees.filter(
    (e) => e.status === 'active' && e.id !== currentEmpId,
  )

  const filteredList = <T extends { name: string }>(list: T[]): T[] => {
    const q = query.trim().toLowerCase()
    return q ? list.filter((x) => x.name.toLowerCase().includes(q)) : list
  }

  const accent = KIND_ACCENT[value.kind] ?? KIND_ACCENT.warehouse
  const chipLabel =
    value.kind === 'warehouse' ? t('dest.warehouse') : (value as { label: string }).label

  const TOP_OPTS = [
    {
      kind: 'warehouse' as const,
      label: t('dest.warehouse'),
      sub: null,
      iconCls: KIND_ACCENT.warehouse.iconCls,
      icon: KIND_ACCENT.warehouse.icon,
    },
    {
      kind: 'employee' as const,
      label: t('dest.employee'),
      sub: 'employee' as SubKind,
      iconCls: KIND_ACCENT.employee.iconCls,
      icon: KIND_ACCENT.employee.icon,
    },
    {
      kind: 'department' as const,
      label: t('dest.department'),
      sub: 'department' as SubKind,
      iconCls: KIND_ACCENT.department.iconCls,
      icon: KIND_ACCENT.department.icon,
    },
    {
      kind: 'branch' as const,
      label: t('dest.branch'),
      sub: 'branch' as SubKind,
      iconCls: KIND_ACCENT.branch.iconCls,
      icon: KIND_ACCENT.branch.icon,
    },
    {
      kind: 'temporary' as const,
      label: t('dest.temporary'),
      sub: 'temporary' as SubKind,
      iconCls: KIND_ACCENT.temporary.iconCls,
      icon: KIND_ACCENT.temporary.icon,
    },
  ]

  const SUB_ICON = {
    employee: KIND_ACCENT.employee,
    department: KIND_ACCENT.department,
    branch: KIND_ACCENT.branch,
  }

  const emptyState = (
    <div className="flex flex-col items-center py-3 gap-1">
      <Icon name="search-x" size={16} className="text-text-subtle" />
      <span className="text-13.5 text-text-tertiary">{t('dest.notFound')}</span>
    </div>
  )

  // ── Shared picker content (rendered in both desktop popover and mobile sheet) ──

  const filteredEmps = filteredList(activeEmps)
  const filteredDepts = filteredList(departments)
  const filteredBranches = filteredList(branches)

  const pickerContent = (
    <>
      {!sub ? (
        <div className="space-y-0.5">
          {TOP_OPTS.map((opt) => (
            <button
              key={opt.kind}
              type="button"
              onClick={() => {
                if (opt.sub) {
                  setSub(opt.sub)
                  setQuery('')
                } else {
                  commit({ kind: 'warehouse' })
                }
              }}
              className="w-full text-left px-2.5 py-3 md:py-2 rounded-xl text-14.5 font-medium text-text-primary hover:bg-bg transition-colors duration-100 flex items-center gap-2.5"
            >
              <span
                className={`inline-flex items-center justify-center w-[1.25rem] h-[1.25rem] rounded-[5px] shrink-0 ${opt.iconCls}`}
              >
                <Icon name={opt.icon} size={11} />
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <div>
          {/* Employee / department / branch search sub-panels */}
          {sub !== 'temporary' && (
            <>
              {/* Sub-picker header: back + search — one even 32px row */}
              <div className="flex items-center gap-1.5 px-0.5 pt-0.5 mb-1.5">
                <button
                  type="button"
                  aria-label={t('dest.back')}
                  onClick={() => {
                    setSub(null)
                    setQuery('')
                  }}
                  className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-lg text-text-subtle hover:text-text-secondary hover:bg-surface-2 transition-colors"
                >
                  <Icon name="arrow-left" size={13} />
                </button>
                <div className="ams-destpicker-search flex-1 h-8 flex items-center gap-1.5 bg-bg ring-1 ring-border/60 focus-within:ring-accent/40 rounded-lg px-2.5 transition-shadow">
                  <Icon name="search" size={12} className="text-text-subtle shrink-0" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('dest.search')}
                    aria-label={t('dest.search')}
                    autoFocus={!isMobile}
                    className="ams-destpicker-search-input flex-1 text-14 bg-transparent border-none outline-none placeholder:text-text-subtle text-text-primary min-w-0"
                  />
                </div>
              </div>
              <div className="max-h-[45vh] md:max-h-[10rem] overflow-y-auto space-y-0.5">
                {sub === 'employee' &&
                  filteredEmps.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => commit({ kind: 'employee', id: e.id, label: e.name })}
                      className="w-full text-left px-2.5 py-3 md:py-2 rounded-xl text-14 font-medium text-text-primary hover:bg-bg transition-colors duration-100 flex items-center gap-2 truncate"
                    >
                      <span
                        className={`inline-flex items-center justify-center w-[1.125rem] h-[1.125rem] rounded-[4px] shrink-0 ${SUB_ICON.employee.iconCls}`}
                      >
                        <Icon name={SUB_ICON.employee.icon} size={11} />
                      </span>
                      <span className="truncate">{e.name}</span>
                    </button>
                  ))}
                {sub === 'department' &&
                  filteredDepts.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() =>
                        commit({ kind: 'department', id: d.id, label: d.name })
                      }
                      className="w-full text-left px-2.5 py-3 md:py-2 rounded-xl text-14 font-medium text-text-primary hover:bg-bg transition-colors duration-100 flex items-center gap-2 truncate"
                    >
                      <span
                        className={`inline-flex items-center justify-center w-[1.125rem] h-[1.125rem] rounded-[4px] shrink-0 ${SUB_ICON.department.iconCls}`}
                      >
                        <Icon name={SUB_ICON.department.icon} size={11} />
                      </span>
                      <span className="truncate">{d.name}</span>
                    </button>
                  ))}
                {sub === 'branch' &&
                  filteredBranches.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => commit({ kind: 'branch', id: b.id, label: b.name })}
                      className="w-full text-left px-2.5 py-3 md:py-2 rounded-xl text-14 font-medium text-text-primary hover:bg-bg transition-colors duration-100 flex items-center gap-2 truncate"
                    >
                      <span
                        className={`inline-flex items-center justify-center w-[1.125rem] h-[1.125rem] rounded-[4px] shrink-0 ${SUB_ICON.branch.iconCls}`}
                      >
                        <Icon name={SUB_ICON.branch.icon} size={11} />
                      </span>
                      <span className="truncate">{b.name}</span>
                    </button>
                  ))}
                {sub === 'employee' && filteredEmps.length === 0 && emptyState}
                {sub === 'department' && filteredDepts.length === 0 && emptyState}
                {sub === 'branch' && filteredBranches.length === 0 && emptyState}
              </div>
            </>
          )}

          {/* Temporary sub-panel */}
          {sub === 'temporary' && (
            <div className="px-1.5 pb-1">
              <div className="flex items-center gap-1.5 px-0.5 pt-0.5 mb-2">
                <button
                  type="button"
                  aria-label={t('dest.back')}
                  onClick={() => { setSub(null); setTempKind(null); setReturnDate(plusDaysISO(7)) }}
                  className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-lg text-text-subtle hover:text-text-secondary hover:bg-surface-2 transition-colors"
                >
                  <Icon name="arrow-left" size={13} />
                </button>
                <span className="text-12 uppercase tracking-[0.06em] font-semibold text-text-tertiary">
                  {t('dest.temporary')}
                </span>
              </div>
              <div className="flex items-center gap-1 h-9 bg-bg border border-border rounded-lg overflow-hidden mb-2">
                {(['audit', 'intern'] as const).map((k, i) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTempKind(k)}
                    aria-pressed={tempKind === k}
                    className={`flex-1 h-full text-13 font-medium transition-colors ${i > 0 ? 'border-l border-border' : ''}
                      ${tempKind === k ? 'bg-rose-500/80 text-white' : 'text-text-tertiary hover:text-text-primary hover:bg-surface-2'}`}
                  >
                    {k === 'audit' ? t('dest.kindAudit') : t('dest.kindIntern')}
                  </button>
                ))}
              </div>
              <label htmlFor="dest-return-date" className="block text-12 uppercase tracking-[0.06em] font-semibold text-text-tertiary mb-1">
                {t('dest.returnDate')}
              </label>
              <DatePicker
                id="dest-return-date"
                value={returnDate}
                onChange={(v) => setReturnDate(v)}
                placeholder={t('dest.returnDatePlaceholder')}
              />
              <button
                type="button"
                disabled={!tempKind || !returnDate}
                onClick={() => {
                  if (!tempKind) return
                  const dd = returnDate.split('-')
                  const short = `${dd[2]}.${dd[1]}`
                  const kindLabel = tempKind === 'audit' ? t('dest.kindAudit') : t('dest.kindIntern')
                  commit({
                    kind: 'temporary',
                    tempKind,
                    expiresAt: returnDate,
                    label: t('dest.tempLabel', { kind: kindLabel, date: short }),
                  })
                }}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-14 bg-rose-500/80 text-white hover:bg-rose-500 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >
                <Icon name="check" size={13} />
                {t('dest.tempConfirm')}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )

  return (
    <div ref={wrapRef}>
      {/* Chip trigger */}
      <button
        ref={triggerRef}
        type="button"
        aria-label={chipLabel}
        onClick={() => setOpen((v) => !v)}
        className={`ams-handover-destpicker-trigger inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-14 font-medium ring-1 transition-colors duration-150 cursor-pointer ${accent.chipCls}`}
      >
        <span
          className={`inline-flex items-center justify-center w-[1.125rem] h-[1.125rem] rounded-[4px] shrink-0 ${accent.iconCls}`}
        >
          <Icon name={accent.icon} size={11} />
        </span>
        <span className="truncate max-w-[6.875rem]">{chipLabel}</span>
        <Icon name="chevron-down" size={10} className="shrink-0 opacity-50" />
      </button>

      {/* Desktop: portal popover — portaled to document.body to escape modal overflow clipping */}
      {!isMobile && open && pos &&
        ReactDOM.createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              zIndex: 60,
              width: pos.width,
              ...(pos.top !== undefined ? { top: pos.top } : {}),
              ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}),
              ...(pos.left !== undefined ? { left: pos.left } : {}),
              ...(pos.right !== undefined ? { right: pos.right } : {}),
            }}
            className="bg-surface shadow-2xl shadow-slate-900/15 light:shadow-slate-300/50 rounded-2xl ring-1 ring-border p-1.5 anim-fade-slide-in"
          >
            {pickerContent}
          </div>,
          document.body,
        )}

      {/* Mobile: own MobileSheet above parent modals */}
      {isMobile && (
        <MobileSheet open={open} onClose={() => setOpen(false)} title={chipLabel}>
          <div className="px-2 pb-2">
            {pickerContent}
          </div>
        </MobileSheet>
      )}
    </div>
  )
}
