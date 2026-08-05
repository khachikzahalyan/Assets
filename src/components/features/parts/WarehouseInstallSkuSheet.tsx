import { Icon, Chip, MobileSheet } from '@/components/ui'
import { workingStock } from '@/domain/part/partStock'
import type { Part, PartStock } from '@/domain/part/types'

export interface WarehouseInstallSkuSheetItem {
  sku: Part
  onHand: number
  /** Primary label displayed in the row (e.g. sku.name or sku.variantLabel). */
  label: string
  /** Optional secondary label shown muted after a · separator (e.g. ddr, variantLabel). */
  sublabel?: string
}

export interface WarehouseInstallSkuSheetProps {
  open: boolean
  onClose: () => void
  title: string
  items: WarehouseInstallSkuSheetItem[]
  onPick: (sku: Part) => void
}

/**
 * Shared picker sheet for «Установить» when there are 2+ in-stock SKUs.
 *
 * Used by both WarehouseMobileDetail (single-pos / models categories) and
 * WarehouseSizedDetail (sized categories).
 *
 * Each row: label + optional sublabel · suffix + green stock Chip + chevron-right.
 * Design is lifted 1:1 from the existing WarehouseSizedDetail picker rows.
 */
export function WarehouseInstallSkuSheet({
  open,
  onClose,
  title,
  items,
  onPick,
}: WarehouseInstallSkuSheetProps) {
  return (
    <MobileSheet open={open} onClose={onClose} title={title} height="60dvh">
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          return (
            <button
              key={item.sku.id}
              type="button"
              onClick={() => onPick(item.sku)}
              className={`flex items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2${!isLast ? ' border-b border-border/60' : ''}`}
            >
              <span className="text-14.5 font-medium text-text-primary min-w-0 truncate">
                {item.label}
                {item.sublabel && (
                  <span className="text-text-tertiary font-normal"> · {item.sublabel}</span>
                )}
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                <Chip color="green" size="sm" dot>{item.onHand} шт</Chip>
                <Icon name="chevron-right" size={15} className="text-text-subtle" />
              </span>
            </button>
          )
        })}
      </div>
    </MobileSheet>
  )
}

/**
 * Build the items array for WarehouseInstallSkuSheet from a SKU list + stockOf.
 * Filters to in-stock (workingStock > 0) only.
 */
export function buildSkuPickerItems(
  skus: Part[],
  stockOf: (skuId: string) => PartStock,
): WarehouseInstallSkuSheetItem[] {
  return skus
    .filter((s) => workingStock(stockOf(s.id)) > 0)
    .map((s) => {
      const onHand = workingStock(stockOf(s.id))
      const label = s.name
      // Optional sublabel: variantLabel or ddr when present (used by sized categories).
      // Must be a non-null string to satisfy exactOptionalPropertyTypes.
      const sublabelRaw = s.variantLabel ?? s.ddr
      const sublabel: string | undefined =
        sublabelRaw != null ? sublabelRaw : undefined
      return {
        sku: s,
        onHand,
        label,
        ...(sublabel !== undefined ? { sublabel } : {}),
      }
    })
}
