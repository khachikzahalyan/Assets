import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@/domain/asset/types'
import { Btn, IconBtn, DIALOG_BACKDROP, MODAL_SHEET } from '@/components/ui'
import { AssetLabel } from './AssetLabel'
import { LabelPrintHost } from './LabelPrintHost'

export interface LabelPreviewDialogProps {
  assets: Asset[]
  onClose: () => void
  /** When provided, «Печать» calls this to COMMIT (save) and returns the saved assets to print.
   *  When absent (e.g. detail-page reprint), «Печать» prints `assets` directly. */
  onPrint?: () => Promise<Asset[]>
}

/**
 * In-app preview dialog for asset barcode labels.
 *
 * Shows each AssetLabel scaled up 2× for on-screen readability (the physical
 * label is ~50×30mm, which is tiny on a monitor at 1:1). Clicking «Печать»
 * mounts LabelPrintHost, which fires window.print(); once the browser print
 * dialog returns (Print OR Cancel) the whole preview dialog auto-closes.
 *
 * Desktop: centred modal. Mobile ≤767px: bottom-sheet (via DIALOG_BACKDROP +
 * MODAL_SHEET shared constants). ESC and backdrop click call onClose.
 */
export function LabelPreviewDialog({ assets, onClose, onPrint }: LabelPreviewDialogProps) {
  const { t } = useTranslation('assets')
  const [printAssets, setPrintAssets] = useState<Asset[]>([])
  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)

  // ESC closes the dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (assets.length === 0) return null

  const printLabel = t('label.print')
  const closeLabel = t('actions.close', { ns: 'common' })

  async function handlePrint() {
    setCommitError(null)
    try {
      if (onPrint) {
        setCommitting(true)
        const saved = await onPrint()
        setPrintAssets(saved)
      } else {
        setPrintAssets(assets)
      }
    } catch (err: unknown) {
      setCommitError(err instanceof Error ? err.message : String(err))
    } finally {
      setCommitting(false)
    }
  }

  return createPortal(
    <>
      {/* LabelPrintHost renders into body portal and triggers window.print();
          only mounted once there are committed assets to print. After the browser print
          dialog returns (whether the user hit Print or Cancel), we clear the print assets
          AND close this preview dialog — the owner wants the whole flow to dismiss itself. */}
      {printAssets.length > 0 && (
        <LabelPrintHost
          assets={printAssets}
          onAfterPrint={() => { setPrintAssets([]); onClose() }}
        />
      )}

      <div
        className={`${DIALOG_BACKDROP} anim-backdrop-fade`}
        role="dialog"
        aria-modal="true"
        aria-label={printLabel}
      >
        {/* Backdrop click layer — sits below the panel in z order */}
        <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

        {/* Panel: centred on desktop, bottom-sheet on mobile */}
        <div
          className={`relative bg-surface border border-border shadow-2xl w-full md:max-w-lg md:rounded-2xl md:mx-4 ${MODAL_SHEET}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Pull handle — visible on mobile only */}
          <div
            aria-hidden="true"
            className="md:hidden mx-auto mt-2.5 mb-1 w-10 h-1 rounded-full bg-white/20"
          />

          {/* Header — minimal (just close); the label itself is the focus */}
          <div className="px-5 pt-4 pb-3 flex items-center justify-end gap-3 border-b border-border">
            <IconBtn
              icon="x"
              size="sm"
              onClick={onClose}
              title={closeLabel}
            />
          </div>

          {/* Body — shows the label(s) on a white card at a realistic size */}
          <div className="overflow-y-auto max-h-[60vh] px-5 py-5 flex flex-col items-center gap-4">
            {assets.map((a) => (
              <div key={a.id} className="w-full flex justify-center">
                <div className="shadow-lg" style={{ width: '320px', maxWidth: '100%' }}>
                  <AssetLabel asset={a} />
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            className="px-5 py-4 flex flex-col gap-2 border-t border-border"
            style={{ paddingBottom: 'calc(max(16px, env(safe-area-inset-bottom, 0px)) + 8px)' }}
          >
            {commitError && (
              <p role="alert" className="text-[12px] text-rose-400 self-end max-md:self-start">{commitError}</p>
            )}
            <div className="flex items-center justify-end gap-2 max-md:flex-col-reverse max-md:gap-2.5">
              <Btn
                variant="ghost"
                onClick={onClose}
                className="max-md:w-full max-md:h-11"
              >
                {closeLabel}
              </Btn>
              <Btn
                variant="primary"
                onClick={handlePrint}
                disabled={committing}
                className="max-md:w-full max-md:h-11"
              >
                {printLabel}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
