import { useTranslation } from 'react-i18next'
import { Select, Icon, Btn } from '@/components/ui'
import type { EmployeeListQuery } from '@/domain/employee'
import type { RefRow } from '@/domain/asset'
import type { SelectOption } from '@/components/ui/select'

export interface EmployeesFilterBarProps {
  query: EmployeeListQuery
  onChange: (patch: Partial<EmployeeListQuery>) => void
  branches: RefRow[]
  departments: RefRow[]
}

const DEFAULT_QUERY: Required<EmployeeListQuery> = {
  status: 'all',
  branchId: 'all',
  departmentId: 'all',
  search: '',
}

function isDirty(query: EmployeeListQuery): boolean {
  return (
    (query.status ?? 'all') !== DEFAULT_QUERY.status ||
    (query.branchId ?? 'all') !== DEFAULT_QUERY.branchId ||
    (query.departmentId ?? 'all') !== DEFAULT_QUERY.departmentId ||
    (query.search ?? '') !== DEFAULT_QUERY.search
  )
}

export function EmployeesFilterBar({ query, onChange, branches, departments }: EmployeesFilterBarProps) {
  const { t } = useTranslation('employees')

  const statusOptions: SelectOption[] = [
    { value: 'all', label: t('filter.all') },
    { value: 'active',     label: t('status.active') },
    { value: 'terminated', label: t('status.terminated') },
  ]

  const branchOptions: SelectOption[] = [
    { value: 'all', label: t('filter.all') },
    ...branches.map(b => ({ value: b.id, label: b.name })),
  ]

  const deptOptions: SelectOption[] = [
    { value: 'all', label: t('filter.all') },
    ...departments.map(d => ({ value: d.id, label: d.name })),
  ]

  const dirty = isDirty(query)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none">
          <Icon name="search" size={13} />
        </span>
        <input
          id="employees-search"
          type="search"
          value={query.search ?? ''}
          onChange={e => onChange({ search: e.target.value })}
          placeholder={t('filter.search')}
          className="w-full h-9 pl-8 pr-3 text-sm bg-[#111315] border border-[#2A2F36] rounded-lg text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[rgba(249,115,22,0.40)] transition-all duration-150"
          aria-label={t('filter.search')}
        />
      </div>

      {/* Status */}
      <div className="w-40">
        <Select
          value={query.status ?? 'all'}
          onChange={v => {
            const s = v === 'all' || v === 'active' || v === 'terminated' ? v : 'all'
            onChange({ status: s })
          }}
          options={statusOptions}
        />
      </div>

      {/* Branch */}
      <div className="w-40">
        <Select
          value={query.branchId ?? 'all'}
          onChange={v => onChange({ branchId: v })}
          options={branchOptions}
        />
      </div>

      {/* Department */}
      <div className="w-44">
        <Select
          value={query.departmentId ?? 'all'}
          onChange={v => onChange({ departmentId: v })}
          options={deptOptions}
        />
      </div>

      {/* Reset */}
      {dirty && (
        <Btn
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              status: 'all',
              branchId: 'all',
              departmentId: 'all',
              search: '',
            })
          }
        >
          <Icon name="x" size={13} />
          {t('filter.all')}
        </Btn>
      )}
    </div>
  )
}
