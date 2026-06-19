import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui/page-header'
import { SectionCard } from '@/components/ui/section-card'
import { Icon } from '@/components/ui/icon'

interface KpiTile {
  routeKey: string
  icon: string
}

const KPI_TILES: KpiTile[] = [
  { routeKey: 'assets',      icon: 'package' },
  { routeKey: 'assignments', icon: 'arrow-right-left' },
  { routeKey: 'employees',   icon: 'users' },
  { routeKey: 'licenses',    icon: 'key-round' },
]

export function DashboardPage() {
  const { t } = useTranslation('nav')

  return (
    <div className="anim-content-enter space-y-5">
      <PageHeader icon="layout-dashboard" title={t('items.dashboard')} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_TILES.map((tile) => (
          <SectionCard key={tile.routeKey} noHeader>
            <div className="flex flex-col gap-3">
              <span className="w-9 h-9 rounded-md bg-[#22272E] text-[#94A3B8] inline-flex items-center justify-center">
                <Icon name={tile.icon} size={16} />
              </span>
              <div>
                <div className="text-[12px] text-[#64748B]">
                  {t('items.' + tile.routeKey)}
                </div>
                <div className="text-[22px] font-bold text-[#F8FAFC] tabular-nums">
                  —
                </div>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  )
}
