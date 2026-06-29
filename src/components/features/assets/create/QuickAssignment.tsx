import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui'
import { SearchSelect } from './SearchSelect'
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
  /** Whether the chosen category supports a work-mode (laptops only). */
  isLaptop?: boolean
  /** Whether the chosen category is a network device (gates modes to warehouse+employee). */
  isNetwork?: boolean
}

const MODE_BUTTONS: { id: Exclude<QAPicked, null>; key: string; icon: string }[] = [
  { id: 'warehouse', key: 'qa.warehouse', icon: 'warehouse' },
  { id: 'employee', key: 'qa.employee', icon: 'user' },
  { id: 'branch', key: 'qa.branch', icon: 'map-pin' },
  { id: 'department', key: 'qa.department', icon: 'users' },
]

/** Per-mode active color tokens: chip outline + icon box. */
const MODE_COLOR: Record<Exclude<QAPicked, null>, { chip: string; iconBox: string }> = {
  warehouse: { chip: 'bg-accent/[0.12] border-accent ring-1 ring-accent/15', iconBox: 'bg-accent text-white' },
  employee:  { chip: 'bg-info/[0.12] border-info ring-1 ring-info/15',       iconBox: 'bg-info text-white' },
  branch:    { chip: 'bg-success/[0.12] border-success ring-1 ring-success/15', iconBox: 'bg-success text-white' },
  department: { chip: 'bg-violet-500/[0.12] border-violet-500 ring-1 ring-violet-500/15', iconBox: 'bg-violet-500 text-white' },
}

