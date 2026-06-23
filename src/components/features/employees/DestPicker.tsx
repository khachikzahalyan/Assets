/**
 * DestPicker — portal chip + popover for picking an asset destination.
 *
 * Ported from Warehouse/prototypes/employees.html lines 1599-1799.
 * All data (employees, departments, branches) is injected via props — no globals.
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import { DatePicker } from '@/components/features/assets/create/DatePicker'

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
    iconCls: 'bg-[#22272E] text-[#94A3B8]',
    chipCls: 'bg-[#111315] ring-[#2A2F36] text-[#94A3B8] hover:bg-[#22272E]',
  },
  employee: {
    icon: 'user-round',
    iconCls: 'bg-[#F97316]/10 text-[#F97316]',
    chipCls: 'bg-[#F97316]/10 ring-[#F97316] text-[#F97316] hover:bg-[#F97316]/15',
  },
  department: {
    icon: 'layout-list',
    iconCls: 'bg-amber-500/15 text-amber-300',
    chipCls: 'bg-amber-500/10 ring-amber-500/30 text-amber-300 hover:bg-amber-500/15',
  },
  branch: {
    icon: 'git-branch',
    iconCls: 'bg-teal-50 text-teal-700',
    chipCls: 'bg-teal-50 ring-teal-200 text-teal-700 hover:bg-teal-100',
  },
  temporary: {
    icon: 'timer',
    iconCls: 'bg-rose-500/15 text-rose-300',
    chipCls: 'bg-rose-500/10 ring-rose-500/30 text-rose-300 hover:bg-rose-500/15',
  },
} as const

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

  const pad = (n: number) => String(n).padStart(2, '0')
  const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const todayISO = toISO(new Date())
  const defaultExpiry = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return toISO(d) })()

  const [tempKind, setTempKind] = useState<'audit' | 'intern' | ''>('')
  const [returnDate, setReturnDate] = useState(defaultExpiry)

  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    if (isMobile) {
      setPos({ left: 8, right: 8, bottom: 8, width: 'auto' })
      return
    }
    const rect = triggerRef.current.getBoundingClientRect()
    const popoverHeight = 180
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = forceDropUp || spaceBelow < popoverHeight + 8
    if (openUp) {
      setPos({
        bottom: window.innerHeight - rect.top + 4,
        right: window.innerWidth - rect.right,
        width: 240,
      })
    } else {
      setPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
        width: 240,
      })
    }
  }, [forceDropUp])

  useLayoutEffect(() => {
    if (!open) {
      setSub(null)
      setQuery('')
      setPos(null)
      setTempKind('')
      setReturnDate(defaultExpiry)
      return
    }
    updatePos()
  }, [open, updatePos, defaultExpiry])

  useEffect(() => {
    if (!open) return
    const onOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onOutsideClick)
    document.addEventListener('touchstart', onOutsideClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      document.removeEventListener('mousedown', onOutsideClick)
      document.removeEventListener('touchstart', onOutsideClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open, updatePos])

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
      <Icon name="search-x" size={16} className="text-[#64748B]" />
      <span className="text-[13.5px] text-[#94A3B8]">{t('dest.notFound')}</span>
    </div>
  )

  return (
    <div ref={wrapRef}>
      {/* Chip trigger */}
      <button
        ref={triggerRef}
        type="button"
        aria-label={chipLabel}
        onClick={() => setOpen((v) => !v)}
        className={`ams-handover-destpicker-trigger inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[14px] font-medium ring-1 transition-colors duration-150 cursor-pointer ${accent.chipCls}`}
      >
        <span
          className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] shrink-0 ${accent.iconCls}`}
        >
          <Icon name={accent.icon} size={11} />
        </span>
        <span className="truncate max-w-[110px]">{chipLabel}</span>
        <Icon name="chevron-down" size={10} className="shrink-0 opacity-50" />
      </button>

      {/* Popover — portaled to document.body to escape modal overflow clipping */}
      {open &&
        pos &&
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
            className="bg-[#1B1F24] shadow-2xl shadow-slate-900/15 rounded-2xl ring-1 ring-[#2A2F36] p-1.5 anim-fade-slide-in"
          >
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
                    className="w-full text-left px-2.5 py-2 rounded-xl text-[14.5px] font-medium text-[#F8FAFC] hover:bg-[#111315] transition-colors duration-100 flex items-center gap-2.5"
                  >
                    <span
                      className={`inline-flex items-center justify-center w-[20px] h-[20px] rounded-[5px] shrink-0 ${opt.iconCls}`}
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
                    {/* Sub-picker header: back + search */}
                    <div className="flex items-center gap-1 px-1 mb-1.5">
                      <button
                        type="button"
                        aria-label="Назад"
                        onClick={() => {
                          setSub(null)
                          setQuery('')
                        }}
                        className="p-1 rounded-md text-[#64748B] hover:text-[#CBD5E1] hover:bg-[#22272E] transition-colors"
                      >
                        <Icon name="arrow-left" size={12} />
                      </button>
                      <div className="ams-destpicker-search flex-1 flex items-center gap-1.5 bg-[#111315] rounded-lg px-2 py-1">
                        <Icon name="search" size={11} className="text-[#64748B] shrink-0" />
                        <input
                          type="text"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder={t('dest.search')}
                          aria-label={t('dest.search')}
                          autoFocus
                          className="ams-destpicker-search-input flex-1 text-[14px] bg-transparent border-none outline-none placeholder:text-[#64748B] text-[#F8FAFC] min-w-0"
                        />
                      </div>
                    </div>
                    <div className="max-h-[160px] overflow-y-auto space-y-0.5">
                      {sub === 'employee' &&
                        filteredList(activeEmps).map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => commit({ kind: 'employee', id: e.id, label: e.name })}
                            className="w-full text-left px-2.5 py-2 rounded-xl text-[14px] font-medium text-[#F8FAFC] hover:bg-[#111315] transition-colors duration-100 flex items-center gap-2 truncate"
                          >
                            <span
                              className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] shrink-0 ${SUB_ICON.employee.iconCls}`}
                            >
                              <Icon name={SUB_ICON.employee.icon} size={11} />
                            </span>
                            <span className="truncate">{e.name}</span>
                          </button>
                        ))}
                      {sub === 'department' &&
                        filteredList(departments).map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() =>
                              commit({ kind: 'department', id: d.id, label: d.name })
                            }
                            className="w-full text-left px-2.5 py-2 rounded-xl text-[14px] font-medium text-[#F8FAFC] hover:bg-[#111315] transition-colors duration-100 flex items-center gap-2 truncate"
                          >
                            <span
                              className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] shrink-0 ${SUB_ICON.department.iconCls}`}
                            >
                              <Icon name={SUB_ICON.department.icon} size={11} />
                            </span>
                            <span className="truncate">{d.name}</span>
                          </button>
                        ))}
                      {sub === 'branch' &&
                        filteredList(branches).map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => commit({ kind: 'branch', id: b.id, label: b.name })}
                            className="w-full text-left px-2.5 py-2 rounded-xl text-[14px] font-medium text-[#F8FAFC] hover:bg-[#111315] transition-colors duration-100 flex items-center gap-2 truncate"
                          >
                            <span
                              className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-[4px] shrink-0 ${SUB_ICON.branch.iconCls}`}
                            >
                              <Icon name={SUB_ICON.branch.icon} size={11} />
                            </span>
                            <span className="truncate">{b.name}</span>
                          </button>
                        ))}
                      {sub === 'employee' && filteredList(activeEmps).length === 0 && emptyState}
                      {sub === 'department' && filteredList(departments).length === 0 && emptyState}
                      {sub === 'branch' && filteredList(branches).length === 0 && emptyState}
                    </div>
                  </>
                )}

                {/* Temporary sub-panel */}
                {sub === 'temporary' && (
                  <div className="px-1.5 pb-1">
                    <div className="flex items-center gap-1 px-0.5 mb-2">
                      <button
                        type="button"
                        aria-label="Назад"
                        onClick={() => { setSub(null); setTempKind('') }}
                        className="p-1 rounded-md text-[#64748B] hover:text-[#CBD5E1] hover:bg-[#22272E] transition-colors"
                      >
                        <Icon name="arrow-left" size={12} />
                      </button>
                      <span className="text-[12px] uppercase tracking-[0.06em] font-semibold text-[#94A3B8]">
                        {t('dest.temporary')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 h-9 bg-[#111315] border border-[#2A2F36] rounded-lg overflow-hidden mb-2">
                      {(['audit', 'intern'] as const).map((k, i) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setTempKind(k)}
                          aria-pressed={tempKind === k}
                          className={`flex-1 h-full text-[13px] font-medium transition-colors ${i > 0 ? 'border-l border-[#2A2F36]' : ''}
                            ${tempKind === k ? 'bg-rose-500/80 text-white' : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#22272E]'}`}
                        >
                          {k === 'audit' ? t('dest.kindAudit') : t('dest.kindIntern')}
                        </button>
                      ))}
                    </div>
                    <label className="block text-[12px] uppercase tracking-[0.06em] font-semibold text-[#94A3B8] mb-1">
                      {t('dest.returnDate')}
                    </label>
                    <DatePicker
                      value={returnDate}
                      onChange={(v) => { if (v && v < todayISO) return; setReturnDate(v) }}
                      min={todayISO}
                      placeholder={t('dest.returnDatePlaceholder')}
                    />
                    <button
                      type="button"
                      disabled={!tempKind || !returnDate || returnDate < todayISO}
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
                      className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[14px] bg-rose-500/80 text-white hover:bg-rose-500 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
                    >
                      <Icon name="check" size={13} />
                      {t('dest.tempConfirm')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
