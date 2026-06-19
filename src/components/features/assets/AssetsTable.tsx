import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip, Icon, IconBtn } from '@/components/ui'
import type { Asset } from '@/domain/asset'
import type { AssetReferenceData } from '@/domain/asset/AssetRepository'
import type { ChipColor } from '@/components/ui/chip'
import { assetTitle, relativeBucket, assigneeKind } from './assetFormat'

export interface AssetsTableProps {
  rows: Asset[]
  ref: AssetReferenceData
  canMutate: boolean
  onRowClick?: (a: Asset) => void
}

export function AssetsTable({ rows, ref: refData, canMutate, onRowClick }: AssetsTableProps) {
  const { t } = useTranslation('assets')

  // FIX 6: memoize lookup Maps — rebuilt only when refData reference changes,
  // not on every pagination render (rows change, ref stable).
  const { statusMap, branchMap, deptMap, categoryMap, employeeMap } = useMemo(
    () => ({
      statusMap:   new Map(refData.statuses.map(s => [s.id, s])),
      branchMap:   new Map(refData.branches.map(b => [b.id, b.name])),
      deptMap:     new Map(refData.departments.map(d => [d.id, d.name])),
      categoryMap: new Map(refData.categories.map(c => [c.id, c])),
      employeeMap: new Map(refData.employees.map(e => [e.id, e])),
    }),
    [refData],
  )

  function resolveAssignee(a: Asset): string {
    const kind = assigneeKind(a)
    if (kind === 'warehouse') return t('assignee.warehouse')
    if (kind === 'none') return t('assignee.none')
    if (kind === 'employee' && a.assignment?.employeeId) {
      const emp = employeeMap.get(a.assignment.employeeId)
      if (emp) {
        const parts = [emp.lastName, emp.firstName].filter(Boolean)
        return parts.join(' ') || t('assignee.none')
      }
    }
    if (kind === 'department' && a.assignment?.departmentId) {
      return deptMap.get(a.assignment.departmentId) ?? t('assignee.none')
    }
    if (kind === 'branch' && a.assignment?.branchId) {
      return branchMap.get(a.assignment.branchId) ?? t('assignee.none')
    }
    return t('assignee.none')
  }

  function assigneeIcon(a: Asset): string | null {
    const kind = assigneeKind(a)
    if (kind === 'warehouse') return 'inbox'
    if (kind === 'none') return null
    if (kind === 'employee') return 'user'
    if (kind === 'department') return 'network'
    if (kind === 'branch') return 'building'
    return null
  }

  // FIX 2: translate a RelTimeBucket using i18n keys
  function formatRelTime(iso: string): string {
    const bucket = relativeBucket(iso)
    if (bucket.unit === 'now') return t('relTime.now')
    const keyMap = { min: 'relTime.minAgo', hour: 'relTime.hourAgo', day: 'relTime.dayAgo' } as const
    return t(keyMap[bucket.unit], { n: bucket.n })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[#2A2F36]">
            <th
              scope="col"
              className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B] whitespace-nowrap"
            >
              {t('cols.asset')}
            </th>
            <th
              scope="col"
              className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B] whitespace-nowrap"
            >
              {t('cols.code')}
            </th>
            <th
              scope="col"
              className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B] whitespace-nowrap"
            >
              {t('cols.status')}
            </th>
            <th
              scope="col"
              className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B] whitespace-nowrap"
            >
              {t('cols.assignee')}
            </th>
            <th
              scope="col"
              className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B] whitespace-nowrap"
            >
              {t('cols.branch')}
            </th>
            <th
              scope="col"
              className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-[#64748B] whitespace-nowrap"
            >
              {t('cols.updated')}
            </th>
            {canMutate && <th scope="col" className="py-2.5 px-4 w-10" aria-label="" />}
          </tr>
        </thead>
        <tbody>
          {rows.map(a => {
            const cat = categoryMap.get(a.categoryId)
            const status = statusMap.get(a.statusId)
            const branchName = branchMap.get(a.branchId) ?? '—'
            const title = assetTitle(a)
            const sub = [cat?.name, a.serial].filter(Boolean).join(' · ')
            const assigneeText = resolveAssignee(a)
            const assigneeIconName = assigneeIcon(a)
            const chipColor = (status?.color ?? 'gray') as ChipColor

            return (
              <tr
                key={a.id}
                onClick={() => onRowClick?.(a)}
                className={[
                  'border-b border-[#2A2F36] transition-colors duration-100',
                  onRowClick ? 'cursor-pointer hover:bg-[#22272E]' : '',
                ].join(' ')}
              >
                {/* Asset column */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-md bg-[#22272E] text-[#94A3B8] inline-flex items-center justify-center flex-shrink-0">
                      <Icon name={cat?.lucideIcon ?? 'package'} size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[#F8FAFC] truncate leading-tight">
                        {title}
                      </div>
                      {sub && (
                        <div className="text-[11.5px] text-[#64748B] truncate leading-tight mt-0.5">
                          {sub}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Inv code column */}
                <td className="py-3 px-4">
                  <span className="font-mono text-[12.5px] text-[#94A3B8] tracking-tight">
                    {a.invCode}
                  </span>
                </td>

                {/* Status column */}
                <td className="py-3 px-4">
                  {status ? (
                    <Chip color={chipColor} dot>
                      {status.name}
                    </Chip>
                  ) : (
                    <span className="text-[#64748B] text-xs">{a.statusId}</span>
                  )}
                </td>

                {/* Assignee column */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5 text-[12.5px] text-[#94A3B8]">
                    {assigneeIconName && (
                      <Icon name={assigneeIconName} size={13} className="text-[#64748B] flex-shrink-0" />
                    )}
                    <span>{assigneeText}</span>
                  </div>
                </td>

                {/* Branch column */}
                <td className="py-3 px-4">
                  <span className="text-[12.5px] text-[#94A3B8]">{branchName}</span>
                </td>

                {/* Updated column */}
                <td className="py-3 px-4">
                  <span className="text-[12px] text-[#64748B]">
                    {formatRelTime(a.updatedAt)}
                  </span>
                </td>

                {/* Edit affordance — FIX 1: title via t('actions.edit') */}
                {canMutate && (
                  <td
                    className="py-3 px-4"
                    onClick={ev => ev.stopPropagation()}
                  >
                    <IconBtn
                      icon="settings"
                      size="sm"
                      title={t('actions.edit')}
                      onClick={() => {
                        console.info('[AssetsTable] edit stub for', a.id)
                      }}
                    />
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
