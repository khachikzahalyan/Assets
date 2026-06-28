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
      {/* Row 1: Search (full-width) */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none">
          <Icon name="search" size={13} />
        </span>
        <input
          type="search"
          value={query.search}
          onChange={e => onChange({ search: e.target.value })}
          placeholder={t('search')}
          aria-label={t('search')}
          className="w-full h-9 pl-8 pr-3 text-sm bg-bg border border-border rounded-lg text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-[rgba(249,115,22,0.40)] transition-all duration-150"
        />
      </div>

      {/* Row 2: Entity + Action selects (side by side on mobile too) */}
      <div className="grid grid-cols-2 max-md:grid-cols-2 gap-2">
        <Select
          value={query.entityType}
          onChange={v => onChange({ entityType: v as AuditLogQuery['entityType'] })}
          options={entityOptions}
        />
        <Select
          value={query.action}
          onChange={v => onChange({ action: v as AuditLogQuery['action'] })}
          options={actionOptions}
        />
      </div>

      {/* Row 3: Actor (full-width) */}
      <div>
        <Select
          value={query.actorUid}
          onChange={v => onChange({ actorUid: v })}
          options={actorOptions}
        />
      </div>

      {/* Row 4: Date range (side by side on mobile) + reset */}
      <div className="flex items-center gap-2 flex-wrap max-md:flex-nowrap">
        <label className="flex items-center gap-2 text-[12px] text-text-tertiary flex-1 min-w-0">
          {t('filters.from')}
          <input
            type="date"
            value={fromDateInput}
            onChange={e =>
              onChange({ fromDate: e.target.value ? `${e.target.value}T00:00:00.000Z` : null })
            }
            aria-label={t('filters.from')}
            className="h-9 px-2 text-sm bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent transition-all duration-150 flex-1 min-w-0"
          />
        </label>

        <label className="flex items-center gap-2 text-[12px] text-text-tertiary flex-1 min-w-0">
          {t('filters.to')}
          <input
            type="date"
            value={toDateInput}
            onChange={e =>
              onChange({ toDate: e.target.value ? `${e.target.value}T23:59:59.999Z` : null })
            }
            aria-label={t('filters.to')}
            className="h-9 px-2 text-sm bg-bg border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent transition-all duration-150 flex-1 min-w-0"
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
            <span className="max-md:hidden">{t('filters.reset')}</span>
          </Btn>
        )}
      </div>
    </div>
  )
}
