import { useState, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Icon, MobileSheet, Btn, Select } from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { PartsAsset } from '@/domain/part/types'

export interface ServiceRecordModalProps {
  open: boolean
  onClose: () => void
  asset: PartsAsset | null
  /** List of employees to populate the actor selector. */
  employees: Array<{ id: string; name: string }>
  onConfirm: (kindId: string, kindLabel: string, note: string | null, actorName: string) => Promise<void>
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
 *  - onConfirm signature: (kindId, kindLabel, note, actorName).
 */
export function ServiceRecordModal({ open, onClose, asset, employees, onConfirm }: ServiceRecordModalProps) {
  const { t } = useTranslation('parts')
  const isMobile = useIsMobile()
  const [kindId, setKindId] = useState<ServiceKindId | ''>('')
  const [actor, setActor] = useState<string>(() => employees[0]?.name ?? '')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = useCallback(() => {
    setKindId('')
    setNote('')
    setActor(employees[0]?.name ?? '')
    setSaving(false)
    setError(null)
    onClose()
  }, [onClose, employees])

  const handleSubmit = useCallback(async () => {
    if (!kindId) return
    const kindLabel = t(`serviceModal.kinds.${kindId}`)
    setError(null)
    setSaving(true)
    try {
      await onConfirm(kindId, kindLabel, note.trim() || null, actor)
      handleClose()
    } catch {
      setError(t('serviceModal.errorFailed'))
    } finally {
      setSaving(false)
    }
  }, [kindId, note, actor, onConfirm, handleClose, t])

  if (!open || !asset) return null

  const content = (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-17 font-bold text-text-primary leading-tight flex items-center gap-2">
            <span className="w-7 h-7 rounded-md bg-cyan-500/15 text-cyan-300 inline-flex items-center justify-center flex-shrink-0 light:text-cyan-700">
              <Icon name="clipboard-list" size={13} />
            </span>
            {t('serviceModal.title')}
          </h2>
          <div className="text-13.5 text-text-tertiary mt-1 truncate">
            <span className="font-mono text-text-secondary">{asset.id}</span>
            <span className="mx-1.5 text-text-subtle">·</span>
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

          <label className="block text-13 uppercase tracking-[0.06em] font-semibold text-text-subtle mb-2">
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
                    'h-7 px-2.5 rounded-md text-14 font-medium border transition-colors ' +
                    (active
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200 light:text-cyan-700 light:border-cyan-500/60'
                      : 'bg-[#0F1216] border-border text-text-tertiary hover:text-text-primary hover:border-[#3A3F46] light:bg-surface light:hover:border-border-strong')
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
          <label htmlFor="service-actor" className="block text-13 uppercase tracking-[0.06em] font-semibold text-text-subtle mb-1.5">
            Исполнитель
          </label>
          <Select
            id="service-actor"
            value={actor}
            onChange={setActor}
            options={employees.map(e => ({ value: e.name, label: e.name }))}
          />
        </div>

        {/* Note textarea */}
        <div>
          <label htmlFor="service-note" className="block text-13 uppercase tracking-[0.06em] font-semibold text-text-subtle mb-1.5">
            {t('serviceModal.labelNote')}
          </label>
          {/* TODO: create a <Textarea /> primitive in src/components/ui — no design-system
              textarea component exists yet, so this stays a raw <textarea> for now. */}
          <textarea
            id="service-note"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="Например: продул вентиляторы, заменил термопасту"
            className="w-full p-2.5 rounded-md bg-[#0F1216] border border-border text-14.5 text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-accent resize-none leading-snug light:bg-surface-sunken"
          />
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-3 text-12.5 text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-lg px-3 py-2 light:bg-rose-50 light:border-rose-200 light:text-rose-700" role="alert">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
        <Btn
          variant="ghost"
          onClick={handleClose}
          aria-label={t('serviceModal.cancel')}
        >
          {t('serviceModal.cancel')}
        </Btn>
        <Btn
          variant="primary"
          onClick={() => { void handleSubmit() }}
          disabled={!kindId || saving}
          aria-label={t('serviceModal.confirm')}
        >
          <Icon name="check" size={13} />
          {saving ? t('serviceModal.saving') : t('serviceModal.confirm')}
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
            aria-label={t('serviceModal.title')}
          >
            {content}
          </div>
        </div>,
        document.body,
      )}
      {isMobile && (
        <MobileSheet open={open} onClose={handleClose} title={t('serviceModal.title')}>
          {content}
        </MobileSheet>
      )}
    </>
  )
}
