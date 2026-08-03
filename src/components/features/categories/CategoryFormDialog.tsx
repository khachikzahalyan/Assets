import { useState } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Btn, Field, Input, Icon, DIALOG_BACKDROP, MODAL_SHEET, MODAL_W_LG } from '@/components/ui'
import { deriveCategoryFlags } from '@/domain/asset'
import type { Category } from '@/domain/category'

export interface CategoryFormValues {
  name: string
  hasSpecs: boolean
  hasOemLicense: boolean
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

/** Curated registry subset offered in the icon picker (all must exist in icon.tsx). */
const ICON_OPTIONS = [
  'laptop', 'monitor', 'pc-case', 'server', 'smartphone', 'tablet', 'tv', 'printer',
  'keyboard', 'mouse', 'headphones', 'speaker', 'mic', 'camera', 'video', 'projector',
  'presentation', 'phone', 'gamepad-2', 'scan', 'barcode', 'cpu', 'memory-stick',
  'hard-drive', 'microchip', 'circuit-board', 'fan', 'usb', 'cable', 'plug', 'plug-zap',
  'battery', 'credit-card', 'database', 'radio', 'router', 'wifi', 'network', 'globe',
  'armchair', 'sofa', 'table-2', 'box', 'boxes', 'package', 'archive', 'briefcase', 'warehouse',
]

export function CategoryFormDialog(p: CategoryFormDialogProps) {
  const { t } = useTranslation('categories')

  const [name, setName]         = useState(p.initial?.name ?? '')
  const [hasSpecs, setHasSpecs] = useState(p.initial?.hasSpecs ?? false)
  // Initial: explicit doc flag if set, else what the taxonomy resolves for this
  // category today — so saving without touching the checkbox never flips the form.
  const [hasOemLicense, setHasOemLicense] = useState(
    p.initial
      ? (p.initial.hasOemLicense ?? deriveCategoryFlags(p.initial.id, p.initial.group).hasOemLicense)
      : false,
  )
  const [lucideIcon, setLucideIcon] = useState(p.initial?.lucideIcon ?? '')
  const [touched, setTouched]       = useState(false)

  if (!p.open) return null

  const nameInvalid = touched && !name.trim()

  // An existing category may use an icon outside the curated set — keep it pickable.
  const iconOptions = lucideIcon && !ICON_OPTIONS.includes(lucideIcon)
    ? [lucideIcon, ...ICON_OPTIONS]
    : ICON_OPTIONS

  function submit() {
    setTouched(true)
    if (!name.trim()) return
    p.onSubmit({ name: name.trim(), hasSpecs, hasOemLicense, lucideIcon: lucideIcon.trim() || 'package' })
  }

  return ReactDOM.createPortal(
    <div className={DIALOG_BACKDROP} onClick={p.onCancel}>
      <div
        className={`${MODAL_W_LG} rounded-lg border border-border bg-surface p-5 mx-4 max-md:mx-0 ${MODAL_SHEET}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="max-md:block hidden mx-auto h-1 w-9 rounded-full bg-white/20 mb-3 light:bg-black/10" />
        <h3 className="text-15 font-semibold text-text-primary mb-4">
          {p.initial ? t('form.editTitle') : t('form.createTitle')}
        </h3>

        <div className="space-y-3">
          {p.submitError && (
            <p role="alert" className="text-12 text-error px-1">{p.submitError}</p>
          )}
          <Field label={t('form.name')} required>
            <Input value={name} onChange={setName} autoFocus invalid={nameInvalid} />
          </Field>
          <div className="flex items-start gap-2 pt-1">
            <input
              id="cat-has-specs"
              type="checkbox"
              checked={hasSpecs}
              onChange={e => setHasSpecs(e.target.checked)}
              className="w-4 h-4 accent-accent cursor-pointer mt-0.5 flex-shrink-0"
            />
            <label
              htmlFor="cat-has-specs"
              className="text-13 text-text-tertiary cursor-pointer select-none"
            >
              {t('form.hasSpecs')}
            </label>
          </div>
          <div className="flex items-start gap-2">
            <input
              id="cat-has-oem-license"
              type="checkbox"
              checked={hasOemLicense}
              onChange={e => setHasOemLicense(e.target.checked)}
              className="w-4 h-4 accent-accent cursor-pointer mt-0.5 flex-shrink-0"
            />
            <label
              htmlFor="cat-has-oem-license"
              className="text-13 text-text-tertiary cursor-pointer select-none"
            >
              {t('form.hasOemLicense')}
            </label>
          </div>
          <Field label={t('form.icon')}>
            <div
              role="radiogroup"
              aria-label={t('form.icon')}
              className="grid grid-cols-8 max-md:grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-1.5 rounded-lg border border-border bg-bg"
            >
              {iconOptions.map(icon => {
                const selected = lucideIcon === icon
                return (
                  <button
                    key={icon}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    title={icon}
                    onClick={() => setLucideIcon(icon)}
                    className={`h-9 rounded-md inline-flex items-center justify-center transition-colors ${
                      selected
                        ? 'bg-accent/15 text-accent ring-1 ring-accent/50'
                        : 'text-text-tertiary hover:bg-surface-2 hover:text-text-primary'
                    }`}
                  >
                    <Icon name={icon} size={16} />
                  </button>
                )
              })}
            </div>
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Btn variant="secondary" size="sm" onClick={p.onCancel}>{t('form.cancel')}</Btn>
          <Btn variant="primary" size="sm" disabled={!!p.submitting} onClick={submit}>
            {t('form.save')}
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}
