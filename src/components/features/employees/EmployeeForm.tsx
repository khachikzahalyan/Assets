import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SectionCard, Input, Btn, Icon } from '@/components/ui'
import { Select, type SelectOption } from '@/components/ui'
import type { Employee } from '@/domain/employee'
import type { RefRow } from '@/domain/asset'

/** Pure email format check. Exported for unit tests. */
export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export interface EmployeeFormSubmit {
  id?: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  position: string | null
  branchId: string | null
  departmentId: string | null
}

export interface EmployeeFormProps {
  mode: 'create' | 'edit'
  initial?: Partial<Employee>
  branches: RefRow[]
  departments: RefRow[]
  submitting?: boolean
  submitError?: string | null
  onSubmit: (v: EmployeeFormSubmit) => void
  onCancel: () => void
}

const LABEL_CLS = 'block mb-1 text-[11px] uppercase tracking-[0.06em] font-semibold text-text-subtle'
const ERROR_CLS  = 'mt-1 text-[11px] text-[#FDA4AF]'

export function EmployeeForm({
  mode,
  initial,
  branches,
  departments,
  submitting = false,
  submitError,
  onSubmit,
  onCancel,
}: EmployeeFormProps) {
  const { t } = useTranslation('employees')

  const [uid,          setUid]          = useState(initial?.id          ?? '')
  const [firstName,    setFirstName]    = useState(initial?.firstName   ?? '')
  const [lastName,     setLastName]     = useState(initial?.lastName    ?? '')
  const [email,        setEmail]        = useState(initial?.email       ?? '')
  const [phone,        setPhone]        = useState(initial?.phone       ?? '')
  const [position,     setPosition]     = useState(initial?.position    ?? '')
  const [branchId,     setBranchId]     = useState(initial?.branchId    ?? '')
  const [departmentId, setDepartmentId] = useState(initial?.departmentId ?? '')

  // Inline validation errors
  const [uidErr,       setUidErr]       = useState<string | null>(null)
  const [firstNameErr, setFirstNameErr] = useState<string | null>(null)
  const [lastNameErr,  setLastNameErr]  = useState<string | null>(null)
  const [emailErr,     setEmailErr]     = useState<string | null>(null)

  function validateEmailOnBlur() {
    if (email.trim() && !isValidEmail(email.trim())) {
      setEmailErr(t('validation.emailFormat'))
    } else {
      setEmailErr(null)
    }
  }

  function validate(): boolean {
    let ok = true

    if (mode === 'create' && !uid.trim()) {
      setUidErr(t('validation.uidRequired'))
      ok = false
    } else {
      setUidErr(null)
    }

    if (!firstName.trim()) {
      setFirstNameErr(t('validation.required'))
      ok = false
    } else {
      setFirstNameErr(null)
    }

    if (!lastName.trim()) {
      setLastNameErr(t('validation.required'))
      ok = false
    } else {
      setLastNameErr(null)
    }

    if (!email.trim()) {
      setEmailErr(t('validation.required'))
      ok = false
    } else if (!isValidEmail(email.trim())) {
      setEmailErr(t('validation.emailFormat'))
      ok = false
    } else {
      setEmailErr(null)
    }

    return ok
  }

  function handleSubmit() {
    if (!validate()) return
    onSubmit({
      ...(mode === 'create' ? { id: uid.trim() } : {}),
      firstName:    firstName.trim(),
      lastName:     lastName.trim(),
      email:        email.trim(),
      phone:        phone.trim() || null,
      position:     position.trim() || null,
      branchId:     branchId || null,
      departmentId: departmentId || null,
    })
  }

  const branchOptions: SelectOption[] = [
    { value: '', label: t('form.pickBranch') },
    ...branches.map(b => ({ value: b.id, label: b.name })),
  ]

  const deptOptions: SelectOption[] = [
    { value: '', label: t('form.pickDepartment') },
    ...departments.map(d => ({ value: d.id, label: d.name })),
  ]

  return (
    <SectionCard noHeader>
      <div className="space-y-4">
        {/* Submit error banner */}
        {submitError && (
          <p role="alert" className="text-[12px] text-[#FDA4AF] px-1">
            {submitError}
          </p>
        )}

        {/* UID — create mode only */}
        {mode === 'create' && (
          <div>
            <label htmlFor="emp-uid" className={LABEL_CLS}>
              {t('form.uid')}
            </label>
            <Input
              id="emp-uid"
              value={uid}
              onChange={setUid}
              mono
            />
            <p className="mt-1 text-[11px] text-text-subtle">{t('form.uidHint')}</p>
            {uidErr && <p className={ERROR_CLS}>{uidErr}</p>}
          </div>
        )}

        {/* First + Last name row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="emp-first" className={LABEL_CLS}>
              {t('form.firstName')}
            </label>
            <Input
              id="emp-first"
              value={firstName}
              onChange={setFirstName}
            />
            {firstNameErr && <p className={ERROR_CLS}>{firstNameErr}</p>}
          </div>
          <div>
            <label htmlFor="emp-last" className={LABEL_CLS}>
              {t('form.lastName')}
            </label>
            <Input
              id="emp-last"
              value={lastName}
              onChange={setLastName}
            />
            {lastNameErr && <p className={ERROR_CLS}>{lastNameErr}</p>}
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="emp-email" className={LABEL_CLS}>
            {t('form.email')}
          </label>
          <input
            id="emp-email"
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr(null) }}
            onBlur={validateEmailOnBlur}
            className="w-full h-9 px-3 text-sm bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-[rgba(249,115,22,0.40)] transition-all duration-150"
          />
          {emailErr && <p className={ERROR_CLS}>{emailErr}</p>}
        </div>

        {/* Position */}
        <div>
          <label htmlFor="emp-position" className={LABEL_CLS}>
            {t('form.position')}
          </label>
          <Input
            id="emp-position"
            value={position}
            onChange={setPosition}
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="emp-phone" className={LABEL_CLS}>
            {t('form.phone')}
          </label>
          <Input
            id="emp-phone"
            value={phone}
            onChange={setPhone}
            placeholder="099 12 34 56"
            mono
          />
        </div>

        {/* Branch + Department row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="emp-branch" className={LABEL_CLS}>
              {t('form.branch')}
            </label>
            <Select
              id="emp-branch"
              value={branchId}
              onChange={setBranchId}
              options={branchOptions}
            />
          </div>
          <div>
            <label htmlFor="emp-dept" className={LABEL_CLS}>
              {t('form.department')}
            </label>
            <Select
              id="emp-dept"
              value={departmentId}
              onChange={setDepartmentId}
              options={deptOptions}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <Btn
            variant="primary"
            size="md"
            disabled={submitting}
            onClick={handleSubmit}
            type="button"
          >
            {submitting && <Icon name="loader-circle" size={13} className="animate-spin" />}
            {t('form.save')}
          </Btn>
          <Btn variant="ghost" size="md" type="button" onClick={onCancel} disabled={submitting}>
            {t('form.cancel')}
          </Btn>
        </div>
      </div>
    </SectionCard>
  )
}
