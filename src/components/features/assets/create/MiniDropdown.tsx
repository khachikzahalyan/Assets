import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { Icon } from '@/components/ui'
import { useExclusiveDropdown } from './dropdownBus'

export interface MiniOption { value: string; label: string }

export interface MiniDropdownProps {
  value: string
  onChange: (v: string) => void
  options: MiniOption[]
  placeholder?: string
  disabled?: boolean
  ariaLabel?: string
}

/**
 * Compact value+chevron dropdown (no label prefix) for inline spec slots.
 * Portal-to-body, keyboard nav, exclusive-open. Ported from the prototype MiniSelect.
 */
export function MiniDropdown({ value, onChange, options, placeholder = 'Выберите…', disabled = false, ariaLabel }: MiniDropdownProps) {
  const [open, setOpen] = useState(false)
  useExclusiveDropdown(open, setOpen)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const selectedLabel = useMemo(() => options.find(o => o.value === value)?.label ?? null, [value, options])

  const updatePos = useCallback(() => {
    const btn = triggerRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    // Clamp so the dropdown never bleeds off-screen on narrow viewports.
    // minWidth is the larger of the trigger width or 120px (fits typical labels).
    const minWidth = Math.max(r.width, 120)
    let left = r.left
    if (left + minWidth > window.innerWidth - 8) left = window.innerWidth - minWidth - 8
    if (left < 8) left = 8
    setPos({ top: r.bottom + 8, left, width: r.width })
  }, [])

  const openPanel = useCallback(() => {
    if (disabled) return
    const idx = options.findIndex(o => o.value === value)
    setActiveIndex(idx >= 0 ? idx : 0)
    setOpen(true)
  }, [options, value, disabled])

  const closePanel = useCallback((returnFocus = true) => {
    setOpen(false); setActiveIndex(-1); setPos(null)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) { setPos(null); return }
    updatePos()
    const on = () => updatePos()
    window.addEventListener('resize', on)
    window.addEventListener('scroll', on, true)
    return () => { window.removeEventListener('resize', on); window.removeEventListener('scroll', on, true) }
  }, [open, updatePos])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (triggerRef.current?.contains(t)) return
      if (t.closest?.('[data-mini-portal="true"]')) return
      closePanel(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open, closePanel])

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); open ? closePanel() : openPanel() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) openPanel(); else setActiveIndex(i => Math.min(i + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (!open) openPanel(); else setActiveIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Escape') { e.preventDefault(); closePanel() }
    else if (e.key === 'Tab') { closePanel(false) }
  }

  const onPanelKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const o = options[activeIndex]; if (o) { onChange(o.value); closePanel() } }
    else if (e.key === 'Escape') { e.preventDefault(); closePanel() }
    else if (e.key === 'Tab') { closePanel(false) }
  }

  const triggerCls = disabled
    ? 'bg-bg border-border opacity-50 cursor-not-allowed'
    : open ? 'bg-surface border-accent shadow-[0_0_0_3px_rgba(249,115,22,0.15)]'
    : selectedLabel ? 'bg-surface border-border hover:border-border-strong'
    : 'bg-surface border-border hover:border-border-strong'

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        data-ams-dropdown="true"
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => !disabled && (open ? closePanel() : openPanel())}
        onKeyDown={onTriggerKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full px-3 py-2 text-[15px] border rounded-lg text-left outline-none transition-[background-color,border-color,box-shadow] duration-150 flex items-center justify-between gap-2 ${triggerCls}`}
      >
        <span className={selectedLabel ? 'text-text-primary font-medium truncate' : 'text-text-subtle truncate'}>{selectedLabel || placeholder}</span>
        <span className={`inline-flex items-center transition-[transform,color] duration-150 ${open ? 'rotate-180 text-accent' : 'rotate-0 text-text-subtle'}`}><Icon name="chevron-down" size={14} /></span>
      </button>

      {open && !disabled && pos && ReactDOM.createPortal(
        <div
          data-mini-portal="true"
          data-ams-dropdown="true"
          role="listbox"
          tabIndex={-1}
          onKeyDown={onPanelKey}
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width, maxWidth: `calc(100vw - 16px)`, zIndex: 1000 }}
          className="bg-surface rounded-xl ring-1 ring-border shadow-xl shadow-slate-900/30 py-1.5 max-h-[260px] overflow-y-auto w-max anim-fade-slide-in"
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value
            const isActive = idx === activeIndex
            const stateCls = isActive ? 'bg-accent text-white font-medium'
              : isSelected ? 'bg-[rgba(249,115,22,0.12)] text-text-primary font-semibold'
              : 'text-text-secondary'
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => { e.preventDefault(); onChange(opt.value); closePanel() }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`mx-1 px-2.5 py-1.5 rounded-md text-[15px] cursor-pointer flex items-center justify-between gap-3 transition-colors ${stateCls}`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <span className={`inline-flex items-center shrink-0 ${isActive ? 'text-white' : 'text-accent'}`}><Icon name="check" size={14} /></span>}
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
