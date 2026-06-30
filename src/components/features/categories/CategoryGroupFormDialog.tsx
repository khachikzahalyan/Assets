import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Field, Input, DIALOG_BACKDROP, MODAL_SHEET } from '@/components/ui'
import type { CategoryGroup } from '@/domain/category'

export interface CategoryGroupFormValues {
  name: string
  lucideIcon: string
}

export interface CategoryGroupFormDialogProps {
  open: boolean
  initial?: CategoryGroup | null
  submitting?: boolean
  submitError?: string | null
  onSubmit: (v: CategoryGroupFormValues) => void
  onCancel: () => void
}

export function CategoryGroupFormDialog(p: CategoryGroupFormDialogProps) {
  const { t } = useTranslation('categories')

  const [name, setName]             = useState(p.initial?.name ?? '')
  const [lucideIcon, setLucideIcon] = useState(p.initial?.lucideIcon ?? '')
  const [touched, setTouched]       = useState(false)

  if (!p.open) return null

  const nameInvalid = touched && !name.trim()

  function submit() {
    setTouched(true)
    if (!name.trim()) return
    p.onSubmit({ name: name.trim(), lucideIcon: lucideIcon.trim() || 'package' })
  }

  return (
    <div className={DIALOG_BACKDROP} onClick={p.onCancel}>
      <div
        className={`w-[480px] rounded-lg border border-border bg-surface p-5 mx-4 max-md:mx-0 ${MODAL_SHEET}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="max-md:block hidden mx-auto h-1 w-9 rounded-full bg-white/20 mb-3" />
        <h3 className="text-[15px] font-semibold text-text-primary mb-4">
          {p.initial ? t('groupForm.editTitle') : t('groupForm.createTitle')}
        </h3>

        <div className="space-y-3">
          {p.submitError && (
            <p role="alert" className="text-[12px] text-error px-1">{p.submitError}</p>
          )}
          <Field label={t('groupForm.name')} required>
            <Input value={name} onChange={setName} autoFocus invalid={nameInvalid} />
          </Field>
          <Field label={t('groupForm.icon')}>
            <Input value={lucideIcon} onChange={setLucideIcon} />
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Btn variant="secondary" size="sm" onClick={p.onCancel}>{t('groupForm.cancel')}</Btn>
          <Btn variant="primary" size="sm" disabled={!!p.submitting} onClick={submit}>
            {t('groupForm.save')}
          </Btn>
        </div>
      </div>
    </div>
  )
}
