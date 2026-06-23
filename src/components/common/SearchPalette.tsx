import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/icon'
import { Chip } from '@/components/ui/chip'

export interface SearchResult {
  type: 'asset' | 'employee' | 'branch'
  label: string
  hint: string
  icon: string
  route?: string
}

const SEARCH_MOCK: SearchResult[] = [
  { type: 'asset',    label: 'MacBook Pro 16" 2024',    hint: 'LAP/00042 · Выдано · Иван Петров',  icon: 'laptop',   route: 'assets' },
  { type: 'asset',    label: 'Dell UltraSharp U2723QE', hint: 'MON/00018 · На складе',              icon: 'monitor',  route: 'assets' },
  { type: 'employee', label: 'Анна Сидорова',           hint: 'Админ активов · ИТ',                 icon: 'user',     route: 'employees' },
  { type: 'employee', label: 'Дмитрий Козлов',          hint: 'Тех. Админ · ИТ',                    icon: 'user',     route: 'employees' },
  { type: 'branch',   label: 'Головной офис',           hint: 'Филиал · Ереван',                    icon: 'building', route: 'branches' },
]

export interface SearchPaletteProps {
  open: boolean
  onClose: () => void
  onPick: (r: SearchResult) => void
}

export function SearchPalette({ open, onClose, onPick }: SearchPaletteProps) {
  const [query, setQuery] = useState('')
  const { t } = useTranslation('common')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return SEARCH_MOCK
    return SEARCH_MOCK.filter(
      (r) => r.label.toLowerCase().includes(q) || r.hint.toLowerCase().includes(q)
    )
  }, [query])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => { if (!open) setQuery('') }, [open])

  if (!open) return null

  const kindLabel = (type: SearchResult['type']) => {
    if (type === 'asset') return t('search.kindAsset')
    if (type === 'employee') return t('search.kindEmployee')
    return t('search.kindBranch')
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] max-md:pt-[8vh] px-4 max-md:px-3">
      <div className="absolute inset-0 bg-black/60 anim-backdrop-fade" onClick={onClose} />
      <div
        className="relative w-full max-w-xl bg-surface rounded-xl border border-border anim-modal-pop overflow-hidden"
        style={{ boxShadow: '0 12px 32px rgba(0,0,0,0.55)' }}
      >
        {/* Search input row */}
        <div className="flex items-center gap-2 px-4 h-12 border-b border-border">
          <Icon name="search" size={16} className="text-text-subtle" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            className="flex-1 h-full bg-transparent outline-none text-sm text-text-primary placeholder:text-text-subtle"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-semibold rounded border border-border bg-surface-2 text-text-tertiary">ESC</kbd>
        </div>

        {/* Results — max-height uses dvh-aware value to avoid overflow on short landscape */}
        <div className="max-h-[360px] max-md:max-h-[min(360px,50dvh)] overflow-y-auto py-1.5">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-[12.5px] text-text-subtle">
              {t('search.empty')}
            </div>
          )}
          {filtered.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onPick(r); onClose() }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-surface-2 transition-colors"
            >
              <span className="w-7 h-7 rounded-md bg-surface-2 text-text-tertiary inline-flex items-center justify-center">
                <Icon name={r.icon} size={14} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold text-text-primary truncate">{r.label}</div>
                <div className="text-[10.5px] text-text-subtle truncate">{r.hint}</div>
              </div>
              <Chip color="gray" size="sm">{kindLabel(r.type)}</Chip>
            </button>
          ))}
        </div>

        {/* Footer hint — hidden on mobile/touch (keyboard shortcuts irrelevant) */}
        <div className="max-md:hidden flex items-center justify-between px-4 py-2 border-t border-border bg-surface-2/60 text-[10.5px] text-text-subtle">
          <span>{t('search.hint')}</span>
          <span className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 font-semibold rounded border border-border bg-surface">↑↓</kbd>
            {t('search.navigate')}
            <kbd className="px-1.5 py-0.5 font-semibold rounded border border-border bg-surface">↵</kbd>
            {t('search.select')}
          </span>
        </div>
      </div>
    </div>,
    document.body
  )
}
