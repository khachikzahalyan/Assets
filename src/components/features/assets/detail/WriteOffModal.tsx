import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@/domain/asset'
import { assetTitle } from '@/components/features/assets/assetFormat'
import { Icon } from '@/components/ui'

interface WriteOffModalProps {
  asset: Asset
  busy: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}

export function WriteOffModal({ asset, busy, onClose, onConfirm }: WriteOffModalProps) {
  const { t } = useTranslation('assets')
  const [reason, setReason] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // ESC closes the modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, busy])

  // Focus first focusable element on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const textarea = containerRef.current?.querySelector<HTMLTextAreaElement>('textarea')
      textarea?.focus({ preventScroll: true })
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const trimmed = reason.trim()

  function handleConfirm() {
    if (!trimmed || busy) return
    onConfirm(trimmed)
  }

  const title = assetTitle(asset)

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 max-md:items-end max-md:px-0 anim-backdrop-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="writeoff-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />

      {/* Card — centered on desktop, bottom-sheet on mobile */}
      <div
        ref={containerRef}
        tabIndex={-1}
        className={[
          'relative w-full bg-surface shadow-2xl border border-border',
          // Desktop: centered modal
          'md:max-w-md md:rounded-2xl md:anim-modal-pop',
          // Mobile: bottom-sheet with slide-up animation
          'max-md:rounded-t-[18px] max-md:anim-sheet-in',
        ].join(' ')}
      >
        {/* Pull-handle — mobile only */}
        <div
          aria-hidden="true"
          className="md:hidden mx-auto mt-2.5 mb-1 w-10 h-1 rounded-full bg-[rgba(148,163,184,0.35)]"
        />

        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-300 flex items-center justify-center shrink-0 ring-1 ring-rose-500/30">
            <Icon name="archive-x" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="writeoff-modal-title"
              className="text-[17px] font-extrabold text-text-primary tracking-tight leading-tight"
            >
              {t('detail.writeOff.title')}
            </h2>
            <p className="mt-1 text-[14.5px] text-text-primary leading-snug">
              <span className="font-semibold text-text-primary">{title}</span>
              <span className="mx-1.5 text-text-subtle">·</span>
              <span className="font-mono text-text-primary">{asset.invCode}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            aria-label={t('form.close')}
            className="w-8 h-8 rounded-md flex items-center justify-center text-text-subtle hover:text-text-tertiary hover:bg-surface-2 transition-colors"
          >
            <Icon name="x" size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 space-y-3" style={{ paddingBottom: 'calc(max(20px, env(safe-area-inset-bottom, 0px)) + 12px)' }}>
          <div>
            <label
              htmlFor="writeoff-reason"
              className="block text-[13px] font-bold text-text-primary uppercase tracking-[0.04em] mb-2"
            >
              {t('detail.writeOff.reasonLabel')}
            </label>
            <textarea
              id="writeoff-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder={t('detail.writeOff.reasonPlaceholder')}
              className="w-full px-3 py-2 text-[15px] bg-surface border border-border-strong rounded-lg focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 placeholder:text-text-subtle resize-none text-text-primary transition-all"
            />
          </div>

          {/* Footer actions — stacked full-width on mobile, inline on desktop */}
          <div className="flex items-center justify-end gap-2 pt-1 max-md:flex-col-reverse max-md:gap-2.5">
            <button
              type="button"
              onClick={() => !busy && onClose()}
              disabled={busy}
              className="inline-flex items-center justify-center h-9 px-3.5 text-sm gap-1.5 rounded-lg font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:opacity-50 transition-all max-md:w-full max-md:h-11"
            >
              {t('detail.writeOff.cancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!trimmed || busy}
              className="inline-flex items-center justify-center h-9 px-3.5 text-sm gap-1.5 rounded-lg font-medium bg-surface border border-rose-800/60 text-[#FDA4AF] hover:bg-rose-950/40 hover:border-rose-700/60 shadow-sm disabled:opacity-50 transition-all max-md:w-full max-md:h-11"
            >
              {busy
                ? <Icon name="loader-circle" size={13} className="animate-spin" />
                : <Icon name="archive-x" size={13} />
              }
              {t('detail.writeOff.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
