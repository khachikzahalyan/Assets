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
        <div className="flex items-center gap-2">
          <Icon name="building-2" size={14} className="text-lime-400" />
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
  )
}
