import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState, SearchInput } from '@/components/ui'
import { DeviceGridCard } from './DeviceGridCard'
import { InstalledDetailPanel } from './InstalledDetailPanel'
import { DeviceDetailMobileView } from './DeviceDetailMobileView'
import type { Part, PartsAsset, UpgradeSlot, PartMovement } from '@/domain/part/types'
import { assetFamilyOf } from '@/domain/part/partStock'

export interface DevicesTabProps {
  partsAssets: PartsAsset[]
  parts: Part[]
  isMobile: boolean
  onUninstall: (asset: PartsAsset, slot: UpgradeSlot, slotIdx: number) => void
  onService: (asset: PartsAsset) => void
  /** Optional per-asset movement history for the inner «История» tab */
  movements?: PartMovement[]
  /**
   * When provided (from /parts?assetId=<firestoreId>), pre-select and
   * pre-fill the search for the matching asset on mount.
   * Matched against PartsAsset.assetId (Firestore doc ID).
   */
  initialAssetId?: string | null
  /** Controlled search value — lifted to PartsPage so header row 2 can bind it */
  search: string
  /** Controlled search change handler — lifted to PartsPage */
  onSearchChange: (v: string) => void
}


type FamilyFilter = 'all' | 'desktop' | 'laptop' | 'server'

const FAMILIES: Array<{ id: FamilyFilter; labelKey: string; labelFallback: string }> = [
  { id: 'all',     labelKey: 'devices.familyAll',     labelFallback: 'Все'    },
  { id: 'desktop', labelKey: 'devices.familyDesktop',  labelFallback: 'ПК'     },
  { id: 'laptop',  labelKey: 'devices.familyLaptop',   labelFallback: 'Ноутбуки' },
  { id: 'server',  labelKey: 'devices.familyServer',   labelFallback: 'Серверы' },
]

/**
 * «Устройства» tab body.
 *
 * Desktop layout (lg:grid-cols-12):
 *   Left (col-span-5): family-filter pills (4-in-row) + search + 2-col device grid
 *   Right (col-span-7): InstalledDetailPanel (device header + inner tabs Установлено/История)
 *
 * Mobile: 2-col card grid + MobileSheet bottom-sheet for detail.
 *
 * Matches prototype parts.html lines 4079-4403.
 */
