import { useMemo, useCallback } from 'react'
import { PartCard } from './PartCard'
import { HistoryPanel } from './HistoryPanel'
import { WarehouseSizedDetail } from './WarehouseSizedDetail'
import { WarehouseMobileDetail } from './WarehouseMobileDetail'
import { WarehouseSkuList, AGG_CATS } from './WarehouseSkuList'
import type { Part, PartMovement, PartStock, PartsAsset } from '@/domain/part/types'
import { PART_CATEGORY_META, groupSkusByCategoryDef, buildCategoryTint, type Tint, type PartCatMeta } from './partsTokens'
import { deriveStock } from '@/domain/part/partStock'
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import { isSizedCategory, isModelsCategory } from '@/domain/part/partCategory-types'
import { DEFAULT_PART_CATEGORY_DEFS } from '@/domain/part/partCategoryDefaults'

export interface WarehouseTabProps {
  parts: Part[]
  movements: PartMovement[]
  isMobile: boolean
  onInstall: (sku: Part) => void
  onAddGpu: () => void
  /** Lifted from PartsPage — controlled selected category */
  selectedCatId: string
  /** Lifted from PartsPage — category selection handler */
  onSelectCat: (id: string) => void
  /**
   * Upgradeable-asset projections from PartReferenceData — passed through to
   * HistoryPanel so it can display asset category name on install/uninstall rows.
   */
  partsAssets?: PartsAsset[]
  /** Live category catalog — enables behavior dispatch */
  partCategories?: PartCategoryDef[]
  /** Pre-built display meta from buildPartCatMeta — avoids re-building inside tab */
  partCatMeta?: PartCatMeta[]
  /** Pre-built tint map from buildCategoryTint */
  categoryTints?: Record<string, Tint>
}

/**
 * «Склад» tab body — full parity with parts.html prototype.
 *
 * Desktop (lg+): grid-cols-12 master-detail
 *   LEFT  col-span-5 — scrollable vertical list of PartCards (one per category)
 *   RIGHT col-span-7 — SKU list for selected category + History block
 *
 * Mobile (< lg): CategoryChipStrip on top + detail panel below
 */
