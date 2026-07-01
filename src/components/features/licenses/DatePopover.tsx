/**
 * DatePopover — portaled RU calendar with Сегодня / +6 мес / +1 год presets.
 * Sits above modals: z-[300]+.
 */
import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'

const RU_MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const RU_WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function parseLocalISO(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function toLocalISO(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

type Direction = 'auto' | 'up' | 'down'

export interface DatePopoverProps {
  value: string
  onChange: (iso: string) => void
  min?: string
  /** Direction preference. 'auto' flips based on viewport space. */
  direction?: Direction
  showOffsets?: boolean
  placeholder?: string
  /** Accessible label for the trigger button. */
  label?: string
}

export function DatePopover({
  value,
  onChange,
  min,
  direction = 'auto',
  showOffsets = true,
  placeholder = '',
  label,
}: DatePopoverProps) {
  const { t } = useTranslation('licenses')
  const [open, setOpen] = useState(false)
  const valueDate = parseLocalISO(value)
  const minDate = parseLocalISO(min ?? null)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = toLocalISO(today)

  const [view, setView] = useState<Date>(() => valueDate ?? minDate ?? new Date())
  const triggerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{
    top: number | null; bottom: number | null; left: number | null; right: number | null
  }>({ top: null, bottom: null, left: null, right: null })

  // Refs that always hold the latest valueDate / minDate so the open-effect
  // can read them without adding them as dependencies.
  const valueDateRef = useRef(valueDate)
  const minDateRef = useRef(minDate)
  useEffect(() => { valueDateRef.current = valueDate })
  useEffect(() => { minDateRef.current = minDate })

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const compute = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      let goUp: boolean
      if (direction === 'up') goUp = true
      else if (direction === 'down') goUp = false
      else goUp = (window.innerHeight - rect.bottom) < 320 || rect.bottom > window.innerHeight * 0.5
      if (goUp) {
        setPos({ bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right, top: null, left: null })
      } else {
        setPos({ top: rect.bottom + 4, left: rect.left, bottom: null, right: null })
      }
    }
    compute()
    window.addEventListener('scroll', compute, true)
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('scroll', compute, true)
      window.removeEventListener('resize', compute)
    }
  }, [open, direction])

  useEffect(() => {
    if (open) setView(valueDateRef.current ?? minDateRef.current ?? new Date())
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const year = view.getFullYear()
  const month = view.getMonth()

  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)
  const firstDow = (firstOfMonth.getDay() + 6) % 7 // Mon=0
  const daysInMonth = lastOfMonth.getDate()

  const cells: (Date | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const canGoPrev = !minDate || year > minDate.getFullYear() ||
    (year === minDate.getFullYear() && month > minDate.getMonth())

  const isDisabled = (d: Date) => !!minDate && d < minDate
  const isSelected = (d: Date) => !!valueDate && toLocalISO(d) === toLocalISO(valueDate)
  const isToday = (d: Date) => toLocalISO(d) === todayISO

  const handlePick = (d: Date) => {
    if (isDisabled(d)) return
    onChange(toLocalISO(d))
    setOpen(false)
  }

  const presetAnchor = minDate ?? today
  const pickOffset = (months: number) =>
    handlePick(new Date(presetAnchor.getFullYear(), presetAnchor.getMonth() + months, presetAnchor.getDate()))

  const todayDisabled = !!minDate && today < minDate

  const calendarNode = open ? (
    <>
      <div
        onClick={() => setOpen(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 300 }}
      />
      <div
        className="min-w-[244px] bg-surface border border-border rounded-xl shadow-xl p-2.5"
        style={{
          position: 'fixed',
          zIndex: 301,
          top: pos.top != null ? pos.top : 'auto',
          bottom: pos.bottom != null ? pos.bottom : 'auto',
          left: pos.left != null ? pos.left : 'auto',
          right: pos.right != null ? pos.right : 'auto',
          animation: 'modalPop 200ms cubic-bezier(.22,1,.36,1) both',
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('datePopover.aria')}
      >
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => { if (canGoPrev) setView(new Date(year, month - 1, 1)) }}
            disabled={!canGoPrev}
            aria-label={t('datePopover.prevMonth')}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
              canGoPrev ? 'hover:bg-surface-2 text-text-primary' : 'text-text-subtle cursor-not-allowed'
            }`}
          >
            <Icon name="chevron-left" size={14} />
          </button>
          <div className="text-[13px] font-semibold text-text-primary">
            {RU_MONTHS[month]} {year}
          </div>
          <button
            type="button"
            onClick={() => setView(new Date(year, month + 1, 1))}
            aria-label={t('datePopover.nextMonth')}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-surface-2 text-text-primary transition-colors"
          >
            <Icon name="chevron-right" size={14} />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {RU_WEEKDAYS.map(w => (
            <div key={w} className="text-[11.5px] font-semibold text-text-tertiary text-center py-1">{w}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            if (!d) return <div key={`ph-${i}`} />
            const disabled = isDisabled(d)
            const selected = isSelected(d)
            const todayCell = isToday(d)
            return (
              <button
                type="button"
                key={toLocalISO(d)}
                onClick={() => handlePick(d)}
                disabled={disabled}
                tabIndex={disabled ? -1 : 0}
                className={[
                  'h-7 w-7 mx-auto rounded-md text-[13px] font-medium tabular-nums transition-colors flex items-center justify-center',
                  disabled ? 'text-text-subtle opacity-50 line-through cursor-not-allowed select-none' : '',
                  !disabled && !selected ? 'text-text-primary hover:bg-accent/10 hover:text-accent-light' : '',
                  selected ? 'bg-orange-500 text-white hover:bg-orange-500' : '',
                  todayCell && !selected && !disabled ? 'ring-2 ring-accent/30' : '',
                  todayCell && selected ? 'ring-2 ring-accent/30' : '',
                ].filter(Boolean).join(' ')}
              >
                {d.getDate()}
              </button>
            )
          })}
        </div>

        {/* Footer presets */}
        <div className="mt-2 pt-2 border-t border-border flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => { if (!todayDisabled) handlePick(today) }}
            disabled={todayDisabled}
            className={`flex-1 h-7 rounded-md text-[12px] font-semibold transition-colors ${
              todayDisabled
                ? 'text-text-subtle opacity-50 cursor-not-allowed'
                : 'text-accent-light hover:bg-accent/10'
            }`}
          >
            {t('datePopover.today')}
          </button>
          {showOffsets && (
            <>
              <button
                type="button"
                onClick={() => pickOffset(6)}
                className="flex-1 h-7 rounded-md text-[12px] font-medium text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors"
              >
                {t('datePopover.plus6m')}
              </button>
              <button
                type="button"
                onClick={() => pickOffset(12)}
                className="flex-1 h-7 rounded-md text-[12px] font-medium text-text-tertiary hover:text-text-primary hover:bg-surface-2 transition-colors"
              >
                {t('datePopover.plus1y')}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  ) : null

  const displayValue = valueDate ? valueDate.toLocaleDateString('ru-RU') : null

  return (
    <div className="relative" ref={triggerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={label ?? t('datePopover.aria')}
        aria-expanded={open}
        className={[
          'w-full h-9 px-2.5 text-[13.5px] rounded-lg border bg-surface text-left flex items-center justify-between gap-2 transition-colors outline-none',
          open
            ? 'border-orange-400 ring-2 ring-accent/30'
            : 'border-border hover:border-border-strong',
        ].join(' ')}
      >
        <span className={`whitespace-nowrap truncate ${displayValue ? 'text-text-primary tabular-nums' : 'text-text-subtle'}`}>
          {displayValue ?? (placeholder || t('datePopover.placeholder'))}
        </span>
        <Icon name="calendar" size={13} className={`shrink-0 ${displayValue ? 'text-accent-light' : 'text-text-subtle'}`} />
      </button>
      {ReactDOM.createPortal(calendarNode, document.body)}
    </div>
  )
}
