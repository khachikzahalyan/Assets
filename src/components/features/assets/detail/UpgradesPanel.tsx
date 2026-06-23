import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SectionCard, Btn, Icon, Select, Input } from '@/components/ui'
import { UPGRADE_COMPONENTS, isSpecTracked, SPEC_KEY } from '@/domain/asset'
import type { UpgradeComponent, UpgradeEvent } from '@/domain/asset'
import type { AssetSpecs } from '@/domain/asset'

export interface UpgradesPanelProps {
  assetId: string
  currentSpecs: AssetSpecs | null | undefined
  upgrades: UpgradeEvent[]
  canEditUpgrades: boolean
  onAdd: (ev: { component: UpgradeComponent; after: string }) => Promise<void>
}

const COMPONENT_OPTIONS = UPGRADE_COMPONENTS.map(c => ({ value: c, label: c }))

/** Formats an ISO date string to a short locale string */
function shortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function UpgradesPanel({
  assetId: _assetId,
  currentSpecs,
  upgrades,
  canEditUpgrades,
  onAdd,
}: UpgradesPanelProps) {
  const { t } = useTranslation('assets')

  const [open, setOpen] = useState(false)
  const [component, setComponent] = useState<UpgradeComponent>('RAM')
  const [after, setAfter] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  /** The "before" value — read-only, auto-derived from currentSpecs or empty */
  const beforeValue: string | null = isSpecTracked(component)
    ? (currentSpecs?.[SPEC_KEY[component]] ?? null)
    : null

  function handleOpen() {
    setComponent('RAM')
    setAfter('')
    setSaveError(null)
    setOpen(true)
  }

  function handleCancel() {
    setOpen(false)
    setSaveError(null)
  }

  async function handleConfirm() {
    if (!after.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      await onAdd({ component, after: after.trim() })
      setOpen(false)
      setAfter('')
    } catch {
      setSaveError(t('validation.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard
      title={t('form.upgrades')}
      icon="cpu"
      action={
        canEditUpgrades && !open ? (
          <button
            type="button"
            aria-label={t('form.addUpgrade')}
            onClick={handleOpen}
            title={t('form.addUpgrade')}
            className="inline-flex items-center justify-center gap-1 h-7 px-2.5 text-[12px] font-medium rounded-lg bg-surface border border-border hover:border-border-strong hover:bg-surface-2 text-text-primary transition-all duration-150"
          >
            <Icon name="plus" size={13} />
          </button>
        ) : undefined
      }
    >
      {/* Upgrade list */}
      {upgrades.length === 0 && !open && (
        <p className="text-[12.5px] text-text-subtle">{t('upgrade.component')}: —</p>
      )}

      {upgrades.length > 0 && (
        <ul className="space-y-2 mb-4">
          {[...upgrades].sort((a, b) => b.changedAt.localeCompare(a.changedAt)).map(ev => (
            <li
              key={ev.id}
              className="flex items-center gap-3 p-3 bg-bg border border-border rounded-lg text-[12.5px]"
            >
              <span className="font-semibold text-text-primary w-10 flex-shrink-0">{ev.component}</span>
              <span className="text-text-subtle">
                {ev.before ?? '—'}
              </span>
              <Icon name="arrow-right" size={12} className="text-text-subtle flex-shrink-0" />
              <span className="text-accent font-medium flex-1">{ev.after}</span>
              <span className="text-text-subtle flex-shrink-0">{shortDate(ev.changedAt)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Inline add-upgrade sub-form */}
      {open && (
        <div className="mt-3 p-4 bg-bg border border-border rounded-lg space-y-3">
          {saveError && (
            <p role="alert" className="text-[12px] text-[#FDA4AF]">{saveError}</p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Component selector */}
            <div>
              <span className="block mb-1 text-[11px] uppercase tracking-[0.06em] font-semibold text-text-subtle">
                {t('upgrade.component')}
              </span>
              <Select
                value={component}
                onChange={v => setComponent(v as UpgradeComponent)}
                options={COMPONENT_OPTIONS}
              />
            </div>

            {/* Before (read-only) */}
            <div>
              <span className="block mb-1 text-[11px] uppercase tracking-[0.06em] font-semibold text-text-subtle">
                {t('upgrade.before')}
              </span>
              {isSpecTracked(component) ? (
                <Input
                  value={beforeValue ?? '—'}
                  disabled
                />
              ) : (
                <p className="h-9 flex items-center text-[12.5px] text-text-subtle italic">
                  {t('upgrade.notTracked')}
                </p>
              )}
            </div>

            {/* After (editable) */}
            <div className="sm:col-span-2">
              <label htmlFor="upgrade-after" className="block mb-1 text-[11px] uppercase tracking-[0.06em] font-semibold text-text-subtle">
                {t('upgrade.after')} <span className="text-[#FDA4AF] ml-0.5">*</span>
              </label>
              <Input
                id="upgrade-after"
                value={after}
                onChange={setAfter}
                placeholder={t('upgrade.after')}
                autoFocus
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Btn
              variant="primary"
              size="sm"
              onClick={handleConfirm}
              disabled={saving || !after.trim()}
            >
              {saving ? <Icon name="loader-circle" size={13} className="animate-spin" /> : <Icon name="check" size={13} />}
              {t('form.save')}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
              {t('form.cancel')}
            </Btn>
          </div>
        </div>
      )}
    </SectionCard>
  )
}
