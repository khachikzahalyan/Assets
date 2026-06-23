import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@/components/ui/icon'
import { MobileSheet } from '@/components/ui/MobileSheet'

export interface ViewSortOption {
  value: string
  label: string
  shortLabel: string
  hint: string
  icon: string
  iconColor: string
}

export interface ViewPopoverProps {
  sort: string
  onChangeSort: (v: string) => void
  options: ViewSortOption[]
  defaultSort?: string
  viewLabel: string
  title: string
  subtitle: string
}

interface PortalPos {
  top: number
  left: number
}

/** Returns true when window.innerWidth ≤ 767px. Safe in jsdom (no matchMedia). */
function getIsMobile(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(max-width: 767px)').matches
}

/**
 * Sort / view popover for the assets filter bar.
 * Desktop: portal-to-body anchored popover with outside-click + Escape close.
 * Mobile (≤767px): MobileSheet bottom-sheet listing the same options.
 */
export function ViewPopover({
  sort,
  onChangeSort,
  options,
  defaultSort = 'updated_desc',
  viewLabel,
  title,
  subtitle,
}: ViewPopoverProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<PortalPos>({ top: 0, left: 0 })
  const [isMobile, setIsMobile] = useState(getIsMobile)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Track mobile/desktop switches (e.g. browser resize)
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

  const isDefault = sort === defaultSort
  const activeOpt = options.find(o => o.value === sort) ?? options[0]

  function updatePos() {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const panelW = 260
    // Left-align to the trigger (open rightward, like SelectMini), clamped so the
    // panel never bleeds off the right edge of the viewport.
    const left = Math.max(8, Math.min(r.left, window.innerWidth - panelW - 8))
    setPos({ top: r.bottom + 6, left })
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
      const inPortal = t instanceof Element && t.closest('[data-vp-portal="true"]') !== null
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
    'inline-flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-lg border transition-colors duration-150 cursor-pointer',
    !isDefault
      ? 'bg-[rgba(249,115,22,0.12)] border-[rgba(249,115,22,0.30)]/80'
      : open
        ? 'bg-surface border-border-strong ring-2 ring-border-strong/70'
        : 'bg-surface border-border hover:border-border-strong',
  ].join(' ')

  const optionList = (
    <>
      {options.map(opt => {
        const active = sort === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              onChangeSort(opt.value)
              setOpen(false)
            }}
            className={[
              'w-full flex items-center gap-2.5 px-3.5 py-2 text-left transition-colors duration-100',
              active ? 'bg-accent text-white' : 'text-text-primary hover:bg-bg',
            ].join(' ')}
          >
            <span
              className="flex-shrink-0 inline-flex"
              style={{ color: active ? '#FFFFFF' : opt.iconColor }}
            >
              <Icon name={opt.icon} size={13} />
            </span>
            <div className="flex-1 min-w-0">
              <div
                className={[
                  'text-[14.5px] truncate',
                  active ? 'font-semibold' : 'font-medium',
                ].join(' ')}
              >
                {opt.label}
              </div>
              <div
                className={[
                  'text-[12.5px] truncate',
                  active ? 'text-white/80' : 'text-text-tertiary',
                ].join(' ')}
              >
                {opt.hint}
              </div>
            </div>
            {active && (
              <Icon name="check" size={13} className="text-white" />
            )}
          </button>
        )
      })}
    </>
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={viewLabel}
        onClick={() => setOpen(v => !v)}
        className={triggerClass}
      >
        <Icon
          name="list-filter"
          size={12}
          className={!isDefault ? 'text-accent-light' : 'text-text-subtle'}
        />
        <span
          className={[
            'text-[13px] uppercase tracking-[0.07em] font-semibold',
            !isDefault ? 'text-accent' : 'text-text-tertiary',
          ].join(' ')}
        >
          {viewLabel}
        </span>
        <span
          className={[
            'text-[14px] font-semibold tracking-tight',
            !isDefault ? 'text-accent-hover' : 'text-text-secondary',
          ].join(' ')}
        >
          {activeOpt?.shortLabel ?? activeOpt?.label ?? ''}
        </span>
        {!isDefault && (
          <span className="w-1.5 h-1.5 rounded-full bg-accent-light flex-shrink-0" aria-hidden="true" />
        )}
        <Icon
          name="chevron-down"
          size={12}
          className={[
            'transition-transform duration-150',
            open ? 'rotate-180' : '',
            !isDefault ? 'text-accent-light' : 'text-text-subtle',
          ].join(' ')}
        />
      </button>

      {/* ── Mobile branch: bottom-sheet ── */}
      {isMobile && (
        <MobileSheet open={open} onClose={() => setOpen(false)} title={title}>
          <div className="py-1">
            {optionList}
          </div>
        </MobileSheet>
      )}

      {/* ── Desktop branch: anchored popover ── */}
      {!isMobile && open &&
        createPortal(
          <div
            data-vp-portal="true"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: 260,
              zIndex: 1000,
            }}
            className="bg-surface border border-border rounded-xl shadow-2xl shadow-slate-900/20 anim-fade-slide-in overflow-hidden"
          >
            {/* Header */}
            <div className="px-3.5 pt-3 pb-2 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-[12px] uppercase tracking-[0.08em] font-semibold text-text-primary">
                  {title}
                </div>
                <div className="text-[14px] text-text-secondary mt-0.5">
                  {subtitle}
                </div>
              </div>
              <Icon name="layers" size={14} className="text-text-subtle" />
            </div>

            {/* Options */}
            <div className="py-1">
              {optionList}
            </div>
          </div>,
          document.body,
        )
      }
    </>
  )
}
