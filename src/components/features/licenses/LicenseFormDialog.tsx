import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Field, Input, Select, DIALOG_BACKDROP } from '@/components/ui'
import { maskLicenseKey } from '@/lib/audit/maskSecrets'
import type {
  CreateWorkstationLicenseInput,
  CreateServerLicenseInput,
  LicenseType,
  ServerLicenseType,
} from '@/domain/license'

// Workstation license types from the domain
const WORKSTATION_LICENSE_TYPES: LicenseType[] = ['Default', 'OEM', 'Retail', 'Volume', 'Subscription']

// Server license types from the domain
const SERVER_LICENSE_TYPES: ServerLicenseType[] = ['Server', 'Global', 'Infrastructure']

export interface LicenseFormDialogWorkstationValues extends CreateWorkstationLicenseInput {
  kind: 'workstation'
}

export interface LicenseFormDialogServerValues extends CreateServerLicenseInput {
  kind: 'server'
}

export type LicenseFormDialogValues = LicenseFormDialogWorkstationValues | LicenseFormDialogServerValues

export interface LicenseFormDialogProps {
  open: boolean
  kind: 'workstation' | 'server'
  submitting?: boolean
  submitError?: string | null
  onSubmit: (values: LicenseFormDialogValues) => void
  onCancel: () => void
}

export function LicenseFormDialog({ open, kind, submitting, submitError, onSubmit, onCancel }: LicenseFormDialogProps) {
  const { t } = useTranslation('licenses')

  // Common fields
  const [name, setName] = useState('')
  const [vendor, setVendor] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [rawKey, setRawKey] = useState('')

  // Workstation-specific
  const [type, setType] = useState<LicenseType>('Default')
  const [isReusable, setIsReusable] = useState(true)

  // Server-specific
  const [serverType, setServerType] = useState<ServerLicenseType>('Server')
  const [environment, setEnvironment] = useState('')
  const [host, setHost] = useState('')

  const [touched, setTouched] = useState(false)

  // When kind or open changes, reset form
  useEffect(() => {
    setName('')
    setVendor('')
    setExpiresAt('')
    setRawKey('')
    setType('Default')
    setIsReusable(true)
    setServerType('Server')
    setEnvironment('')
    setHost('')
    setTouched(false)
  }, [open, kind])

  // OEM default: isReusable = false
  useEffect(() => {
    if (kind === 'workstation' && type === 'OEM') {
      setIsReusable(false)
    }
  }, [type, kind])

  if (!open) return null

  const nameError = touched && !name.trim() ? t('validation.required') : null
  const maskedPreview = rawKey ? maskLicenseKey(rawKey) : null

  const workstationTypeOptions = WORKSTATION_LICENSE_TYPES.map(lt => ({
    value: lt,
    label: t(`type.${lt}`),
  }))

  const serverTypeOptions = SERVER_LICENSE_TYPES.map(st => ({
    value: st,
    label: t(`serverType.${st}`),
  }))

  function handleSubmit() {
    setTouched(true)
    if (!name.trim()) return

    if (kind === 'workstation') {
      onSubmit({
        kind: 'workstation',
        name: name.trim(),
        vendor: vendor.trim() || null,
        type,
        isReusable,
        expiresAt: expiresAt || null,
        rawKey: rawKey || null,
      })
    } else {
      onSubmit({
        kind: 'server',
        name: name.trim(),
        vendor: vendor.trim() || null,
        type: serverType,
        environment: environment.trim() || null,
        host: host.trim() || null,
        expiresAt: expiresAt || null,
        rawKey: rawKey || null,
      })
    }
  }

  const title = kind === 'workstation' ? t('form.createWorkstationTitle') : t('form.createServerTitle')

  return (
    <div
      className={DIALOG_BACKDROP}
      onClick={onCancel}
    >
      <div
        className="w-[480px] max-md:w-full max-md:rounded-b-none max-md:rounded-t-[18px] max-h-[90vh] max-md:max-h-[85vh] overflow-y-auto rounded-lg border border-border bg-surface p-5 mx-4 max-md:mx-0"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-semibold text-text-primary mb-4">{title}</h3>

        <div className="space-y-3">
          {submitError && (
            <p role="alert" className="text-[12px] text-[#FDA4AF] px-1">{submitError}</p>
          )}

          {/* Name */}
          <div>
            <Field label={t('form.name')} required>
              <Input
                id="lic-name"
                value={name}
                onChange={setName}
                autoFocus
              />
            </Field>
            {nameError && (
              <p role="alert" className="mt-1 text-[12px] text-[#FDA4AF]">{nameError}</p>
            )}
          </div>

          {/* Vendor */}
          <Field label={t('form.vendor')}>
            <Input id="lic-vendor" value={vendor} onChange={setVendor} />
          </Field>

          {/* Type */}
          {kind === 'workstation' ? (
            <Field label={t('form.type')}>
              <Select
                id="lic-type"
                value={type}
                onChange={v => setType(v as LicenseType)}
                options={workstationTypeOptions}
              />
            </Field>
          ) : (
            <Field label={t('form.type')}>
              <Select
                id="lic-server-type"
                value={serverType}
                onChange={v => setServerType(v as ServerLicenseType)}
                options={serverTypeOptions}
              />
            </Field>
          )}

          {/* Workstation: isReusable */}
          {kind === 'workstation' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                id="lic-reusable"
                checked={isReusable}
                onChange={e => setIsReusable(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-accent"
              />
              <span className="text-[13px] text-text-tertiary">{t('form.isReusable')}</span>
            </label>
          )}

          {/* Server: environment + host */}
          {kind === 'server' && (
            <>
              <Field label={t('form.environment')}>
                <Input id="lic-environment" value={environment} onChange={setEnvironment} />
              </Field>
              <Field label={t('form.host')}>
                <Input id="lic-host" value={host} onChange={setHost} mono />
              </Field>
            </>
          )}

          {/* Expiry */}
          <Field label={t('form.expiresAt')}>
            <Input id="lic-expires" value={expiresAt} onChange={setExpiresAt} type="date" />
          </Field>

          {/* Raw key */}
          <div>
            <Field label={t('form.rawKey')} hint={t('form.rawKeyHint')}>
              <Input id="lic-raw-key" value={rawKey} onChange={setRawKey} mono />
            </Field>
            {maskedPreview && (
              <p className="mt-1 text-[11px] text-text-subtle font-mono">
                {t('form.keyMaskedPreview', { masked: maskedPreview })}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Btn variant="secondary" size="sm" onClick={onCancel} disabled={submitting}>
            {t('form.cancel')}
          </Btn>
          <Btn variant="primary" size="sm" disabled={submitting} onClick={handleSubmit}>
            {t('form.save')}
          </Btn>
        </div>
      </div>
    </div>
  )
}
