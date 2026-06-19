import { useTranslation } from 'react-i18next'
import { SectionCard, Chip, EmptyState, Btn, Icon } from '@/components/ui'
import type { Assignment } from '@/domain/assignment'
import type { AssetReferenceData } from '@/domain/asset'

export interface AssignmentHistoryProps {
  assignments: Assignment[]
  /** Reference data for resolving employee and branch names. */
  refData?: AssetReferenceData
  onViewScan?: (path: string) => void
}

function recipientName(a: Assignment, refData?: AssetReferenceData): string {
  if (a.mode === 'employee') {
    const e = refData?.employees.find(x => x.id === a.assignedToEmployeeId)
    return e ? [e.firstName, e.lastName].filter(Boolean).join(' ') : (a.assignedToEmployeeId ?? '—')
  }
  const b = refData?.branches.find(x => x.id === a.assignedToBranchId)
  return b ? b.name : (a.assignedToBranchId ?? '—')
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

export function AssignmentHistory({ assignments, refData, onViewScan }: AssignmentHistoryProps) {
  const { t } = useTranslation('assets')

  return (
    <SectionCard title={t('assign.history')} icon="history">
      {assignments.length === 0 ? (
        <EmptyState icon="inbox" title={t('assign.noHistory')} />
      ) : (
        <ul className="space-y-2">
          {assignments.map(a => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-md bg-[#18181B] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-[13px] text-[#F8FAFC] truncate">
                  {recipientName(a, refData)}
                </p>
                <p className="text-[11px] text-[#64748B]">
                  {t(a.mode === 'employee' ? 'assign.employee' : 'assign.branch')}
                  {' · '}
                  {t('assign.started')} {fmt(a.startedAt)}
                  {a.endedAt ? ` · ${t('assign.ended')} ${fmt(a.endedAt)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Chip color={a.endedAt ? 'gray' : 'green'} dot>
                  {t(a.endedAt ? 'assign.ended' : 'assign.active')}
                </Chip>
                {a.actStoragePath && onViewScan && (
                  <Btn variant="ghost" size="sm" onClick={() => onViewScan(a.actStoragePath!)}>
                    <Icon name="file-text" size={13} />
                    {t('assign.viewScan')}
                  </Btn>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
