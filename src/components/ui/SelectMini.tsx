import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './icon'
import { MobileSheet } from './MobileSheet'
import { rafThrottle } from '@/lib/rafThrottle'
import { useDismissOnOutside } from '@/hooks/useDismissOnOutside'
import { useIsMobile } from '@/hooks/useIsMobile'

export interface SelectMiniOption {
  value: string
  label: string
  dotColor?: string
  icon?: string
  iconColor?: string
  /** Custom leading node (e.g. a RoleIcon badge) — takes precedence over `icon`/`dotColor`. */
  iconNode?: ReactNode
}

export interface SelectMiniProps {
  label: string
  leadingIcon?: string
  /** Mobile-only trigger icon override (≤767px). Desktop keeps `leadingIcon`. */
  leadingIconMobile?: string
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
  /** Extra classes merged onto the trigger button (e.g. width control in a filter bar). */
  className?: string
}

interface PortalPos {
  top: number
  left: number
  minWidth: number
}

// ── OptionRow — shared row renderer for both sheet and dropdown ──────────────

interface OptionRowProps {
  opt: SelectMiniOption
  isActive: boolean
  leadingIcon?: string
  size: 'sheet' | 'dropdown'
  onSelect: () => void
}

function OptionRow({ opt, isActive, leadingIcon, size, onSelect }: OptionRowProps) {
  const isSheet = size === 'sheet'
  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      onClick={onSelect}
      className={[
        'w-full flex items-center gap-2 px-3 text-left transition-colors duration-100',
        isSheet ? 'py-2.5' : 'py-2',
        isActive ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg',
      ].join(' ')}
    >
      {leadingIcon && (
        opt.iconNode ? (
          <span className={`flex-shrink-0 inline-flex items-center justify-center ${isSheet ? 'w-[18px] h-[18px]' : 'w-4 h-4'}`}>{opt.iconNode}</span>
        ) : opt.dotColor ? (
          <span
            style={{ backgroundColor: opt.dotColor }}
            className={`rounded-full flex-shrink-0 ${isSheet ? 'w-2.5 h-2.5' : 'w-2 h-2'}`}
          />
        ) : (
          <span
            className="flex-shrink-0 inline-flex"
            style={{ color: isActive ? '#FFFFFF' : (opt.iconColor ?? (isSheet ? '#64748B' : 'var(--color-text-subtle)')) }}
          >
            <Icon name={opt.icon ?? leadingIcon} size={isSheet ? 14 : 12} />
          </span>
        )
      )}
      <span
        className={[
          'flex-1 truncate',
          isSheet ? 'text-15' : 'text-14.5',
          isActive ? 'font-semibold' : '',
        ].join(' ')}
      >
        {opt.label}
      </span>
      {isActive && (
        <Icon name="check" size={isSheet ? 14 : 13} className="text-white" />
      )}
    </button>
  )
}

/**
 * Compact labeled select chip styled for filter bars.
 * Renders as: [icon LABEL value ▾]
 * Desktop: portal-to-body dropdown with outside-click + Escape close.
 * Mobile (≤767px): MobileSheet bottom-sheet with option rows.
 */
export function SelectMini({ id, label, leadingIcon, leadingIconMobile, value, onChange, options, sheetTitle, defaultValue = 'all', className }: SelectMiniProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<PortalPos | null>(null)
  const isMobile = useIsMobile()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const portalRef = useRef<HTMLDivElement>(null)

  useDismissOnOutside([triggerRef, portalRef], () => setOpen(false), open && !isMobile)

  const current = options.find(o => o.value === value)
  const isNonDefault = value !== defaultValue

  // Close when switching between mobile and desktop
  useEffect(() => { setOpen(false) }, [isMobile])

  function updatePos() {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const next: PortalPos = {
      top: r.bottom + 6,
      left: r.left,
      minWidth: Math.max(r.width, 180),
    }
    setPos(prev =>
      prev && prev.top === next.top && prev.left === next.left && prev.minWidth === next.minWidth
        ? prev
        : next,
    )
  }

  useLayoutEffect(() => {
    if (open && !isMobile) updatePos()
  }, [open, isMobile])

  useEffect(() => {
    if (!open || isMobile) return

    const onScrollResize = rafThrottle(updatePos)
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    window.addEventListener('scroll', onScrollResize, true)
    window.addEventListener('resize', onScrollResize)
    document.addEventListener('keydown', onKey)
    return () => {
      onScrollResize.cancel()
      window.removeEventListener('scroll', onScrollResize, true)
      window.removeEventListener('resize', onScrollResize)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, isMobile])

  const triggerClass = [
    'inline-flex items-center gap-1.5 h-9 pl-2.5 pr-2 rounded-lg border leading-none transition-colors duration-150 cursor-pointer',
    'max-md:h-[var(--ctl-h-sm)] max-md:pl-2.5 max-md:pr-2 max-md:text-12',
    isNonDefault
      ? 'bg-[rgba(249,115,22,0.12)] border-[rgba(249,115,22,0.30)]/80 text-accent-hover'
      : open
        ? 'bg-surface border-border-strong ring-2 ring-border-strong/70'
        : 'bg-surface border-border hover:border-border-strong',
    className,
  ].filter(Boolean).join(' ')

  /** Sheet option rows (mobile bottom-sheet) */
  const sheetOptionRows = (
    <div className="py-1.5 max-h-[280px] overflow-y-auto" role="listbox">
      {options.map(opt => (
        <OptionRow
          key={opt.value}
          opt={opt}
          isActive={opt.value === value}
          {...(leadingIcon !== undefined ? { leadingIcon } : {})}
          size="sheet"
          onSelect={() => { onChange(opt.value); setOpen(false) }}
        />
      ))}
    </div>
  )

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
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
            className={[
              isNonDefault ? 'text-accent-light' : 'text-text-subtle',
              leadingIconMobile ? 'max-md:hidden' : '',
            ].join(' ')}
          />
        )}
        {leadingIconMobile && (
          <Icon
            name={leadingIconMobile}
            size={11}
            className={`md:hidden ${isNonDefault ? 'text-accent-light' : 'text-text-subtle'}`}
          />
        )}
        <span
          className={[
            'text-14 leading-none uppercase tracking-[0.07em] font-semibold max-md:text-12',
            isNonDefault ? 'text-accent' : 'text-text-tertiary',
          ].join(' ')}
        >
          {label}
        </span>
        <span
          className={[
            'text-14 leading-none font-semibold tracking-tight truncate max-w-[12rem] max-md:text-12',
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
          {sheetOptionRows}
        </MobileSheet>
      )}

      {/* ── Desktop branch: anchored dropdown ── */}
      {!isMobile && open && pos &&
        createPortal(
          <div
            ref={portalRef}
            data-sm-portal="true"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              minWidth: pos.minWidth,
              zIndex: 9500, // above MobileSheet (z-9000) — see MiniDropdown note
            }}
            className="bg-surface border border-border rounded-xl shadow-xl shadow-black/40 light:shadow-slate-300/60 anim-fade-slide-in overflow-hidden"
          >
            <div className="py-1.5 max-h-[17.5rem] overflow-y-auto" role="listbox">
              {options.map(opt => (
                <OptionRow
                  key={opt.value}
                  opt={opt}
                  isActive={opt.value === value}
                  {...(leadingIcon !== undefined ? { leadingIcon } : {})}
                  size="dropdown"
                  onSelect={() => { onChange(opt.value); setOpen(false) }}
                />
              ))}
            </div>
          </div>,
          document.body,
        )
      }
    </>
  )
}
