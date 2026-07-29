import { useTranslation } from 'react-i18next'
import type { Asset, AssetReferenceData } from '@/domain/asset'
import { SectionCard, Icon } from '@/components/ui'

interface LocationCardProps {
  asset: Asset
  refData: AssetReferenceData
}

export function LocationCard({ asset, refData }: LocationCardProps) {
  const { t } = useTranslation('assets')

  const branch = refData.branches.find(b => b.id === asset.branchId)
  const dept   = asset.deptId
    ? refData.departments.find(d => d.id === asset.deptId)
    : undefined

  return (
    <>
      {/* Desktop: unchanged SectionCard with inline rows */}
      <div className="max-md:hidden">
        <SectionCard title={t('detail.location.title')} icon="map-pin" iconTone="green">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Icon name="building-2" size={14} className="text-emerald-500" />
              {branch
                ? <span className="text-[14px] text-[#E2E8F0]">{branch.name}</span>
                : <span className="text-[14px] text-text-subtle">—</span>
              }
            </div>
            {dept && (
              <div className="flex items-center gap-2">
                <Icon name="users" size={14} className="text-blue-400" />
                <span className="text-[14px] text-text-tertiary">
                  {t('detail.location.dept')}:{' '}
                  <span className="text-[#E2E8F0]">{dept.name}</span>
                </span>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Mobile: NO section header (owner request — the labels already say it).
          One flat card of label–value rows split by a soft divider. */}
      <div className="md:hidden bg-surface border border-border rounded-xl divide-y divide-border/50">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 min-w-0">
          <span className="inline-flex items-center gap-2.5 text-[12px] text-text-tertiary shrink-0">
            <span className="w-[26px] h-[26px] rounded-md bg-emerald-500/10 flex items-center justify-center">
              <Icon name="building-2" size={13} className="text-emerald-300" />
            </span>
            {t('detail.location.branch')}
          </span>
          <span className={`text-[13.5px] truncate ${branch ? 'font-semibold text-text-primary' : 'text-text-subtle'}`}>
            {branch?.name ?? '—'}
          </span>
        </div>
        {dept && (
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 min-w-0">
            <span className="inline-flex items-center gap-2.5 text-[12px] text-text-tertiary shrink-0">
              <span className="w-[26px] h-[26px] rounded-md bg-emerald-500/10 flex items-center justify-center">
                <Icon name="users" size={13} className="text-emerald-300" />
              </span>
              {t('detail.location.dept')}
            </span>
            <span className="text-[13.5px] font-semibold text-text-primary truncate">{dept.name}</span>
          </div>
        )}
      </div>
    </>
  )
}
