import { useTranslation } from 'react-i18next'
import { Select, Icon, Btn } from '@/components/ui'
import type { AssetListQuery, AssetGroupFilter, AssetSort } from '@/domain/asset'
import type { AssetReferenceData } from '@/domain/asset/AssetRepository'
import type { SelectOption } from '@/components/ui/select'

export interface AssetsFilterBarProps {
  query: AssetListQuery
  onChange: (patch: Partial<AssetListQuery>) => void
  ref: AssetReferenceData
}

const GROUP_IDS: AssetGroupFilter[] = ['all', 'devices', 'network', 'furniture']

const DEFAULT_QUERY: Required<AssetListQuery> = {
  group: 'all',
  statusId: 'all',
  branchId: 'all',
  search: '',
  sort: 'updated_desc',
}

function isDirty(query: AssetListQuery): boolean {
  return (
    (query.group ?? 'all') !== DEFAULT_QUERY.group ||
    (query.statusId ?? 'all') !== DEFAULT_QUERY.statusId ||
    (query.branchId ?? 'all') !== DEFAULT_QUERY.branchId ||
    (query.search ?? '') !== DEFAULT_QUERY.search ||
    (query.sort ?? 'updated_desc') !== DEFAULT_QUERY.sort
  )
}

export function AssetsFilterBar({ query, onChange, ref: refData }: AssetsFilterBarProps) {
  const { t } = useTranslation('assets')

  const statusOptions: SelectOption[] = [
    { value: 'all', label: t('filters.allStatuses') },
    ...refData.statuses.map(s => ({ value: s.id, label: s.name })),
  ]

  const branchOptions: SelectOption[] = [
    { value: 'all', label: t('filters.allBranches') },
    ...refData.branches.map(b => ({ value: b.id, label: b.name })),
  ]

  const sortOptions: SelectOption[] = [
    { value: 'updated_desc', label: t('sort.updated_desc') },
    { value: 'updated_asc', label: t('sort.updated_asc') },
    { value: 'name_asc', label: t('sort.name_asc') },
    { value: 'name_desc', label: t('sort.name_desc') },
    { value: 'inv_asc', label: t('sort.inv_asc') },
  ]

  const activeGroup = query.group ?? 'all'
  const dirty = isDirty(query)

  function groupLabel(g: AssetGroupFilter): string {
    if (g === 'all') return t('filters.allGroups')
    return t(`groups.${g}`)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Group tabs row */}
      <div className="flex items-center gap-2 flex-wrap">
        {GROUP_IDS.map(g => (
          <button
            key={g}
            type="button"
            onClick={() => onChange({ group: g })}
            aria-pressed={activeGroup === g}
            className={[
              'inline-flex items-center h-7 px-3 rounded-md text-[12px] font-semibold tracking-tight border transition-all duration-150',
              activeGroup === g
                ? 'bg-[rgba(249,115,22,0.15)] text-[#FB923C] border-[rgba(249,115,22,0.35)]'
                : 'bg-[#22272E] text-[#94A3B8] border-[#2A2F36] hover:border-[#3A4048] hover:text-[#F8FAFC]',
            ].join(' ')}
          >
            {groupLabel(g)}
          </button>
        ))}
      </div>

      {/* Filter controls row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none">
            <Icon name="search" size={13} />
          </span>
          <input
            id="assets-search"
            type="search"
            value={query.search ?? ''}
            onChange={e => onChange({ search: e.target.value })}
            placeholder={t('search')}
            className="w-full h-9 pl-8 pr-3 text-sm bg-[#111315] border border-[#2A2F36] rounded-lg text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[rgba(249,115,22,0.40)] transition-all duration-150"
            aria-label={t('search')}
          />
        </div>

        {/* Status */}
        <div className="w-40">
          <Select
            value={query.statusId ?? 'all'}
            onChange={v => onChange({ statusId: v })}
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

        {/* Sort */}
        <div className="w-44">
          <Select
            value={query.sort ?? 'updated_desc'}
            onChange={v => onChange({ sort: v as AssetSort })}
            options={sortOptions}
          />
        </div>

        {/* Reset */}
        {dirty && (
          <Btn
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                group: 'all',
                statusId: 'all',
                branchId: 'all',
                search: '',
                sort: 'updated_desc',
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
