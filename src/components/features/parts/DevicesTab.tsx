import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState, Icon, MobileSheet } from '@/components/ui'
import { DeviceGridCard } from './DeviceGridCard'
import { InstalledDetailPanel } from './InstalledDetailPanel'
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
}


type FamilyFilter = 'all' | 'desktop' | 'laptop' | 'server'

const FAMILIES: Array<{ id: FamilyFilter; labelKey: string; labelFallback: string }> = [
  { id: 'all',     labelKey: 'devices.familyAll',     labelFallback: 'Все'    },
  { id: 'desktop', labelKey: 'devices.familyDesktop',  labelFallback: 'ПК'     },
  { id: 'laptop',  labelKey: 'devices.familyLaptop',   labelFallback: 'Ноут'   },
  { id: 'server',  labelKey: 'devices.familyServer',   labelFallback: 'Сервер' },
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
  const [search, setSearch] = useState(() => {
    // If an initialAssetId was provided but could not be matched yet (data may not
    // be loaded), start with empty search so the list is fully visible.
    // The selection above handles the focus when the asset IS found.
    return ''
  })
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
    /* Mobile: overflow visible so content scrolls with the page (PartsPage handles scroll) */
    <div className="flex flex-col gap-2.5 max-md:overflow-visible">

      {/* ── Main layout: lg 12-col grid ── */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-4 flex flex-col gap-4">

        {/* LEFT COLUMN (col-span-5): pills + search + 2-col card grid */}
        <div className="lg:col-span-5 flex flex-col gap-2.5 min-h-0">

          {/* Family filter pills — grid 4-in-row */}
          <div className="grid grid-cols-4 gap-1.5 flex-shrink-0">
            {FAMILIES.map(f => {
              const active = family === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFamily(f.id)}
                  className={
                    'h-7 w-full rounded-md text-[14px] font-medium border transition-colors inline-flex items-center justify-center ' +
                    (active
                      ? 'bg-accent border-accent text-white'
                      : 'bg-surface border-border text-text-tertiary hover:text-text-primary hover:border-[#3A3F46]')
                  }
                >
                  {t(f.labelKey, f.labelFallback)}
                </button>
              )
            })}
          </div>

          {/* Search input */}
          <div className="relative flex-shrink-0">
            <Icon
              name="search"
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none"
            />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('devices.searchPlaceholder')}
              aria-label={t('devices.searchPlaceholder')}
              className="w-full h-8 pl-7 pr-2.5 rounded-md bg-surface border border-border text-[14.5px] text-text-primary placeholder:text-text-subtle outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* 2-col device card grid — gap 8px desktop, 6px mobile per §11 spec */}
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-[14px] text-text-subtle text-center">
              {t('devices.emptyFiltered')}
            </div>
          ) : (
            <div
              className="flex-1 overflow-y-auto min-h-0 devices-scroll max-md:overflow-visible max-md:flex-none"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', alignContent: 'start' }}
            >
              {filtered.map(a => (
                <DeviceGridCard
                  key={a.id}
                  asset={a}
                  selected={selectedId === a.id}
                  onSelect={() => handleSelect(a.id)}
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

      {/* Mobile: installed detail bottom-sheet */}
      {isMobile && (
        <MobileSheet
          open={mobileDetailId !== null}
          onClose={() => setMobileDetailId(null)}
          title={
            mobileDetailAsset
              ? `${mobileDetailAsset.id} — ${t('device.tabInstalled', 'Установлено')}`
              : ''
          }
        >
          {mobileDetailAsset && (
            <div className="px-4 py-3">
              <InstalledDetailPanel
                asset={mobileDetailAsset}
                onUninstall={(slot, idx) => {
                  setMobileDetailId(null)
                  onUninstall(mobileDetailAsset, slot, idx)
                }}
                movements={movements}
                parts={parts}
              />
            </div>
          )}
        </MobileSheet>
      )}
    </div>
  )
}
