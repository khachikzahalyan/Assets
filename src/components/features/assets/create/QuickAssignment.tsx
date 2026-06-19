import { useTranslation } from 'react-i18next'
import { Btn, Chip, Select } from '@/components/ui'
import type { AssetAssignment, EmployeeRow, StatusRow } from '@/domain/asset'
import type { RefRow } from '@/domain/asset'

export type QAPicked = 'warehouse' | 'employee' | 'department' | 'branch' | null

export interface QAValue {
  picked: QAPicked
  assignment: AssetAssignment | null
}

export interface QuickAssignmentProps {
  value: QAValue
  onChange: (v: QAValue) => void
  employees: EmployeeRow[]
  departments: RefRow[]
  branches: RefRow[]
  mainBranchId: string
  statuses: StatusRow[]
}

export function QuickAssignment({
  value,
  onChange,
  employees,
  departments,
  branches,
  statuses,
}: QuickAssignmentProps) {
  const { t } = useTranslation('assets')

  const { picked, assignment } = value

  function pick(mode: QAPicked) {
    if (mode === 'warehouse') {
      onChange({ picked: 'warehouse', assignment: null })
    } else {
      // Clear sub-selection when switching modes
      onChange({ picked: mode, assignment: null })
    }
  }

  function handleEmployeeChange(employeeId: string) {
    onChange({ picked: 'employee', assignment: { mode: 'employee', employeeId } })
  }

  function handleDepartmentChange(departmentId: string) {
    onChange({ picked: 'department', assignment: { mode: 'department', departmentId } })
  }

  function handleBranchChange(branchId: string) {
    onChange({ picked: 'branch', assignment: { mode: 'branch', branchId } })
  }

  const warehouseStatus = statuses.find(s => s.id === 'st_warehouse')
  const assignedStatus = statuses.find(s => s.id === 'st_assigned')

  const warehouseName = warehouseStatus?.name ?? 'На складе'
  const assignedName = assignedStatus?.name ?? 'Выдано'

  const employeeOptions = employees.map(e => ({
    value: e.id,
    label: [e.firstName, e.lastName].filter(Boolean).join(' '),
  }))

  const departmentOptions = departments.map(d => ({ value: d.id, label: d.name }))
  const branchOptions = branches.map(b => ({ value: b.id, label: b.name }))

  function btnVariant(mode: QAPicked): 'primary' | 'secondary' {
    return picked === mode ? 'primary' : 'secondary'
  }

  return (
    <div className="space-y-3">
      {/* Four toggle buttons */}
      <div className="flex flex-wrap gap-2">
        <Btn
          variant={btnVariant('warehouse')}
          size="sm"
          onClick={() => pick('warehouse')}
          type="button"
        >
          {t('qa.warehouse')}
        </Btn>
        <Btn
          variant={btnVariant('employee')}
          size="sm"
          onClick={() => pick('employee')}
          type="button"
        >
          {t('qa.employee')}
        </Btn>
        <Btn
          variant={btnVariant('department')}
          size="sm"
          onClick={() => pick('department')}
          type="button"
        >
          {t('qa.department')}
        </Btn>
        <Btn
          variant={btnVariant('branch')}
          size="sm"
          onClick={() => pick('branch')}
          type="button"
        >
          {t('qa.branch')}
        </Btn>
      </div>

      {/* Conditional sub-selects */}
      {picked === 'employee' && (
        <Select
          value={(assignment as AssetAssignment & { employeeId?: string })?.employeeId ?? ''}
          onChange={handleEmployeeChange}
          options={employeeOptions}
          placeholder={t('qa.pickRecipient')}
        />
      )}
      {picked === 'department' && (
        <Select
          value={(assignment as AssetAssignment & { departmentId?: string })?.departmentId ?? ''}
          onChange={handleDepartmentChange}
          options={departmentOptions}
          placeholder={t('qa.pickRecipient')}
        />
      )}
      {picked === 'branch' && (
        <Select
          value={(assignment as AssetAssignment & { branchId?: string })?.branchId ?? ''}
          onChange={handleBranchChange}
          options={branchOptions}
          placeholder={t('qa.pickRecipient')}
        />
      )}

      {/* Derived status chip — shown only when a mode is picked */}
      {picked !== null && (
        <div className="pt-1">
          <Chip color={picked === 'warehouse' ? 'gray' : 'green'} dot>
            {t('statusLine.derived', {
              name: picked === 'warehouse' ? warehouseName : assignedName,
            })}
          </Chip>
        </div>
      )}
    </div>
  )
}