export function DevicesTab({
  partsAssets,
  parts,
  isMobile,
  onUninstall,
  onService: _onService,
  movements = [],
  initialAssetId,
  search,
  onSearchChange,
}: DevicesTabProps) {
  const { t } = useTranslation('parts')

  // If an initialAssetId is provided, pre-select the matching PartsAsset by its
  // Firestore document ID. Falls back to the first asset when no match exists.
  const resolvedInitialId = useMemo(() => {
    if (initialAssetId) {
      const match = partsAssets.find(a => a.assetId === initialAssetId)
      if (match) return match.id
    }
    return partsAssets.length > 0 ? (partsAssets[0]?.id ?? null) : null
  }, [initialAssetId, partsAssets])

  const [selectedId, setSelectedId] = useState<string | null>(resolvedInitialId)
  const [family, setFamily] = useState<FamilyFilter>('all')
  const [mobileDetailId, setMobileDetailId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return partsAssets.filter(a => {
      if (family !== 'all') {
        const fam = assetFamilyOf(a.categoryId)
        if (fam !== family) return false
      }
      if (!q) return true
      return (
        a.id.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.user && a.user.toLowerCase().includes(q))
      )
    })
  }, [partsAssets, search, family])

  const selectedAsset = useMemo(
    () => partsAssets.find(a => a.id === selectedId) ?? null,
    [partsAssets, selectedId],
  )

  const mobileDetailAsset = useMemo(
    () => partsAssets.find(a => a.id === mobileDetailId) ?? null,
    [partsAssets, mobileDetailId],
  )

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id)
      if (isMobile) setMobileDetailId(id)
    },
    [isMobile],
  )

  if (partsAssets.length === 0) {
    return (
      <EmptyState
        icon="monitor"
        title={t('devices.emptyTitle')}
        description={t('devices.emptyDesc')}
      />
    )
  }

  return (
    /* Grid is a bounded scroll region at all widths — PartsPage tab-body is overflow-hidden */
    <div className="flex flex-col gap-2.5 h-full min-h-0">

      {/* ── Main layout: lg 12-col grid — flex-1 + auto-rows-fr so grid row fills bounded height ── */}
      <div className="lg:grid lg:grid-cols-12 lg:auto-rows-fr lg:gap-4 flex flex-col gap-4 flex-1 min-h-0">

        {/* LEFT COLUMN (col-span-5): pills + search + 2-col card grid */}
        <div className="lg:col-span-5 flex flex-col gap-2.5 min-h-0 flex-1 max-md:px-3.5 max-md:pt-2.5">

          {/* Family filter pills — grid 4-in-row (desktop) / flex overflow-x-auto (mobile) */}
          <div className="grid grid-cols-4 gap-1.5 flex-shrink-0 max-md:flex max-md:gap-[0.4375rem] max-md:overflow-x-auto max-md:pl-0" style={{ scrollbarWidth: 'none' }}>
            {FAMILIES.map(f => {
              const active = family === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFamily(f.id)}
                  className={
                    'h-7 w-full rounded-md text-14 font-medium border transition-colors inline-flex items-center justify-center ' +
                    // Mobile: match the warehouse CategoryChipStrip pill exactly
                    // (h-8 px-2.5 rounded-lg text-13, solid surface + border-border idle),
                    // so both parts tabs share one pill look. Horizontal scroll row.
                    'max-md:w-auto max-md:rounded-lg max-md:h-8 max-md:px-2.5 max-md:text-13 max-md:font-semibold max-md:whitespace-nowrap max-md:flex-shrink-0 ' +
                    (active
                      ? 'bg-accent border-accent text-white'
                      : 'bg-surface border-border text-text-tertiary hover:text-text-primary hover:border-[#3A3F46] max-md:text-text-primary')
                  }
                >
                  {t(f.labelKey, f.labelFallback)}
                </button>
              )
            })}
          </div>

          {/* Search input — desktop only; mobile gets the header row-2 input */}
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder={t('devices.searchPlaceholder')}
            aria-label={t('devices.searchPlaceholder')}
            containerClassName="flex-shrink-0 max-md:hidden"
          />

          {/* Device card list: 2-col grid on desktop, full-width 1-col on mobile.
              MUST use Tailwind responsive classes — an inline style={{ display:'grid' }}
              here would override max-md:hidden / max-md:flex on sibling elements and
              can never be overridden by a Tailwind responsive class (inline wins).
              grid-cols-1 collapses to 1 col on mobile; md:grid-cols-2 expands on ≥768px. */}
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-14 text-text-subtle text-center">
              {t('devices.emptyFiltered')}
            </div>
          ) : (
            <div
              className="flex-1 overflow-y-auto min-h-0 devices-scroll grid grid-cols-1 md:grid-cols-2 gap-2 content-start"
            >
              {filtered.map(a => (
                <DeviceGridCard
                  key={a.id}
                  asset={a}
                  selected={selectedId === a.id}
                  isMobile={isMobile}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (col-span-7): detail panel — hidden on mobile */}
        <div className="hidden lg:flex lg:col-span-7 min-h-0 flex-col overflow-hidden">
          <InstalledDetailPanel
            asset={selectedAsset}
            onUninstall={(slot, idx) => selectedAsset && onUninstall(selectedAsset, slot, idx)}
            movements={movements}
            parts={parts}
          />
        </div>
      </div>

      {/* Mobile: full-screen slide-in device detail (replaces former MobileSheet) */}
      {isMobile && mobileDetailId !== null && mobileDetailAsset && (
        <DeviceDetailMobileView
          asset={mobileDetailAsset}
          onBack={() => setMobileDetailId(null)}
          movements={movements}
          parts={parts}
        />
      )}
    </div>
  )
}
