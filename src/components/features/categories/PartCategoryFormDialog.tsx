import { useState } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Btn, Field, Input, Select, Chip, DIALOG_BACKDROP, MODAL_SHEET, MODAL_W_XL } from '@/components/ui'
import type { PartCategoryDef, PartCategoryBehavior } from '@/domain/part/partCategory-types'
import { PART_CATEGORY_BEHAVIORS } from '@/domain/part/partCategory-types'
import { TINT_BY_TOKEN, TINT_FALLBACK } from '@/components/features/parts/partsTokens'

/** Slot kinds known to the domain (MVP set). */
const KNOWN_SLOT_KINDS = ['psu', 'cooler', 'storage', 'ram', 'gpu', 'other'] as const
type SlotKind = (typeof KNOWN_SLOT_KINDS)[number]

/** Storage types (only relevant for behavior='sized'). */
const STORAGE_TYPES = ['SSD', 'HDD', 'M.2'] as const

export interface PartCategoryFormValues {
  name: { ru: string; en: string; hy: string }
  icon: string
  tintToken: string
  order: number
  slotKind: string
  storageType: 'SSD' | 'HDD' | 'M.2' | null
  /** Only present on create — absent on edit (behavior is immutable). */
  behavior?: PartCategoryBehavior
}

export interface PartCategoryFormDialogProps {
  open: boolean
  /** null = create mode; PartCategoryDef = edit mode. */
  initial?: PartCategoryDef | null
  submitting?: boolean
  submitError?: string | null
  onSubmit: (v: PartCategoryFormValues) => void
  onCancel: () => void
}

/** Sensible default slot kind given a behavior selection. */
function defaultSlotKind(behavior: PartCategoryBehavior): SlotKind {
  if (behavior === 'sized') return 'storage'
  if (behavior === 'models') return 'gpu'
  return 'psu'
}

