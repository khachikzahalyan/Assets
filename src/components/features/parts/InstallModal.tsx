import { useState, useCallback, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Btn, Icon, MobileSheet, Select } from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { Part, PartsAsset } from '@/domain/part/types'
import type { InstallInput } from '@/domain/part/PartRepository'
import {
  assetFamilyOf,
  isServiceOnly,
  slotKindForSku,
  slotIsSingle,
  slotLabelFor,
  currentPartsForSkuCategory,
  workingStock,
} from '@/domain/part/partStock'
import { isInsufficientStockError } from '@/domain/part/errors'

export interface InstallModalProps {
  open: boolean
  onClose: () => void
  sku: Part | null
  partsAssets: PartsAsset[]
  onConfirm: (input: InstallInput) => Promise<void>
}

type DisposalChoice = 'warehouse' | 'broken'
type ActionMode = 'install' | 'replace' | 'add'

/**
 * Install/Replace modal — full slot-decision logic from partStock.ts helpers.
 * Ported directly from the prototype InstallModal (parts.html 563-990).
 *
 * Slot-decision flow:
 *  1. User selects target asset.
 *  2. We derive existing slots via currentPartsForSkuCategory.
 *  3. empty slot → straight install.
 *  4. occupied single-slot cat → forced replace: select which slot.
 *  5. occupied multi-slot cat → user chooses replace-one OR "add alongside".
 *  6. Cooler/PSU always auto-broken on replace (no disposal choice shown).
 *  7. Service device → serviceReplace: true, stock untouched.
 *
 * NO slot/stock math is implemented here — all calls go to domain helpers.
 *
 * Note field is intentionally removed (prototype does not have it).
 * Asset selector uses the shared <Select> (themed MiniDropdown + sr-only native
 * <select>), so mobile and desktop share one styled control while tests keep
 * driving the hidden combobox via getAllByRole('combobox')[0].
 */
