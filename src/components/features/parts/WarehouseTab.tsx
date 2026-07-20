import { useMemo, useCallback } from 'react'
import { PartCard } from './PartCard'
import { HistoryPanel } from './HistoryPanel'
import { WarehouseSizedDetail } from './WarehouseSizedDetail'
import { WarehouseMobileDetail } from './WarehouseMobileDetail'
import { WarehouseSkuList, AGG_CATS } from './WarehouseSkuList'
import type { Part, PartMovement, PartStock } from '@/domain/part/types'
import { PART_CATEGORY_META, groupSkusByCategory } from './partsTokens'
import { deriveStock } from '@/domain/part/partStock'

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
}: WarehouseTabProps) {
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

  /* ── Group parts by category — uses shared helper from partsTokens ── */
  const skusByCategory = useMemo(() => groupSkusByCategory(parts), [parts])

  /* ── Selected category data ── */
  const selectedCatMeta = PART_CATEGORY_META.find((c) => c.id === selectedCatId)
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
        />
        {/* History block — rendered inline inside the same card */}
        <HistoryPanel
          movements={movements}
          skuIds={selectedSkuIds}
          parts={parts}
          isMobile={isMobile}
          categoryId={selectedCatId}
          remainingAfterMap={remainingAfterMap}
        />
      </div>
    </div>
  )

  /* ──────────────────────── MOBILE LAYOUT ──────────────────────── */
  if (isMobile) {
    const isAgg = AGG_CATS.has(selectedCatId)
    const isGpu = selectedCatId === 'gpu'

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
        ) : isGpu ? (
          /* GPU: full-bleed without nested card chrome — fused card body */
          <div>
            <WarehouseSkuList
              selectedCatId={selectedCatId}
              selectedSkus={selectedSkus}
              stockOf={stockOf}
              isMobile={true}
              onAddGpu={onAddGpu}
              catMeta={selectedCatMeta}
            />
            <HistoryPanel
              movements={movements}
              skuIds={selectedSkuIds}
              parts={parts}
              isMobile
              categoryId={selectedCatId}
              remainingAfterMap={remainingAfterMap}
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
          {PART_CATEGORY_META.map((cat) => (
            <PartCard
              key={cat.id}
              categoryId={cat.id}
              skus={skusByCategory[cat.id] ?? []}
              selected={selectedCatId === cat.id}
              onSelect={onSelectCat}
              onInstall={onInstall}
              stockMap={stockMap}
              {...(cat.id === 'gpu' ? { onAddGpu } : {})}
            />
          ))}
        </div>
      </div>

      {/* RIGHT: SKU list + history — col-span-7 */}
      <div className="col-span-7 flex flex-col gap-3 min-h-0">
        {renderRightPanel()}
      </div>
    </div>
  )
}
