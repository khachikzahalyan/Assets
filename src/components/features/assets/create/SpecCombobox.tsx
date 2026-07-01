import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { Icon } from '@/components/ui'
import { useExclusiveDropdown } from './dropdownBus'

export interface SpecComboboxProps {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  placeholder?: string
  id?: string
}

/** Free-text input with a filtered suggestion dropdown (CPU, reusable keys, etc.). */
export function SpecCombobox({ value, onChange, suggestions, placeholder, id }: SpecComboboxProps) {
  const [open, setOpen] = useState(false)
  useExclusiveDropdown(open, setOpen)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (!value) return suggestions
    const lower = value.toLowerCase()
    if (suggestions.some(s => s.toLowerCase() === lower)) return suggestions
    return suggestions.filter(s => s.toLowerCase().includes(lower))
  }, [value, suggestions])

  const updatePos = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    // Clamp so the dropdown never bleeds off-screen on narrow viewports
    const minWidth = Math.max(r.width, 180)
    let left = r.left
    if (left + minWidth > window.innerWidth - 8) left = window.innerWidth - minWidth - 8
    if (left < 8) left = 8
    const width = Math.min(minWidth, window.innerWidth - 16)
    setPos({ top: r.bottom + 6, left, width })
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
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (triggerRef.current?.contains(t)) return
      if (t.closest?.('[data-spec-portal="true"]')) return
      setOpen(false); setActiveIdx(-1)
    }
    document.addEventListener('click', onDown)
    return () => document.removeEventListener('click', onDown)
  }, [open])

  const pick = (s: string) => { onChange(s); setOpen(false); setActiveIdx(-1) }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setActiveIdx(-1) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && open && activeIdx >= 0 && filtered[activeIdx]) { e.preventDefault(); pick(filtered[activeIdx]!) }
  }

  return (
    <div className="relative">
      <div
        ref={triggerRef}
        data-ams-dropdown="true"
        className="flex items-center border-b border-border focus-within:border-accent focus-within:shadow-[0_2px_8px_rgba(217,119,87,0.1)] transition-[border-color,box-shadow] duration-200 cursor-text"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          setOpen(true)
          const input = e.currentTarget.querySelector('input')
          if (input && document.activeElement !== input) input.focus()
        }}
      >
        <input
          id={id}
          type="text"
          value={value || ''}
          onChange={e => { onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-0 py-2.5 text-[15px] bg-transparent text-text-primary outline-none placeholder:text-text-subtle"
        />
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => { e.preventDefault(); setOpen(o => !o) }}
          className={`shrink-0 pl-1 pr-0.5 text-text-subtle hover:text-text-tertiary transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          aria-label="Открыть список"
        ><Icon name="chevron-down" size={14} /></button>
      </div>
      {open && pos && filtered.length > 0 && ReactDOM.createPortal(
        <div
          data-spec-portal="true"
          data-ams-dropdown="true"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 1000 }}
          className="rounded-lg bg-surface shadow-lg ring-1 ring-border max-h-64 overflow-y-auto anim-fade-slide-in"
        >
          {filtered.map((s, idx) => {
            const isActive = idx === activeIdx || s === value
            return (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(s) }}
                onMouseEnter={() => setActiveIdx(idx)}
                className={`block w-full px-3 py-2 text-[14.5px] text-left transition-colors duration-75 ${isActive ? 'bg-accent text-white' : 'text-text-primary hover:bg-accent hover:text-white'}`}
              >{s}</button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
