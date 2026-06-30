import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Field, Input, Select, DIALOG_BACKDROP, MODAL_SHEET } from '@/components/ui'
import { CATEGORY_GROUP_BEHAVIORS } from '@/domain/category'
import type { Category, CategoryGroupBehavior } from '@/domain/category'

export interface CategoryFormValues {
  name: string
  group: CategoryGroupBehavior
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
  const [group, setGroup]           = useState<string>(p.initial?.group ?? CATEGORY_GROUP_BEHAVIORS[0])
  const [hasSpecs, setHasSpecs]     = useState(p.initial?.hasSpecs ?? false)
  const [lucideIcon, setLucideIcon] = useState(p.initial?.lucideIcon ?? '')

  const [touched, setTouched] = useState(false)

  if (!p.open) return null

  const nameError = touched && !name.trim() ? t('validation.required') : null

  const groupOptions = CATEGORY_GROUP_BEHAVIORS.map(g => ({ value: g, label: t(`group.${g}`) }))

  function submit() {
    setTouched(true)
    if (!name.trim()) return
    p.onSubmit({
      name: name.trim(),
      group: group as CategoryGroupBehavior,
      hasSpecs,
      lucideIcon: lucideIcon.trim() || 'package',
    })
  }

  return (
    <div
      className={DIALOG_BACKDROP}
      onClick={p.onCancel}
    >
      <div
        className={`w-[480px] max-md:w-full max-md:rounded-b-none max-md:rounded-t-[18px] max-md:max-h-[85vh] max-md:overflow-y-auto rounded-lg border border-border bg-surface p-5 mx-4 max-md:mx-0 ${MODAL_SHEET}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="max-md:block hidden mx-auto h-1 w-9 rounded-full bg-white/20 mb-3" />
        <h3 className="text-[15px] font-semibold text-text-primary mb-4">
          {p.initial ? t('form.editTitle') : t('form.createTitle')}
        </h3>

        <div className="space-y-3">
          {p.submitError && (
            <p role="alert" className="text-[12px] text-[#FDA4AF] px-1">{p.submitError}</p>
          )}

          {/* name — textbox #0 */}
          <div>
            <Field label={t('form.name')} required>
              <Input value={name} onChange={setName} autoFocus />
            </Field>
            {nameError && <p className="mt-1 text-[12px] text-[#FDA4AF]">{nameError}</p>}
          </div>

          {/* group — combobox (Select), NOT a textbox role */}
          <div>
            <Field label={t('form.group')} required>
              <Select
                value={group}
                onChange={setGroup}
                options={groupOptions}
                placeholder={t('form.pickGroup')}
              />
            </Field>
          </div>

          {/* hasSpecs — native checkbox, NOT a textbox role */}
          <div className="flex items-center gap-2 pt-1">
            <input
              id="category-has-specs"
              type="checkbox"
              checked={hasSpecs}
              onChange={e => setHasSpecs(e.target.checked)}
              className="w-4 h-4 accent-accent cursor-pointer"
            />
            <label
              htmlFor="category-has-specs"
              className="text-[13px] text-text-tertiary cursor-pointer select-none"
            >
              {t('form.hasSpecs')}
            </label>
          </div>

          {/* lucideIcon — textbox #1 */}
          <div>
            <Field label={t('form.icon')}>
              <Input value={lucideIcon} onChange={setLucideIcon} />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Btn variant="secondary" size="sm" onClick={p.onCancel}>{t('form.cancel')}</Btn>
          <Btn variant="primary" size="sm" disabled={!!p.submitting} onClick={submit}>{t('form.save')}</Btn>
        </div>
      </div>
    </div>
  )
}
