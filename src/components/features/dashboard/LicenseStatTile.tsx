import { useTranslation } from 'react-i18next'
import type { WorkstationLicenseStats } from '@/domain/dashboard'
import { SectionCard } from '@/components/ui/section-card'

export interface LicenseStatTileProps {
  stats: WorkstationLicenseStats
}

interface SubStat {
  labelKey: string
  value: number
  color: string
}

export function LicenseStatTile({ stats }: LicenseStatTileProps) {
  const { t } = useTranslation('dashboard')

  const subStats: SubStat[] = [
    { labelKey: 'license.free',    value: stats.free,    color: '#10B981' },
    { labelKey: 'license.inUse',   value: stats.inUse,   color: '#F97316' },
    { labelKey: 'license.retired', value: stats.retired, color: '#64748B' },
  ]

  return (
    <SectionCard title="Лицензии" icon="key-round">
      <div className="flex flex-col gap-4">
        {/* Big total — aggregate count only, never a license key */}
        <div>
          <div className="text-[12px] text-[#64748B]">
            {t('license.total', { defaultValue: 'Всего лицензий' })}
          </div>
          <div className="text-[28px] font-bold text-[#F8FAFC] tabular-nums leading-tight">
            {stats.total}
          </div>
        </div>

        {/* 3 sub-stats */}
        <div className="grid grid-cols-3 gap-2">
          {subStats.map(({ labelKey, value, color }) => (
            <div key={labelKey} className="flex flex-col gap-0.5">
              <span className="text-[20px] font-bold tabular-nums" style={{ color }}>
                {value}
              </span>
              <span className="text-[11px] text-[#64748B]">
                {t(labelKey, { defaultValue: labelKey })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  )
}
