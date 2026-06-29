import { useState, useRef, useLayoutEffect, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import { MobileSheet } from '@/components/ui/MobileSheet'

export interface SearchSelectOption {
  value: string
  label: string
  icon?: string
}

export interface SearchSelectProps {
  options: SearchSelectOption[]
  value: string
  onChange: (value: string) => void
  /** Trigger text when nothing selected */
  placeholder?: string
  /** Search input placeholder */
  searchPlaceholder?: string
  ariaLabel?: string
  /** MobileSheet title */
  title?: string
  disabled?: boolean
}

interface PortalPos {
  top: number
  left: number
  width: number
}

/**
 * Generic reusable searchable combobox.
 * Mirrors CategoryPicker's dropdown UX exactly — search input, keyboard nav,
 * orange active row, check on selected, kbd-hint footer + count.
 * Desktop: portal-to-body dropdown. Mobile (≤767px): MobileSheet.
 */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  ariaLabel,
  title,
  disabled = false,
}: SearchSelectProps) {
  const { t } = useTranslation('assets')

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [pos, setPos] = useState<PortalPos | null>(null)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Track mobile breakpoint changes
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [query, options])

  const selectedOption = options.find(o => o.value === value) ?? null

  function updatePos() {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const popWidth = Math.max(r.width, 240)
    let left = r.left
    if (left + popWidth > window.innerWidth - 8) left = window.innerWidth - popWidth - 8
    if (left < 8) left = 8
    const width = Math.min(popWidth, window.innerWidth - 16)
    setPos({ top: r.bottom + 4, left, width })
  }

  useLayoutEffect(() => {
    if (open) updatePos()
  }, [open])

  // Consolidated effect for all open-state event listeners
  useEffect(() => {
    if (!open) return

    function onScroll() { updatePos() }
    function onResize() { updatePos() }
    // NOTE: We listen for `pointerdown` (not `mousedown`) so that taps inside
    // a MobileSheet are excluded. MobileSheet's panel calls
    // `e.stopPropagation()` on `pointerdown`, preventing the event from ever
    // reaching `document`. A `mousedown` listener would NOT be stopped by that
    // and would prematurely close the sheet before the `click` fires.
    function onOutsidePointerDown(e: PointerEvent) {
      const target = e.target as Node | null
      const inTrigger = triggerRef.current?.contains(target) ?? false
      const inPortal = target instanceof Element && target.closest('[data-ss-portal="true"]') !== null
      if (!inTrigger && !inPortal) {
        setOpen(false)
        setQuery('')
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }

    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    document.addEventListener('pointerdown', onOutsidePointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('pointerdown', onOutsidePointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Reset highlight when query or open changes
  useEffect(() => {
    setActiveIdx(0)
  }, [query, open])

  // Scroll active row into view
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`)
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIdx, open])

  function selectOption(val: string) {
    onChange(val)
    setOpen(false)
    setQuery('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveIdx(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveIdx(filtered.length - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = filtered[activeIdx]
      if (item) selectOption(item.value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery('')
    }
  }

  const triggerClass = [
    'w-full px-3 py-2 text-[15px] border rounded-lg text-left outline-none transition-[background-color,border-color,box-shadow] duration-150 flex items-center justify-between gap-2',
    disabled
      ? 'bg-surface border-border opacity-50 cursor-not-allowed'
      : open
        ? 'bg-surface border-accent shadow-[0_0_0_3px_rgba(249,115,22,0.15)]'
        : selectedOption
          ? 'bg-surface border-border hover:border-border-strong cursor-pointer'
          : 'bg-surface border-border hover:border-border-strong cursor-pointer',
  ].join(' ')

  /** Shared list content — used in both portal and MobileSheet */
  const listContent = (
    <>
      {/* Search input */}
      <div className="px-2 pt-2 pb-1.5 border-b border-border">
        <div className="relative">
          <Icon
            name="search"
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none"
          />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder ?? t('placeholders.categorySearch')}
            className="w-full h-8 pl-7 pr-2 text-[16px] bg-transparent text-text-primary placeholder:text-text-subtle focus:outline-none"
          />
        </div>
      </div>

      {/* Option list */}
      <div ref={listRef} className="max-h-72 overflow-y-auto py-1" role="listbox">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-[14px] text-text-primary">
            {t('placeholders.noResults')}
          </div>
        ) : (
          filtered.map((opt, idx) => {
            const isActive = idx === activeIdx
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-idx={idx}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => selectOption(opt.value)}
                className={[
                  'w-full flex items-center gap-2 px-3 py-2 text-[16px] text-left transition-colors',
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-text-primary hover:bg-surface-2',
                ].join(' ')}
              >
                {opt.icon != null && (
                  <div className={[
                    'w-5 h-5 rounded flex items-center justify-center shrink-0',
                    isActive ? 'bg-white/20 text-white' : 'bg-surface-2 text-text-tertiary',
                  ].join(' ')}>
                    <Icon name={opt.icon} size={12} />
                  </div>
                )}
                <span className="truncate flex-1">{opt.label}</span>
                {isSelected && (
                  <Icon
                    name="check"
                    size={13}
                    className={['ml-auto shrink-0', isActive ? 'text-white' : 'text-accent'].join(' ')}
                  />
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Footer: kbd hints + count — hidden on mobile */}
      <div className="px-3 py-1.5 border-t border-border text-[12px] text-text-subtle flex items-center gap-3 bg-[#111315]/50">
        <span className="hidden md:flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-surface border border-border rounded text-[11px] font-mono text-text-primary">↑↓</kbd>
          {' '}навигация
        </span>
        <span className="hidden md:flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-surface border border-border rounded text-[11px] font-mono text-text-primary">Enter</kbd>
          {' '}выбрать
        </span>
        <span className="hidden md:flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-surface border border-border rounded text-[11px] font-mono text-text-primary">Esc</kbd>
          {' '}закрыть
        </span>
        <span className="ml-auto tabular-nums">{filtered.length} / {options.length}</span>
      </div>
    </>
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(o => !o) }}
        className={triggerClass}
      >
        {selectedOption ? (
          <span className="font-medium text-text-primary truncate flex-1">{selectedOption.label}</span>
        ) : (
          <span className="text-text-subtle flex-1">{placeholder}</span>
        )}
        <Icon
          name="chevron-down"
          size={14}
          className={[
            'shrink-0 transition-transform duration-150',
            open ? 'rotate-180 text-accent' : 'text-text-subtle',
          ].join(' ')}
        />
      </button>

      {/* Mobile: bottom sheet */}
      {isMobile && (
        <MobileSheet open={open} onClose={() => { setOpen(false); setQuery('') }} {...(title !== undefined ? { title } : {})}>
          {listContent}
        </MobileSheet>
      )}

      {/* Desktop: clamped portal dropdown */}
      {!isMobile && open && pos && createPortal(
        <div
          data-ss-portal="true"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: pos.width,
            zIndex: 1000,
          }}
          className="bg-surface ring-1 ring-[#2A2F36]/80 rounded-xl shadow-lg shadow-slate-900/10 anim-fade-slide-in overflow-hidden"
        >
          {listContent}
        </div>,
        document.body,
      )}
    </>
  )
}
