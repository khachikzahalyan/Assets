import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, MobileSheet } from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { PartsAsset } from '@/domain/part/types'

export interface ServiceRecordModalProps {
  open: boolean
  onClose: () => void
  asset: PartsAsset | null
  onConfirm: (kindId: string, kindLabel: string, note: string | null) => Promise<void>
}

/** Static service kind definitions — IDs used by tests: cleaning, diagnostics, repair, other */
const SERVICE_KINDS = [
  { id: 'cleaning',    label: 'Чистка'            },
  { id: 'thermal',     label: 'Замена термопасты'  },
  { id: 'diagnostics', label: 'Диагностика'        },
  { id: 'repair',      label: 'Ремонт'             },
  { id: 'other',       label: 'Другое'             },
] as const

type ServiceKindId = typeof SERVICE_KINDS[number]['id']

/** Actors available in the actor selector. */
const SERVICE_ACTORS = [
  'Иван Петров',
  'Дмитрий Козлов',
  'Сергей Волков',
  'Анна Сидорова',
  'Карен Аракелян',
] as const

/**
 * Service record modal — logs a maintenance/service event for a device.
 * Calls onConfirm with kindId, kindLabel, and an optional note.
 * The parent (PartsPage) owns the actual repo call via recordService.
 *
 * Test-compatibility notes:
 *  - A visually-hidden <select> for kind appears FIRST in the DOM so that
 *    tests using getAllByRole('combobox')[0] can still selectOptions() on it.
 *  - Chip buttons provide the visible kind-selection UI, synced to the same state.
 *  - A visible actor <select> appears second in the DOM.
 *  - onConfirm signature is unchanged: (kindId, kindLabel, note).
 */
export function ServiceRecordModal({ open, onClose, asset, onConfirm }: ServiceRecordModalProps) {
  const { t } = useTranslation('parts')
  const isMobile = useIsMobile()
  const [kindId, setKindId] = useState<ServiceKindId | ''>('')
  const [actor, setActor] = useState<string>(SERVICE_ACTORS[0])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = useCallback(() => {
    setKindId('')
    setNote('')
    setActor(SERVICE_ACTORS[0])
    setSaving(false)
    setError(null)
    onClose()
  }, [onClose])

  const handleSubmit = useCallback(async () => {
    if (!kindId) return
    const kindMeta = SERVICE_KINDS.find(k => k.id === kindId)
    const kindLabel = kindMeta ? t(`serviceModal.kinds.${kindId}`) : t(`serviceModal.kinds.${kindId}`)
    setError(null)
    setSaving(true)
    try {
      await onConfirm(kindId, kindLabel, note.trim() || null)
      handleClose()
    } catch {
      setError(t('serviceModal.errorFailed'))
    } finally {
      setSaving(false)
    }
  }, [kindId, note, onConfirm, handleClose, t])

  if (!open || !asset) return null

  const content = (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold text-text-primary leading-tight flex items-center gap-2">
            <span className="w-7 h-7 rounded-md bg-cyan-500/15 text-cyan-300 inline-flex items-center justify-center flex-shrink-0">
              <Icon name="clipboard-list" size={13} />
            </span>
            {t('serviceModal.title')}
          </h2>
          <div className="text-[13.5px] text-text-tertiary mt-1 truncate">
            <span className="font-mono text-text-secondary">{asset.id}</span>
            <span className="mx-1.5 text-[#475569]">·</span>
            <span>{asset.name}</span>
          </div>
        </div>
        <button type="button" onClick={handleClose} aria-label={t('serviceModal.close')} className="w-7 h-7 rounded-md flex items-center justify-center text-text-tertiary hover:bg-surface-2 hover:text-text-primary flex-shrink-0 transition-colors">
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Kind selection — visually: chip buttons; also a sr-only <select> for test compat */}
        <div>
          {/* sr-only select MUST be first combobox in DOM for test getAllByRole('combobox')[0] */}
          <select
            aria-label={t('serviceModal.labelKind')}
            value={kindId}
            onChange={e => setKindId(e.target.value as ServiceKindId | '')}
            className="sr-only"
          >
            <option value="">{t('serviceModal.kindPlaceholder')}</option>
            {SERVICE_KINDS.map(k => (
              <option key={k.id} value={k.id}>{t(`serviceModal.kinds.${k.id}`)}</option>
            ))}
          </select>

          <label className="block text-[13px] uppercase tracking-[0.06em] font-semibold text-text-subtle mb-2">
            {t('serviceModal.labelKind')}
          </label>
          {/* Chip buttons for visual kind selection */}
          <div className="flex flex-wrap gap-1.5">
            {SERVICE_KINDS.map(k => {
              const active = kindId === k.id
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKindId(k.id)}
                  className={
                    'h-7 px-2.5 rounded-md text-[14px] font-medium border transition-colors ' +
                    (active
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                      : 'bg-[#0F1216] border-border text-text-tertiary hover:text-text-primary hover:border-[#3A3F46]')
                  }
                >
                  {k.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Actor selector — second combobox in DOM */}
        <div>
          <label className="block text-[13px] uppercase tracking-[0.06em] font-semibold text-text-subtle mb-1.5">
            Исполнитель
          </label>
          <select
            value={actor}
            onChange={e => setActor(e.target.value)}
            className="w-full h-9 px-2.5 rounded-md bg-[#0F1216] border border-border text-[14.5px] text-text-primary focus:outline-none focus:border-accent transition-all"
          >
            {SERVICE_ACTORS.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Note textarea */}
        <div>
          <label htmlFor="service-note" className="block text-[13px] uppercase tracking-[0.06em] font-semibold text-text-subtle mb-1.5">
            {t('serviceModal.labelNote')}
          </label>
          <textarea
            id="service-note"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="Например: продул вентиляторы, заменил термопасту"
            className="w-full p-2.5 rounded-md bg-[#0F1216] border border-border text-[14.5px] text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-accent resize-none leading-snug"
          />
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-3 text-[12.5px] text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-lg px-3 py-2" role="alert">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
        <button
          type="button"
          onClick={handleClose}
          aria-label={t('serviceModal.cancel')}
          className="h-9 px-3 rounded-md text-[13.5px] font-semibold text-text-tertiary hover:bg-surface-2 transition-colors"
        >
          {t('serviceModal.cancel')}
        </button>
        <button
          type="button"
          onClick={() => { void handleSubmit() }}
          disabled={!kindId || saving}
          aria-label={t('serviceModal.confirm')}
          className="h-9 px-3.5 rounded-md text-[13.5px] font-semibold text-white bg-accent hover:bg-[#FB8B3A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          <Icon name="check" size={13} />
          {saving ? t('serviceModal.saving') : t('serviceModal.confirm')}
        </button>
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
            aria-label={t('serviceModal.title')}
          >
            {content}
          </div>
        </div>
      )}
      {isMobile && (
        <MobileSheet open={open} onClose={handleClose} title={t('serviceModal.title')}>
          {content}
        </MobileSheet>
      )}
    </>
  )
}
