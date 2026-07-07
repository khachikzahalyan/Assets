import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Icon, MobileAddButton } from '@/components/ui'
import { GroupTabs } from './GroupTabs'
import type { GroupTab } from './GroupTabs'
import type { AssetListQuery, AssetGroupFilter } from '@/domain/asset'

const SEARCH_DEBOUNCE_MS = 300

export interface AssetsToolbarProps {
  query: AssetListQuery
  onChange: (patch: Partial<AssetListQuery>) => void
  groupCounts: Record<string, number>
  totalCount: number
  canMutate: boolean
  onExport: () => void
  onNavigateCreate: () => void
}

/**
 * Assets page toolbar — group tabs + search + action buttons.
 *
 * Desktop (≥768px): single flex row: [tabs | search | import | export | create]
 * Mobile (<768px): two stacked rows:
 *   Row 1 — tab strip (bg-surface-2, border-b)  — full-bleed, px-[14px]
 *   Row 2 — search input + square add button     — bg-bg, px-[14px] py-[7px]
 *
 * Import/Export buttons remain hidden on mobile (max-md:hidden, unchanged).
 */
export function AssetsToolbar({
  query,
  onChange,
  groupCounts,
  totalCount,
  canMutate,
  onExport,
  onNavigateCreate,
}: AssetsToolbarProps) {
  const { t } = useTranslation('assets')

  // ── Debounced search ────────────────────────────────────────────────────────
  // The input stays immediately responsive via local state; the parent `onChange`
  // (which triggers a full-collection Firestore refetch) fires only after the user
  // pauses typing for ~300ms. External resets of query.search (e.g. "reset filters")
  // still sync back into the local input.
  const [searchLocal, setSearchLocal] = useState(query.search ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEmittedRef = useRef(query.search ?? '')

  useEffect(() => {
    const incoming = query.search ?? ''
    // Only resync when the prop changed to something we didn't just emit ourselves
    // (an external reset), so mid-typing debounces aren't clobbered.
    if (incoming !== lastEmittedRef.current) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      lastEmittedRef.current = incoming
      setSearchLocal(incoming)
    }
  }, [query.search])

  // Clear any pending debounce on unmount.
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  const handleSearchInput = (value: string) => {
    setSearchLocal(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      lastEmittedRef.current = value
      onChange({ search: value })
    }, SEARCH_DEBOUNCE_MS)
  }

  const groupTabs: GroupTab[] = [
    { id: 'all',       label: t('groups.all'),       icon: 'layers' },
    { id: 'devices',   label: t('groups.devices'),   icon: 'monitor-smartphone' },
    { id: 'network',   label: t('groups.network'),   shortLabel: t('groups.networkShort'), icon: 'server' },
    { id: 'furniture', label: t('groups.furniture'), icon: 'armchair' },
  ]

  const activeGroup = query.group ?? 'all'

  return (
    <div
      className={[
        // Desktop: single horizontal flex row with padding
        'flex items-center justify-between gap-2.5 flex-wrap px-5 py-2',
        // Mobile: vertical column, no outer padding (each row has its own)
        'max-md:flex-col max-md:items-stretch max-md:gap-0 max-md:p-0',
      ].join(' ')}
    >
      {/* ── Row 1: Group tabs ──────────────────────────────────────────────────
          Desktop: bare flex item (no extra bg/border).
          Mobile:  full-bleed bg-surface-2 strip with bottom border.               */}
      <div className="max-md:bg-surface-2 max-md:border-b max-md:border-border max-md:px-[14px] max-md:w-full">
        <GroupTabs
          tabs={groupTabs}
          selected={activeGroup}
          onSelect={g => onChange({ group: g as AssetGroupFilter })}
          counts={groupCounts}
        />
      </div>

      {/* ── Row 2: Search + actions ────────────────────────────────────────────
          Desktop: right-aligned flex row that fills remaining space.
          Mobile:  full-width bg-bg row with 14px horizontal padding.               */}
      <div
        className={[
          'flex items-center gap-2 flex-1 ml-auto justify-end',
          'max-md:ml-0 max-md:flex-none max-md:w-full max-md:gap-[8px]',
          'max-md:bg-bg max-md:px-[14px] max-md:py-[7px]',
        ].join(' ')}
      >
        {/* Search input */}
        <div className="w-full max-w-[280px] max-md:max-w-none max-md:flex-1">
          <div className="relative">
            <span
              className={[
                'absolute top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none',
                'left-2.5 max-md:left-[10px]',
              ].join(' ')}
            >
              <Icon name="search" size={13} />
            </span>
            <input
              id="assets-search"
              type="search"
              autoComplete="off"
              value={searchLocal}
              onChange={e => handleSearchInput(e.target.value)}
              placeholder={t('search')}
              aria-label={t('search')}
              className={[
                // Desktop
                'w-full h-8 pl-8 pr-3 text-[13.5px] bg-surface border border-border rounded-lg',
                'text-text-primary placeholder:text-text-subtle',
                'focus:outline-none focus:border-accent-light focus:ring-2 focus:ring-accent-light/15',
                'transition-all duration-150',
                // Mobile overrides
                'max-md:h-auto max-md:rounded-[9px] max-md:py-[9px] max-md:pl-[30px] max-md:pr-[12px]',
                'max-md:text-[11.5px] max-md:caret-accent',
              ].join(' ')}
            />
          </div>
        </div>

        {/* Import — Phase 2 deferred. Hidden on mobile. */}
        <button
          type="button"
          disabled
          title={t('toolbar.importSoon')}
          aria-label={t('toolbar.import')}
          className="bg-surface border border-border-strong text-text-primary h-8 px-3 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors duration-150 opacity-40 cursor-not-allowed max-md:hidden"
        >
          <Icon name="file-up" size={13} className="text-sky-300" />
          <span>{t('toolbar.import')}</span>
        </button>

        {/* Export — hidden on mobile */}
        <button
          type="button"
          disabled={totalCount === 0}
          onClick={onExport}
          title={t('export.xlsx')}
          aria-label={t('export.xlsx')}
          className="bg-surface border border-border-strong text-text-primary hover:bg-bg h-8 px-3 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed max-md:hidden"
        >
          <Icon name="file-spreadsheet" size={13} className="text-emerald-300" />
          <span>{t('export.xlsx')}</span>
        </button>

        {/* Create — role-gated */}
        {canMutate && (
          <>
            {/* Desktop: full label button */}
            <Btn variant="primary" size="sm" onClick={onNavigateCreate} className="max-md:hidden">
              <Icon name="plus" size={13} />
              {t('toolbar.create')}
            </Btn>
            {/* Mobile: shared 36×36 MobileAddButton — same control on every page */}
            <MobileAddButton
              onClick={onNavigateCreate}
              ariaLabel={t('toolbar.create')}
              className="md:hidden"
            />
          </>
        )}
      </div>
    </div>
  )
}
