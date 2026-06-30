import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, Chip } from '@/components/ui'
import { PartCard } from './PartCard'
import { CategoryChipStrip } from './CategoryChipStrip'
import { HistoryPanel } from './HistoryPanel'
import { WarehouseSizedDetail } from './WarehouseSizedDetail'
import { WarehouseMobileDetail } from './WarehouseMobileDetail'
import type { Part, PartMovement, PartStock } from '@/domain/part/types'
import { PART_CATEGORY_META, categoryTint, categoryIcon } from './partsTokens'
import { deriveStock } from '@/domain/part/partStock'

/* AGG_CATS: aggregate (collapse to one summary row) */
const AGG_CATS = new Set(['ssd', 'hdd', 'nvme', 'ram'])

export interface WarehouseTabProps {
  parts: Part[]
  movements: PartMovement[]
  isMobile: boolean
  onInstall: (sku: Part) => void
  onAddGpu: () => void
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
}: WarehouseTabProps) {
  const { t } = useTranslation('parts')

  const [selectedCatId, setSelectedCatId] = useState<string>(
    PART_CATEGORY_META[0]?.id ?? 'psu',
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

  /* ── Group parts by category ── */
  const skusByCategory = useMemo(() => {
    const map: Record<string, Part[]> = {}
    PART_CATEGORY_META.forEach((c) => { map[c.id] = [] })
    parts.forEach((p) => {
      if (!map[p.category]) map[p.category] = []
      map[p.category]!.push(p)
    })
    return map
  }, [parts])

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

  const handleCatSelect = useCallback((id: string) => {
    setSelectedCatId(id)
  }, [])

  /* ── SKU list renderer (right panel top section) ── */
  const renderSkuList = () => {
    const isGpuCat = selectedCatId === 'gpu'
    // Show every SKU in the category, even at 0 on-hand, so the count reads «0 шт»
    // instead of an empty state — per owner: don't hide out-of-stock parts. The
    // empty state below only remains for a category with no SKU docs at all (GPU).
    const visibleSkus = selectedSkus

    if (visibleSkus.length === 0) {
      return (
        <div className="h-full flex items-center justify-center p-8">
          <div className="text-center max-w-xs">
            <span className="w-12 h-12 rounded-full bg-surface-2 text-text-subtle inline-flex items-center justify-center mb-3">
              <Icon name={isGpuCat ? 'microchip' : 'search'} size={20} />
            </span>
            <div className="text-[15px] font-semibold text-text-secondary">
              {isGpuCat ? t('warehouse.emptyGpu') : t('warehouse.emptyCategory')}
            </div>
            <div className="text-[14px] text-text-tertiary mt-1">
              {isGpuCat
                ? t('warehouse.emptyGpuHint')
                : t('warehouse.emptyCategoryHint')}
            </div>
            {isGpuCat && (
              <button
                type="button"
                onClick={onAddGpu}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[14.5px] font-semibold text-accent border border-[#F97316]/30 bg-[#F97316]/10 hover:bg-[#F97316]/15 transition-colors"
              >
                <Icon name="plus" size={12} />
                {t('gpu.addBtn')}
              </button>
            )}
          </div>
        </div>
      )
    }

    /* Aggregated categories: one summary row with dual chips */
    if (AGG_CATS.has(selectedCatId)) {
      const tint = categoryTint(selectedCatId)
      const icon = categoryIcon(selectedCatId)
      const catMeta = selectedCatMeta
      let totalWorking = 0
      let totalBroken = 0
      for (const sku of visibleSkus) {
        const s = stockOf(sku.id)
        totalWorking += s.onHand
        totalBroken += s.broken
      }
      return (
        <ul className="divide-y divide-border flex-shrink-0">
          <li className="flex items-center gap-3 px-5 py-3 max-md:px-3 max-md:py-2 hover:bg-[#22272E]/60 transition-colors">
            <span className={`w-8 h-8 rounded-lg ${tint.iconBg} ${tint.iconText} inline-flex items-center justify-center flex-shrink-0`}>
              <Icon name={icon} size={14} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-text-primary truncate leading-tight">
                {catMeta?.label ?? selectedCatId}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Chip color="green" size="sm" dot>{totalWorking} шт</Chip>
              {totalBroken > 0 && <Chip color="red" size="sm" dot>{totalBroken} шт</Chip>}
            </div>
          </li>
        </ul>
      )
    }

    /* Per-SKU rows (psu / cooler / gpu) */
    return (
      <ul className="divide-y divide-border flex-shrink-0">
        {visibleSkus.map((sku) => {
          const tint = categoryTint(sku.category)
          const icon = categoryIcon(sku.category)
          const s = stockOf(sku.id)
          return (
            <li
              key={sku.id}
              className="flex items-center gap-3 px-5 py-3 max-md:px-3 max-md:py-2 hover:bg-[#22272E]/60 transition-colors"
            >
              <span className={`w-8 h-8 rounded-lg ${tint.iconBg} ${tint.iconText} inline-flex items-center justify-center flex-shrink-0`}>
                <Icon name={icon} size={14} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-text-primary truncate leading-tight">
                  {sku.name}
                  {sku.variantLabel && (
                    <span className="text-text-tertiary font-normal"> · {sku.variantLabel}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Chip color="green" size="sm" dot>{s.onHand} шт</Chip>
                {s.broken > 0 && <Chip color="red" size="sm" dot>{s.broken} шт</Chip>}
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  /* ── RIGHT panel (desktop only, or mobile detail) ── */
  const renderRightPanel = () => (
    <div className="bg-surface border border-border rounded-xl shadow-sm shadow-black/30 flex flex-col">
      <div className="flex flex-col">
        {renderSkuList()}
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
      <div className="flex flex-col pb-[68px]">
        <CategoryChipStrip
          skusByCategory={skusByCategory}
          selectedId={selectedCatId}
          onSelect={handleCatSelect}
          stockMap={stockMap}
        />
        {isAgg ? (
          /* Sized categories: SSD / HDD / M.2 / ОЗУ — per-size rows */
          <WarehouseSizedDetail
            categoryId={selectedCatId}
            skus={selectedSkus}
            stockMap={stockMap}
            onInstall={onInstall}
          />
        ) : isGpu ? (
          /* GPU: reuse existing right panel (shows GPU empty state / GPU SKU rows) */
          <div className="px-3.5 pt-2">{renderRightPanel()}</div>
        ) : (
          /* Single-pos: PSU / Cooler — header + ИСТОРИЯ overline + history card */
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
              onSelect={handleCatSelect}
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

