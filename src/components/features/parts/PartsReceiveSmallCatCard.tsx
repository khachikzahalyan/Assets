import { Icon } from '@/components/ui'
import { categoryTint, type PartCatMeta } from './partsTokens'
import type { Part } from '@/domain/part/types'

/** Small-card (PSU / Cooler) — full-width steppers, one per SKU */
export function PartsReceiveSmallCatCard({
  cat,
  catParts,
  qtys,
  bumpQty,
  t,
}: {
  cat: PartCatMeta
  catParts: Part[]
  qtys: Record<string, string>
  bumpQty: (skuId: string, delta: number) => void
  t: (key: string) => string
}) {
  const tint = categoryTint(cat.id)
  return (
    <div className="bg-surface border border-border rounded-xl p-3">
      {/* Card header */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <span
          className={`w-5 h-5 rounded-md ${tint.iconBg} ${tint.iconText} inline-flex items-center justify-center flex-shrink-0`}
        >
          <Icon name={cat.icon} size={11} />
        </span>
        <span className="text-[12.5px] font-bold text-text-primary truncate">{cat.label}</span>
        <span className="ml-auto text-[10px] text-text-subtle tabular-nums flex-shrink-0">
          {catParts.length}&nbsp;{t('addModal.positions')}
        </span>
      </div>

      {/* SKU rows */}
      {catParts.map(p => {
        const qtyValue = qtys[p.id] ?? ''
        const qtyNum = parseInt(qtyValue, 10) || 0
        const isActive = qtyNum > 0
        const label = p.variantLabel || p.name
        return (
          <div key={p.id} className="mb-2 last:mb-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-text-secondary leading-none">{label}</span>
              <span className="text-[10px] text-text-subtle tabular-nums">{p.onHand}</span>
            </div>
            <div
              className={`flex items-center bg-bg border rounded-lg overflow-hidden transition-colors ${
                isActive ? 'border-accent' : 'border-border'
              }`}
            >
              <button
                type="button"
                onClick={() => bumpQty(p.id, -1)}
                disabled={qtyNum <= 0}
                aria-label={t('addModal.decrease')}
                className="w-[34px] h-8 flex-shrink-0 flex items-center justify-center text-text-tertiary hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Icon name="minus" size={12} />
              </button>
              <div
                className={`flex-1 text-center text-[13px] font-semibold font-mono tabular-nums leading-none select-none ${
                  isActive ? 'text-accent' : 'text-text-secondary'
                }`}
              >
                {qtyNum === 0 ? '0' : qtyValue}
              </div>
              <button
                type="button"
                onClick={() => bumpQty(p.id, +1)}
                aria-label={t('addModal.increase')}
                className="w-[34px] h-8 flex-shrink-0 flex items-center justify-center text-text-tertiary hover:bg-surface-2 transition-colors"
              >
                <Icon name="plus" size={12} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
