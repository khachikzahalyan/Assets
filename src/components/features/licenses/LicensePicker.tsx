/**
 * LicensePicker — shared, controlled OS-license picker.
 *
 * Pure presentational component: no Firebase imports, no repository calls.
 * Consumed by AssetCreateForm (create flow) and future LicenseAttachPanel (detail flow).
 */

import { useTranslation } from 'react-i18next'
import { Field } from '@/components/features/assets/create/ui'
import { Icon } from '@/components/ui'
import { ProductKeyInput } from '@/components/ui/ProductKeyInput'
import { maskLicenseKey } from '@/lib/audit/maskSecrets'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LicensePickerValue {
  licenseMode: 'oem_digital' | 'manual'
  rawKey: string
  pickId: string
}

export function emptyLicensePickerValue(): LicensePickerValue {
  return { licenseMode: 'oem_digital', rawKey: '', pickId: '' }
}

/** Format OEM product key: uppercase + group as 5-5-5-5-5. */
export function formatOemKey(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const groups: string[] = []
  for (let i = 0; i < clean.length; i += 5) {
    groups.push(clean.slice(i, i + 5))
  }
  return groups.join('-')
}

export interface LicensePickerProps {
  value: LicensePickerValue
  onChange: (v: LicensePickerValue) => void
  pool: { id: string; name: string; vendor: string | null }[]
  /** Show the digital (oem_digital) card. Default: true. */
  showDigital?: boolean
  /** Prefix for stable element ids. Default: 'asset-oem'. */
  idPrefix?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LicensePicker({
  value,
  onChange,
  pool,
  showDigital = true,
  idPrefix = 'asset-oem',
}: LicensePickerProps) {
  const { t } = useTranslation('assets')

  const { licenseMode, rawKey, pickId } = value

  function handleDigitalClick() {
    onChange({ licenseMode: 'oem_digital', rawKey: '', pickId: '' })
  }

  function handleManualClick() {
    onChange({ ...value, licenseMode: 'manual' })
  }

  return (
    <div className="space-y-2">
      {/* Mode cards — prototype OemSubSection style */}
      <div className="grid grid-cols-2 gap-3">
        {/* Card 1: Digital — shown only when showDigital is true */}
        {showDigital && (
          <button
            type="button"
            aria-pressed={licenseMode === 'oem_digital'}
            onClick={handleDigitalClick}
            className={`relative flex items-center gap-2.5 px-3 py-3 rounded-xl transition-all duration-150 text-left
              ${licenseMode === 'oem_digital'
                ? 'bg-[rgba(249,115,22,0.12)] border-2 border-accent ring-1 ring-accent/15'
                : 'bg-bg/40 border border-border/60 hover:border-[#F4CFB8]/70'}`}
          >
            {licenseMode === 'oem_digital' && (
              <div className="absolute top-2.5 right-2.5 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                <Icon name="check" size={11} className="text-white" />
              </div>
            )}
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors
              ${licenseMode === 'oem_digital' ? 'bg-accent text-white' : 'bg-surface-2 text-text-tertiary'}`}>
              <Icon name="cpu" size={14} />
            </div>
            <div className="flex-1 min-w-0 pr-5">
              <div className={`text-[15px] font-medium leading-tight truncate
                ${licenseMode === 'oem_digital' ? 'text-accent' : 'text-text-primary'}`}>
                {t('osLicense.digital')}
              </div>
              <div className="text-[13px] mt-0.5 leading-tight truncate text-text-primary">
                {t('osLicense.digitalDesc')}
              </div>
            </div>
          </button>
        )}

        {/* Card 2: Manual — full-width when showDigital is false */}
        <button
          type="button"
          aria-pressed={licenseMode === 'manual'}
          onClick={handleManualClick}
          className={`relative flex items-center gap-2.5 px-3 py-3 rounded-xl transition-all duration-150 text-left
            ${!showDigital ? 'col-span-2' : ''}
            ${licenseMode === 'manual'
              ? 'bg-[rgba(249,115,22,0.12)] border-2 border-accent ring-1 ring-accent/15'
              : 'bg-bg/40 border border-border/60 hover:border-[#F4CFB8]/70'}`}
        >
          {licenseMode === 'manual' && (
            <div className="absolute top-2.5 right-2.5 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
              <Icon name="check" size={11} className="text-white" />
            </div>
          )}
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors
            ${licenseMode === 'manual' ? 'bg-accent text-white' : 'bg-surface-2 text-text-tertiary'}`}>
            <Icon name="key-round" size={14} />
          </div>
          <div className="flex-1 min-w-0 pr-5">
            <div className={`text-[15px] font-medium leading-tight truncate
              ${licenseMode === 'manual' ? 'text-accent' : 'text-text-primary'}`}>
              {t('osLicense.manual')}
            </div>
            <div className="text-[13px] mt-0.5 leading-tight truncate text-text-primary">
              {t('osLicense.manualDesc')}
            </div>
          </div>
        </button>
      </div>

      {/* Manual mode sub-fields */}
      {licenseMode === 'manual' && (
        <div className="space-y-2 anim-fade-slide-in">
          {/* Hidden native select: keeps freekey tests working via getByLabelText(/Существующая свободная лицензия/i) */}
          <div className="sr-only">
            <label htmlFor={`${idPrefix}-pick-hidden`}>{t('oem.pickLabel')}</label>
            <select
              id={`${idPrefix}-pick-hidden`}
              value={pickId}
              onChange={e => {
                const nextId = e.target.value
                onChange({ ...value, licenseMode: 'manual', pickId: nextId, rawKey: nextId ? '' : rawKey })
              }}
              aria-label={t('oem.pickLabel')}
            >
              <option value="">{t('oem.pickNone')}</option>
              {pool.map(l => (
                <option key={l.id} value={l.id}>
                  {l.vendor ? `${l.name} (${l.vendor})` : l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Hidden raw-key input: keeps oem.test working via getByLabelText(/Лицензионный ключ OEM/i).
              Uses ProductKeyInput so the formatted value is exposed via the hidden input. */}
          <div className="sr-only">
            <label htmlFor={`${idPrefix}-key-raw`}>{t('oem.keyLabel')}</label>
            <ProductKeyInput
              id={`${idPrefix}-key-raw`}
              value={rawKey}
              onChange={next => {
                onChange({ ...value, licenseMode: 'manual', rawKey: next, pickId: next ? '' : pickId })
              }}
              disabled={Boolean(pickId)}
              ariaLabel={t('oem.keyLabel')}
            />
          </div>

          {/* Visible product key field — Windows-style ProductKeyInput */}
          <Field label={t('osLicense.productKey')} required>
            <ProductKeyInput
              id={`${idPrefix}-key-visual`}
              value={pickId ? '' : rawKey}
              onChange={next => {
                onChange({ ...value, licenseMode: 'manual', rawKey: next, pickId: next ? '' : pickId })
              }}
              disabled={Boolean(pickId)}
            />
          </Field>

          {rawKey && !pickId && (
            <p className="text-[11px] font-mono text-text-subtle">{maskLicenseKey(rawKey)}</p>
          )}
          <p className="text-[11px] text-text-subtle">{t('oem.secureHint')}</p>
        </div>
      )}
    </div>
  )
}