export function WarehouseTab({
  parts,
  movements,
  isMobile,
  onInstall,
  onAddGpu,
  selectedCatId,
  onSelectCat,
  partsAssets = [],
  partCategories,
  partCatMeta,
  categoryTints,
}: WarehouseTabProps) {
  const effectiveDefs = partCategories ?? (DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[])
  const effectiveMeta = partCatMeta ?? PART_CATEGORY_META

  // Tint lookup — use passed map or build from effectiveDefs
  const effectiveTints = useMemo(
    () => categoryTints ?? buildCategoryTint(effectiveDefs),
    [categoryTints, effectiveDefs],
  )

  /* ── Derived stock map (from movements, authoritative) ── */
  const stockMap = useMemo<Record<string, PartStock>>(
    () => deriveStock(movements),
    [movements],
  )

  /* ── stockOf helper ── */
  const stockOf = useCallback(
    (skuId: string): PartStock => stockMap[skuId] ?? { onHand: 0, broken: 0 },
    [stockMap],
  )

  /* ── Group parts by category — uses defs-aware helper ── */
  const skusByCategory = useMemo(
    () => groupSkusByCategoryDef(parts, effectiveDefs),
    [parts, effectiveDefs],
  )

  /* ── Selected category data ── */
  const selectedCatMeta = effectiveMeta.find((c) => c.id === selectedCatId)
  const selectedDef = effectiveDefs.find(d => d.id === selectedCatId)
  const selectedSkus = skusByCategory[selectedCatId] ?? []
  const selectedSkuIds = useMemo(
    () => new Set(selectedSkus.map((s) => s.id)),
    [selectedSkus],
  )

  /* ── Running-stock snapshot per movement id (for "Осталось N шт") ──
     Walk ALL category movements in chronological order, track per-SKU
     running warehouse stock, record post-event stock keyed by movement id.
     Logic mirrors prototype lines 3888-3911. */
  const remainingAfterMap = useMemo<Record<string, number>>(() => {
    const catMovements = movements
      .filter((m) => selectedSkuIds.has(m.skuId))
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    const running: Record<string, number> = {}
    const out: Record<string, number> = {}
    for (const m of catMovements) {
      const cur = running[m.skuId] ?? 0
      // Mirror deriveStock (partStock.ts): serviceReplace movements never touch
      // warehouse stock — skipping them here too keeps the "Осталось N шт"
      // label consistent with the authoritative stock derivation.
      if (m.serviceReplace) { out[m.id] = cur; continue }
      const q = m.qty ?? 1
      let next = cur
      if (m.type === 'receive') next = cur + q
      else if (m.type === 'install') next = Math.max(0, cur - q)
      else if (m.type === 'uninstall' && !m.broken) next = cur + q
      // broken uninstall: warehouse stock unchanged
      running[m.skuId] = next
      out[m.id] = next
    }
    return out
  }, [movements, selectedSkuIds])

  /* ── RIGHT panel (desktop only) ── */
  const renderRightPanel = () => (
    <div className="bg-surface border border-border rounded-xl shadow-sm shadow-black/30 flex flex-col">
      <div className="flex flex-col">
        <WarehouseSkuList
          selectedCatId={selectedCatId}
          selectedSkus={selectedSkus}
          stockOf={stockOf}
          isMobile={isMobile}
          onAddGpu={onAddGpu}
          catMeta={selectedCatMeta}
          {...(selectedDef !== undefined ? { catDef: selectedDef } : {})}
          {...(effectiveTints[selectedCatId] !== undefined ? { tint: effectiveTints[selectedCatId] } : {})}
        />
        {/* History block — rendered inline inside the same card */}
        <HistoryPanel
          movements={movements}
          skuIds={selectedSkuIds}
          parts={parts}
          isMobile={isMobile}
          categoryId={selectedCatId}
          remainingAfterMap={remainingAfterMap}
          partsAssets={partsAssets}
        />
      </div>
    </div>
  )

  /* ──────────────────────── MOBILE LAYOUT ──────────────────────── */
  if (isMobile) {
    // Behavior dispatch — use def when available, fall back to legacy constants
    const isAgg = selectedDef ? isSizedCategory(selectedDef) : AGG_CATS.has(selectedCatId)
    const isModelsCat = selectedDef ? isModelsCategory(selectedDef) : selectedCatId === 'gpu'

    return (
      /* CategoryChipStrip moved to PartsTabsHeader row 2 — not rendered here.
         pb-[68px] removed — bottom clearance comes from .app-shell-content-flush. */
      <div className="flex flex-col">
        {isAgg ? (
          /* Sized categories: SSD / HDD / M.2 / ОЗУ — per-size rows */
          <WarehouseSizedDetail
            categoryId={selectedCatId}
            skus={selectedSkus}
            stockMap={stockMap}
            onInstall={onInstall}
          />
        ) : isModelsCat ? (
          /* Models (GPU): full-bleed without nested card chrome — fused card body */
          <div>
            <WarehouseSkuList
              selectedCatId={selectedCatId}
              selectedSkus={selectedSkus}
              stockOf={stockOf}
              isMobile={true}
              onAddGpu={onAddGpu}
              catMeta={selectedCatMeta}
              {...(selectedDef !== undefined ? { catDef: selectedDef } : {})}
              {...(effectiveTints[selectedCatId] !== undefined ? { tint: effectiveTints[selectedCatId] } : {})}
            />
            <HistoryPanel
              movements={movements}
              skuIds={selectedSkuIds}
              parts={parts}
              isMobile
              categoryId={selectedCatId}
              remainingAfterMap={remainingAfterMap}
              partsAssets={partsAssets}
            />
          </div>
        ) : (
          /* Single-pos: PSU / Cooler — header + HistoryPanel full-bleed */
          <WarehouseMobileDetail
            catId={selectedCatId}
            skus={selectedSkus}
            stockOf={stockOf}
            catMeta={selectedCatMeta}
            onInstall={onInstall}
            movements={movements}
            skuIds={selectedSkuIds}
            parts={parts}
            remainingAfterMap={remainingAfterMap}
            partsAssets={partsAssets}
          />
        )}
      </div>
    )
  }

  /* ──────────────────────── DESKTOP LAYOUT ─────────────────────── */
  return (
    <div className="grid grid-cols-12 gap-4">
      {/* LEFT: category card list — col-span-5 */}
      <div className="col-span-5 flex flex-col min-h-0">
        <div className="flex flex-col gap-2.5 overflow-y-auto pr-1">
          {effectiveMeta.map((cat) => {
            const catDef = effectiveDefs.find(d => d.id === cat.id)
            return (
              <PartCard
                key={cat.id}
                categoryId={cat.id}
                skus={skusByCategory[cat.id] ?? []}
                selected={selectedCatId === cat.id}
                onSelect={onSelectCat}
                onInstall={onInstall}
                stockMap={stockMap}
                {...(catDef !== undefined ? { catDef } : {})}
                {...(catDef && isModelsCategory(catDef) ? { onAddSku: onAddGpu } : {})}
                {...(cat.id === 'gpu' && !catDef ? { onAddGpu } : {})}
              />
            )
          })}
        </div>
      </div>

      {/* RIGHT: SKU list + history — col-span-7 */}
      <div className="col-span-7 flex flex-col gap-3 min-h-0">
        {renderRightPanel()}
      </div>
    </div>
  )
}
