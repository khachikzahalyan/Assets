import { useTranslation } from 'react-i18next'
import { SelectMini, Icon } from '@/components/ui'
import type { AssetListQuery, AssetSort } from '@/domain/asset'
import type { AssetReferenceData } from '@/domain/asset/AssetRepository'
import type { SelectMiniOption } from '@/components/ui/SelectMini'
import { ViewPopover } from './ViewPopover'
import type { ViewSortOption } from './ViewPopover'

export interface AssetsFilterBarProps {
  query: AssetListQuery
  onChange: (patch: Partial<AssetListQuery>) => void
  ref: AssetReferenceData
  // Temp toggle
  showTemp?: boolean
  onToggleTemp?: () => void
  tempCount?: number
  // Full reset (resets filters + temp in one shot from the page)
  onReset?: () => void
}

const STATUS_DOT_COLORS: Record<string, string> = {
  st_warehouse: '#38BDF8',
  st_assigned:  '#10B981',
  st_repair:    '#F59E0B',
  st_disposed:  '#F43F5E',
}

const DEFAULT_QUERY_STATUS  = 'all'
const DEFAULT_QUERY_BRANCH  = 'all'
const DEFAULT_SORT          = 'updated_desc'

function isDirty(query: AssetListQuery, showTemp: boolean): boolean {
  return (
    (query.statusId ?? 'all') !== DEFAULT_QUERY_STATUS ||
    (query.branchId ?? 'all') !== DEFAULT_QUERY_BRANCH ||
    (query.sort ?? 'updated_desc') !== DEFAULT_SORT ||
    showTemp === true
  )
}

export function AssetsFilterBar({
  query,
  onChange,
  ref: refData,
  showTemp = false,
  onToggleTemp,
  tempCount = 0,
  onReset,
}: AssetsFilterBarProps) {
  const { t } = useTranslation('assets')

  // ── Status options (colored dots) ─────────────────────────────────────────
  const statusOptions: SelectMiniOption[] = [
    { value: 'all', label: t('filters.allStatuses') },
    ...refData.statuses.map(s => {
      const dot = STATUS_DOT_COLORS[s.id]
      return { value: s.id, label: s.name, ...(dot ? { dotColor: dot } : {}) }
    }),
  ]

  // ── Branch options (per-branch icon+color) ────────────────────────────────
  const branchOptions: SelectMiniOption[] = [
    { value: 'all', label: t('filters.allBranches') },
    ...refData.branches.map(b => ({
      value: b.id,
      label: b.name,
      icon:      b.id === 'br_main' ? 'landmark' : 'building',
      iconColor: b.id === 'br_main' ? '#10B981'  : '#38BDF8',
    })),
  ]

  // ── Sort / view options ───────────────────────────────────────────────────
  const sortOptions: ViewSortOption[] = [
    {
      value: 'updated_desc',
      label: t('sort.updated_desc'),
      shortLabel: t('sort.short.updated_desc'),
      hint: t('sort.hint.updated'),
      icon: 'arrow-down-narrow-wide',
      iconColor: '#10B981',
    },
    {
      value: 'updated_asc',
      label: t('sort.updated_asc'),
      shortLabel: t('sort.short.updated_asc'),
      hint: t('sort.hint.updated'),
      icon: 'arrow-up-narrow-wide',
      iconColor: '#94A3B8',
    },
    {
      value: 'name_asc',
      label: t('sort.name_asc'),
      shortLabel: t('sort.short.name_asc'),
      hint: t('sort.hint.alpha'),
      icon: 'arrow-down-a-z',
      iconColor: '#A78BFA',
    },
    {
      value: 'name_desc',
      label: t('sort.name_desc'),
      shortLabel: t('sort.short.name_desc'),
      hint: t('sort.hint.alpha'),
      icon: 'arrow-down-z-a',
      iconColor: '#F472B6',
    },
    {
      value: 'inv_asc',
      label: t('sort.inv_asc'),
      shortLabel: t('sort.short.inv_asc'),
      hint: t('sort.hint.inv'),
      icon: 'hash',
      iconColor: '#38BDF8',
    },
  ]

  const dirty = isDirty(query, showTemp)

  function handleReset() {
    if (onReset) {
      onReset()
    } else {
      onChange({
        statusId: 'all',
        branchId: 'all',
        sort: 'updated_desc',
      })
      if (showTemp && onToggleTemp) onToggleTemp()
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-5 py-2 max-md:flex-nowrap max-md:overflow-x-auto max-md:gap-[6px] max-md:px-3 max-md:py-2 no-scrollbar max-md:scroll-fade-x">
      {/* Status */}
      <SelectMini
        id="assets-status"
        label={t('filters.status')}
        leadingIcon="circle-dot"
        value={query.statusId ?? 'all'}
        onChange={v => onChange({ statusId: v })}
        options={statusOptions}
      />

      {/* Branch */}
      <SelectMini
        id="assets-branch"
        label={t('filters.branch')}
        leadingIcon="building"
        value={query.branchId ?? 'all'}
        onChange={v => onChange({ branchId: v })}
        options={branchOptions}
      />

      {/* View / Sort popover */}
      <ViewPopover
        sort={query.sort ?? 'updated_desc'}
        onChangeSort={v => onChange({ sort: v as AssetSort })}
        options={sortOptions}
        defaultSort="updated_desc"
        viewLabel={t('sort.view')}
        title={t('sort.viewTitle')}
        subtitle={t('sort.viewSubtitle')}
      />

      {/* Temp toggle */}
      <button
        type="button"
        onClick={onToggleTemp}
        className={[
          'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[13px] font-semibold tracking-tight transition-all duration-150 shrink-0',
          'max-md:h-[30px] max-md:px-[10px] max-md:text-[12px]',
          showTemp
            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/25 ring-1 ring-emerald-700/15'
            : 'bg-surface text-text-primary border border-border hover:border-border-strong hover:bg-bg',
        ].join(' ')}
        aria-pressed={showTemp}
      >
        <Icon
          name="clock"
          size={13}
          className={showTemp ? 'text-white' : 'text-text-tertiary'}
        />
        {/* Full label on desktop; short label on mobile (≤767px) */}
        <span className="max-md:hidden">{t('filters.temp')}</span>
        <span className="hidden max-md:inline">{t('filters.tempShort')}</span>
        <span
          aria-hidden="true"
          className={[
            'tabular-nums text-[13px]',
            showTemp ? 'text-emerald-100' : 'text-text-subtle',
          ].join(' ')}
        >
          {tempCount}
        </span>
      </button>

      {/* Reset — pushed to the far right (ml-auto on desktop, shrink-0 on mobile) */}
      {dirty && (
        <button
          type="button"
          onClick={handleReset}
          className="ml-auto inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[13px] font-semibold text-text-primary hover:text-text-primary hover:bg-surface-2 transition-colors duration-150 max-md:shrink-0 max-md:ml-0 max-md:h-[30px] max-md:px-[8px] max-md:text-[12px]"
        >
          <Icon name="x" size={12} />
          {t('filters.reset')}
        </button>
      )}
    </div>
  )
}
