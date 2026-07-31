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
  AUDIT_GRID,
} from '@/components/features/dashboard'
import { useDashboard } from '@/hooks'
import type { DashboardRepository } from '@/domain/dashboard'
import { ASSET_STATUS } from '@/domain/asset'
import { getSharedDashboardRepository } from '@/infra/repositories'
import { canAccess } from '@/config/access'
import { cn } from '@/lib/utils'

// ── Dashboard grid templates ───────────────────────────────────────────────────
// ROW 1 (KPI cards): Tailwind arbitrary class lg:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))].
//   Useful content width on 1366px ≈ 1366 - 260 (sidebar) - 38 (padding) ≈ 1068px ≈ 66.75rem.
//   At minmax(12rem, 1fr): floor(66.75 / 12) = 5 columns → fits all 5 cards on 1366
//   without horizontal scroll. On 1920+: content ≈ 100rem → still 5 columns (auto-fit fills).
//   Mobile (< lg) keeps explicit 2-col so col-span-2 on the featured card works.

// ROW 2 (2 panels): auto-fit minmax(20rem, 1fr) — 2 cols on lg+, collapses on mobile.
//   At ~1068px content: floor(1068/320) = 3 potential, but 2 items → 2 cols.
const PANEL_GRID_2 = 'repeat(auto-fit, minmax(20rem, 1fr))'

// ROW 3 (3 panels): auto-fit minmax(17rem, 1fr) — exactly 3 cols at 1366, fills on 1920+.
//   At ~1068px content: floor(1068/272) = 3 cols → exactly 3 on 1366. Collapses on mobile.
const PANEL_GRID_3 = 'repeat(auto-fit, minmax(17rem, 1fr))'

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
        {/* ROW 1: 5 KPI card shimmers — 2-col on mobile, auto-fit (KPI_GRID) on lg+ */}
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

        {/* ROW 2: 2 panel shimmers — real headers, shimmer content; auto-fit PANEL_GRID_2 */}
        <div className="grid gap-4" style={{ gridTemplateColumns: PANEL_GRID_2 }}>
          {[
            { icon: 'circle-dot', iconCls: 'bg-info/15 text-info', title: t('status.title') },
            { icon: 'tags',       iconCls: 'bg-accent/15 text-accent', title: t('groups.title') },
          ].map((p, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
                <span className={`w-6 h-6 lg:w-7 lg:h-7 rounded-md inline-flex items-center justify-center flex-shrink-0 ${p.iconCls}`}>
                  <Icon name={p.icon} size={13} />
                </span>
                <span className="text-12 lg:text-13 font-semibold text-text-primary">{p.title}</span>
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

        {/* ROW 3: 3 panel shimmers — real headers, shimmer content; auto-fit PANEL_GRID_3 */}
        <div className="grid gap-4" style={{ gridTemplateColumns: PANEL_GRID_3 }}>
          {[
            { icon: 'building',         iconCls: 'bg-success/15 text-success',           title: t('branches.title') },
            { icon: 'key-round',        iconCls: 'bg-violet-500/15 text-violet-300 light:text-violet-700',      title: t('license.title') },
            { icon: 'arrow-right-left', iconCls: 'bg-success/15 text-success',            title: t('recentActivity') },
          ].map((p, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
                <span className={`w-6 h-6 lg:w-7 lg:h-7 rounded-md inline-flex items-center justify-center flex-shrink-0 ${p.iconCls}`}>
                  <Icon name={p.icon} size={13} />
                </span>
                <span className="text-12 lg:text-13 font-semibold text-text-primary">{p.title}</span>
              </div>
              <div className="p-4 lg:p-5 space-y-3">
                {Array.from({ length: 3 }).map((__, j) => (
                  <div key={j} className="h-3 w-full rounded anim-skeleton" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ROW 4: Audit table shimmer — mirrors AuditTable (dashboard/AuditTable.tsx).
            P2: panel header (icon + title + «viewAll» link) is local chrome — renders real.
            P1: desktop sub-header row (4-col labels) mirrors AuditTable header (AUDIT_GRID);
                body rows use the same AUDIT_GRID as real rows. */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {/* Panel header — local chrome: icon, title, and «viewAll» link render real */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 lg:w-7 lg:h-7 rounded-md inline-flex items-center justify-center flex-shrink-0 bg-surface-2 text-text-tertiary">
                <Icon name="history" size={13} />
              </span>
              <span className="text-12 lg:text-13 font-semibold text-text-primary">{t('recentAudit')}</span>
            </div>
            {/* «viewAll» link is local chrome (known translation string) — renders real, not shimmered */}
            <span className="text-11.5 text-accent pointer-events-none opacity-50">
              {t('viewAll')}
            </span>
          </div>

          {/* Desktop column sub-header — mirrors AuditTable header; columns defined by AUDIT_GRID */}
          <div className="hidden lg:grid gap-4 px-5 py-2 border-b border-border/50" style={{ gridTemplateColumns: AUDIT_GRID }}>
            {(['audit.col.action', 'audit.col.description', 'audit.col.user', 'audit.col.time'] as const).map(key => (
              <span key={key} className="text-10.5 font-semibold uppercase tracking-wider text-text-subtle">
                {t(key)}
              </span>
            ))}
          </div>

          {/* Body rows — same grid as real AuditTable */}
          <div className="divide-y divide-border/50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3">
                {/* Desktop: mirrors AuditTable row grid; columns defined by AUDIT_GRID */}
                <div className="hidden lg:grid gap-4 items-center" style={{ gridTemplateColumns: AUDIT_GRID }}>
                  <div className="h-5 w-[100px] rounded-md anim-skeleton flex-shrink-0" />
                  <div className="h-3 flex-1 rounded anim-skeleton" />
                  <div className="h-3 w-[120px] rounded anim-skeleton flex-shrink-0" />
                  <div className="h-3 w-[40px] rounded anim-skeleton flex-shrink-0" />
                </div>
                {/* Mobile: flex-col gap-1.5 — action badge + date / targetLabel */}
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

      {/* ROW 2 — Status breakdown + Group breakdown; auto-fit PANEL_GRID_2 */}
      {assets && (
        <div className="grid gap-4" style={{ gridTemplateColumns: PANEL_GRID_2 }}>
          <StatusBars
            byStatus={assets.byStatus}
            total={assets.total}
            statuses={[...statuses]}
          />
          <GroupBars byGroup={assets.byGroup} />
        </div>
      )}

      {/* ROW 3 — Branches + Licenses + Activity; auto-fit PANEL_GRID_3 */}
      <div className="grid gap-4" style={{ gridTemplateColumns: PANEL_GRID_3 }}>
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
