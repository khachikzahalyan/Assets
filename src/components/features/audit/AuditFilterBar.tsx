import { useTranslation } from 'react-i18next'
import { Select, Icon, Btn } from '@/components/ui'
import type { SelectOption } from '@/components/ui/select'
import type { AuditLogQuery, AuditLogReferenceData } from '@/domain/audit'
import { AUDIT_ACTIONS } from '@/domain/audit'

const ENTITY_TYPES = [
  'asset', 'assignment', 'upgrade', 'license', 'employee', 'user',
  'branch', 'department', 'category', 'asset_status',
] as const

export interface AuditFilterBarProps {
  query: AuditLogQuery
  onChange: (patch: Partial<AuditLogQuery>) => void
  ref: AuditLogReferenceData
}

function isDirty(q: AuditLogQuery): boolean {
  return (
    q.entityType !== 'all' ||
    q.action !== 'all' ||
    q.actorUid !== 'all' ||
    q.fromDate != null ||
    q.toDate != null ||
    q.search.trim() !== ''
  )
}

export function AuditFilterBar({ query, onChange, ref: refData }: AuditFilterBarProps) {
  const { t } = useTranslation('audit')

  const entityOptions: SelectOption[] = [
    { value: 'all', label: t('filters.allEntities') },
    ...ENTITY_TYPES.map(e => ({ value: e, label: t(`entity.${e}`) })),
  ]

  const actionOptions: SelectOption[] = [
    { value: 'all', label: t('filters.allActions') },
    ...AUDIT_ACTIONS.map(a => ({ value: a, label: t(`action.${a}`) })),
  ]

  const actorOptions: SelectOption[] = [
    { value: 'all', label: t('filters.allActors') },
    ...refData.actors.map(a => ({ value: a.uid, label: a.displayName ?? a.uid })),
  ]

  // <input type="date"> uses YYYY-MM-DD; convert to/from ISO bounds.
  const fromDateInput = query.fromDate ? query.fromDate.slice(0, 10) : ''
  const toDateInput = query.toDate ? query.toDate.slice(0, 10) : ''

  const dirty = isDirty(query)

  return (
    <div className="flex flex-col gap-3">
      {/* Search + selects row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none">
            <Icon name="search" size={13} />
          </span>
          <input
            type="search"
            value={query.search}
            onChange={e => onChange({ search: e.target.value })}
            placeholder={t('search')}
            aria-label={t('search')}
            className="w-full h-9 pl-8 pr-3 text-sm bg-[#111315] border border-[#2A2F36] rounded-lg text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[rgba(249,115,22,0.40)] transition-all duration-150"
          />
        </div>

        {/* Entity type */}
        <div className="w-44">
          <Select
            value={query.entityType}
            onChange={v => onChange({ entityType: v as AuditLogQuery['entityType'] })}
            options={entityOptions}
          />
        </div>

        {/* Action */}
        <div className="w-44">
          <Select
            value={query.action}
            onChange={v => onChange({ action: v as AuditLogQuery['action'] })}
            options={actionOptions}
          />
        </div>

        {/* Actor */}
        <div className="w-44">
          <Select
            value={query.actorUid}
            onChange={v => onChange({ actorUid: v })}
            options={actorOptions}
          />
        </div>
      </div>

      {/* Date range + reset row */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-2 text-[12px] text-[#94A3B8]">
          {t('filters.from')}
          <input
            type="date"
            value={fromDateInput}
            onChange={e =>
              onChange({ fromDate: e.target.value ? `${e.target.value}T00:00:00.000Z` : null })
            }
            aria-label={t('filters.from')}
            className="h-9 px-2 text-sm bg-[#111315] border border-[#2A2F36] rounded-lg text-[#F8FAFC] focus:outline-none focus:border-[#F97316] transition-all duration-150"
          />
        </label>

        <label className="flex items-center gap-2 text-[12px] text-[#94A3B8]">
          {t('filters.to')}
          <input
            type="date"
            value={toDateInput}
            onChange={e =>
              onChange({ toDate: e.target.value ? `${e.target.value}T23:59:59.999Z` : null })
            }
            aria-label={t('filters.to')}
            className="h-9 px-2 text-sm bg-[#111315] border border-[#2A2F36] rounded-lg text-[#F8FAFC] focus:outline-none focus:border-[#F97316] transition-all duration-150"
          />
        </label>

        {/* Reset — shown only when filters are dirty */}
        {dirty && (
          <Btn
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                entityType: 'all',
                action: 'all',
                actorUid: 'all',
                fromDate: null,
                toDate: null,
                search: '',
              })
            }
          >
            <Icon name="x" size={13} />
            {t('filters.reset')}
          </Btn>
        )}
      </div>
    </div>
  )
}
