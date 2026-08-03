import { Icon } from '@/components/ui'
import { categoryTint, variantRankDef, type PartCatMeta } from './partsTokens'
import type { Part } from '@/domain/part/types'
import type { PartCategoryVariant, PartCategoryDef } from '@/domain/part/partCategory-types'

/** Sized-card (SSD / HDD / M.2 / RAM) — horizontal-scroll mini-steppers */
export function PartsReceiveSizedCatCard({
  cat,
  catParts,
  qtys,
  bumpQty,
  ramDdr,
  setRamDdr,
  t,
  generations,
  catDef,
}: {
  cat: PartCatMeta
  catParts: Part[]
  qtys: Record<string, string>
  bumpQty: (skuId: string, delta: number) => void
  ramDdr: string
  setRamDdr: (ddr: string) => void
  t: (key: string) => string
  /** DDR-style generation list from def.generations — null/undefined = not a generations category */
  generations?: PartCategoryVariant[] | null
  /** Resolved def for variant ranking — when provided uses variantRankDef instead of variantRank */
  catDef?: PartCategoryDef
}) {
  const tint = categoryTint(cat.id)
  const isRam = generations !== null && generations !== undefined && generations.length > 0
  const ddrLabels = isRam
    ? [...(generations ?? [])].sort((a, b) => a.order - b.order).map(g => g.label)
    : []

  const visibleParts = (isRam ? catParts.filter(p => p.ddr === ramDdr) : catParts)
    .slice()
    .sort((a, b) => variantRankDef(catDef, a.variantId) - variantRankDef(catDef, b.variantId))

  return (
    <div className="bg-surface border border-border rounded-xl p-3">
      {/* Card header */}
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        <span
          className={`w-5 h-5 rounded-md ${tint.iconBg} ${tint.iconText} inline-flex items-center justify-center flex-shrink-0`}
        >
          <Icon name={cat.icon} size={11} />
        </span>
        <span className="text-13 font-bold text-text-primary">{cat.label}</span>
        {isRam && (
          <div className="flex items-center gap-1">
            {ddrLabels.map(ddr => (
              <button
                key={ddr}
                type="button"
                onClick={() => setRamDdr(ddr)}
                className={`px-1.5 h-5 rounded text-10 font-semibold transition-all border ${
                  ramDdr === ddr
                    ? 'bg-accent border-accent text-white'
                    : 'bg-surface border-border text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {ddr}
              </button>
            ))}
          </div>
        )}
        <span className="ml-auto text-10 text-text-subtle tabular-nums flex-shrink-0">
          {visibleParts.length}&nbsp;{t('addModal.positions')}
        </span>
      </div>

      {/* Horizontal-scroll mini-stepper row */}
      <div className="flex gap-[0.4375rem] overflow-x-auto pb-1">
        {visibleParts.map(p => {
          const qtyValue = qtys[p.id] ?? ''
          const qtyNum = parseInt(qtyValue, 10) || 0
          const isActive = qtyNum > 0
          const sizeLabel = p.variantLabel || p.name
          return (
            <div key={p.id} className="flex-shrink-0 w-[4.5rem]">
              <div
                className={`text-10.5 mb-1 leading-none ${
                  isActive ? 'text-accent' : 'text-text-secondary'
                }`}
              >
                {sizeLabel}
              </div>
              <div
                className={`flex items-center bg-bg border rounded-md overflow-hidden transition-colors ${
                  isActive ? 'border-accent' : 'border-border'
                }`}
              >
                <button
                  type="button"
                  onClick={() => bumpQty(p.id, -1)}
                  disabled={qtyNum <= 0}
                  aria-label={`${t('addModal.decrease')} ${sizeLabel}`}
                  className="w-6 h-7 flex-shrink-0 flex items-center justify-center text-text-tertiary hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Icon name="minus" size={10} />
                </button>
                <div
                  className={`flex-1 text-center text-12 font-semibold font-mono tabular-nums leading-none select-none ${
                    isActive ? 'text-accent' : 'text-text-secondary'
                  }`}
                >
                  {qtyNum === 0 ? '0' : qtyValue}
                </div>
                <button
                  type="button"
                  onClick={() => bumpQty(p.id, +1)}
                  aria-label={`${t('addModal.increase')} ${sizeLabel}`}
                  className="w-6 h-7 flex-shrink-0 flex items-center justify-center text-text-tertiary hover:bg-surface-2 transition-colors"
                >
                  <Icon name="plus" size={10} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
