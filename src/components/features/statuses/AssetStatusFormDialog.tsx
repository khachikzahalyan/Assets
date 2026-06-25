import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Field, Input, Select, Chip, DIALOG_BACKDROP, MODAL_SHEET } from '@/components/ui'
import type { AssetStatus } from '@/domain/asset_status'

export interface AssetStatusFormValues {
  name: string
  color: string
  isFinal: boolean
  sortOrder: number
}

export interface AssetStatusFormDialogProps {
  open: boolean
  initial?: AssetStatus | null
  submitting?: boolean
  submitError?: string | null
  onSubmit: (v: AssetStatusFormValues) => void
  onCancel: () => void
}

const COLOR_TOKENS = [
  'gray', 'green', 'blue', 'red', 'amber', 'orange', 'indigo', 'violet', 'teal', 'cyan',
] as const

export function AssetStatusFormDialog(p: AssetStatusFormDialogProps) {
  const { t } = useTranslation('statuses')

  const [name, setName]           = useState(p.initial?.name ?? '')
  const [color, setColor]         = useState<string>(p.initial?.color ?? 'gray')
  const [isFinal, setIsFinal]     = useState(p.initial?.isFinal ?? false)
  const [sortOrder, setSortOrder] = useState(String(p.initial?.sortOrder ?? 0))
  const [touched, setTouched]     = useState(false)

  if (!p.open) return null

  const nameError = touched && !name.trim() ? t('validation.required') : null
  const colorOptions = COLOR_TOKENS.map(token => ({ value: token, label: token }))
  const isSystem = !!p.initial?.isSystem

  function submit() {
    setTouched(true)
    if (!name.trim()) return
    p.onSubmit({
      name: name.trim(),
      color,
      isFinal,
      sortOrder: Number(sortOrder) || 0,
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
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-[15px] font-semibold text-text-primary">
            {p.initial ? t('form.editTitle') : t('form.createTitle')}
          </h3>
          {isSystem && (
            <Chip color="indigo">{t('systemBadge')}</Chip>
          )}
        </div>

        {isSystem && (
          <p className="text-[11px] text-text-subtle mb-3">{t('form.systemLocked')}</p>
        )}

        <div className="space-y-3">
          {p.submitError && (
            <p role="alert" className="text-[12px] text-[#FDA4AF] px-1">{p.submitError}</p>
          )}

          {/* name — textbox[0] */}
          <div>
            <Field label={t('form.name')} required>
              <Input value={name} onChange={setName} autoFocus />
            </Field>
            {nameError && <p className="mt-1 text-[12px] text-[#FDA4AF]">{nameError}</p>}
          </div>

          {/* color — Select (combobox, NOT textbox) */}
          <div>
            <Field label={t('form.color')}>
              <Select
                value={color}
                onChange={setColor}
                options={colorOptions}
              />
            </Field>
          </div>

          {/* isFinal — native checkbox; disabled when editing a system status */}
          <div className="flex items-center gap-2 pt-1">
            <input
              id="status-is-final"
              type="checkbox"
              checked={isFinal}
              onChange={e => setIsFinal(e.target.checked)}
              disabled={isSystem}
              className="w-4 h-4 accent-accent cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            />
            <label
              htmlFor="status-is-final"
              className="text-[13px] text-text-tertiary cursor-pointer select-none"
            >
              {t('form.isFinal')}
            </label>
          </div>

          {/* sortOrder — textbox[1] (type="number") */}
          <div>
            <Field label={t('form.sortOrder')}>
              <Input
                type="number"
                value={String(sortOrder)}
                onChange={v => setSortOrder(v)}
              />
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
