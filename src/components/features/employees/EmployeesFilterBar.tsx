import { useTranslation } from 'react-i18next'
import { Icon, SelectMini } from '@/components/ui'
import type { EmployeeListQuery, SortValue } from '@/domain/employee'
import type { RefRow } from '@/domain/asset'
import type { SelectMiniOption } from '@/components/ui/SelectMini'

export interface EmployeesFilterBarProps {
  query: EmployeeListQuery
  onChange: (patch: Partial<EmployeeListQuery>) => void
  branches: RefRow[]
  departments: RefRow[]
  /** Which branch id is the head office. Defaults to branches[0]?.id if omitted. */
  headOfficeBranchId?: string | null
}

const DEFAULT_QUERY: Required<Omit<EmployeeListQuery, 'sort'>> & { sort: SortValue } = {
  status: 'active',
  branchId: 'all',
  departmentId: 'all',
  search: '',
  sort: 'updated_desc',
}

function isDirty(query: EmployeeListQuery): boolean {
  return (
    (query.status ?? 'active') !== DEFAULT_QUERY.status ||
    (query.branchId ?? 'all') !== DEFAULT_QUERY.branchId ||
    (query.departmentId ?? 'all') !== DEFAULT_QUERY.departmentId ||
    (query.search ?? '') !== DEFAULT_QUERY.search ||
    (query.sort ?? 'updated_desc') !== DEFAULT_QUERY.sort
  )
}

export function EmployeesFilterBar({
  query,
  onChange,
  branches,
  departments,
  headOfficeBranchId,
}: EmployeesFilterBarProps) {
  const { t } = useTranslation('employees')

  // Head office id: use prop if provided, else fall back to first branch
  const headId = headOfficeBranchId ?? branches[0]?.id ?? null

  const deptOptions: SelectMiniOption[] = [
    { value: 'all', label: t('filter.all') },
    ...departments.map(d => ({ value: d.id, label: d.name })),
  ]

  const branchOptions: SelectMiniOption[] = [
    { value: 'all', label: t('filter.all') },
    ...branches.map(b => ({
      value: b.id,
      label: b.name,
      icon: b.id === headId ? 'landmark' : 'building',
      iconColor: b.id === headId ? '#10B981' : '#38BDF8',
    })),
  ]

  const statusOptions: SelectMiniOption[] = [
    { value: 'all',        label: t('filter.all') },
    { value: 'active',     label: t('status.active') },
    { value: 'terminated', label: t('status.terminated') },
  ]

  const sortOptions: SelectMiniOption[] = [
    { value: 'updated_desc', label: t('filter.sortUpdatedDesc') },
    { value: 'updated_asc',  label: t('filter.sortUpdatedAsc') },
    { value: 'name_asc',     label: t('filter.sortNameAsc') },
    { value: 'name_desc',    label: t('filter.sortNameDesc') },
    { value: 'dept_asc',     label: t('filter.sortDeptAsc') },
    { value: 'assets_desc',  label: t('filter.sortAssetsDesc') },
  ]

  const dirty = isDirty(query)

  return (
    <div className="flex items-center gap-2 px-4 py-2 flex-wrap max-md:flex-nowrap max-md:overflow-x-auto no-scrollbar scroll-fade-x">
      <SelectMini
        id="emp-filter-dept"
        label={t('filter.department')}
        leadingIcon="users"
        value={query.departmentId ?? 'all'}
        onChange={v => onChange({ departmentId: v })}
        options={deptOptions}
      />
      <SelectMini
        id="emp-filter-branch"
        label={t('filter.branch')}
        leadingIcon="building"
        value={query.branchId ?? 'all'}
        onChange={v => onChange({ branchId: v })}
        options={branchOptions}
      />
      <SelectMini
        id="emp-filter-status"
        label={t('filter.status')}
        leadingIcon="circle-dot"
        value={query.status ?? 'active'}
        onChange={v => {
          const s = v === 'all' || v === 'active' || v === 'terminated' ? v : 'all'
          onChange({ status: s })
        }}
        options={statusOptions}
        defaultValue="active"
      />
      <SelectMini
        id="emp-filter-sort"
        label={t('filter.sort')}
        leadingIcon="list-filter"
        value={query.sort ?? 'updated_desc'}
        onChange={v => onChange({ sort: v as SortValue })}
        options={sortOptions}
        defaultValue="updated_desc"
      />

      {dirty && (
        <button
          type="button"
          onClick={() => onChange({
            status: 'active',
            branchId: 'all',
            departmentId: 'all',
            search: '',
            sort: 'updated_desc',
          })}
          aria-label={t('filter.reset')}
          className="ml-auto inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[14px] font-semibold text-text-primary hover:bg-surface-2"
        >
          <Icon name="x" size={12} />
          {t('filter.reset')}
        </button>
      )}
    </div>
  )
}
