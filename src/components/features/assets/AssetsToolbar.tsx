import { useTranslation } from 'react-i18next'
import { Btn, Icon } from '@/components/ui'
import { GroupTabs } from './GroupTabs'
import type { GroupTab } from './GroupTabs'
import type { AssetListQuery, AssetGroupFilter } from '@/domain/asset'

export interface AssetsToolbarProps {
  query: AssetListQuery
  onChange: (patch: Partial<AssetListQuery>) => void
  groupCounts: Record<string, number>
  totalCount: number
  canMutate: boolean
  onExport: () => void
  onNavigateCreate: () => void
}

export function AssetsToolbar({
  query,
  onChange,
  groupCounts,
  totalCount,
  canMutate,
  onExport,
  onNavigateCreate,
}: AssetsToolbarProps) {
  const { t } = useTranslation('assets')

  const groupTabs: GroupTab[] = [
    { id: 'all',       label: t('groups.all'),       icon: 'layers' },
    { id: 'devices',   label: t('groups.devices'),   icon: 'monitor-smartphone' },
    { id: 'network',   label: t('groups.network'),   shortLabel: t('groups.networkShort'), icon: 'server' },
    { id: 'furniture', label: t('groups.furniture'), icon: 'armchair' },
  ]

  const activeGroup = query.group ?? 'all'

  return (
    <div className="flex items-center justify-between gap-2.5 flex-wrap px-5 py-2 max-md:flex-col max-md:items-stretch max-md:gap-2 max-md:px-3 max-md:py-2">
      {/* Row 1: Group tabs (scrollable on mobile) */}
      <GroupTabs
        tabs={groupTabs}
        selected={activeGroup}
        onSelect={g => onChange({ group: g as AssetGroupFilter })}
        counts={groupCounts}
      />

      {/* Row 2 on mobile / right side on desktop: search + action buttons */}
      <div className="flex items-center gap-2 flex-1 ml-auto justify-end max-md:ml-0 max-md:flex-none max-md:w-full max-md:gap-2">
        {/* Search */}
        <div className="w-full max-w-[280px] max-md:max-w-none max-md:flex-1">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none">
              <Icon name="search" size={13} />
            </span>
            <input
              id="assets-search"
              type="search"
              autoComplete="off"
              value={query.search ?? ''}
              onChange={e => onChange({ search: e.target.value })}
              placeholder={t('search')}
              className="w-full h-8 pl-8 pr-3 text-[13.5px] bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-accent-light focus:ring-2 focus:ring-accent-light/15 transition-all duration-150"
              aria-label={t('search')}
            />
          </div>
        </div>

        {/* Import — Phase 2 deferred. Hidden on mobile. */}
        <button
          type="button"
          disabled
          title={t('toolbar.importSoon')}
          aria-label={t('toolbar.import')}
          className="bg-surface border border-border-strong text-text-primary h-8 px-3 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors duration-150 opacity-40 cursor-not-allowed max-md:hidden"
        >
          <Icon name="file-up" size={13} className="text-sky-300" />
          <span>{t('toolbar.import')}</span>
        </button>

        {/* Export — hidden on mobile */}
        <button
          type="button"
          disabled={totalCount === 0}
          onClick={onExport}
          title={t('export.xlsx')}
          aria-label={t('export.xlsx')}
          className="bg-surface border border-border-strong text-text-primary hover:bg-bg h-8 px-3 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed max-md:hidden"
        >
          <Icon name="file-spreadsheet" size={13} className="text-emerald-300" />
          <span>{t('export.xlsx')}</span>
        </button>

        {/* Create — role-gated; compact on mobile (icon-only 80×32 orange btn) */}
        {canMutate && (
          <>
            {/* Desktop: full label button */}
            <Btn variant="primary" size="sm" onClick={onNavigateCreate} className="max-md:hidden">
              <Icon name="plus" size={13} />
              {t('toolbar.create')}
            </Btn>
            {/* Mobile: icon-only 80×32 orange button */}
            <button
              type="button"
              onClick={onNavigateCreate}
              aria-label={t('toolbar.create')}
              className="md:hidden w-[80px] h-[32px] min-w-[80px] shrink-0 rounded-[8px] bg-accent text-white inline-flex items-center justify-center transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(249,115,22,0.40)]"
            >
              <Icon name="plus" size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
