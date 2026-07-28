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
    <SectionCard title={t('detail.location.title')} icon="map-pin" iconTone="green">
      <div className="space-y-3">
        {/* Desktop: inline icon */}
        <div className="max-md:hidden flex items-center gap-2">
          <Icon name="building-2" size={14} className="text-lime-400" />
          {branch
            ? <span className="text-[14px] text-[#E2E8F0]">{branch.name}</span>
            : <span className="text-[14px] text-text-subtle">—</span>
          }
        </div>
        {/* Mobile: icon box matches the SectionCard header box (26px) so the
            value text aligns under the «МЕСТОНАХОЖДЕНИЕ» title in one column. */}
        <div className="md:hidden flex items-center gap-2.5">
          <div className="w-[26px] h-[26px] rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Icon name="building-2" size={13} className="text-emerald-300" />
          </div>
          {branch
            ? <span className="text-[13.5px] font-semibold leading-none text-text-primary truncate">{branch.name}</span>
            : <span className="text-[13.5px] leading-none text-text-subtle">—</span>
          }
        </div>
        {dept && (
          <>
            {/* Desktop: inline icon — same style as the branch row above */}
            <div className="max-md:hidden flex items-center gap-2">
              <Icon name="users" size={14} className="text-blue-400" />
              <span className="text-[14px] text-text-tertiary">
                {t('detail.location.dept')}:{' '}
                <span className="text-[#E2E8F0]">{dept.name}</span>
              </span>
            </div>
            {/* Mobile: same 26px icon-box row as the branch — one aligned column,
                same emerald tone so the location card reads as one cohesive block
                (the lone blue dept icon looked out of place). */}
            <div className="md:hidden flex items-center gap-2.5">
              <div className="w-[26px] h-[26px] rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Icon name="users" size={13} className="text-emerald-300" />
              </div>
              <span className="text-[13.5px] leading-none text-text-tertiary truncate">
                {t('detail.location.dept')}:{' '}
                <span className="font-semibold text-text-primary">{dept.name}</span>
              </span>
            </div>
          </>
        )}
      </div>
    </SectionCard>
  )
}
