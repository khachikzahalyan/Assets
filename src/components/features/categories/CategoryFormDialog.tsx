import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Field, Input, DIALOG_BACKDROP, MODAL_SHEET } from '@/components/ui'
import type { Category } from '@/domain/category'

export interface CategoryFormValues {
  name: string
  hasSpecs: boolean
  lucideIcon: string
}

export interface CategoryFormDialogProps {
  open: boolean
  initial?: Category | null
  submitting?: boolean
  submitError?: string | null
  onSubmit: (v: CategoryFormValues) => void
  onCancel: () => void
}

export function CategoryFormDialog(p: CategoryFormDialogProps) {
  const { t } = useTranslation('categories')

  const [name, setName]             = useState(p.initial?.name ?? '')
  const [hasSpecs, setHasSpecs]     = useState(p.initial?.hasSpecs ?? false)
  const [lucideIcon, setLucideIcon] = useState(p.initial?.lucideIcon ?? '')
  const [touched, setTouched]       = useState(false)

  if (!p.open) return null

  const nameInvalid = touched && !name.trim()

  function submit() {
    setTouched(true)
    if (!name.trim()) return
    p.onSubmit({ name: name.trim(), hasSpecs, lucideIcon: lucideIcon.trim() || 'package' })
  }

  return (
    <div className={DIALOG_BACKDROP} onClick={p.onCancel}>
      <div
        className={`w-[480px] rounded-lg border border-border bg-surface p-5 mx-4 max-md:mx-0 ${MODAL_SHEET}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="max-md:block hidden mx-auto h-1 w-9 rounded-full bg-white/20 mb-3" />
        <h3 className="text-[15px] font-semibold text-text-primary mb-4">
          {p.initial ? t('form.editTitle') : t('form.createTitle')}
        </h3>

        <div className="space-y-3">
          {p.submitError && (
            <p role="alert" className="text-[12px] text-error px-1">{p.submitError}</p>
          )}
          <Field label={t('form.name')} required>
            <Input value={name} onChange={setName} autoFocus invalid={nameInvalid} />
          </Field>
          <div className="flex items-center gap-2 pt-1">
            <input
              id="cat-has-specs"
              type="checkbox"
              checked={hasSpecs}
              onChange={e => setHasSpecs(e.target.checked)}
              className="w-4 h-4 accent-accent cursor-pointer"
            />
            <label
              htmlFor="cat-has-specs"
              className="text-[13px] text-text-tertiary cursor-pointer select-none"
            >
              {t('form.hasSpecs')}
            </label>
          </div>
          <Field label={t('form.icon')}>
            <Input value={lucideIcon} onChange={setLucideIcon} />
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Btn variant="secondary" size="sm" onClick={p.onCancel}>{t('form.cancel')}</Btn>
          <Btn variant="primary" size="sm" disabled={!!p.submitting} onClick={submit}>
            {t('form.save')}
          </Btn>
        </div>
      </div>
    </div>
  )
}
