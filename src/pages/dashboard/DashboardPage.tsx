import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { ErrorState } from '@/components/ui'
import { SectionCard } from '@/components/ui/section-card'
import type { SectionCardProps } from '@/components/ui/section-card'
import { StatCard, DomainBox } from '@/components/features/dashboard'
import { useDashboard } from '@/hooks'
import type { DashboardRepository, DashboardData, DomainBoxKey } from '@/domain/dashboard'
import { DOMAIN_BOX_KEYS } from '@/domain/dashboard'
import { ASSET_STATUS } from '@/domain/asset'
import { getSharedDashboardRepository } from '@/infra/repositories'
import { canAccess } from '@/config/access'
import type { RouteId } from '@/config/nav'
import { cn } from '@/lib/utils'

export interface DashboardPageProps {
  repo?: DashboardRepository
}

// ── Domain-box presentation config (icon/tone/bar colour + list route) ─────────
interface BoxMeta {
  icon: string
  iconTone?: SectionCardProps['iconTone']
  barClass: string
  routeId: RouteId
  path: string
}

const BOX_GRID = 'repeat(auto-fit, minmax(20rem, 1fr))'

const BOX_META: Record<DomainBoxKey, BoxMeta> = {
  assets:        { icon: 'package',   barClass: 'bg-text-tertiary/50', routeId: 'assets',      path: '/assets' },
  employees:     { icon: 'users',     iconTone: 'blue',   barClass: 'bg-sky-400/70',     routeId: 'employees',   path: '/employees' },
  parts:         { icon: 'wrench',    iconTone: 'rose',   barClass: 'bg-rose-400/70',    routeId: 'parts',       path: '/parts' },
  subscriptions: { icon: 'key-round', iconTone: 'orange', barClass: 'bg-amber-400/70',   routeId: 'licenses',    path: '/licenses' },
  branches:      { icon: 'map-pin',   iconTone: 'green',  barClass: 'bg-emerald-400/70', routeId: 'branches',    path: '/branches' },
  departments:   { icon: 'building',  iconTone: 'cyan',   barClass: 'bg-cyan-400/70',    routeId: 'departments', path: '/departments' },
}

/** Aggregated total for a box header; null renders as «—». */
function boxTotal(key: DomainBoxKey, data: DashboardData): number | null {
  switch (key) {
    case 'assets':        return data.assets?.total ?? null
    case 'employees':     return data.people?.employeeCount ?? null
    case 'parts':         return data.counts?.partsUnits ?? null
    case 'subscriptions': return data.counts?.subscriptions ?? null
    case 'branches':      return data.counts?.branches ?? null
    case 'departments':   return data.counts?.departments ?? null
  }
}