export function PartCategoryFormDialog(p: PartCategoryFormDialogProps) {
  const { t } = useTranslation('categories')

  const isEdit = !!p.initial

  // ── form state ───────────────────────────────────────────────────────────
  const [nameRu, setNameRu] = useState(p.initial?.name.ru ?? '')
  const [nameEn, setNameEn] = useState(p.initial?.name.en ?? '')
  const [nameHy, setNameHy] = useState(p.initial?.name.hy ?? '')
  const [icon, setIcon] = useState(p.initial?.icon ?? 'package')
  const [tintToken, setTintToken] = useState(p.initial?.tintToken ?? 'slate')
  const [order, setOrder] = useState<string>(String(p.initial?.order ?? 0))
  const [behavior, setBehavior] = useState<PartCategoryBehavior>(p.initial?.behavior ?? 'single')
  const [slotKind, setSlotKind] = useState<string>(p.initial?.slotKind ?? defaultSlotKind(p.initial?.behavior ?? 'single'))
  const [storageType, setStorageType] = useState<'SSD' | 'HDD' | 'M.2' | ''>(() => {
    if (p.initial?.storageType) return p.initial.storageType
    return ''
  })
  const [touched, setTouched] = useState(false)

  if (!p.open) return null

  // ── derived ─────────────────────────────────────────────────────────────
  const nameRuInvalid = touched && !nameRu.trim()
  const nameEnInvalid = touched && !nameEn.trim()
  const orderNum = parseInt(order, 10)
  const orderInvalid = touched && (isNaN(orderNum) || orderNum < 0)

  const tintOptions = Object.keys(TINT_BY_TOKEN).map(tok => ({
    value: tok,
    label: t(`parts.tintToken.${tok}`),
  }))

  const behaviorOptions = PART_CATEGORY_BEHAVIORS.map(b => ({
    value: b,
    label: t(`parts.behavior.${b}`),
  }))

  const slotKindOptions = KNOWN_SLOT_KINDS.map(k => ({
    value: k,
    label: t(`parts.slotKind.${k}`),
  }))

  const storageTypeOptions = [
    { value: '', label: t('parts.storageType.none') },
    ...STORAGE_TYPES.map(st => ({
      value: st,
      label: t(`parts.storageType.${st === 'M.2' ? 'M2' : st}`),
    })),
  ]

  function handleBehaviorChange(v: string) {
    const b = v as PartCategoryBehavior
    setBehavior(b)
    // Auto-set a sensible slot kind when behavior changes in create mode
    setSlotKind(defaultSlotKind(b))
    // Clear storageType when switching away from 'sized'
    if (b !== 'sized') setStorageType('')
  }

  function submit() {
    setTouched(true)
    if (!nameRu.trim() || !nameEn.trim()) return
    const parsedOrder = parseInt(order, 10)
    if (isNaN(parsedOrder) || parsedOrder < 0) return

    const resolvedStorageType = (): 'SSD' | 'HDD' | 'M.2' | null => {
      if (behavior !== 'sized' || !storageType) return null
      return storageType
    }

    const values: PartCategoryFormValues = {
      name: {
        ru: nameRu.trim(),
        en: nameEn.trim(),
        hy: nameHy.trim() || nameEn.trim(), // fallback to en if hy left empty
      },
      icon: icon.trim() || 'package',
      tintToken,
      order: parsedOrder,
      slotKind,
      storageType: resolvedStorageType(),
      ...(!isEdit ? { behavior } : {}),
    }
    p.onSubmit(values)
  }

  const currentTint = TINT_BY_TOKEN[tintToken] ?? TINT_FALLBACK

  return ReactDOM.createPortal(
    <div className={DIALOG_BACKDROP} onClick={p.onCancel}>
      <div
        className={`${MODAL_W_XL} rounded-lg border border-border bg-surface p-5 mx-4 max-md:mx-0 ${MODAL_SHEET}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="max-md:block hidden mx-auto h-1 w-9 rounded-full bg-white/20 mb-3 light:bg-black/10" />
        <h3 className="text-15 font-semibold text-text-primary mb-4">
          {isEdit ? t('parts.form.editTitle') : t('parts.form.createTitle')}
        </h3>

        <div className="space-y-3">
          {p.submitError && (
            <p role="alert" className="text-12 text-error px-1">{p.submitError}</p>
          )}

          {/* Multi-lang name inputs (Tier-2 field) */}
          <Field label={t('parts.form.nameRu')} required>
            <Input
              value={nameRu}
              onChange={setNameRu}
              autoFocus
              invalid={nameRuInvalid}
              id="pcat-name-ru"
            />
          </Field>
          <Field label={t('parts.form.nameEn')} required>
            <Input
              value={nameEn}
              onChange={setNameEn}
              invalid={nameEnInvalid}
              id="pcat-name-en"
            />
          </Field>
          <Field label={t('parts.form.nameHy')}>
            <Input
              value={nameHy}
              onChange={setNameHy}
              id="pcat-name-hy"
            />
          </Field>

          {/* Behavior — create only; shown read-only in edit */}
          {!isEdit ? (
            <Field label={t('parts.form.behavior')} required>
              <Select
                id="pcat-behavior"
                value={behavior}
                onChange={handleBehaviorChange}
                options={behaviorOptions}
              />
              <p className="mt-1 text-11 text-text-subtle">
                {t(`parts.behavior.${behavior}Desc`)}
              </p>
            </Field>
          ) : (
            <div>
              <span className="block mb-1 text-11 uppercase tracking-[0.06em] font-semibold text-text-subtle">
                {t('parts.col.behavior')}
              </span>
              <Chip color="gray">
                {t(`parts.behavior.${p.initial!.behavior}`)}
              </Chip>
              <p className="mt-1 text-11 text-text-subtle">
                {t(`parts.behavior.${p.initial!.behavior}Desc`)}
              </p>
            </div>
          )}

          {/* Slot kind — editable only at creation; immutable after (UpdatePartCategoryInput omits it) */}
          {!isEdit ? (
            <Field label={t('parts.slotKind.label')}>
              <Select
                id="pcat-slot-kind"
                value={slotKind}
                onChange={setSlotKind}
                options={slotKindOptions}
              />
            </Field>
          ) : (
            <div>
              <span className="block mb-1 text-11 uppercase tracking-[0.06em] font-semibold text-text-subtle">
                {t('parts.slotKind.label')}
              </span>
              <Chip color="gray">
                {t(`parts.slotKind.${(p.initial!.slotKind as string) in { psu: 1, cooler: 1, storage: 1, ram: 1, gpu: 1, other: 1 } ? p.initial!.slotKind : 'other'}`)}
              </Chip>
            </div>
          )}

          {/* Storage type — create-only for sized behavior (immutable after creation) */}
          {!isEdit && behavior === 'sized' && (
            <Field label={t('parts.storageType.label')}>
              <Select
                id="pcat-storage-type"
                value={storageType}
                onChange={v => setStorageType(v as 'SSD' | 'HDD' | 'M.2' | '')}
                options={storageTypeOptions}
              />
            </Field>
          )}

          {/* Icon */}
          <Field label={t('parts.form.icon')}>
            <Input
              value={icon}
              onChange={setIcon}
              id="pcat-icon"
            />
          </Field>

          {/* Tint token with color swatch */}
          <Field label={t('parts.tintToken.label')}>
            <div className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-md flex-shrink-0 ${currentTint.iconBg}`}
                aria-hidden="true"
              />
              <div className="flex-1">
                <Select
                  id="pcat-tint"
                  value={tintToken}
                  onChange={setTintToken}
                  options={tintOptions}
                />
              </div>
            </div>
          </Field>

          {/* Sort order */}
          <Field label={t('parts.form.order')}>
            <Input
              value={order}
              onChange={setOrder}
              type="number"
              id="pcat-order"
              invalid={orderInvalid}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <Btn variant="secondary" size="sm" onClick={p.onCancel}>{t('parts.form.cancel')}</Btn>
          <Btn variant="primary" size="sm" disabled={!!p.submitting} onClick={submit}>
            {t('parts.form.save')}
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}
