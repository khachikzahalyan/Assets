/**
 * EmployeeMultiSelect — portaled searchable multi-select trigger.
 * Panel renders above z-[200] modals (z-[300]+).
 */
import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import type { Employee } from '@/domain/employee'
import { avatarColorFor, initialsOf } from './licenseHelpers'

export interface EmployeeMultiSelectProps {
  employees: Employee[]
  selected: string[]
  onToggle: (id: string) => void
  placeholder?: string
}

export function EmployeeMultiSelect({
  employees,
  selected,
  onToggle,
  placeholder = '',
}: EmployeeMultiSelectProps) {
  const { t } = useTranslation('licenses')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const triggerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [panelPos, setPanelPos] = useState<{
    top: number | null; bottom: number | null; left: number | null; width: number | null
  }>({ top: null, bottom: null, left: null, width: null })

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const compute = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const goUp = spaceBelow < 290 && spaceAbove > spaceBelow
      if (goUp) {
        setPanelPos({ bottom: window.innerHeight - rect.top + 4, top: null, left: rect.left, width: rect.width })
      } else {
        setPanelPos({ top: rect.bottom + 4, bottom: null, left: rect.left, width: rect.width })
      }
    }
    compute()
    window.addEventListener('scroll', compute, true)
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('scroll', compute, true)
      window.removeEventListener('resize', compute)
    }
  }, [open])

  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined
    if (open && searchRef.current) {
      id = setTimeout(() => searchRef.current?.focus(), 30)
    }
    if (!open) setSearch('')
    return () => { if (id !== undefined) clearTimeout(id) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter(e =>
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
      (e.position ?? '').toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q),
    )
  }, [employees, search])

  const shown = selected.slice(0, 5)
  const overflow = selected.length - shown.length

  const panelNode = open ? (
    <>
      <div
        onClick={() => setOpen(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 300 }}
      />
      <div
        className="rounded-xl shadow-lg ring-1 ring-border/80 border border-border bg-surface flex flex-col overflow-hidden"
        style={{
          position: 'fixed',
          zIndex: 301,
          top: panelPos.top != null ? panelPos.top : 'auto',
          bottom: panelPos.bottom != null ? panelPos.bottom : 'auto',
          left: panelPos.left != null ? panelPos.left : 'auto',
          width: panelPos.width ? Math.max(panelPos.width, 260) : 260,
          maxHeight: 280,
          animation: 'modalPop 200ms cubic-bezier(.22,1,.36,1) both',
        }}
        onClick={e => e.stopPropagation()}
        role="listbox"
        aria-multiselectable="true"
        aria-label={t('multiselect.placeholder')}
      >
        {/* Search */}
        <div className="px-2 pt-2 pb-1.5 border-b border-border flex-shrink-0">
          <div className="relative">
            <Icon name="search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('multiselect.searchPlaceholder')}
              aria-label={t('multiselect.searchAria')}
              className="w-full h-9 pl-7 pr-2 text-[13.5px] bg-transparent text-text-primary placeholder:text-text-subtle focus:outline-none"
            />
          </div>
        </div>

        {/* Employee list */}
        <div className="overflow-y-auto flex-1 py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px] text-text-subtle">{t('manage.notFound')}</div>
          ) : filtered.map(e => {
            const isSel = selected.includes(e.id)
            const fullName = `${e.firstName} ${e.lastName}`.trim()
            return (
              <button
                key={e.id}
                type="button"
                role="option"
                aria-selected={isSel}
                onClick={() => onToggle(e.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  isSel ? 'bg-accent/10 hover:bg-accent/15' : 'hover:bg-surface-2'
                }`}
              >
                <span className={`text-[13.5px] flex-1 min-w-0 truncate ${isSel ? 'text-text-primary font-medium' : 'text-text-primary'}`}>
                  {fullName}
                </span>
                {e.position && (
                  <span className={`text-[12px] flex-shrink-0 ml-2 ${isSel ? 'text-accent-light' : 'text-text-subtle'}`}>
                    {e.position}
                  </span>
                )}
                {isSel && <Icon name="check" size={14} className="ml-1 shrink-0 text-accent" />}
              </button>
            )
          })}
        </div>

        {/* Done button */}
        <div className="px-2 py-2 border-t border-border flex-shrink-0">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full h-8 rounded-lg bg-accent hover:bg-accent-hover text-white text-[13px] font-semibold transition-colors"
          >
            {t('multiselect.done')}{selected.length > 0 ? ` (${selected.length})` : ''}
          </button>
        </div>
      </div>
    </>
  ) : null

  return (
    <div className="relative" ref={triggerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('multiselect.placeholder')}
        className={[
          'w-full h-9 px-2.5 text-[13.5px] rounded-lg border bg-surface text-left flex items-center justify-between gap-2 transition-colors outline-none',
          open
            ? 'border-orange-400 ring-2 ring-accent/30'
            : 'border-border hover:border-border-strong',
        ].join(' ')}
      >
        {selected.length === 0 ? (
          <span className="text-text-subtle truncate">{placeholder || t('multiselect.placeholder')}</span>
        ) : (
          <span className="flex items-center gap-1 min-w-0">
            {shown.map((id, i) => {
              const emp = employees.find(e => e.id === id)
              if (!emp) return null
              return (
                <span
                  key={id}
                  title={`${emp.firstName} ${emp.lastName}`}
                  className={[
                    'w-6 h-6 rounded-full text-white text-[10px] font-bold inline-flex items-center justify-center flex-shrink-0 ring-1 ring-surface',
                    avatarColorFor(id),
                    i > 0 ? '-ml-1.5' : '',
                  ].join(' ')}
                >
                  {initialsOf(emp.firstName, emp.lastName)}
                </span>
              )
            })}
            {overflow > 0 && (
              <span className="w-6 h-6 rounded-full bg-surface-2 text-text-tertiary text-[10px] font-bold inline-flex items-center justify-center flex-shrink-0 ring-1 ring-surface -ml-1.5">
                +{overflow}
              </span>
            )}
            <span className="ml-1.5 text-[12.5px] text-text-tertiary flex-shrink-0">{t('multiselect.selectedCount', { count: selected.length })}</span>
          </span>
        )}
        <Icon
          name="chevron-down"
          size={14}
          className={`shrink-0 text-text-subtle transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {ReactDOM.createPortal(panelNode, document.body)}
    </div>
  )
}
