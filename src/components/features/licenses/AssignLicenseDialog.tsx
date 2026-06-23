import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Field, Input, Select, DIALOG_BACKDROP } from '@/components/ui'
import type { AssignWorkstationLicenseInput } from '@/domain/license'

type AssignScope = 'employee' | 'device'

export interface AssignLicenseDialogProps {
  open: boolean
  licenseId: string
  submitting?: boolean
  submitError?: string | null
  onSubmit: (input: AssignWorkstationLicenseInput) => void
  onCancel: () => void
}

export function AssignLicenseDialog({ open, submitting, submitError, onSubmit, onCancel }: AssignLicenseDialogProps) {
  const { t } = useTranslation('licenses')

  const [scope, setScope] = useState<AssignScope>('employee')
  const [employeeId, setEmployeeId] = useState('')
  const [assetId, setAssetId] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) {
      setScope('employee')
      setEmployeeId('')
      setAssetId('')
      setTouched(false)
    }
  }, [open])

  if (!open) return null

  const scopeOptions = [
    { value: 'employee', label: t('assignDialog.employee') },
    { value: 'device', label: t('assignDialog.device') },
  ]

  const employeeError = touched && scope === 'employee' && !employeeId.trim()
    ? t('assignDialog.employeeRequires')
    : null

  const deviceError = touched && scope === 'device' && !assetId.trim()
    ? t('assignDialog.deviceRequiresAsset')
    : null

  function handleSubmit() {
    setTouched(true)

    if (scope === 'employee') {
      if (!employeeId.trim()) return
      onSubmit({ to: 'employee', employeeId: employeeId.trim() })
    } else {
      if (!assetId.trim()) return
      onSubmit({ to: 'device', assetId: assetId.trim() })
    }
  }

  return (
    <div
      className={DIALOG_BACKDROP}
      onClick={onCancel}
    >
      <div
        className="w-[400px] max-md:w-full max-md:rounded-b-none max-md:rounded-t-[18px] max-md:max-h-[85vh] max-md:overflow-y-auto rounded-lg border border-border bg-surface p-5 mx-4 max-md:mx-0"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-semibold text-text-primary mb-4">
          {t('assignDialog.title')}
        </h3>

        <div className="space-y-3">
          {submitError && (
            <p role="alert" className="text-[12px] text-[#FDA4AF] px-1">{submitError}</p>
          )}

          {/* Scope */}
          <Field label={t('assignDialog.scope')}>
            <Select
              id="assign-scope"
              value={scope}
              onChange={v => {
                setScope(v as AssignScope)
                setTouched(false)
              }}
              options={scopeOptions}
            />
          </Field>

          {/* Employee ID */}
          {scope === 'employee' && (
            <div>
              <Field label={t('assignDialog.employeeId')} required>
                <Input
                  id="assign-employee-id"
                  value={employeeId}
                  onChange={setEmployeeId}
                  placeholder="#id"
                  autoFocus
                />
              </Field>
              {employeeError && (
                <p role="alert" className="mt-1 text-[12px] text-[#FDA4AF]">{employeeError}</p>
              )}
            </div>
          )}

          {/* Asset ID */}
          {scope === 'device' && (
            <div>
              <Field label={t('assignDialog.assetId')} required>
                <Input
                  id="assign-asset-id"
                  value={assetId}
                  onChange={setAssetId}
                  placeholder="#id"
                  autoFocus
                />
              </Field>
              {deviceError && (
                <p role="alert" className="mt-1 text-[12px] text-[#FDA4AF]">{deviceError}</p>
              )}
            </div>
          )}
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