export function QuickAssignment({
  value, onChange, employees, departments, branches, mainBranchId, statuses, isLaptop = false, isNetwork = false,
}: QuickAssignmentProps) {
  const { t } = useTranslation('assets')
  const { picked, assignment } = value

  const visibleModes = isNetwork ? MODE_BUTTONS.filter(m => m.id === 'warehouse' || m.id === 'employee') : MODE_BUTTONS

  function pick(mode: Exclude<QAPicked, null>) {
    if (mode === 'warehouse') { onChange({ picked: 'warehouse', assignment: null }); return }
    const needsWorkMode = (mode === 'employee' || mode === 'department') && isLaptop
    const base: AssetAssignment = { mode }
    if (needsWorkMode) base.workMode = 'office'
    onChange({ picked: mode, assignment: base })
  }

  function setEmployee(employeeId: string) {
    const next: AssetAssignment = { mode: 'employee', employeeId }
    if (isLaptop) next.workMode = (assignment?.workMode ?? 'office')
    onChange({ picked: 'employee', assignment: next })
  }
  function setDepartment(departmentId: string) {
    const next: AssetAssignment = { mode: 'department', departmentId }
    if (isLaptop) next.workMode = (assignment?.workMode ?? 'office')
    onChange({ picked: 'department', assignment: next })
  }
  function setBranch(branchId: string) {
    onChange({ picked: 'branch', assignment: { mode: 'branch', branchId } })
  }
  function setWorkMode(workMode: 'office' | 'remote') {
    if (!assignment) return
    onChange({ picked, assignment: { ...assignment, workMode } })
  }

  // Snap-back: network device cannot be on branch/department.
  useEffect(() => {
    if (isNetwork && (picked === 'branch' || picked === 'department')) pick('warehouse')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNetwork])

  // Snap-back: non-laptop never carries a workMode.
  useEffect(() => {
    if (!isLaptop && assignment?.workMode != null) {
      onChange({ picked, assignment: { ...assignment, workMode: null } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLaptop])

  const warehouseName = statuses.find(s => s.id === 'st_warehouse')?.name ?? 'На складе'
  // Warehouse always lives at the Head Office by default (br_main) — show that branch
  // with its own icon/colour (landmark / emerald), not the first branch in the list.
  const headBranch = branches.find(b => b.id === mainBranchId) ?? null
  const showWorkMode = isLaptop && (picked === 'employee' || picked === 'department')

  const employeeOptions = employees.map(e => ({ value: e.id, label: [e.firstName, e.lastName].filter(Boolean).join(' ') || e.email || e.id }))
  const departmentOptions = departments.map(d => ({ value: d.id, label: d.name }))
  const branchOptions = branches.map(b => ({ value: b.id, label: b.name }))

  return (
    <div className="space-y-3">
      <div className={`grid ${visibleModes.length === 2 ? 'grid-cols-2' : 'grid-cols-4 max-md:grid-cols-2'} gap-1.5`}>
        {visibleModes.map(b => {
          const active = picked === b.id
          const color = MODE_COLOR[b.id]
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => pick(b.id)}
              aria-pressed={active}
              className={`group flex flex-col items-center justify-center gap-1.5 py-2.5 px-1.5 rounded-lg border transition-all duration-150 text-[13px] font-semibold tracking-tight
                ${active
                  ? color.chip
                  : 'bg-surface border-border text-text-primary hover:border-border-strong hover:bg-surface-2'}`}
            >
              <div className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${active ? color.iconBox : 'bg-surface-2 text-text-primary group-hover:bg-border'}`}>
                <Icon name={b.icon} size={14} />
              </div>
              <span>{t(b.key)}</span>
            </button>
          )
        })}
      </div>

      {picked === 'employee' && (
        <SearchSelect
          options={employeeOptions}
          value={assignment?.employeeId ?? ''}
          onChange={setEmployee}
          placeholder={t('qa.pickRecipient')}
          searchPlaceholder={t('placeholders.recipientSearch')}
          ariaLabel={t('qa.employee')}
          title={t('qa.employee')}
        />
      )}
      {picked === 'department' && (
        <SearchSelect
          options={departmentOptions}
          value={assignment?.departmentId ?? ''}
          onChange={setDepartment}
          placeholder={t('qa.pickRecipient')}
          searchPlaceholder={t('placeholders.recipientSearch')}
          ariaLabel={t('qa.department')}
          title={t('qa.department')}
        />
      )}
      {picked === 'branch' && (
        <SearchSelect
          options={branchOptions}
          value={assignment?.branchId ?? ''}
          onChange={setBranch}
          placeholder={t('qa.pickRecipient')}
          searchPlaceholder={t('placeholders.recipientSearch')}
          ariaLabel={t('qa.branch')}
          title={t('qa.branch')}
        />
      )}
      {picked === 'warehouse' && (
        <div className="bg-[#111315]/60 border border-[#2A2F36]/70 rounded-lg px-3.5 py-2 text-[14px] text-text-primary flex items-center gap-2 anim-fade-slide-in">
          <Icon name="landmark" size={13} className="text-[#10B981] shrink-0" />
          <span>{t('qa.onShelf')} · <span className="font-medium">{headBranch?.name ?? warehouseName}</span></span>
        </div>
      )}

      {showWorkMode && (
        <div>
          {/* B6: work-mode label font text-[13px] */}
          <div className="text-[13px] uppercase tracking-[0.06em] font-semibold text-text-tertiary mb-1.5">{t('qa.workMode')}</div>
          <div className="inline-flex bg-[#22272E]/80 rounded-lg border border-[#2A2F36]/80 p-1 w-full gap-1">
            <button type="button" onClick={() => setWorkMode('office')} aria-pressed={assignment?.workMode === 'office'}
              className={`flex-1 px-3 py-1.5 text-[14px] font-semibold rounded-md transition-all duration-150 flex items-center justify-center gap-1.5 ${assignment?.workMode === 'office' ? 'bg-surface text-accent-hover ring-1 ring-[#F97316]/40' : 'text-text-primary hover:bg-[#1B1F24]/60'}`}>
              <Icon name="building-2" size={12} />{t('qa.office')}
            </button>
            <button type="button" onClick={() => setWorkMode('remote')} aria-pressed={assignment?.workMode === 'remote'}
              className={`flex-1 px-3 py-1.5 text-[14px] font-semibold rounded-md transition-all duration-150 flex items-center justify-center gap-1.5 ${assignment?.workMode === 'remote' ? 'bg-surface text-sky-300 ring-1 ring-sky-500/30' : 'text-text-primary hover:bg-[#1B1F24]/60'}`}>
              <Icon name="house" size={12} />{t('qa.remote')}
            </button>
          </div>
        </div>
      )}

      {/* B6: derived-status pill removed — prototype QA card has none */}
    </div>
  )
}
