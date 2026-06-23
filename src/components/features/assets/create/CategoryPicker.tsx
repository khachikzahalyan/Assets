import { useState, useRef, useLayoutEffect, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import { MobileSheet } from '@/components/ui/MobileSheet'
import type { CategoryRow } from '@/domain/asset'

// The capability taxonomy + derivation now live in the pure domain layer
// (src/domain/asset/categoryCapabilities.ts). Re-exported here under the historic
// names so existing import sites (AssetCreateForm, AssetDetailPage) stay stable.
export {
  resolveCategoryCapabilities as categoryCapabilities,
  type CategoryCapabilities,
} from '@/domain/asset'

export interface CategoryPickerProps {
  categories: CategoryRow[]
  value: string
  onChange: (categoryId: string) => void
  /** When set, restricts options to a single group (group-tab filter). */
  group?: 'devices' | 'network' | 'furniture' | null
  /** Disables the trigger (e.g. edit mode where category is locked). */
  disabled?: boolean
}

interface PortalPos {
  top: number
  left: number
  width: number
}

/**
 * Searchable combobox category picker matching the prototype CategoryCombobox.
 * Portal-to-body dropdown with search input, keyboard navigation, and a kbd-hint footer.
 */
export function CategoryPicker({ categories, value, onChange, group, disabled = false }: CategoryPickerProps) {
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

  // Filter categories by group prop
  const groupCategories = useMemo(() => {
    if (!group) return categories
    return categories.filter(c => c.group === group)
  }, [categories, group])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groupCategories
    return groupCategories.filter(c => c.name.toLowerCase().includes(q))
  }, [query, groupCategories])

  const selectedCat = categories.find(c => c.id === value) ?? null

  function updatePos() {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    // Clamp left so dropdown never bleeds off-screen on narrow viewports
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

  // Single consolidated effect for all "open" event listeners — matches SelectMini pattern
  useEffect(() => {
    if (!open) return

    function onScroll() { updatePos() }
    function onResize() { updatePos() }
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node | null
      const inTrigger = triggerRef.current?.contains(t) ?? false
      const inPortal = t instanceof Element && t.closest('[data-cb-portal="true"]') !== null
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
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Reset highlight when query/group/open changes
  useEffect(() => {
    setActiveIdx(0)
  }, [query, open, group])

  // Scroll active row into view
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`)
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIdx, open])

  function selectCategory(id: string) {
    onChange(id)
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
      if (item) selectCategory(item.id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery('')
    }
  }

  const triggerClass = [
    'w-full px-0 py-2.5 text-[15px] border-b bg-transparent rounded-none flex items-center gap-2 outline-none shadow-none transition-[border-color,box-shadow] duration-200 text-left',
    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    open
      ? 'border-accent shadow-[0_2px_8px_rgba(217,119,87,0.1)]'
      : 'border-border hover:border-border-strong',
  ].join(' ')

  /** Shared category list content — used in both portal and MobileSheet */
  const categoryListContent = (
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
            placeholder={t('placeholders.categorySearch')}
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
          filtered.map((c, idx) => {
            const isActive = idx === activeIdx
            const isSelected = c.id === value
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-idx={idx}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => selectCategory(c.id)}
                className={[
                  'w-full flex items-center gap-2 px-3 py-2 text-[16px] text-left transition-colors',
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-text-primary hover:bg-surface-2',
                ].join(' ')}
              >
                <div className={[
                  'w-5 h-5 rounded flex items-center justify-center shrink-0',
                  isActive ? 'bg-white/20 text-white' : 'bg-surface-2 text-text-tertiary',
                ].join(' ')}>
                  <Icon name={c.lucideIcon} size={12} />
                </div>
                <span className="truncate flex-1">{c.name}</span>
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

      {/* Footer: kbd hints + count — hidden on mobile sheet */}
      <div className="px-3 py-1.5 border-t border-border text-[12px] text-text-subtle flex items-center gap-3 bg-bg/50">
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
        <span className="ml-auto tabular-nums">{filtered.length} / {groupCategories.length}</span>
      </div>
    </>
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={t('form.category')}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(o => !o) }}
        className={triggerClass}
      >
        {selectedCat ? (
          <>
            <div className="w-5 h-5 rounded bg-surface-2 text-text-tertiary flex items-center justify-center shrink-0">
              <Icon name={selectedCat.lucideIcon} size={12} />
            </div>
            <span className="font-medium text-text-primary truncate flex-1">{selectedCat.name}</span>
          </>
        ) : (
          <span className="text-text-subtle flex-1">{t('placeholders.category')}</span>
        )}
        <Icon
          name="chevron-down"
          size={14}
          className={[
            'text-text-subtle shrink-0 ml-auto transition-transform duration-150',
            open ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {/* Mobile: bottom sheet */}
      {isMobile && (
        <MobileSheet open={open} onClose={() => { setOpen(false); setQuery('') }} title={t('form.category')}>
          {categoryListContent}
        </MobileSheet>
      )}

      {/* Desktop: clamped portal dropdown */}
      {!isMobile && open && pos && createPortal(
        <div
          data-cb-portal="true"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: pos.width,
            zIndex: 1000,
          }}
          className="bg-surface ring-1 ring-border/80 rounded-xl shadow-lg shadow-slate-900/10 anim-fade-slide-in overflow-hidden"
        >
          {categoryListContent}
        </div>,
        document.body,
      )}
    </>
  )
}
