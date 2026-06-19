import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip, Icon } from '@/components/ui'
import type { Employee } from '@/domain/employee'
import type { RefRow } from '@/domain/asset'

export interface EmployeesTableProps {
  rows: Employee[]
  branches: RefRow[]
  departments: RefRow[]
  onRowClick: (e: Employee) => void
}

export function EmployeesTable({ rows, branches, departments, onRowClick }: EmployeesTableProps) {
  const { t } = useTranslation('employees')

  const { branchMap, deptMap } = useMemo(
    () => ({
      branchMap: new Map(branches.map(b => [b.id, b.name])),
      deptMap:   new Map(departments.map(d => [d.id, d.name])),
    }),
    [branches, departments],
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[#2A2F36]">
            <th
              scope="col"
              className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B] whitespace-nowrap"
            >
              {t('form.firstName')} / {t('form.lastName')}
            </th>
            <th
              scope="col"
              className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B] whitespace-nowrap"
            >
              {t('form.position')}
            </th>
            <th
              scope="col"
              className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B] whitespace-nowrap"
            >
              {t('form.branch')}
            </th>
            <th
              scope="col"
              className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B] whitespace-nowrap"
            >
              {t('form.department')}
            </th>
            <th
              scope="col"
              className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B] whitespace-nowrap"
            >
              {t('filter.status')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(e => {
            const fullName = [e.firstName, e.lastName].filter(Boolean).join(' ')
            const branchName = e.branchId ? (branchMap.get(e.branchId) ?? '—') : '—'
            const deptName   = e.departmentId ? (deptMap.get(e.departmentId) ?? '—') : '—'

            return (
              <tr
                key={e.id}
                onClick={() => onRowClick(e)}
                className="border-b border-[#2A2F36] transition-colors duration-100 cursor-pointer hover:bg-[#22272E]"
              >
                {/* Name + email */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-md bg-[#22272E] text-[#94A3B8] inline-flex items-center justify-center flex-shrink-0">
                      <Icon name="user" size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[#F8FAFC] truncate leading-tight">
                        {fullName || '—'}
                      </div>
                      <div className="text-[11.5px] text-[#64748B] truncate leading-tight mt-0.5 font-mono">
                        {e.email}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Position */}
                <td className="py-3 px-4">
                  <span className="text-[12.5px] text-[#94A3B8]">{e.position ?? '—'}</span>
                </td>

                {/* Branch */}
                <td className="py-3 px-4">
                  <span className="text-[12.5px] text-[#94A3B8]">{branchName}</span>
                </td>

                {/* Department */}
                <td className="py-3 px-4">
                  <span className="text-[12.5px] text-[#94A3B8]">{deptName}</span>
                </td>

                {/* Status chip */}
                <td className="py-3 px-4">
                  <Chip color={e.status === 'active' ? 'green' : 'gray'} dot>
                    {t(`status.${e.status}`)}
                  </Chip>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
