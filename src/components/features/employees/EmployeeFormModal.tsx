import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Icon, Input, Select } from '@/components/ui'
import { normalizePhone, formatLocalPhone } from './employeeFormat'
import { EmployeeModalShell } from './EmployeeModalShell'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmployeeFormSubmit {
  id?: string
  firstName: string
  lastName: string
  email: string
  phone: string
  position: string
  departmentId: string
}

export interface EmployeeFormModalProps {
  open: boolean
  /** null = create mode; provided object = edit mode */
  initial: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    position: string | null
    departmentId: string | null
  } | null
  departments: { id: string; name: string }[]
  onSave: (submit: EmployeeFormSubmit) => void
  onClose: () => void
}

// ── Internal draft shape ──────────────────────────────────────────────────────

interface Draft {
  firstName: string
  lastName: string
  email: string
  phone: string
  position: string
  departmentId: string
}

function blankDraft(): Draft {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    position: '',
    departmentId: '',
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

const LABEL_CLS =
  'block mb-1 text-[11px] uppercase tracking-[0.06em] font-semibold text-text-subtle'
const ERROR_CLS = 'mt-1 text-[11px] text-[#FDA4AF]'

interface FieldWrapProps {
  label: string
  required?: boolean
  error?: string | null
  children: React.ReactNode
}

function FieldWrap({ label, required, error, children }: FieldWrapProps) {
  return (
    <label className="block">
      <span className={LABEL_CLS}>
        {label}
        {required && <span className="text-[#FDA4AF] ml-0.5">*</span>}
      </span>
      {children}
      {error && <span className={ERROR_CLS}>{error}</span>}
    </label>
  )
}

/**
 * Read-only value display — prototype lines 759-765.
 * Used for identity fields (firstName, lastName, email) in edit mode.
 */
interface ReadOnlyValueProps {
  children: React.ReactNode
  mono?: boolean
  icon?: string
}

function ReadOnlyValue({ children, mono, icon }: ReadOnlyValueProps) {
  return (
    <div
      className={`w-full h-9 px-3 flex items-center gap-2 text-[16px] rounded-lg border border-border bg-surface-2 text-text-primary ${
        mono ? 'font-mono tracking-tight' : ''
      }`}
    >
      <span className="flex-1 truncate text-sm">{children}</span>
      {icon ? (
        <Icon name={icon} size={11} />
      ) : (
        <Icon name="lock" size={11} />
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * EmployeeFormModal — create + edit employee modal.
 * Mirrors Warehouse/prototypes/employees.html EmployeeFormModal (lines 1442-1594).
 *
 * Presentational only — does NOT call Firebase. Emits onSave with
 * EmployeeFormSubmit; the page/hook generates the Firestore id.
 */
export function EmployeeFormModal({
  open,
  initial,
  departments,
  onSave,
  onClose,
}: EmployeeFormModalProps) {
  const { t } = useTranslation('employees')

  const [draft, setDraft] = useState<Draft>(blankDraft)

  // Seed draft from initial on open
  useEffect(() => {
    if (!open) return
    if (!initial) {
      setDraft(blankDraft())
      return
    }
    setDraft({
      firstName:    initial.firstName,
      lastName:     initial.lastName,
      email:        initial.email ?? '',
      phone:        normalizePhone(initial.phone),
      position:     initial.position ?? '',
      departmentId: initial.departmentId ?? '',
    })
  }, [open, initial])

  const isEdit = !!initial

  function set(patch: Partial<Draft>) {
    setDraft(prev => ({ ...prev, ...patch }))
  }

  // ── Validation ──────────────────────────────────────────────────────────────

  const phoneDigits = normalizePhone(draft.phone)

  const firstNameErr: string | null = !draft.firstName.trim()
    ? t('validation.firstNameRequired')
    : null
  const lastNameErr: string | null = !draft.lastName.trim()
    ? t('validation.lastNameRequired')
    : null
  const positionErr: string | null = !draft.position.trim()
    ? t('validation.positionRequired')
    : null
  const deptErr: string | null = !draft.departmentId
    ? t('validation.deptRequired')
    : null
  const phoneErr: string | null =
    phoneDigits.length === 0
      ? t('validation.phoneRequired')
      : phoneDigits.length !== 9
        ? t('validation.phoneDigits')
        : null
  const emailTrim = draft.email.trim()
  const emailErr: string | null = !emailTrim
    ? t('validation.required')
    : !/^\S+@\S+\.\S+$/.test(emailTrim)
      ? t('validation.emailFormat')
      : null

  // Identity fields are locked in edit — only mutable fields matter for canSave
  const canSave = isEdit
    ? !positionErr && !deptErr && !phoneErr
    : !firstNameErr && !lastNameErr && !positionErr && !deptErr && !phoneErr && !emailErr

  // ── Submit ──────────────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!canSave) return
    onSave({
      ...(initial?.id !== undefined ? { id: initial.id } : {}),
      firstName:    draft.firstName.trim(),
      lastName:     draft.lastName.trim(),
      email:        draft.email.trim(),
      phone:        phoneDigits,
      position:     draft.position.trim(),
      departmentId: draft.departmentId,
    })
  }

  // ── Department options ──────────────────────────────────────────────────────

  const deptOptions = departments.map(d => ({ value: d.id, label: d.name }))

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <EmployeeModalShell open={open} onClose={onClose} width="max-w-2xl">
      {/* Header — prototype lines 1524-1537 */}
      <div className="px-6 pt-5 pb-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-[17px] font-bold text-text-primary tracking-tight">
            {isEdit ? t('form.editTitle') : t('form.createTitle')}
          </div>
          <div className="text-[14px] text-text-subtle mt-0.5">
            {isEdit ? t('form.editSubtitle') : t('form.createSubtitle')}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('form.cancel')}
          className="w-8 h-8 rounded-md text-text-subtle hover:text-text-secondary hover:bg-surface-2 flex items-center justify-center transition-colors"
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* Body — prototype lines 1539-1583 */}
      <div className="px-6 py-5 space-y-4">
        {/* Row 1: Имя / Фамилия */}
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <FieldWrap
            label={t('form.firstName')}
            required={!isEdit}
            error={!isEdit && draft.firstName.length > 0 ? firstNameErr : null}
          >
            {isEdit ? (
              <ReadOnlyValue>{draft.firstName}</ReadOnlyValue>
            ) : (
              <Input
                ariaLabel={t('form.firstName')}
                value={draft.firstName}
                onChange={v => set({ firstName: v })}
                placeholder="Иван"
              />
            )}
          </FieldWrap>
          <FieldWrap
            label={t('form.lastName')}
            required={!isEdit}
            error={!isEdit && draft.lastName.length > 0 ? lastNameErr : null}
          >
            {isEdit ? (
              <ReadOnlyValue>{draft.lastName}</ReadOnlyValue>
            ) : (
              <Input
                ariaLabel={t('form.lastName')}
                value={draft.lastName}
                onChange={v => set({ lastName: v })}
                placeholder="Иванов"
              />
            )}
          </FieldWrap>
        </div>

        {/* Row 2: Должность / Отдел */}
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <FieldWrap
            label={t('form.position')}
            required
            error={draft.position.length > 0 ? positionErr : null}
          >
            <Input
              ariaLabel={t('form.position')}
              value={draft.position}
              onChange={v => set({ position: v })}
              placeholder="Менеджер по продажам"
            />
          </FieldWrap>
          <FieldWrap
            label={t('form.department')}
            required
            error={draft.departmentId.length > 0 ? null : deptErr}
          >
            <Select
              id="emp-modal-dept"
              value={draft.departmentId}
              onChange={v => set({ departmentId: v })}
              options={deptOptions}
              placeholder={t('form.pickDepartment')}
            />
          </FieldWrap>
        </div>

        {/* Row 3: Телефон / Gmail */}
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <FieldWrap
            label={t('form.phone')}
            required
            error={draft.phone.length > 0 ? phoneErr : null}
          >
            <Input
              ariaLabel={t('form.phone')}
              type="tel"
              value={formatLocalPhone(draft.phone)}
              onChange={v => set({ phone: normalizePhone(v) })}
              placeholder="094 90 89 78"
            />
          </FieldWrap>
          <FieldWrap
            label={t('form.gmail')}
            required={!isEdit}
            error={!isEdit && draft.email.length > 0 ? emailErr : null}
          >
            {isEdit ? (
              <ReadOnlyValue mono icon="mail">
                {draft.email || '—'}
              </ReadOnlyValue>
            ) : (
              <Input
                ariaLabel={t('form.gmail')}
                type="email"
                value={draft.email}
                onChange={v => set({ email: v })}
                placeholder="ivan@gmail.com"
              />
            )}
          </FieldWrap>
        </div>
      </div>

      {/* Footer — prototype lines 1585-1591 */}
      <div className="px-6 py-3.5 bg-bg/60 border-t border-border flex items-center justify-end gap-2 max-md:flex-col-reverse max-md:gap-2">
        <Btn variant="ghost" onClick={onClose} className="max-md:w-full max-md:justify-center">
          {t('form.cancel')}
        </Btn>
        <Btn variant="primary" onClick={handleSubmit} disabled={!canSave} className="max-md:w-full max-md:justify-center">
          <Icon name="check" size={14} />
          {isEdit ? t('form.save') : t('form.create')}
        </Btn>
      </div>
    </EmployeeModalShell>
  )
}