export function DashboardPage({ repo }: DashboardPageProps) {
  const { t } = useTranslation('dashboard')
  const { role } = useAuth()

  const activeRepo = repo ?? getSharedDashboardRepository()
  const { data, loading, error, reload } = useDashboard(activeRepo, role)

  // ── Loading skeleton (KPI row + 6 domain-box grid) ───────────────────────────
  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        {/* ROW 1: 5 KPI card shimmers — 2-col on mobile, auto-fit on lg+ */}
        <div className="grid grid-cols-2 gap-2 lg:gap-3 lg:[grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'bg-surface border border-border rounded-xl p-3 lg:p-4.5',
                i === 0 && 'col-span-2 lg:col-span-1',
              )}
            >
              {/* Mobile shimmer — featured (i=0): ROW with mini-stats; others: COLUMN */}
              {i === 0 ? (
                <div className="lg:hidden flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[9px] anim-skeleton flex-shrink-0" />
                    <div>
                      <div className="h-[1.75rem] w-[80px] rounded anim-skeleton" />
                      <div className="h-[11px] w-[60px] rounded anim-skeleton mt-0.5" />
                    </div>
                  </div>
                  <div className="flex gap-3 flex-shrink-0">
                    {[0, 1].map(j => (
                      <div key={j} className="text-center">
                        <div className="h-[17px] w-[32px] rounded anim-skeleton mx-auto" />
                        <div className="h-[9px] w-[36px] rounded anim-skeleton mt-0.5 mx-auto" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="lg:hidden flex flex-col gap-2">
                  <div className="w-8 h-8 rounded-[9px] anim-skeleton" />
                  <div className="h-[1.75rem] w-[55%] rounded anim-skeleton" />
                  <div className="h-[11px] w-[70%] rounded anim-skeleton mt-0.5" />
                </div>
              )}
              {/* Desktop shimmer */}
              <div className="hidden lg:flex flex-col gap-2">
                <div className="w-8 h-8 rounded-[9px] anim-skeleton" />
                <div className="h-8 w-[55%] rounded anim-skeleton" />
                <div className="h-3 w-[70%] rounded anim-skeleton" />
              </div>
            </div>
          ))}
        </div>

        {/* ROW 2: 6 domain-box shimmers — real header, async body shimmers */}
        <div className="grid gap-4" style={{ gridTemplateColumns: BOX_GRID }}>
          {DOMAIN_BOX_KEYS.map(key => {
            const meta = BOX_META[key]
            return (
              <SectionCard
                key={key}
                icon={meta.icon}
                {...(meta.iconTone ? { iconTone: meta.iconTone } : {})}
                title={t(`boxes.${key}.title`)}
                action={<div className="h-6 w-[4.5rem] rounded anim-skeleton" />}
              >
                {/* Total + delta shimmer */}
                <div className="flex items-baseline gap-2">
                  <div className="h-8 w-16 rounded anim-skeleton" />
                  <div className="h-4 w-20 rounded-full anim-skeleton" />
                </div>
                <hr className="border-border my-3" />
                {/* Feed shimmer — one stripe per row */}
                <div className="flex flex-col gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="min-h-11 flex items-center px-2">
                      <div className="h-3.5 w-full rounded anim-skeleton" />
                    </div>
                  ))}
                </div>
                {/* View-all muted placeholder */}
                <div className="hidden lg:block pt-3 text-right">
                  <span className="text-11.5 text-accent opacity-50 pointer-events-none">
                    {t(`boxes.${key}.viewAll`)}
                  </span>
                </div>
              </SectionCard>
            )
          })}
        </div>
      </div>
    )
  }

  const assets = data.assets

  return (
    <div className="space-y-5">
      {error && (
        <div data-testid="dashboard-error">
          <ErrorState onRetry={reload} />
        </div>
      )}

      {/* ROW 1 — 5 KPI stat cards: 2-col on mobile, auto-fit KPI_GRID on lg+ */}
      <div className="grid grid-cols-2 gap-2 lg:gap-3 lg:[grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
        {assets && (
          <StatCard
            icon="package"
            label={t('kpi.totalAssets')}
            value={assets.total}
            to="/assets"
            accent="orange"
            featured
            testId="section-total-assets"
            heroStats={[
              {
                value: assets.byStatus[ASSET_STATUS.assigned],
                label: t('kpi.heroAssigned'),
                tone: 'success',
              },
              {
                value: assets.byStatus[ASSET_STATUS.warehouse],
                label: t('kpi.heroWarehouse'),
                tone: 'info',
              },
            ]}
          />
        )}
        {assets && (
          <StatCard
            icon="arrow-right"
            label={t('kpi.currentlyOut')}
            value={assets.byStatus[ASSET_STATUS.assigned]}
            to="/assets"
            accent="green"
          />
        )}
        {assets && (
          <StatCard
            icon="inbox"
            label={t('kpi.inWarehouse')}
            value={assets.byStatus[ASSET_STATUS.warehouse]}
            to="/assets"
            accent="blue"
          />
        )}
        {data.workstationLicenses && (
          <StatCard
            icon="key-round"
            label={t('kpi.licenses')}
            value={data.workstationLicenses.total}
            {...(canAccess(role, 'licenses') ? { to: '/licenses' } : {})}
            accent="violet"
            testId="section-licenses"
          />
        )}
        {data.people && (
          <StatCard
            icon="users"
            label={t('kpi.employees')}
            value={data.people.employeeCount}
            {...(canAccess(role, 'employees') ? { to: '/employees' } : {})}
            accent="amber"
            testId="section-people"
          />
        )}
      </div>

      {/* ROW 2 — 6 domain boxes (total + 7-day mini-bar + event feed) */}
      {data.boxes && (
        <div className="grid gap-4" style={{ gridTemplateColumns: BOX_GRID }}>
          {DOMAIN_BOX_KEYS.map(key => {
            const meta = BOX_META[key]
            const box = data.boxes![key]
            const linked = canAccess(role, meta.routeId)
            // Strip per-row links when the role can't reach the target list/detail.
            const events = linked
              ? box.events
              : box.events.map(({ linkTo: _linkTo, ...rest }) => rest)
            return (
              <DomainBox
                key={key}
                icon={meta.icon}
                {...(meta.iconTone ? { iconTone: meta.iconTone } : {})}
                title={t(`boxes.${key}.title`)}
                total={boxTotal(key, data)}
                delta7d={box.delta7d}
                days={box.days}
                events={events}
                barClass={meta.barClass}
                {...(linked ? { viewAllTo: meta.path } : {})}
                viewAllLabel={t(`boxes.${key}.viewAll`)}
                emptyLabel={t('boxes.empty')}
                {...(key === 'parts' ? { totalCaption: t('boxes.partsUnits') } : {})}
                testId={`domain-box-${key}`}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
