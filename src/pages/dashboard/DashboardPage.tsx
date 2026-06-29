import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader, ErrorState } from '@/components/ui'
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
import { FirestoreDashboardRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'

export interface DashboardPageProps {
  repo?: DashboardRepository
}

export function DashboardPage({ repo }: DashboardPageProps) {
  const { t } = useTranslation('dashboard')
  const { role } = useAuth()

  // Composition root — builds the real Firestore repo once; tests inject theirs.
  const defaultRepo = useMemo<DashboardRepository>(
    () => new FirestoreDashboardRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const activeRepo = repo ?? defaultRepo
  const { data, loading, error, reload } = useDashboard(activeRepo, role)

  // ── Loading skeleton (mirrors the 4-row layout — plain shimmer blocks only) ──
  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        {/* Header */}
        <div className="h-9 w-[220px] rounded-xl anim-skeleton" />

        {/* ROW 1: 5 KPI card shimmers */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-[18px] flex flex-col gap-2">
              <div className="w-8 h-8 rounded-[9px] anim-skeleton" />
              <div className="h-8 w-[55%] rounded anim-skeleton" />
              <div className="h-3 w-[70%] rounded anim-skeleton" />
            </div>
          ))}
        </div>

        {/* ROW 2: 2 panel shimmers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
                <div className="w-7 h-7 rounded-md anim-skeleton flex-shrink-0" />
                <div className="h-3 w-[30%] rounded anim-skeleton" />
              </div>
              <div className="p-5 flex flex-col gap-3.5">
                {Array.from({ length: 4 }).map((__, j) => (
                  <div key={j} className="flex flex-col gap-1.5">
                    <div className="h-3 w-full rounded anim-skeleton" />
                    <div className="h-1.5 w-full rounded-full anim-skeleton" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ROW 3: 3 panel shimmers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
                <div className="w-7 h-7 rounded-md anim-skeleton flex-shrink-0" />
                <div className="h-3 w-[35%] rounded anim-skeleton" />
              </div>
              <div className="p-5 space-y-3">
                {Array.from({ length: 3 }).map((__, j) => (
                  <div key={j} className="h-3 w-full rounded anim-skeleton" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ROW 4: Audit table shimmer */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md anim-skeleton flex-shrink-0" />
              <div className="h-3 w-[120px] rounded anim-skeleton" />
            </div>
            <div className="h-3 w-[60px] rounded anim-skeleton" />
          </div>
          <div className="divide-y divide-border/50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-4">
                <div className="h-5 w-[100px] rounded-md anim-skeleton flex-shrink-0" />
                <div className="h-3 flex-1 rounded anim-skeleton" />
                <div className="h-3 w-[100px] rounded anim-skeleton flex-shrink-0" />
                <div className="h-3 w-[50px] rounded anim-skeleton flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const assets = data.assets

  const statuses = [
    { id: 'st_warehouse', name: t('status.st_warehouse'), color: 'gray'   },
    { id: 'st_assigned',  name: t('status.st_assigned'),  color: 'green'  },
    { id: 'st_repair',    name: t('status.st_repair'),    color: 'orange' },
    { id: 'st_disposed',  name: t('status.st_disposed'),  color: 'red'    },
  ] as const

  return (
    <div className="space-y-5">
      <PageHeader icon="layout-dashboard" title={t('title')} />

      {error && (
        <div data-testid="dashboard-error">
          <ErrorState onRetry={reload} />
        </div>
      )}

      {/* ROW 1 — 5 KPI stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {assets && (
          <StatCard
            icon="package"
            label={t('kpi.totalAssets')}
            value={assets.total}
            to="/assets"
            accent="orange"
            featured
          />
        )}
        {assets && (
          <StatCard
            icon="arrow-right"
            label={t('kpi.currentlyOut')}
            value={assets.byStatus.st_assigned}
            to="/assets"
            accent="green"
          />
        )}
        {assets && (
          <StatCard
            icon="inbox"
            label={t('kpi.inWarehouse')}
            value={assets.byStatus.st_warehouse}
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
