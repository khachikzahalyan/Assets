import { useTranslation } from 'react-i18next'
import { Icon, SelectMini } from '@/components/ui'
import type { SelectMiniOption } from '@/components/ui/SelectMini'
import type { AuditLogQuery, AuditLogReferenceData } from '@/domain/audit'
import { AUDIT_ACTIONS } from '@/domain/audit'
import { DatePicker } from '@/components/features/assets/create/DatePicker'

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

/**
 * Audit filter bar — same strip pattern as EmployeesFilterBar/AssetsFilterBar:
 * Row 1: full-width search. Row 2: SelectMini chips (entity / action / actor)
 * + compact date range; on mobile the row is a single horizontal scroll strip
 * (SelectMini opens a bottom sheet there), desktop wraps and shows Reset.
 */
export function AuditFilterBar({ query, onChange, ref: refData }: AuditFilterBarProps) {
  const { t } = useTranslation('audit')

  const entityOptions: SelectMiniOption[] = [
    { value: 'all', label: t('filters.allEntities') },
    ...ENTITY_TYPES.map(e => ({ value: e, label: t(`entity.${e}`) })),
  ]

  const actionOptions: SelectMiniOption[] = [
    { value: 'all', label: t('filters.allActions') },
    ...AUDIT_ACTIONS.map(a => ({ value: a, label: t(`action.${a}`) })),
  ]

  const actorOptions: SelectMiniOption[] = [
    { value: 'all', label: t('filters.allActors') },
    ...refData.actors.map(a => ({ value: a.uid, label: a.displayName ?? a.uid })),
  ]

  // DatePicker uses YYYY-MM-DD; convert to/from ISO bounds.
  const fromDateInput = query.fromDate ? query.fromDate.slice(0, 10) : ''
  const toDateInput = query.toDate ? query.toDate.slice(0, 10) : ''

  const dirty = isDirty(query)

  return (
    <div className="flex flex-col gap-2">
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

      {/* Row 2: filter strip — wraps on desktop, horizontal scroll on mobile */}
      <div
        className={[
          'flex items-center gap-2 flex-wrap',
          'max-md:flex-nowrap max-md:overflow-x-auto max-md:gap-[6px]',
          'no-scrollbar scroll-fade-x',
        ].join(' ')}
      >
        <SelectMini
          id="audit-filter-entity"
          label={t('col.entity')}
          leadingIcon="box"
          value={query.entityType}
          onChange={v => onChange({ entityType: v as AuditLogQuery['entityType'] })}
          options={entityOptions}
        />
        <SelectMini
          id="audit-filter-action"
          label={t('col.action')}
          leadingIcon="circle-dot"
          value={query.action}
          onChange={v => onChange({ action: v as AuditLogQuery['action'] })}
          options={actionOptions}
        />
        <SelectMini
          id="audit-filter-actor"
          label={t('col.actor')}
          leadingIcon="users"
          value={query.actorUid}
          onChange={v => onChange({ actorUid: v })}
          options={actorOptions}
        />

        {/* From-date — span avoids label→button double-click forwarding; ariaLabel covers a11y */}
        <span className="flex items-center gap-1.5 text-[12px] text-text-tertiary flex-shrink-0">
          {t('filters.from')}
          <div className="w-[128px]">
            <DatePicker
              id="audit-filter-from"
              variant="chip"
              value={fromDateInput}
              {...(toDateInput ? { max: toDateInput } : {})}
              onChange={iso => onChange({ fromDate: iso ? `${iso}T00:00:00.000Z` : null })}
              ariaLabel={t('filters.from')}
              placeholder="дд.мм.гггг"
            />
          </div>
        </span>

        {/* To-date */}
        <span className="flex items-center gap-1.5 text-[12px] text-text-tertiary flex-shrink-0">
          {t('filters.to')}
          <div className="w-[128px]">
            <DatePicker
              id="audit-filter-to"
              variant="chip"
              value={toDateInput}
              {...(fromDateInput ? { min: fromDateInput } : {})}
              onChange={iso => onChange({ toDate: iso ? `${iso}T23:59:59.999Z` : null })}
              ariaLabel={t('filters.to')}
              placeholder="дд.мм.гггг"
            />
          </div>
        </span>

        {/* Reset — shown only when filters are dirty */}
        {dirty && (
          <button
            type="button"
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
            aria-label={t('filters.reset')}
            className="ml-auto inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[13px] font-semibold text-text-primary hover:bg-surface-2 flex-shrink-0"
          >
            <Icon name="x" size={12} />
            <span className="max-md:hidden">{t('filters.reset')}</span>
          </button>
        )}
      </div>
    </div>
  )
}
