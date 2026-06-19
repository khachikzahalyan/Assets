import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Field, Input } from '@/components/ui'
import type { Department } from '@/domain/department'

export interface DepartmentFormValues { name: string }
export interface DepartmentFormDialogProps {
  open: boolean
  initial?: Department | null
  submitting?: boolean
  submitError?: string | null
  onSubmit: (v: DepartmentFormValues) => void
  onCancel: () => void
}

export function DepartmentFormDialog(p: DepartmentFormDialogProps) {
  const { t } = useTranslation('departments')
  const [name, setName] = useState(p.initial?.name ?? '')
  const [touched, setTouched] = useState(false)

  if (!p.open) return null
  const nameError = touched && !name.trim() ? t('validation.required') : null

  function submit() {
    setTouched(true)
    if (!name.trim()) return
    p.onSubmit({ name: name.trim() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={p.onCancel}>
      <div className="w-[440px] rounded-lg border border-[#2A2F36] bg-[#1B1F24] p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-[15px] font-semibold text-[#F8FAFC] mb-4">
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
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Btn variant="secondary" size="sm" onClick={p.onCancel}>{t('form.cancel')}</Btn>
          <Btn variant="primary" size="sm" disabled={p.submitting} onClick={submit}>{t('form.save')}</Btn>
        </div>
      </div>
    </div>
  )
}
