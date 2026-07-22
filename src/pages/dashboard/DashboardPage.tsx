import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { ErrorState, Icon } from '@/components/ui'
import {
  StatCard,
  StatusBars,
  GroupBars,
  BranchBars,
  LicensePanel,
  ActivityPanel,
  AuditTable,
} from '@/components/features/dashboard'
import { useDashboard } from '@/hooks'
import type { DashboardRepository } from '@/domain/dashboard'
import { ASSET_STATUS } from '@/domain/asset'
import { getSharedDashboardRepository } from '@/infra/repositories'
import { cn } from '@/lib/utils'

export interface DashboardPageProps {
  repo?: DashboardRepository
}

export function DashboardPage({ repo }: DashboardPageProps) {
  const { t } = useTranslation('dashboard')
  const { role } = useAuth()

  const activeRepo = repo ?? getSharedDashboardRepository()
  const { data, loading, error, reload } = useDashboard(activeRepo, role)

  // ── Loading skeleton (mirrors the 4-row layout — plain shimmer blocks only) ──
  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        {/* ROW 1: 5 KPI card shimmers — 2-col on mobile, 5-col on desktop */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5 lg:gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'bg-surface border border-border rounded-xl p-3 lg:p-[18px]',
                i === 0 && 'col-span-2 lg:col-span-1',
              )}
            >
              {/* Mobile shimmer — featured (i=0): ROW with mini-stats; others: COLUMN */}
              {i === 0 ? (
                <div className="lg:hidden flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[9px] anim-skeleton flex-shrink-0" />
                    <div>
                      <div className="h-[28px] w-[80px] rounded anim-skeleton" />
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
                  <div className="h-[28px] w-[55%] rounded anim-skeleton" />
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

        {/* ROW 2: 2 panel shimmers — real headers, shimmer content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[
            { icon: 'circle-dot', iconCls: 'bg-info/15 text-info', title: t('status.title') },
            { icon: 'tags',       iconCls: 'bg-accent/15 text-accent', title: t('groups.title') },
          ].map((p, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
                <span className={`w-6 h-6 lg:w-7 lg:h-7 rounded-md inline-flex items-center justify-center flex-shrink-0 ${p.iconCls}`}>
                  <Icon name={p.icon} size={13} />
                </span>
                <span className="text-[12px] lg:text-[13px] font-semibold text-text-primary">{p.title}</span>
              </div>
              <div className="p-4 lg:p-5 flex flex-col gap-3.5">
                {Array.from({ length: 4 }).map((__, j) => (
                  <div key={j} className="flex flex-col gap-1.5">
                    <div className="h-3 w-full rounded anim-skeleton" />
                    <div className="h-[5px] lg:h-1.5 w-full rounded-full anim-skeleton" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ROW 3: 3 panel shimmers — real headers, shimmer content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            { icon: 'building',         iconCls: 'bg-success/15 text-success',           title: t('branches.title') },
            { icon: 'key-round',        iconCls: 'bg-violet-500/15 text-violet-300',      title: t('license.title') },
            { icon: 'arrow-right-left', iconCls: 'bg-success/15 text-success',            title: t('recentActivity') },
          ].map((p, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
                <span className={`w-6 h-6 lg:w-7 lg:h-7 rounded-md inline-flex items-center justify-center flex-shrink-0 ${p.iconCls}`}>
                  <Icon name={p.icon} size={13} />
                </span>
                <span className="text-[12px] lg:text-[13px] font-semibold text-text-primary">{p.title}</span>
              </div>
              <div className="p-4 lg:p-5 space-y-3">
                {Array.from({ length: 3 }).map((__, j) => (
                  <div key={j} className="h-3 w-full rounded anim-skeleton" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ROW 4: Audit table shimmer — real header */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 lg:w-7 lg:h-7 rounded-md inline-flex items-center justify-center flex-shrink-0 bg-surface-2 text-text-tertiary">
                <Icon name="history" size={13} />
              </span>
              <span className="text-[12px] lg:text-[13px] font-semibold text-text-primary">{t('recentAudit')}</span>
            </div>
            <div className="h-3 w-[60px] rounded anim-skeleton" />
          </div>
          <div className="divide-y divide-border/50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3">
                <div className="hidden lg:flex items-center gap-4">
                  <div className="h-5 w-[100px] rounded-md anim-skeleton flex-shrink-0" />
                  <div className="h-3 flex-1 rounded anim-skeleton" />
                  <div className="h-3 w-[100px] rounded anim-skeleton flex-shrink-0" />
                  <div className="h-3 w-[50px] rounded anim-skeleton flex-shrink-0" />
                </div>
                <div className="lg:hidden flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-5 w-[90px] rounded-md anim-skeleton" />
                    <div className="h-3 w-[40px] rounded anim-skeleton" />
                  </div>
                  <div className="h-3 w-[70%] rounded anim-skeleton" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const assets = data.assets

  const statuses = [
    { id: ASSET_STATUS.warehouse, name: t('status.st_warehouse'), color: 'gray'   },
    { id: ASSET_STATUS.assigned,  name: t('status.st_assigned'),  color: 'green'  },
    { id: ASSET_STATUS.repair,    name: t('status.st_repair'),    color: 'orange' },
    { id: ASSET_STATUS.disposed,  name: t('status.st_disposed'),  color: 'red'    },
  ] as const

  return (
    <div className="space-y-5">
      {error && (
        <div data-testid="dashboard-error">
          <ErrorState onRetry={reload} />
        </div>
      )}

      {/* ROW 1 — 5 KPI stat cards: 2-col grid on mobile, 5-col on desktop */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5 lg:gap-3">
        {assets && (
          <StatCard
            icon="package"
            label={t('kpi.totalAssets')}
            value={assets.total}
            to="/assets"
            accent="orange"
            featured
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
            to="/licenses"
            accent="violet"
          />
        )}
        {data.people && (
          <StatCard
            icon="users"
            label={t('kpi.employees')}
            value={data.people.employeeCount}
            to="/employees"
            accent="amber"
            testId="section-people"
          />
        )}
      </div>

      {/* ROW 2 — Status breakdown + Group breakdown */}
      {assets && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StatusBars
            byStatus={assets.byStatus}
            total={assets.total}
            statuses={[...statuses]}
          />
          <GroupBars byGroup={assets.byGroup} />
        </div>
      )}

      {/* ROW 3 — Branches + Licenses + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {assets && <BranchBars branches={assets.topBranches} />}
        {data.workstationLicenses && (
          <LicensePanel
            stats={data.workstationLicenses}
            serverLicenseCount={data.serverLicenseCount}
          />
        )}
        {data.assignments && (
          <ActivityPanel rows={data.assignments.recent} />
        )}
      </div>

      {/* ROW 4 — Audit log table (super_admin only) */}
      {data.recentAudit && (
        <AuditTable rows={data.recentAudit} />
      )}
    </div>
  )
}
