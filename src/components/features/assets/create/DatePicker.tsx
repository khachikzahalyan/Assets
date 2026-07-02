import { useEffect, useRef, useState, type ReactNode } from 'react'
import ReactDOM from 'react-dom'
import { Icon } from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useExclusiveDropdown } from './dropdownBus'

const RU_MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const RU_WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const parseISO = (s?: string): Date | null => {
  if (!s) return null
  const [y, m, d] = String(s).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
const formatISO = (d: Date | null): string => {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const formatDisplay = (d: Date | null): string => {
  if (!d) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}.${m}.${d.getFullYear()}`
}
const sameDay = (a: Date | null, b: Date | null): boolean =>
  !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)

export interface DatePickerProps {
  value?: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  disabled?: boolean
  placeholder?: string
  /** Show a "На 1 год" footer shortcut (warranty field). */
  showPlusYear?: boolean
  /** Accessible label / data-testid passthrough for the trigger. */
  id?: string
}

/** Calendar surface wrapper: mobile = bottom sheet (slides up), desktop = anchored popover. */
function DPPortal({ isMobile, pos, onBackdrop, children }: {
  isMobile: boolean
  pos: { top: number; left: number; width: number } | null
  onBackdrop: () => void
  children: ReactNode
}) {
  if (isMobile) {
    return (
      <div
        data-dp-portal="true"
        className="fixed inset-0 z-[1000] flex items-end bg-black/60 anim-backdrop-fade"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onBackdrop() }}
      >
        <div
          data-ams-dropdown="true"
          className="w-full bg-surface rounded-t-[18px] overflow-hidden pb-[env(safe-area-inset-bottom,0px)] [animation:amsSheetIn_0.22s_ease-out]"
        >
          {children}
        </div>
      </div>
    )
  }
  if (!pos) return null
  return (
    <div
      data-dp-portal="true"
      data-ams-dropdown="true"
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 1000 }}
      className="bg-surface ring-1 ring-border rounded-xl shadow-xl shadow-slate-900/40 anim-fade-slide-in overflow-hidden"
    >
      {children}
    </div>
  )
}

/** Themed calendar (dark/orange) matching the AMS brand. Ported from the prototype. */
export function DatePicker({ value, onChange, min, max, disabled = false, placeholder = 'дд.мм.гггг', showPlusYear = false, id }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  useExclusiveDropdown(open, setOpen)
  const isMobile = useIsMobile()
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(parseISO(value) || new Date()))
  const [calMode, setCalMode] = useState<'days' | 'months' | 'years'>('days')
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const selected = parseISO(value)
  const minDate = parseISO(min)
  const maxDate = parseISO(max)
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const updatePos = () => {
    const btn = triggerRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const popWidth = 288, popHeight = 340
    let left = r.left
    if (left + popWidth > window.innerWidth - 8) left = window.innerWidth - popWidth - 8
    if (left < 8) left = 8
    let top = r.bottom + 6
    if (top + popHeight > window.innerHeight - 8 && r.top - popHeight - 6 > 8) top = r.top - popHeight - 6
    setPos({ top, left, width: popWidth })
  }

  useEffect(() => {
    if (!open) { setPos(null); return }
    setViewMonth(startOfMonth(parseISO(value) || new Date()))
    setCalMode('days')
    // Mobile renders as a bottom sheet — no anchor positioning needed.
    if (isMobile) return
    updatePos()
    const onChangeWin = () => updatePos()
    window.addEventListener('resize', onChangeWin)
    window.addEventListener('scroll', onChangeWin, true)
    return () => {
      window.removeEventListener('resize', onChangeWin)
      window.removeEventListener('scroll', onChangeWin, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isMobile])

  useEffect(() => {
    if (!open) return
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const inRoot = rootRef.current?.contains(target)
      const inPortal = target.closest?.('[data-dp-portal]')
      if (!inRoot && !inPortal) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const monthStart = startOfMonth(viewMonth)
  const firstDow = (monthStart.getDay() + 6) % 7
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
  const daysInPrev = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 0).getDate()
  const cells: { day: number; monthOffset: number; date: Date }[] = []
  for (let i = 0; i < 42; i++) {
    let day: number, monthOffset: number
    if (i < firstDow) { day = daysInPrev - firstDow + 1 + i; monthOffset = -1 }
    else if (i < firstDow + daysInMonth) { day = i - firstDow + 1; monthOffset = 0 }
    else { day = i - firstDow - daysInMonth + 1; monthOffset = 1 }
    cells.push({ day, monthOffset, date: new Date(viewMonth.getFullYear(), viewMonth.getMonth() + monthOffset, day) })
  }

  const isDisabledDate = (d: Date) => (minDate && d < minDate) || (maxDate && d > maxDate)
  const pick = (d: Date) => { if (isDisabledDate(d)) return; onChange(formatISO(d)); setOpen(false) }
  const handleToday = () => { if (isDisabledDate(today)) return; onChange(formatISO(today)); setOpen(false) }
  const handleOneYear = () => {
    const d = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
    if (isDisabledDate(d)) return
    onChange(formatISO(d)); setOpen(false)
  }
  const handleClear = () => { onChange(''); setOpen(false) }

  const yearAnchor = viewMonth.getFullYear()
  const yearStart = yearAnchor - 6
  const years = Array.from({ length: 12 }, (_, i) => yearStart + i)

  return (
    <div ref={rootRef} data-ams-dropdown="true" className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`w-full px-0 py-2.5 text-[15px] border-b bg-transparent rounded-none flex items-center gap-2 outline-none shadow-none transition-[border-color,box-shadow] duration-200 text-left
          ${open ? 'border-accent shadow-[0_2px_8px_rgba(217,119,87,0.1)]' : 'border-border hover:border-border-strong'}
          disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className={selected ? 'text-text-primary' : 'text-text-subtle'}>
          {selected ? formatDisplay(selected) : placeholder}
        </span>
        <Icon name="calendar" size={14} className={`ml-auto shrink-0 transition-colors ${open ? 'text-accent' : 'text-text-subtle'}`} />
      </button>

      {open && ReactDOM.createPortal(
        <DPPortal isMobile={isMobile} pos={pos} onBackdrop={() => setOpen(false)}>
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <button
              type="button"
              onClick={() => setCalMode(m => m === 'days' ? 'months' : m === 'months' ? 'years' : 'days')}
              className="px-2 py-1 text-[15px] font-semibold text-text-primary hover:bg-surface-2 rounded-md transition-colors flex items-center gap-1"
            >
              {calMode === 'days' && <>{RU_MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}</>}
              {calMode === 'months' && <>{viewMonth.getFullYear()}</>}
              {calMode === 'years' && <>{yearStart}—{yearStart + 11}</>}
              <Icon name="chevron-down" size={12} className="text-text-subtle" />
            </button>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => {
                  if (calMode === 'days') setViewMonth(addMonths(viewMonth, -1))
                  if (calMode === 'months') setViewMonth(new Date(viewMonth.getFullYear() - 1, viewMonth.getMonth(), 1))
                  if (calMode === 'years') setViewMonth(new Date(viewMonth.getFullYear() - 12, viewMonth.getMonth(), 1))
                }}
                className="w-7 h-7 flex items-center justify-center rounded-md text-text-tertiary hover:bg-surface-2 hover:text-text-primary transition-colors"
                aria-label="Назад"
              ><Icon name="chevron-left" size={14} /></button>
              <button
                type="button"
                onClick={() => {
                  if (calMode === 'days') setViewMonth(addMonths(viewMonth, 1))
                  if (calMode === 'months') setViewMonth(new Date(viewMonth.getFullYear() + 1, viewMonth.getMonth(), 1))
                  if (calMode === 'years') setViewMonth(new Date(viewMonth.getFullYear() + 12, viewMonth.getMonth(), 1))
                }}
                className="w-7 h-7 flex items-center justify-center rounded-md text-text-tertiary hover:bg-surface-2 hover:text-text-primary transition-colors"
                aria-label="Вперёд"
              ><Icon name="chevron-right" size={14} /></button>
            </div>
          </div>

          <div className="px-3 pb-2">
            {calMode === 'days' && (
              <>
                <div className="grid grid-cols-7 gap-0.5 mb-1">
                  {RU_WEEKDAYS.map((wd, i) => (
                    <div key={wd} className={`text-center text-[12px] font-semibold uppercase tracking-wide py-1 ${i >= 5 ? 'text-accent/70' : 'text-text-subtle'}`}>{wd}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {cells.map((c, i) => {
                    const isOut = c.monthOffset !== 0
                    const isSel = sameDay(c.date, selected)
                    const isTd = sameDay(c.date, today)
                    const dis = isDisabledDate(c.date)
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => pick(c.date)}
                        disabled={!!dis}
                        className={`h-8 text-[14px] rounded-md transition-colors font-medium
                          ${isSel ? 'bg-accent text-white shadow-sm'
                            : dis ? 'text-border-strong cursor-not-allowed'
                            : isOut ? 'text-[#475569] hover:bg-surface-2 hover:text-text-tertiary'
                            : isTd ? 'text-accent ring-1 ring-[#F97316]/40 hover:bg-[rgba(249,115,22,0.08)]'
                            : 'text-text-primary hover:bg-surface-2'}`}
                      >{c.day}</button>
                    )
                  })}
                </div>
              </>
            )}
            {calMode === 'months' && (
              <div className="grid grid-cols-3 gap-1 py-1">
                {RU_MONTHS.map((m, i) => (
                  <button key={m} type="button"
                    onClick={() => { setViewMonth(new Date(viewMonth.getFullYear(), i, 1)); setCalMode('days') }}
                    className={`h-10 text-[14px] rounded-md transition-colors font-medium ${i === viewMonth.getMonth() ? 'bg-accent text-white shadow-sm' : 'text-text-primary hover:bg-surface-2'}`}
                  >{m.slice(0, 3)}</button>
                ))}
              </div>
            )}
            {calMode === 'years' && (
              <div className="grid grid-cols-3 gap-1 py-1">
                {years.map(y => (
                  <button key={y} type="button"
                    onClick={() => { setViewMonth(new Date(y, viewMonth.getMonth(), 1)); setCalMode('months') }}
                    className={`h-10 text-[14px] rounded-md transition-colors font-medium ${y === viewMonth.getFullYear() ? 'bg-accent text-white shadow-sm' : 'text-text-primary hover:bg-surface-2'}`}
                  >{y}</button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-[#111315]/40">
            <button type="button" onClick={handleClear} className="text-[13px] font-semibold text-text-subtle hover:text-text-primary transition-colors px-2 py-1 rounded">Очистить</button>
            {showPlusYear && (
              <button type="button" onClick={handleOneYear} className="text-[13px] font-semibold text-accent hover:bg-[rgba(249,115,22,0.12)] transition-colors px-2 py-1 rounded">На 1 год</button>
            )}
            <button type="button" onClick={handleToday} className="text-[13px] font-semibold text-accent hover:bg-[rgba(249,115,22,0.12)] transition-colors px-2 py-1 rounded">Сегодня</button>
          </div>
        </DPPortal>,
        document.body,
      )}
    </div>
  )
}
