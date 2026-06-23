import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Icon, Select, Input } from '@/components/ui'
import type { EmployeeRow, RefRow } from '@/domain/asset'
import { validateActFile } from '@/infra/storage'

export interface AssignmentSubmit {
  mode: 'employee' | 'branch'
  employeeId?: string
  branchId?: string
  comment: string | null
  file: File | null
}

export interface AssignmentFormProps {
  employees: EmployeeRow[]
  branches: RefRow[]
  busy?: boolean
  onSubmit: (v: AssignmentSubmit) => void
  onCancel: () => void
}

export function AssignmentForm({ employees, branches, busy, onSubmit, onCancel }: AssignmentFormProps) {
  const { t } = useTranslation('assets')
  const [mode, setMode] = useState<'employee' | 'branch'>('employee')
  const [employeeId, setEmployeeId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [comment, setComment] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const employeeOptions = employees.map(e => ({
    value: e.id,
    label: [e.firstName, e.lastName].filter(Boolean).join(' '),
  }))
  const branchOptions = branches.map(b => ({ value: b.id, label: b.name }))

  const canSubmit = (mode === 'employee' ? !!employeeId : !!branchId) && !fileError && !busy

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    if (f) {
      const err = validateActFile(f)
      if (err === 'too-large') { setFileError(t('assign.fileTooLarge')); setFile(null); return }
      if (err === 'bad-type') { setFileError(t('assign.fileBadType')); setFile(null); return }
    }
    setFileError(null)
    setFile(f)
  }

  function handleSubmit() {
    const v: AssignmentSubmit = { mode, comment: comment || null, file }
    if (mode === 'employee') v.employeeId = employeeId
    if (mode === 'branch') v.branchId = branchId
    onSubmit(v)
  }

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex flex-wrap gap-2">
        <Btn
          type="button"
          size="sm"
          variant={mode === 'employee' ? 'primary' : 'secondary'}
          onClick={() => { setMode('employee'); setEmployeeId('') }}
        >
          {t('assign.employee')}
        </Btn>
        <Btn
          type="button"
          size="sm"
          variant={mode === 'branch' ? 'primary' : 'secondary'}
          onClick={() => { setMode('branch'); setBranchId('') }}
        >
          {t('assign.branch')}
        </Btn>
      </div>

      {/* Recipient select */}
      {mode === 'employee'
        ? (
          <Select
            value={employeeId}
            onChange={setEmployeeId}
            options={employeeOptions}
            placeholder={t('assign.pickEmployee')}
          />
        )
        : (
          <Select
            value={branchId}
            onChange={setBranchId}
            options={branchOptions}
            placeholder={t('assign.pickBranch')}
          />
        )}

      {/* Comment */}
      <div>
        <label
          htmlFor="assign-comment"
          className="block mb-1 text-[11px] uppercase tracking-[0.06em] font-semibold text-text-subtle"
        >
          {t('assign.comment')}
        </label>
        <Input
          id="assign-comment"
          value={comment}
          onChange={setComment}
          placeholder={t('assign.commentPlaceholder')}
        />
      </div>

      {/* Act scan file input */}
      <div>
        <label
          htmlFor="assign-act-scan"
          className="block mb-1 text-[11px] uppercase tracking-[0.06em] font-semibold text-text-subtle"
        >
          {t('assign.actScan')}
        </label>
        <input
          id="assign-act-scan"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={onFile}
          className="block w-full text-[12px] text-text-tertiary file:mr-3 file:rounded-md file:border-0 file:bg-[#27272A] file:px-3 file:py-1.5 file:text-text-primary max-md:file:py-3 max-md:py-2"
        />
        <p className="mt-1 text-[11px] text-text-subtle">{t('assign.actScanHint')}</p>
        {fileError && (
          <p role="alert" className="mt-1 text-[12px] text-[#FDA4AF]">{fileError}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Btn
          variant="primary"
          size="sm"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {busy
            ? <Icon name="loader-circle" size={13} className="animate-spin" />
            : <Icon name="user-check" size={13} />}
          {t('assign.submit')}
        </Btn>
        <Btn variant="ghost" size="sm" onClick={onCancel} disabled={busy === true}>
          {t('assign.cancel')}
        </Btn>
      </div>
    </div>
  )
}
