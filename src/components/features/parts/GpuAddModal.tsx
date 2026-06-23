import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, MobileSheet } from '@/components/ui'

export interface GpuAddModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (name: string, initialQty: number) => Promise<void>
}

/**
 * Add a new GPU SKU dynamically.
 * User enters a model name (Tier-4 EN free text) + initial stock qty.
 * Creates a parts/{id} doc + optional receive movement.
 */
export function GpuAddModal({ open, onClose, onConfirm }: GpuAddModalProps) {
  const { t } = useTranslation('parts')
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 60)
      return () => clearTimeout(timer)
    }
  }, [open])

  const handleClose = useCallback(() => {
    setName('')
    setQty('1')
    setError(null)
    onClose()
  }, [onClose])

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      setError(t('gpuModal.errorName'))
      return
    }
    const parsedQty = Math.max(0, parseInt(qty, 10) || 0)
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(name.trim(), parsedQty)
      handleClose()
    } catch {
      setError(t('gpuModal.errorFailed'))
    } finally {
      setSubmitting(false)
    }
  }, [name, qty, onConfirm, handleClose, t])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim()) {
      void handleSubmit()
    }
  }, [name, handleSubmit])

  const canCreate = name.trim().length > 0

  const content = (
    <div className="flex flex-col gap-0">
      {/* header */}
      <div className="px-5 pt-5 pb-3 border-b border-border flex items-start justify-between gap-3 flex-shrink-0">
        <h2 className="text-[17px] font-bold text-text-primary leading-tight">{t('gpuModal.title')}</h2>
        <button type="button" onClick={handleClose} aria-label={t('gpuModal.close')} className="w-7 h-7 rounded-md flex items-center justify-center text-text-subtle hover:text-text-primary hover:bg-surface-2 transition-colors">
          <Icon name="x" size={14} />
        </button>
      </div>

      {/* body */}
      <div className="px-5 py-4 flex flex-col gap-3">
        <div>
          <label htmlFor="gpu-name-input" className="block text-[14px] font-semibold text-text-tertiary mb-1.5">
            {t('gpuModal.labelName')}
          </label>
          <input
            ref={inputRef}
            id="gpu-name-input"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="например, NVIDIA GeForce RTX 4060"
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[15.5px] text-text-primary placeholder:text-text-subtle outline-none focus:border-accent focus:ring-1 focus:ring-[#F97316]/30 transition-colors"
          />
        </div>
        <div>
          <label htmlFor="gpu-qty-input" className="block text-[14px] font-semibold text-text-tertiary mb-1.5">
            {t('gpuModal.labelQty')}
          </label>
          <input
            id="gpu-qty-input"
            type="number"
            min="0"
            step="1"
            value={qty}
            onChange={e => setQty(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-[15.5px] text-text-primary placeholder:text-text-subtle outline-none focus:border-accent focus:ring-1 focus:ring-[#F97316]/30 transition-colors"
          />
        </div>
      </div>

      {error && (
        <div className="mx-5 text-[12.5px] text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-lg px-3 py-2 mb-3" role="alert">
          {error}
        </div>
      )}

      {/* footer */}
      <div className="px-5 pb-5 flex items-center justify-end gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={handleClose}
          className="px-4 py-2 rounded-lg text-[15px] font-semibold text-text-tertiary bg-surface-2 border border-border hover:border-border-strong hover:text-text-secondary transition-colors"
        >
          {t('gpuModal.cancel')}
        </button>
        <button
          type="button"
          disabled={!canCreate || submitting}
          onClick={() => { void handleSubmit() }}
          className={`px-4 py-2 rounded-lg text-[15px] font-semibold transition-colors
            ${canCreate && !submitting
              ? 'bg-accent text-white hover:bg-[#EA6C0C] shadow-sm shadow-[#FB923C]/40'
              : 'bg-surface-2 text-text-subtle cursor-not-allowed border border-border'}`}
        >
          {submitting ? t('gpuModal.saving') : 'Создать'}
        </button>
      </div>
    </div>
  )

  if (!open) return null

  return (
    <>
      <div className="md:block hidden fixed inset-0 z-[80]">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={handleClose} />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label={t('gpuModal.title')}
        >
          {content}
        </div>
      </div>
      <MobileSheet open={open} onClose={handleClose} title={t('gpuModal.title')}>
        {content}
      </MobileSheet>
    </>
  )
}
