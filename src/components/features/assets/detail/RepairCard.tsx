import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@/domain/asset'
import { SectionCard, Icon, Btn } from '@/components/ui'

const SEVERITY_OPTIONS = [
  { id: 'low',    labelKey: 'detail.repair.severityLow',    activeCls: 'bg-sky-500/10 text-sky-300 ring-sky-500/30'    },
  { id: 'medium', labelKey: 'detail.repair.severityMedium', activeCls: 'bg-amber-500/10 text-amber-300 ring-amber-500/30' },
  { id: 'high',   labelKey: 'detail.repair.severityHigh',   activeCls: 'bg-rose-500/10 text-rose-300 ring-rose-500/30'   },
]

interface RepairCardProps {
  asset: Asset
  canRepair: boolean
  busy: boolean
  onSendToRepair: (reason: string) => void
  onReturnFromRepair: () => void
}

export function RepairCard({
  asset,
  canRepair,
  busy,
  onSendToRepair,
  onReturnFromRepair,
}: RepairCardProps) {
  const { t } = useTranslation('assets')
  const [showForm, setShowForm] = useState(false)
  const [reason, setReason]     = useState('')
  const [severity, setSeverity] = useState<string | null>(null)

  if (!canRepair) return null

  const isInRepair = asset.statusId === 'st_repair'

  function openForm() { setShowForm(true); setReason(''); setSeverity(null) }
  function closeForm() { setShowForm(false); setReason(''); setSeverity(null) }

  function handleConfirm() {
    const trimmed = reason.trim()
    if (!trimmed || busy) return
    onSendToRepair(trimmed)
    closeForm()
  }

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  return (
    <SectionCard title={t('detail.repair.title')} icon="wrench" iconTone="orange" bodyClassName="!p-4 max-md:!p-3.5">
      {isInRepair ? (
        // State: in-repair alert + return button
        <div className="space-y-3">
          <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <Icon name="alert-circle" size={14} className="text-amber-300 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-amber-300">{t('detail.repair.inRepair')}</p>
            </div>
          </div>
          <Btn
            variant="secondary"
            size="sm"
            onClick={onReturnFromRepair}
            disabled={busy}
          >
            {busy
              ? <Icon name="loader-circle" size={13} className="animate-spin" />
              : <Icon name="check" size={13} />
            }
            {t('detail.repair.returnFromRepair')}
          </Btn>
        </div>
      ) : !showForm ? (
        // State: idle — dashed trigger
        <button
          type="button"
          onClick={openForm}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-border text-[14px] text-text-primary hover:border-amber-500/30 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
        >
          <Icon name="wrench" size={13} />
          {t('detail.repair.sendToRepair')}
        </button>
      ) : (
        // State: form open
        <div className="space-y-2 anim-fade-slide-in">
          {/* Reason textarea */}
          <div>
            <label
              htmlFor="repair-reason"
              className="block text-[12px] text-text-tertiary uppercase tracking-widest mb-1"
            >
              {t('detail.repair.reasonLabel')}
            </label>
            <div className="relative">
              <textarea
                id="repair-reason"
                value={reason}
                onChange={e => setReason(e.target.value.slice(0, 300))}
                autoFocus
                rows={2}
                placeholder={t('detail.repair.reasonPlaceholder')}
                className="w-full text-[14px] bg-surface-2 border border-border rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/30 transition-all resize-none placeholder:text-text-subtle text-text-primary"
              />
              <div className="absolute bottom-2 right-2.5 text-[12px] text-text-subtle tabular-nums select-none">
                {reason.length}/300
              </div>
            </div>
          </div>

          {/* Severity (visual-only, optional) */}
          <div>
            <p className="text-[12px] text-text-tertiary uppercase tracking-widest mb-1">
              {t('detail.repair.severityLabel')}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {SEVERITY_OPTIONS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSeverity(severity === s.id ? null : s.id)}
                  className={`py-1.5 max-md:py-3 rounded-lg text-[12px] ring-1 transition-all
                    ${severity === s.id
                      ? s.activeCls
                      : 'bg-surface-2 text-text-tertiary ring-transparent hover:bg-border hover:text-text-primary'
                    }`}
                >
                  {t(s.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeForm}
              disabled={busy}
              className="flex-1 py-1.5 max-md:py-2 rounded-xl text-[14px] border border-border text-text-primary hover:bg-surface-2 transition-colors disabled:opacity-50"
            >
              {t('detail.repair.cancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!reason.trim() || busy}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 max-md:py-2 rounded-xl text-[14px] bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {busy
                ? <Icon name="loader-circle" size={13} className="animate-spin" />
                : <Icon name="check" size={13} />
              }
              {t('detail.repair.confirm')}
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  )
}
