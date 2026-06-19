import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Field, Input, Select } from '@/components/ui'
import { CATEGORY_GROUPS } from '@/domain/category'
import type { Category, CategoryGroup } from '@/domain/category'

export interface CategoryFormValues {
  name: string
  group: CategoryGroup
  prefix: string
  hasSpecs: boolean
  lucideIcon: string
}

export interface CategoryFormDialogProps {
  open: boolean
  initial?: Category | null
  prefixLocked?: boolean
  submitting?: boolean
  submitError?: string | null
  onSubmit: (v: CategoryFormValues) => void
  onCancel: () => void
}

export function CategoryFormDialog(p: CategoryFormDialogProps) {
  const { t } = useTranslation('categories')

  const [name, setName] = useState(p.initial?.name ?? '')
  const [group, setGroup] = useState<string>(p.initial?.group ?? CATEGORY_GROUPS[0])
  const [prefix, setPrefix] = useState(p.initial?.prefix ?? '')
  const [hasSpecs, setHasSpecs] = useState(p.initial?.hasSpecs ?? false)
  const [lucideIcon, setLucideIcon] = useState(p.initial?.lucideIcon ?? '')

  const [touched, setTouched] = useState(false)

  if (!p.open) return null

  const nameError = touched && !name.trim() ? t('validation.required') : null
  const prefixError = touched && !prefix.trim() ? t('validation.required') : null

  const groupOptions = CATEGORY_GROUPS.map(g => ({ value: g, label: t(`group.${g}`) }))

  function submit() {
    setTouched(true)
    if (!name.trim()) return
    if (!prefix.trim()) return
    p.onSubmit({
      name: name.trim(),
      group: group as CategoryGroup,
      prefix: prefix.trim(),
      hasSpecs,
      lucideIcon: lucideIcon.trim() || 'package',
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={p.onCancel}
    >
      <div
        className="w-[480px] rounded-lg border border-[#2A2F36] bg-[#1B1F24] p-5"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-[15px] font-semibold text-[#F8FAFC] mb-4">
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

          {/* prefix — textbox #1 */}
          <div>
            <Field label={t('form.prefix')} required>
              <Input
                value={prefix}
                onChange={setPrefix}
                disabled={p.prefixLocked}
              />
            </Field>
            {p.prefixLocked && (
              <p className="mt-1 text-[11px] text-[#64748B]">{t('form.prefixLocked')}</p>
            )}
            {!p.prefixLocked && prefixError && (
              <p className="mt-1 text-[12px] text-[#FDA4AF]">{prefixError}</p>
            )}
          </div>

          {/* hasSpecs — native checkbox, NOT a textbox role */}
          <div className="flex items-center gap-2 pt-1">
            <input
              id="category-has-specs"
              type="checkbox"
              checked={hasSpecs}
              onChange={e => setHasSpecs(e.target.checked)}
              className="w-4 h-4 accent-[#F97316] cursor-pointer"
            />
            <label
              htmlFor="category-has-specs"
              className="text-[13px] text-[#94A3B8] cursor-pointer select-none"
            >
              {t('form.hasSpecs')}
            </label>
          </div>

          {/* lucideIcon — textbox #2 */}
          <div>
            <Field label={t('form.icon')}>
              <Input value={lucideIcon} onChange={setLucideIcon} />
            </Field>
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
