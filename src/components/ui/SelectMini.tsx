import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './icon'
import { MobileSheet } from './MobileSheet'

export interface SelectMiniOption {
  value: string
  label: string
  dotColor?: string
  icon?: string
  iconColor?: string
}

export interface SelectMiniProps {
  label: string
  leadingIcon?: string
  value: string
  onChange: (v: string) => void
  options: SelectMiniOption[]
  id?: string
  /** Title shown in the mobile bottom-sheet header. Defaults to `label`. */
  sheetTitle?: string
  /**
   * The value treated as the neutral default; when `value` equals it the trigger
   * renders in the neutral (non-active) style. Defaults to 'all'.
   */
  defaultValue?: string
}

interface PortalPos {
  top: number
  left: number
  minWidth: number
}

/** Returns true when window.innerWidth ≤ 767px. Safe in jsdom (no matchMedia). */
function getIsMobile(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(max-width: 767px)').matches
}

/**
 * Compact labeled select chip styled for filter bars.
 * Renders as: [icon LABEL value ▾]
 * Desktop: portal-to-body dropdown with outside-click + Escape close.
 * Mobile (≤767px): MobileSheet bottom-sheet with option rows.
 */
export function SelectMini({ label, leadingIcon, value, onChange, options, sheetTitle, defaultValue = 'all' }: SelectMiniProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<PortalPos | null>(null)
  const [isMobile, setIsMobile] = useState(getIsMobile)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const current = options.find(o => o.value === value)
  const isNonDefault = value !== defaultValue

  // Track mobile/desktop switches
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(max-width: 767px)')
    function handler(e: MediaQueryListEvent) {
      setIsMobile(e.matches)
      setOpen(false)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function updatePos() {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      top: r.bottom + 6,
      left: r.left,
      minWidth: Math.max(r.width, 180),
    })
  }

  useLayoutEffect(() => {
    if (open && !isMobile) updatePos()
  }, [open, isMobile])

  useEffect(() => {
    if (!open || isMobile) return

    function onScroll() { updatePos() }
    function onResize() { updatePos() }
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node | null
      const inTrigger = triggerRef.current?.contains(t) ?? false
      const inPortal = t instanceof Element && t.closest('[data-sm-portal="true"]') !== null
      if (!inTrigger && !inPortal) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, isMobile])

  const triggerClass = [
    'inline-flex items-center gap-1.5 h-9 pl-2.5 pr-2 rounded-lg border leading-none transition-colors duration-150 cursor-pointer',
    'max-md:h-[30px] max-md:pl-[10px] max-md:pr-[8px] max-md:text-[12px]',
    isNonDefault
      ? 'bg-[rgba(249,115,22,0.12)] border-[rgba(249,115,22,0.30)]/80 text-accent-hover'
      : open
        ? 'bg-surface border-border-strong ring-2 ring-border-strong/70'
        : 'bg-surface border-border hover:border-border-strong',
  ].join(' ')

  /** Shared option rows used in both sheet and dropdown */
  const optionRows = (
    <div className="py-1.5 max-h-[280px] overflow-y-auto" role="listbox">
      {options.map(opt => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={isActive}
            onClick={() => {
              onChange(opt.value)
              setOpen(false)
            }}
            className={[
              'w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors duration-100',
              isActive ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg',
            ].join(' ')}
          >
            {leadingIcon && (
              opt.dotColor ? (
                <span
                  style={{ backgroundColor: opt.dotColor }}
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                />
              ) : (
                <span
                  className="flex-shrink-0 inline-flex"
                  style={{ color: isActive ? '#FFFFFF' : (opt.iconColor ?? '#64748B') }}
                >
                  <Icon name={opt.icon ?? leadingIcon} size={14} />
                </span>
              )
            )}
            <span
              className={[
                'flex-1 text-[15px] truncate',
                isActive ? 'font-semibold' : '',
              ].join(' ')}
            >
              {opt.label}
            </span>
            {isActive && (
              <Icon name="check" size={14} className="text-white" />
            )}
          </button>
        )
      })}
    </div>
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen(v => !v)}
        className={triggerClass}
      >
        {leadingIcon && (
          <Icon
            name={leadingIcon}
            size={14}
            className={isNonDefault ? 'text-accent-light' : 'text-text-subtle'}
          />
        )}
        <span
          className={[
            'text-[14px] leading-none uppercase tracking-[0.07em] font-semibold max-md:text-[12px]',
            isNonDefault ? 'text-accent' : 'text-text-tertiary',
          ].join(' ')}
        >
          {label}
        </span>
        <span
          className={[
            'text-[14px] leading-none font-semibold tracking-tight truncate max-w-[140px] max-md:text-[12px]',
            isNonDefault ? 'text-accent-hover' : 'text-text-secondary',
          ].join(' ')}
        >
          {current?.label ?? value}
        </span>
        <Icon
          name="chevron-down"
          size={14}
          className={[
            'transition-transform duration-150',
            open ? 'rotate-180' : '',
            isNonDefault ? 'text-accent-light' : 'text-text-subtle',
          ].join(' ')}
        />
      </button>

      {/* ── Mobile branch: bottom-sheet ── */}
      {isMobile && (
        <MobileSheet open={open} onClose={() => setOpen(false)} title={sheetTitle ?? label}>
          {optionRows}
        </MobileSheet>
      )}

      {/* ── Desktop branch: anchored dropdown ── */}
      {!isMobile && open && pos &&
        createPortal(
          <div
            data-sm-portal="true"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              minWidth: pos.minWidth,
              zIndex: 1000,
            }}
            className="bg-surface border border-border rounded-xl shadow-xl shadow-black/40 anim-fade-slide-in overflow-hidden"
          >
            <div className="py-1.5 max-h-[280px] overflow-y-auto" role="listbox">
              {options.map(opt => {
                const isActive = opt.value === value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      onChange(opt.value)
                      setOpen(false)
                    }}
                    className={[
                      'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors duration-100',
                      isActive ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg',
                    ].join(' ')}
                  >
                    {leadingIcon && (
                      opt.dotColor ? (
                        <span
                          style={{ backgroundColor: opt.dotColor }}
                          className="w-2 h-2 rounded-full flex-shrink-0"
                        />
                      ) : (
                        <span
                          className="flex-shrink-0 inline-flex"
                          style={{ color: isActive ? '#FFFFFF' : (opt.iconColor ?? '#64748B') }}
                        >
                          <Icon name={opt.icon ?? leadingIcon} size={12} />
                        </span>
                      )
                    )}
                    <span
                      className={[
                        'flex-1 text-[14.5px] truncate',
                        isActive ? 'font-semibold' : '',
                      ].join(' ')}
                    >
                      {opt.label}
                    </span>
                    {isActive && (
                      <Icon name="check" size={13} className="text-white" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )
      }
    </>
  )
}
