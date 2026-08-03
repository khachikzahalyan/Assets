import { useTranslation } from 'react-i18next'
import { Icon, Btn } from '@/components/ui'
import type { PickerStockRow, GroupToneKey } from './assetPickerTypes'
import { ASSET_GROUPS, ASSET_GROUP_TONES } from './assetPickerTypes'

// ── Step 1 — Group selection ──────────────────────────────────────────────────

interface AssetPickerGroupStepProps {
  groupCounts: Record<string, number>
  onSelectGroup: (id: string) => void
}

export function AssetPickerGroupStep({ groupCounts, onSelectGroup }: AssetPickerGroupStepProps) {
  const { t } = useTranslation('employees')
  return (
    <div className="px-6 py-5">
      <div className="text-14 text-text-primary mb-3">{t('picker.intro')}</div>
      <div className="grid grid-cols-3 gap-3">
        {ASSET_GROUPS.map((g) => {
          const tone = ASSET_GROUP_TONES[g.tone as GroupToneKey]
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelectGroup(g.id)}
              className={`group flex flex-col items-start gap-3 p-4 rounded-xl bg-surface border ${tone.border} ${tone.hoverBorder} ${tone.hoverBg} shadow-sm hover:shadow-md transition-all duration-150 text-left`}
            >
              <span
                className={`w-11 h-11 rounded-lg ${tone.tile} flex items-center justify-center`}
              >
                <Icon name={g.icon} size={20} />
              </span>
              <div className="min-w-0">
                <div className="text-15.5 font-bold text-text-primary tracking-tight">
                  {g.id === 'devices'
                    ? t('picker.groupDevices')
                    : g.id === 'network'
                      ? t('picker.groupNetwork')
                      : t('picker.groupFurniture')}
                </div>
                <div className="text-13 text-text-primary mt-0.5 tabular-nums">
                  {groupCounts[g.id] ?? 0} {t('picker.inStock')}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 2 — Subcategory selection ────────────────────────────────────────────

interface AssetPickerCategoryStepProps {
  groupLabel: string
  categoriesInGroup: { name: string; icon: string; count: number }[]
  onSelectCategory: (name: string) => void
}

export function AssetPickerCategoryStep({
  groupLabel,
  categoriesInGroup,
  onSelectCategory,
}: AssetPickerCategoryStepProps) {
  return (
    <div className="px-6 py-5">
      <div className="text-14 text-text-primary mb-3">
        Подкатегория в группе «
        <span className="text-text-primary font-semibold">{groupLabel}</span>».
      </div>
      {categoriesInGroup.length === 0 ? (
        <div className="py-10 text-center text-14.5 text-text-tertiary">
          Подкатегорий нет
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {categoriesInGroup.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => onSelectCategory(c.name)}
              className="group flex items-center gap-3 p-3 rounded-lg bg-surface border border-border/80 hover:border-accent hover:bg-accent/10 hover:shadow-sm transition-all duration-150 text-left"
            >
              <span className="w-9 h-9 rounded-md bg-surface-2 group-hover:bg-accent/15 text-text-tertiary group-hover:text-accent flex items-center justify-center shrink-0 transition-colors">
                <Icon name={c.icon} size={15} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-15 font-semibold text-text-primary truncate tracking-tight">
                  {c.name}
                </div>
                <div className="text-13 text-text-primary tabular-nums">
                  {c.count} {c.count === 1 ? 'актив' : 'активов'}
                </div>
              </div>
              <Icon
                name="chevron-right"
                size={14}
                className="text-text-subtle group-hover:text-accent-light transition-colors shrink-0"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Step 3 — Specific items in subcategory ────────────────────────────────────

interface AssetPickerItemsStepProps {
  catName: string
  query: string
  setQuery: (q: string) => void
  itemsInCategory: PickerStockRow[]
  cart: Set<string>
  toggle: (id: string) => void
}

export function AssetPickerItemsStep({
  catName,
  query,
  setQuery,
  itemsInCategory,
  cart,
  toggle,
}: AssetPickerItemsStepProps) {
  const { t } = useTranslation('employees')
  return (
    <>
      <div className="px-6 pt-4 pb-3">
        {/* Inline search — no SearchInput export exists, inline matching prototype */}
        <div className="flex items-center gap-2 bg-bg rounded-xl px-3 py-2 ring-1 ring-border">
          <Icon name="search" size={14} className="text-text-subtle shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск..."
            aria-label={`Поиск в «${catName}»`}
            className="flex-1 text-14 bg-transparent border-none outline-none placeholder:text-text-subtle text-text-primary min-w-0"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-text-subtle hover:text-text-tertiary transition-colors"
              aria-label="Очистить поиск"
            >
              <Icon name="x" size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="max-h-[21.25rem] overflow-y-auto border-t border-border">
        {itemsInCategory.length === 0 ? (
          <div className="px-6 py-12 text-center text-14.5 text-text-tertiary">
            {t('picker.notFound')}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {itemsInCategory.map((a) => {
              const isSel = cart.has(a.id)
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => toggle(a.id)}
                    className={`w-full flex items-center gap-3 px-6 py-2.5 text-left transition-colors duration-100 ${
                      isSel ? 'bg-accent/10' : 'hover:bg-bg'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                        isSel
                          ? 'bg-accent border-accent text-white'
                          : 'border-border-strong bg-surface'
                      }`}
                    >
                      {isSel && <Icon name="check" size={11} />}
                    </span>
                    <span className="w-8 h-8 rounded-md bg-surface-2 text-text-tertiary flex items-center justify-center shrink-0">
                      <Icon name={a.icon} size={13} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-15 font-semibold text-text-primary truncate tracking-tight">
                        {a.title}
                      </div>
                      <div className="text-13 text-text-primary truncate">{a.cat}</div>
                    </div>
                    <span className="font-mono text-13.5 font-medium text-text-primary bg-bg border border-border/80 rounded px-1.5 py-0.5 shrink-0">
                      {a.invCode}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}

// ── Step 4 — Review (cart contents) ──────────────────────────────────────────

interface AssetPickerReviewStepProps {
  cartRows: PickerStockRow[]
  cartByCat: { name: string; icon: string; rows: PickerStockRow[] }[]
  removeFromCart: (id: string) => void
  goToGroupStep: () => void
}

export function AssetPickerReviewStep({
  cartRows,
  cartByCat,
  removeFromCart,
  goToGroupStep,
}: AssetPickerReviewStepProps) {
  const { t } = useTranslation('employees')
  return (
    <div className="max-h-[26.25rem] overflow-y-auto">
      {cartRows.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-surface-2 text-text-subtle flex items-center justify-center mb-3">
            <Icon name="shopping-cart" size={20} />
          </div>
          <div className="text-15 font-semibold text-text-primary mb-1">
            {t('picker.empty')}
          </div>
          <div className="text-14 text-text-tertiary mb-4">{t('picker.emptyHint')}</div>
          <Btn variant="secondary" onClick={goToGroupStep}>
            <Icon name="chevron-left" size={14} /> {t('picker.toSelection')}
          </Btn>
        </div>
      ) : (
        <div className="px-6 py-4 space-y-4">
          {cartByCat.map((grp) => (
            <div key={grp.name}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-12.5 font-semibold text-text-tertiary tracking-[0.06em] uppercase">
                  {grp.name}
                </span>
                <span className="inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-surface-2 text-text-tertiary text-12.5 font-semibold tabular-nums">
                  {grp.rows.length}
                </span>
              </div>
              <ul className="divide-y divide-border rounded-lg border border-border/70 overflow-hidden bg-surface">
                {grp.rows.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="w-8 h-8 rounded-md bg-surface-2 text-text-tertiary flex items-center justify-center shrink-0">
                      <Icon name={a.icon} size={13} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-15 font-semibold text-text-primary truncate tracking-tight">
                        {a.title}
                      </div>
                      <div className="text-13 text-text-tertiary truncate">{a.cat}</div>
                    </div>
                    <span className="font-mono text-13.5 font-medium text-text-primary bg-bg border border-border/80 rounded px-1.5 py-0.5 shrink-0">
                      {a.invCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFromCart(a.id)}
                      title="Убрать из корзины"
                      className="w-7 h-7 rounded-md text-text-subtle hover:text-rose-300 light:hover:text-rose-700 hover:bg-rose-500/10 flex items-center justify-center transition-colors shrink-0"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
