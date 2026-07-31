/**
 * AssetPickerSheet — 4-step wizard for linking warehouse stock to an employee.
 *
 * Ported from Warehouse/prototypes/employees.html lines 2161-2532.
 * All data injected via props — no globals, no window.AMS_MOCK.
 *
 * Steps: group → category → items → review.
 * Cart persists across navigation within the wizard.
 * Cancelling with non-empty cart shows an in-modal confirm overlay.
 */
import { useTranslation } from 'react-i18next'
import { Icon, Btn } from '@/components/ui'
import { RoleIcon } from '@/components/ui/RoleIcon'
import { EmployeeModalShell } from './EmployeeModalShell'
import type { AssetPickerSheetProps } from './assetPickerTypes'
import { ASSET_GROUP_BY_ID } from './assetPickerTypes'
import { useAssetPicker } from './useAssetPicker'
import {
  AssetPickerGroupStep,
  AssetPickerCategoryStep,
  AssetPickerItemsStep,
  AssetPickerReviewStep,
} from './AssetPickerSteps'

// Keep both types importable from this path (test + index.ts depend on it)
export type { PickerStockRow, AssetPickerSheetProps } from './assetPickerTypes'

export function AssetPickerSheet({
  open,
  emp,
  stock,
  onConfirm,
  onClose,
}: AssetPickerSheetProps) {
  const { t } = useTranslation('employees')

  const {
    step,
    groupId,
    catName,
    query,
    cart,
    pendingClose,
    groupCounts,
    categoriesInGroup,
    itemsInCategory,
    cartRows,
    cartByCat,
    setQuery,
    setPendingClose,
    toggle,
    removeFromCart,
    selectGroup,
    selectCategory,
    goToGroupStep,
    goToCategoryStep,
    goToReviewStep,
    requestClose,
  } = useAssetPicker(open, stock, onClose)

  if (!emp) return null

  const count = cart.size
  const empName = `${emp.firstName} ${emp.lastName}`
  const group = groupId ? ASSET_GROUP_BY_ID[groupId] : null

  // Breadcrumb
  const crumbs: { label: string; onClick: () => void; active: boolean }[] = []
  if (step === 'review') {
    crumbs.push({ label: t('picker.review'), onClick: () => {}, active: true })
  } else {
    crumbs.push({
      label: 'Категория',
      onClick: goToGroupStep,
      active: step === 'group',
    })
    if (group) {
      crumbs.push({
        label: group.label,
        onClick: goToCategoryStep,
        active: step === 'category',
      })
    }
    if (catName) {
      crumbs.push({ label: catName, onClick: () => {}, active: step === 'items' })
    }
  }

  return (
    <EmployeeModalShell open={open} onClose={requestClose} width="max-w-2xl">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <RoleIcon role="employee" size={40} className="shrink-0" />
            <div className="min-w-0">
              <div className="text-17 font-bold text-text-primary tracking-tight truncate">
                {t('picker.title')} {empName}
              </div>
              <div className="text-14 text-text-primary mt-0.5 truncate">
                {[emp.position, emp.departmentName, emp.branchName]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Cart pill — visible when cart has items and not on review step */}
            {count > 0 && step !== 'review' && (
              <button
                type="button"
                onClick={goToReviewStep}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-accent/10 text-accent border border-accent/70 text-13.5 font-semibold tracking-tight hover:bg-accent/15 transition-colors"
              >
                <Icon name="shopping-cart" size={12} />
                {t('picker.cart')} <span className="tabular-nums">{count}</span>
              </button>
            )}
            <button
              type="button"
              onClick={requestClose}
              aria-label={t('picker.back')}
              className="w-8 h-8 rounded-md text-text-subtle hover:text-text-secondary hover:bg-surface-2 flex items-center justify-center transition-colors"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>
        {/* Breadcrumb */}
        <div className="mt-3.5 flex items-center gap-1 text-14">
          {crumbs.map((c, i) => (
            <span key={i} className="inline-flex items-center">
              {i > 0 && (
                <Icon name="chevron-right" size={12} className="text-text-subtle mx-0.5" />
              )}
              <button
                type="button"
                onClick={c.onClick}
                disabled={c.active}
                className={`px-1.5 py-0.5 rounded font-medium tracking-tight transition-colors ${
                  c.active
                    ? 'text-text-primary cursor-default'
                    : 'text-text-primary hover:text-accent hover:bg-accent/10'
                }`}
              >
                {c.label}
              </button>
            </span>
          ))}
        </div>
      </div>

      {step === 'group' && (
        <AssetPickerGroupStep groupCounts={groupCounts} onSelectGroup={selectGroup} />
      )}

      {step === 'category' && group && (
        <AssetPickerCategoryStep
          groupLabel={group.label}
          categoriesInGroup={categoriesInGroup}
          onSelectCategory={selectCategory}
        />
      )}

      {step === 'items' && group && catName && (
        <AssetPickerItemsStep
          catName={catName}
          query={query}
          setQuery={setQuery}
          itemsInCategory={itemsInCategory}
          cart={cart}
          toggle={toggle}
        />
      )}

      {step === 'review' && (
        <AssetPickerReviewStep
          cartRows={cartRows}
          cartByCat={cartByCat}
          removeFromCart={removeFromCart}
          goToGroupStep={goToGroupStep}
        />
      )}

      {/* Footer */}
      <div className="px-6 py-3.5 bg-bg/60 border-t border-border flex items-center justify-between gap-2">
        <div className="text-13.5 text-text-primary min-w-0 truncate">
          {step === 'items' && count > 0 ? (
            <>
              В корзине:{' '}
              <span className="font-semibold text-text-primary tabular-nums">{count}</span> · статус
              станет <span className="font-semibold text-text-primary">Выдано</span>
            </>
          ) : step === 'review' && count > 0 ? (
            <>
              {t('picker.willLink')}{' '}
              <span className="font-semibold text-text-primary tabular-nums">{count}</span> к{' '}
              <span className="font-semibold text-text-primary">{empName}</span>
            </>
          ) : step === 'review' ? (
            <>{t('picker.empty')}</>
          ) : (
            <>
              {t('picker.branchOnly')}{' '}
              <span className="font-semibold text-text-primary">{emp.branchName}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {step === 'category' && (
            <Btn variant="ghost" onClick={goToGroupStep}>
              <Icon name="chevron-left" size={14} /> {t('picker.back')}
            </Btn>
          )}
          {step === 'items' && (
            <Btn variant="ghost" onClick={goToCategoryStep}>
              <Icon name="chevron-left" size={14} /> {t('picker.back')}
            </Btn>
          )}
          {step === 'review' && (
            <Btn variant="ghost" onClick={goToGroupStep}>
              <Icon name="chevron-left" size={14} /> {t('picker.toSelection')}
            </Btn>
          )}
          <Btn variant="ghost" onClick={requestClose}>
            Отмена
          </Btn>
          {(step === 'group' || step === 'category') && count > 0 && (
            <Btn variant="primary" onClick={goToReviewStep}>
              <Icon name="shopping-cart" size={14} />
              {t('picker.cart')} ({count})
            </Btn>
          )}
          {step === 'items' && (
            <Btn variant="primary" onClick={goToReviewStep} disabled={count === 0}>
              {t('picker.done')} ({count})
              <Icon name="chevron-right" size={14} />
            </Btn>
          )}
          {step === 'review' && (
            <Btn
              variant="primary"
              onClick={() => onConfirm(Array.from(cart))}
              disabled={count === 0}
            >
              <Icon name="link-2" size={14} />
              {t('picker.confirm')} ({count})
            </Btn>
          )}
        </div>
      </div>

      {/* Cancel-with-cart confirmation overlay */}
      {pendingClose && (
        <div className="absolute inset-0 bg-surface/85 backdrop-blur-[1px] flex items-center justify-center p-6 rounded-2xl">
          <div className="w-full max-w-sm bg-surface rounded-xl border border-border shadow-xl shadow-black/40 light:shadow-slate-300/60 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-300 light:text-amber-700 flex items-center justify-center shrink-0">
                <Icon name="alert-triangle" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-16 font-bold text-text-primary tracking-tight">
                  {t('picker.cancelTitle')}
                </div>
                <div className="text-14.5 text-text-tertiary mt-1 leading-relaxed">
                  В корзине{' '}
                  <span className="font-semibold text-text-primary tabular-nums">{count}</span>{' '}
                  {count === 1 ? 'актив' : count < 5 ? 'актива' : 'активов'}. Без подтверждения
                  они не будут привязаны.
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Btn variant="ghost" size="sm" onClick={() => setPendingClose(false)}>
                {t('picker.back')}
              </Btn>
              <Btn
                variant="danger"
                size="sm"
                onClick={() => {
                  setPendingClose(false)
                  onClose()
                }}
              >
                {t('picker.cancelConfirm')}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </EmployeeModalShell>
  )
}
