import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Field, Input, Select, DIALOG_BACKDROP, MODAL_SHEET } from '@/components/ui'
import type { Branch, BranchType } from '@/domain/branch'
import { BRANCH_TYPES } from '@/domain/branch'

export interface BranchFormValues { name: string; type: BranchType; city: string | null; address: string | null }
export interface BranchFormDialogProps {
  open: boolean
  initial?: Branch | null
  submitting?: boolean
  submitError?: string | null
  onSubmit: (v: BranchFormValues) => void
  onCancel: () => void
}

export function BranchFormDialog(p: BranchFormDialogProps) {
  const { t } = useTranslation('branches')
  const [name, setName] = useState(p.initial?.name ?? '')
  const [type, setType] = useState<BranchType>(p.initial?.type ?? 'branch')
  const [city, setCity] = useState(p.initial?.city ?? '')
  const [address, setAddress] = useState(p.initial?.address ?? '')
  const [touched, setTouched] = useState(false)

  if (!p.open) return null
  const nameError = touched && !name.trim() ? t('validation.required') : null
  const typeOptions = BRANCH_TYPES.map(bt => ({ value: bt, label: t(`type.${bt}`) }))

  function submit() {
    setTouched(true)
    if (!name.trim()) return
    p.onSubmit({ name: name.trim(), type, city: city.trim() || null, address: address.trim() || null })
  }

  return (
    <div className={DIALOG_BACKDROP} onClick={p.onCancel}>
      <div className={`w-[440px] max-md:w-full max-md:rounded-b-none max-md:rounded-t-[18px] max-md:max-h-[85vh] max-md:overflow-y-auto rounded-lg border border-border bg-surface p-5 mx-4 max-md:mx-0 ${MODAL_SHEET}`} onClick={e => e.stopPropagation()}>
        <div className="max-md:block hidden mx-auto h-1 w-9 rounded-full bg-white/20 mb-3" />
        <h3 className="text-[15px] font-semibold text-text-primary mb-4">
          {p.initial ? t('form.editTitle') : t('form.createTitle')}
        </h3>
        <div className="space-y-3">
          {p.submitError && <p role="alert" className="text-[12px] text-[#FDA4AF] px-1">{p.submitError}</p>}
          <div>
            <Field label={t('form.name')} required>
              <Input value={name} onChange={setName} autoFocus />
            </Field>
            {nameError && <p className="mt-1 text-[12px] text-[#FDA4AF]">{nameError}</p>}
          </div>
          <Field label={t('form.type')}>
            <Select value={type} onChange={v => setType(v as BranchType)} options={typeOptions} />
          </Field>
          <Field label={t('form.city')}>
            <Input value={city} onChange={setCity} />
          </Field>
          <Field label={t('form.address')}>
            <Input value={address} onChange={setAddress} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Btn variant="secondary" size="sm" onClick={p.onCancel}>{t('form.cancel')}</Btn>
          <Btn variant="primary" size="sm" disabled={!!p.submitting} onClick={submit}>{t('form.save')}</Btn>
        </div>
      </div>
    </div>
  )
}
