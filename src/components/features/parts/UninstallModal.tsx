import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Icon, MobileSheet } from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { Part, PartsAsset, UpgradeSlot } from '@/domain/part/types'
import type { UninstallInput } from '@/domain/part/PartRepository'
import { isServiceOnly } from '@/domain/part/partStock'

export interface UninstallModalProps {
  open: boolean
  onClose: () => void
  sku: Part | null
  asset: PartsAsset | null
  /** The specific slot being uninstalled, or null to pick first match */
  slot?: UpgradeSlot | null
  /** Optional stock counters for the FROM→TO preview strip */
  stock?: { onHand: number }
  onConfirm: (input: UninstallInput) => Promise<void>
}

/**
 * Uninstall/Dismount modal.
 *   - Desktop/server: choose return-to-shelf or scrap.
 *   - Service device (laptop): serviceReplace=true, stock untouched, note allowed.
 *
 * Prototype parity: flow card with FROM→TO strip, disposal radios as full-width rows.
 */
export function UninstallModal({ open, onClose, sku, asset, slot: _slot, stock, onConfirm }: UninstallModalProps) {
  const { t } = useTranslation('parts')
  const isMobile = useIsMobile()
  const [broken, setBroken] = useState(false)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isService = asset ? isServiceOnly(asset.categoryId) : false
  const isWarehouse = !broken

  const handleClose = useCallback(() => {
    setBroken(false)
    setNote('')
    setError(null)
    onClose()
  }, [onClose])

  const handleSubmit = useCallback(async () => {
    if (!sku || !asset) return
    setSubmitting(true)
    setError(null)
    try {
      const input: UninstallInput = {
        skuId: sku.id,
        assetId: asset.assetId,
        assetInvCode: asset.id,
        assetCategoryId: asset.categoryId,
        broken: isService ? false : broken,
        serviceReplace: isService,
        note: note.trim() || null,
      }
      await onConfirm(input)
      handleClose()
    } catch {
      setError(t('uninstallModal.errorFailed'))
    } finally {
      setSubmitting(false)
    }
  }, [sku, asset, broken, note, isService, onConfirm, handleClose, t])

  if (!open || !sku || !asset) return null

  const content = (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#F97316]/15 text-accent-light flex-shrink-0">
              <Icon name="rotate-ccw" size={14} />
            </div>
            <h2 className="text-[16px] font-bold text-text-primary leading-tight">{t('uninstallModal.title')}</h2>
          </div>
          <button type="button" onClick={handleClose} aria-label={t('uninstallModal.close')} className="w-7 h-7 rounded-md flex items-center justify-center text-text-subtle hover:text-text-primary hover:bg-surface-2 transition-colors">
            <Icon name="x" size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 overflow-y-auto flex-1 flex flex-col gap-3" style={{ maxHeight: '60vh' }}>

        {/* Flow card */}
        <div className="rounded-xl border border-border bg-bg overflow-hidden">
          {/* SKU row */}
          <div className="px-4 pt-3.5 pb-2.5 border-b border-border">
            <div className="text-[12px] font-semibold uppercase tracking-widest text-text-subtle mb-0.5">Запчасть</div>
            <div className="text-[15.5px] font-bold text-text-primary leading-snug">
              {sku.name}{sku.variantLabel ? <span className="text-text-tertiary font-normal"> · {sku.variantLabel}</span> : ''}
            </div>
          </div>

          {/* FROM → TO strip */}
          <div className="flex items-stretch">
            {/* FROM: asset */}
            <div className="flex-1 px-3.5 py-2.5 bg-[#F97316]/10 border-r border-border">
              <div className="text-[12px] font-semibold uppercase tracking-widest text-accent-light mb-1">Снимается с</div>
              <div className="font-mono text-[14px] font-bold text-accent">{asset.id}</div>
              <div className="text-[13.5px] text-text-tertiary mt-0.5 leading-tight truncate" title={asset.name}>{asset.name}</div>
            </div>

            {/* Arrow — hidden for service devices */}
            {!isService && (
              <div className="flex flex-col items-center justify-center px-2 bg-bg gap-0.5">
                <div className="w-5 h-5 rounded-full bg-[#F97316]/15 flex items-center justify-center">
                  <Icon name="arrow-right" size={10} className="text-accent-light" />
                </div>
              </div>
            )}

            {/* TO: warehouse or write-off — desktop only */}
            {!isService && (isWarehouse ? (
              <div className="flex-1 px-3.5 py-2.5 bg-bg">
                <div className="text-[12px] font-semibold uppercase tracking-widest text-text-subtle mb-1">Вернётся на склад</div>
                {stock != null ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Icon name="package" size={12} className="text-text-subtle flex-shrink-0" />
                    <span className="text-[13px] text-text-tertiary tabular-nums">{stock.onHand} шт</span>
                    <Icon name="arrow-right" size={9} className="text-text-subtle" />
                    <span className="text-[13.5px] font-bold text-emerald-300 tabular-nums">{stock.onHand + 1} шт</span>
                  </div>
                ) : (
                  <div className="text-[13px] text-text-tertiary mt-0.5">НА СКЛАДЕ +1</div>
                )}
                <div className="mt-1 inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-1.5 py-0.5">
                  <Icon name="plus" size={9} className="text-emerald-300" />
                  <span className="text-[12px] font-semibold text-emerald-300">1 единица</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 px-3.5 py-2.5 bg-red-500/5">
                <div className="text-[12px] font-semibold uppercase tracking-widest text-red-400 mb-1">Списание</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Icon name="x-circle" size={12} className="text-red-400 flex-shrink-0" />
                  <span className="text-[13px] text-red-300 font-semibold">Неисправно</span>
                </div>
                <div className="mt-1 inline-flex items-center gap-1 bg-red-500/10 border border-red-500/30 rounded-md px-1.5 py-0.5">
                  <span className="text-[12px] font-semibold text-red-300">Не рабочие +1</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disposal choice — desktop/server only */}
        {!isService && (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="text-[12px] font-semibold uppercase tracking-widest text-text-subtle px-3 pt-2.5 pb-1.5">Куда направить запчасть</div>
            <label
              className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer transition-colors border-t border-border
                ${isWarehouse ? 'bg-emerald-500/[0.08]' : 'bg-bg hover:bg-surface-2'}`}
            >
              <input
                type="radio"
                name="uninstall-mode"
                checked={isWarehouse}
                onChange={() => setBroken(false)}
                className="mt-0.5 accent-emerald-500"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-semibold text-text-primary leading-tight">Вернуть на склад</div>
                <div className="text-[13px] text-text-tertiary mt-0.5">Исправная деталь — НА СКЛАДЕ +1</div>
              </div>
            </label>
            <label
              className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer transition-colors border-t border-border
                ${!isWarehouse ? 'bg-red-500/[0.08]' : 'bg-bg hover:bg-surface-2'}`}
            >
              <input
                type="radio"
                name="uninstall-mode"
                checked={!isWarehouse}
                onChange={() => setBroken(true)}
                className="mt-0.5 accent-red-500"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-semibold text-text-primary leading-tight">Списать как неисправное</div>
                <div className="text-[13px] text-text-tertiary mt-0.5">Вышло из строя — НЕ РАБОЧИЕ +1</div>
              </div>
            </label>
          </div>
        )}

        {/* Service device info card */}
        {isService && (
          <div className="rounded-lg border border-slate-600/40 bg-slate-800/50 px-4 py-3 flex items-start gap-3">
            <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-slate-600/40 inline-flex items-center justify-center">
              <Icon name="info" size={11} className="text-slate-300" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-slate-200 leading-tight">Замена через сервис</div>
              <div className="text-[13px] text-slate-400 mt-1 leading-snug">Запчасть была заменена в сервисном центре. Склад не изменится.</div>
            </div>
          </div>
        )}

        {/* Note field */}
        <div>
          <div className="text-[13px] font-semibold text-text-subtle uppercase tracking-wider mb-1.5">Примечание <span className="normal-case font-normal text-text-subtle">(необязательно)</span></div>
          <input
            id="uninstall-note"
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Например: «Сбой при загрузке»"
            className="w-full h-9 px-3 text-[15px] bg-surface border border-border rounded-lg placeholder:text-text-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-[#F97316]/15 transition-all"
          />
        </div>
      </div>

      {error && (
        <div className="mx-5 text-[12.5px] text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-lg px-3 py-2" role="alert">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border">
        <Btn variant="ghost" size="md" onClick={handleClose} disabled={submitting}>
          {t('uninstallModal.cancel')}
        </Btn>
        {isService ? (
          <Btn variant="primary" size="md" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <><Icon name="loader-2" size={14} className="animate-spin" />{t('uninstallModal.saving')}</>
            ) : (
              <><Icon name="wrench" size={14} />Отметить как заменено</>
            )}
          </Btn>
        ) : (
          <Btn variant={isWarehouse ? 'primary' : 'danger'} size="md" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <><Icon name="loader-2" size={14} className="animate-spin" />{t('uninstallModal.saving')}</>
            ) : isWarehouse ? (
              <><Icon name="rotate-ccw" size={14} />{t('uninstallModal.disposalWarehouse')}</>
            ) : (
              <><Icon name="x-circle" size={14} />Списать</>
            )}
          </Btn>
        )}
      </div>
    </div>
  )

  return (
    <>
      {!isMobile && (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={handleClose} />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={t('uninstallModal.title')}
          >
            {content}
          </div>
        </div>
      )}
      {isMobile && (
        <MobileSheet open={open} onClose={handleClose} title={t('uninstallModal.title')}>
          {content}
        </MobileSheet>
      )}
    </>
  )
}
