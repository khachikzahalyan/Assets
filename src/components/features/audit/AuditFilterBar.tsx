import { useTranslation } from 'react-i18next'
import { Icon, SearchInput, SelectMini } from '@/components/ui'
import type { SelectMiniOption } from '@/components/ui/SelectMini'
import type { AuditLogQuery, AuditLogReferenceData } from '@/domain/audit'
import { AUDIT_ACTIONS } from '@/domain/audit'
import { DatePicker } from '@/components/ui'

const ENTITY_TYPES = [
  'asset', 'assignment', 'upgrade', 'license', 'employee', 'user',
  'branch', 'department', 'category', 'asset_status',
] as const

export interface AuditFilterBarProps {
  query: AuditLogQuery
  onChange: (patch: Partial<AuditLogQuery>) => void
  ref: AuditLogReferenceData | null
}

/**
 * Day-boundary helpers — the user picks a LOCAL calendar day, so the query
 * bounds must be that day's start/end in the browser's timezone converted to
 * UTC instants. Appending 'Z' to the picked day (a former bug) shifted the
 * window by the UTC offset: e.g. in UTC+4 a record at 01:00 local fell into
 * the previous day's filter.
 */
function localDayStartIso(day: string): string {
  return new Date(`${day}T00:00:00`).toISOString()
}
function localDayEndIso(day: string): string {
  return new Date(`${day}T23:59:59.999`).toISOString()
}
/** Inverse for display: UTC instant → the LOCAL calendar day it belongs to. */
function isoToLocalDay(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
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
 * Audit filter bar — single DOM tree, responsive via Tailwind breakpoints.
 *
 * Desktop (≥768px): ONE row — search (flex-1, shrinks) + 3 SelectMini chips +
 *   "С [date] По [date]" atomic pair + Reset. The chip strip uses md:contents
 *   so its children become direct flex items of the row; flex-wrap is the
 *   graceful fallback on narrow desktop widths.
 *
 * Mobile (<768px):
 *   Row 1: full-width search.
 *   Row 2: horizontal scroll strip — chips + date pair + Reset in one line.
 *
 * No DOM duplication — a single element tree handles both layouts.
 * The date pair is always wrapped in one flex-shrink-0 container so it
 * never splits across lines.
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
    ...(refData?.actors ?? []).map(a => ({ value: a.uid, label: a.displayName ?? a.uid })),
  ]

  // DatePicker uses YYYY-MM-DD; convert to/from ISO bounds (local-day mapping,
  // NOT slice(0,10) — the stored bound is a UTC instant of a LOCAL midnight).
  const fromDateInput = query.fromDate ? isoToLocalDay(query.fromDate) : ''
  const toDateInput = query.toDate ? isoToLocalDay(query.toDate) : ''

  const dirty = isDirty(query)

  return (
    /* Desktop: one flex-wrap row (everything inline). Mobile: column of
       search row + scroll strip. */
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:flex-wrap">
      {/* Search — flex-1 on desktop so it shrinks to fit everything in one row */}
      <SearchInput
        value={query.search}
        onChange={v => onChange({ search: v })}
        placeholder={t('search')}
        aria-label={t('search')}
        containerClassName="max-md:w-full md:flex-1 md:min-w-[160px]"
      />

      {/* Chips strip — mobile: horizontal scroll line; desktop: md:contents
          flattens the children into the outer row (search + chips + dates + reset
          all become siblings of ONE flex line). */}
      <div
        className={[
          'flex items-center gap-2 md:contents',
          /* Mobile: single non-wrapping horizontal scroll strip */
          'max-md:flex-nowrap max-md:overflow-x-auto max-md:gap-1.5',
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

        {/* Date pair — atomic: never splits С from По; wraps as one unit */}
        <span className="flex items-center gap-2 flex-shrink-0">
          <span className="flex items-center gap-1.5 text-12 text-text-tertiary flex-shrink-0">
            {t('filters.from')}
            <div className="w-[8rem]">
              <DatePicker
                id="audit-filter-from"
                variant="chip"
                value={fromDateInput}
                {...(toDateInput ? { max: toDateInput } : {})}
                onChange={iso => onChange({ fromDate: iso ? localDayStartIso(iso) : null })}
                ariaLabel={t('filters.from')}
                placeholder="дд.мм.гггг"
              />
            </div>
          </span>
          <span className="flex items-center gap-1.5 text-12 text-text-tertiary flex-shrink-0">
            {t('filters.to')}
            <div className="w-[8rem]">
              <DatePicker
                id="audit-filter-to"
                variant="chip"
                value={toDateInput}
                {...(fromDateInput ? { min: fromDateInput } : {})}
                onChange={iso => onChange({ toDate: iso ? localDayEndIso(iso) : null })}
                ariaLabel={t('filters.to')}
                placeholder="дд.мм.гггг"
              />
            </div>
          </span>
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
            className="ml-auto inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-13 font-semibold text-text-primary hover:bg-surface-2 flex-shrink-0"
          >
            <Icon name="x" size={12} />
            <span className="max-md:hidden">{t('filters.reset')}</span>
          </button>
        )}
      </div>
    </div>
  )
}