export function InstallModal({ open, onClose, sku, partsAssets, onConfirm }: InstallModalProps) {
  const { t } = useTranslation('parts')
  const isMobile = useIsMobile()
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [actionMode, setActionMode] = useState<ActionMode>('install')
  const [replaceIdx, setReplaceIdx] = useState<number | null>(null)
  const [disposal, setDisposal] = useState<DisposalChoice>('warehouse')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = useCallback(() => {
    setSelectedAssetId(null)
    setActionMode('install')
    setReplaceIdx(null)
    setDisposal('warehouse')
    setError(null)
    onClose()
  }, [onClose])

  const selectedAsset = useMemo(
    () => partsAssets.find(a => a.id === selectedAssetId) ?? null,
    [partsAssets, selectedAssetId],
  )

  const family = selectedAsset ? assetFamilyOf(selectedAsset.categoryId) : null
  const isService = selectedAsset ? isServiceOnly(selectedAsset.categoryId) : false
  const slotKind = (selectedAsset && sku) ? slotKindForSku(sku.category, family) : null
  const slotLabel = slotKind ? slotLabelFor(slotKind) : (sku?.category ?? '')

  // All existing slots for this SKU category on the selected asset
  const existingSlots = useMemo(() => {
    if (!selectedAsset || !sku) return []
    return currentPartsForSkuCategory(selectedAsset.upgradeCurrent, sku.category, family)
  }, [selectedAsset, sku, family])

  const isSingle = sku && family ? slotIsSingle(slotKindForSku(sku.category, family) ?? '', family) : false

  const hasOccupied = existingSlots.some(s => !s.isEmpty)
  const hasEmpty = existingSlots.some(s => s.isEmpty)

  // Cooler/PSU always scrap on replace
  const autoScrap = sku?.category === 'cooler' || sku?.category === 'psu'

  // Auto-scrap caption per category
  const autoScrapCaption =
    sku?.category === 'cooler' ? 'Старый кулер будет списан'
    : sku?.category === 'psu' ? 'Старый блок питания будет списан'
    : null

  // Derive recommended action when asset changes
  const derivedAction = useMemo<ActionMode>(() => {
    if (existingSlots.length === 0 || hasEmpty) return 'install'
    if (isSingle && hasOccupied) return 'replace'
    if (!isSingle && hasOccupied) return 'replace' // default; user can switch to 'add'
    return 'install'
  }, [existingSlots, hasEmpty, hasOccupied, isSingle])

  // Auto-set action when asset changes
  const handleAssetSelect = useCallback((assetId: string) => {
    setSelectedAssetId(assetId)
    setReplaceIdx(null)
    setDisposal('warehouse')
    setError(null)
    setActionMode('install')
  }, [])

  // Once we know existingSlots, snap actionMode to derived if not yet set by user
  const effectiveAction = !selectedAsset ? 'install' : (actionMode === 'install' ? derivedAction : actionMode)

  const stockOk = sku ? workingStock(sku) > 0 : false
  // Service devices (isService) bypass the stock requirement — they never debit the warehouse.
  // For in-house devices all action modes (install, replace, add) consume 1 unit of stock,
  // so stockOk is required regardless of effectiveAction.
  const canSubmit = !!selectedAsset && (isService || stockOk)

  const handleSubmit = useCallback(async () => {
    if (!selectedAsset || !sku) return
    setSubmitting(true)
    setError(null)
    try {
      const oldIsBroken = autoScrap ? true : disposal === 'broken'
      const input: InstallInput = {
        skuId: sku.id,
        assetId: selectedAsset.assetId,
        assetInvCode: selectedAsset.id,
        assetCategoryId: selectedAsset.categoryId,
        action: effectiveAction === 'add' ? 'install' : (effectiveAction as 'install' | 'replace'),
        replaceUcIndex: effectiveAction === 'replace' ? (replaceIdx ?? null) : null,
        oldIsBroken,
        serviceReplace: isService,
        note: null,
      }
      await onConfirm(input)
      handleClose()
    } catch (err) {
      if (isInsufficientStockError(err)) {
        setError(t('installModal.insufficientStock'))
      } else {
        setError(t('installModal.errorFailed'))
      }
    } finally {
      setSubmitting(false)
    }
  }, [selectedAsset, sku, effectiveAction, replaceIdx, disposal, autoScrap, isService, onConfirm, handleClose, t])

  if (!open || !sku) return null

  const occupiedSlots = existingSlots.filter(s => !s.isEmpty)

  // For single-slot with exactly 1 current: action is forced (no radio needed)
  const forcedReplace = isSingle && occupiedSlots.length === 1

  const content = (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-border flex items-start justify-between gap-3">
        <div>
          <h2 className="text-17 font-bold text-text-primary leading-tight">
            Установить {sku.name}{sku.variantLabel ? ` · ${sku.variantLabel}` : ''}
          </h2>
          <p className="mt-0.5 text-14.5 text-text-tertiary">
            Остаток: <span className="font-semibold text-text-secondary">{workingStock(sku)} шт</span>
          </p>
        </div>
        <button type="button" onClick={handleClose} aria-label={t('installModal.close')} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-subtle hover:text-text-primary hover:bg-surface-2 transition-colors">
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="overflow-y-auto flex flex-col gap-4 px-5 py-4" style={{ maxHeight: '60vh' }}>
        {/* Stock warning */}
        {!isService && !stockOk && (
          <div className="flex items-center gap-2 bg-rose-950/30 border border-rose-800/40 rounded-lg px-3 py-2 text-12.5 text-rose-300 light:bg-rose-50 light:border-rose-200 light:text-rose-700">
            <Icon name="triangle-alert" size={13} />
            {t('installModal.noStock')}
          </div>
        )}

        {/* Asset selector — shared <Select> (themed dropdown, one control for mobile + desktop).
            The sr-only native <select> inside it stays first in the DOM for getAllByRole('combobox')[0]. */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="install-asset" className="text-12.5 font-medium text-text-tertiary">
            {t('installModal.labelAsset')} <span className="text-rose-400 light:text-rose-600">*</span>
          </label>
          <Select
            id="install-asset"
            value={selectedAssetId ?? ''}
            onChange={handleAssetSelect}
            placeholder={t('installModal.assetPlaceholder')}
            options={partsAssets.map(a => ({ value: a.id, label: `${a.id} — ${a.name} (${a.kind})` }))}
          />
        </div>

        {/* Service notice */}
        {isService && (
          <div className="flex items-center gap-2 bg-sky-950/30 border border-sky-800/40 rounded-lg px-3 py-2 text-12.5 text-sky-300 light:bg-sky-50 light:border-sky-200 light:text-sky-700">
            <Icon name="info" size={13} />
            {t('installModal.serviceNotice')}
          </div>
        )}

        {/* Contextual panel — shown when asset is selected */}
        {selectedAsset && (
          <div className="rounded-lg border border-border bg-bg overflow-hidden">
            {/* Asset row */}
            <div className="px-3 py-2 border-b border-border flex items-center gap-2">
              <span className="w-7 h-7 rounded-md bg-surface-2 text-text-tertiary inline-flex items-center justify-center flex-shrink-0">
                <Icon name="monitor" size={13} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-13.5 font-bold text-accent">{selectedAsset.id}</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 text-11.5 font-semibold rounded bg-surface-2 text-text-primary border border-[#2A2F36]/80 light:border-border">
                    {selectedAsset.kind}
                  </span>
                </div>
                <div className="text-13 text-text-tertiary truncate">{selectedAsset.name}</div>
              </div>
            </div>

            {/* Slot state */}
            {!hasOccupied && (
              /* Empty slot — straight install */
              <div className="px-3 py-2.5 flex items-center gap-2 border-t border-border bg-[#161A1F] light:bg-surface-sunken">
                <Icon name="info" size={13} className="text-text-subtle flex-shrink-0" />
                <span className="text-13.5 text-text-subtle leading-snug">
                  Слот «{slotLabel}» пуст — будет выполнена установка
                </span>
              </div>
            )}

            {hasOccupied && (
              /* Slot occupied — replace options (+ add alongside for multi-slot) */
              <div className="px-3 pt-3 pb-2.5 space-y-1.5">
                {occupiedSlots.map(({ slot, idx }) => {
                  const isPicked = effectiveAction === 'replace' && (replaceIdx === idx || (forcedReplace && occupiedSlots.length === 1))

                  return (
                    <div key={idx} className="space-y-0">
                      <label
                        className={`flex items-start gap-2 px-3 py-2 rounded transition-colors border ${forcedReplace ? 'cursor-default' : 'cursor-pointer'}
                          ${isPicked || forcedReplace ? 'bg-rose-500/10 border-rose-500/60' : 'bg-surface border-transparent hover:bg-surface-2'}`}
                      >
                        {/* Always render the radio input (required for tests getAllByDisplayValue('replace')).
                            For forced-replace (single-slot), it is visually hidden and pre-checked. */}
                        <input
                          type="radio"
                          name="action-mode"
                          value="replace"
                          checked={isPicked || forcedReplace}
                          onChange={() => {
                            if (!forcedReplace) {
                              setActionMode('replace')
                              setReplaceIdx(idx)
                              setDisposal('warehouse')
                            }
                          }}
                          className={forcedReplace ? 'sr-only' : 'mt-1 accent-rose-500'}
                        />
                        {/* Show visible rose checkmark for forced replace */}
                        {forcedReplace && (
                          <span className="w-4 h-4 rounded-full inline-flex items-center justify-center flex-shrink-0 mt-0.5 bg-rose-500/80">
                            <Icon name="check" size={10} className="text-white" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-15 font-semibold text-text-primary leading-tight">
                            <span>Заменить: </span>
                            <span>{slot.spec || ('Заводской ' + slotLabel.toLowerCase())}</span>
                            {slot.storageType ? <span> · {slot.storageType}</span> : null}
                          </div>
                          {/* autoScrap amber banner — FIX: show when replace is active and autoScrap, NOT inside !autoScrap block */}
                          {(isPicked || forcedReplace) && autoScrap && autoScrapCaption && (
                            <div className="mt-2 ml-1 flex items-center gap-1.5 bg-amber-500/10 ring-1 ring-amber-500/30 rounded-md px-2.5 py-2">
                              <Icon name="triangle-alert" size={12} className="text-amber-400 flex-shrink-0 light:text-amber-700" />
                              <span className="text-13 text-amber-300 leading-snug light:text-amber-700">{autoScrapCaption}</span>
                            </div>
                          )}
                        </div>
                      </label>

                      {/* Disposal sub-radios — only when this replace picked AND not autoScrap AND not service */}
                      {(isPicked || forcedReplace) && !autoScrap && !isService && (
                        <div className="ml-4 mt-1.5 mb-1 border border-border border-l-2 border-l-[#F97316]/30 bg-[#161A1F] rounded-lg px-3 py-2.5 light:bg-surface-sunken">
                          <div className="text-12 uppercase tracking-wide text-text-subtle mb-2 leading-tight">
                            Что делать со старой деталью?
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label
                              className={`flex items-center justify-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors min-h-[var(--ctl-h-md)] border
                                ${disposal === 'warehouse'
                                  ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30 border-emerald-500/40'
                                  : 'border-border hover:bg-surface-2'}`}
                            >
                              <input
                                type="radio"
                                name="disposal"
                                value="warehouse"
                                checked={disposal === 'warehouse'}
                                onChange={() => setDisposal('warehouse')}
                                className="sr-only"
                              />
                              <span className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors
                                ${disposal === 'warehouse' ? 'bg-emerald-500 border-emerald-500' : 'bg-border border-border-strong'}`}>
                                {disposal === 'warehouse' && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
                                )}
                              </span>
                              <Icon name="package" size={12} className={`flex-shrink-0 ${disposal === 'warehouse' ? 'text-emerald-400 light:text-emerald-700' : 'text-text-subtle'}`} />
                              <span className={`text-13 leading-tight ${disposal === 'warehouse' ? 'text-emerald-300 light:text-emerald-700' : 'text-text-secondary'}`}>
                                Вернуть на склад
                              </span>
                            </label>
                            <label
                              className={`flex items-center justify-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors min-h-[var(--ctl-h-md)] border
                                ${disposal === 'broken'
                                  ? 'bg-red-500/10 ring-1 ring-red-500/30 border-red-500/40'
                                  : 'border-border hover:bg-surface-2'}`}
                            >
                              <input
                                type="radio"
                                name="disposal"
                                value="broken"
                                checked={disposal === 'broken'}
                                onChange={() => setDisposal('broken')}
                                className="sr-only"
                              />
                              <span className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors
                                ${disposal === 'broken' ? 'bg-red-500 border-red-500' : 'bg-border border-border-strong'}`}>
                                {disposal === 'broken' && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
                                )}
                              </span>
                              <Icon name="x-circle" size={12} className={`flex-shrink-0 ${disposal === 'broken' ? 'text-red-400 light:text-red-700' : 'text-text-subtle'}`} />
                              <span className={`text-13 leading-tight ${disposal === 'broken' ? 'text-red-300 light:text-red-700' : 'text-text-secondary'}`}>
                                Списать
                              </span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* "Add alongside" card — only for multi-slot categories */}
                {!isSingle && (
                  <label
                    className={`flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors border
                      ${effectiveAction === 'add' ? 'bg-emerald-500/10 border-emerald-500/60' : 'bg-surface border-transparent hover:bg-surface-2'}`}
                  >
                    <input
                      type="radio"
                      name="action-mode"
                      value="add"
                      checked={effectiveAction === 'add'}
                      onChange={() => { setActionMode('add'); setDisposal('warehouse') }}
                      className="mt-1 accent-emerald-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-14 font-semibold text-text-primary leading-tight">
                        Добавить рядом — поставить ещё один {sku.name}{sku.variantLabel ? ` · ${sku.variantLabel}` : ''}
                      </div>
                      <div className="text-13 text-emerald-300 mt-0.5 leading-snug light:text-emerald-700">
                        Старая запчасть остаётся в активе
                      </div>
                    </div>
                  </label>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mx-5 text-12.5 text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-lg px-3 py-2 light:bg-rose-50 light:border-rose-200 light:text-rose-700" role="alert">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
        <Btn variant="secondary" size="md" onClick={handleClose} disabled={submitting}>
          {t('installModal.cancel')}
        </Btn>
        <Btn
          variant="primary"
          size="md"
          onClick={handleSubmit}
          disabled={
            submitting ||
            !canSubmit ||
            (effectiveAction === 'replace' && !forcedReplace && replaceIdx === null && occupiedSlots.length > 1)
          }
        >
          {submitting ? (
            <><Icon name="loader-2" size={14} className="animate-spin" />{t('installModal.saving')}</>
          ) : (
            <><Icon name="wrench" size={14} />Установить</>
          )}
        </Btn>
      </div>
    </div>
  )

  return (
    <>
      {!isMobile && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] light:bg-slate-900/35" onClick={handleClose} />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={t('installModal.title')}
          >
            {content}
          </div>
        </div>,
        document.body,
      )}
      {isMobile && (
        <MobileSheet open={open} onClose={handleClose} title={t('installModal.title')}>
          {content}
        </MobileSheet>
      )}
    </>
  )
}
