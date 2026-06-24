import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader, ErrorState, Icon } from '@/components/ui'
import {
  KpiTile,
  StatusBreakdown,
  GroupBreakdown,
  BranchBreakdown,
  LicenseStatTile,
  PeopleTile,
  RecentActivityList,
} from '@/components/features/dashboard'
import type { ActivityRowVM } from '@/components/features/dashboard'
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

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <PageHeader icon="layout-dashboard" title={t('title')} />
        {/* KPI tile row — REAL icon + REAL label, shimmer value */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(
            [
              { labelKey: 'kpi.totalAssets',  icon: 'package' },
              { labelKey: 'kpi.currentlyOut', icon: 'arrow-right-left' },
              { labelKey: 'kpi.licenses',     icon: 'key-round' },
              { labelKey: 'kpi.employees',    icon: 'users' },
            ] as const
          ).map(({ labelKey, icon }) => (
            <div key={labelKey} className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
              <Icon name={icon} size={18} className="text-text-subtle flex-shrink-0 w-9 h-9 flex items-center justify-center" />
              <div className="space-y-2">
                <span className="block text-[12px] uppercase tracking-[0.07em] font-semibold text-text-subtle">
                  {t(labelKey)}
                </span>
                <div className="h-[22px] w-[40%] rounded anim-skeleton" />
              </div>
            </div>
          ))}
        </div>
        {/* Detail panels — REAL panel titles, shimmer body rows */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(
            [
              { titleKey: 'status.title',   icon: 'circle-dot' },
              { titleKey: 'groups.title',   icon: 'tags' },
              { titleKey: 'branches.title', icon: 'building' },
              { titleKey: 'recentActivity', icon: 'arrow-right-left' },
            ] as const
          ).map(({ titleKey, icon }) => (
            <div key={titleKey} className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
                <Icon name={icon} size={15} className="text-text-subtle flex-shrink-0 w-7 h-7 flex items-center justify-center" />
                <span className="text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
                  {t(titleKey)}
                </span>
              </div>
              <div className="p-5 space-y-3">
                {Array.from({ length: 4 }).map((__, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <div className="h-[12px] flex-1 rounded anim-skeleton" style={{ maxWidth: `${55 + j * 8}%` }} />
                    <div className="h-[12px] w-[48px] rounded anim-skeleton flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const assets = data.assets

  const activityRows: ActivityRowVM[] = (data.assignments?.recent ?? []).map(r => ({
    id: r.auditId,
    icon: r.action === 'assigned' ? 'arrow-right' : 'undo-2',
    label: t(`activity.${r.action}`),
    at: r.at,
    ...(r.assetId ? { to: `/assets/${r.assetId}` } : {}),
  }))

  const auditRows: ActivityRowVM[] = (data.recentAudit ?? []).map(a => ({
    id: a.id,
    icon: 'history',
    label: t(`auditAction.${a.action}`, { defaultValue: a.action }),
    at: a.at,
  }))

  return (
    <div className="space-y-5">
      <PageHeader icon="layout-dashboard" title={t('title')} />

      {error && (
        <div data-testid="dashboard-error">
          <ErrorState onRetry={reload} />
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {assets && (
          <KpiTile
            icon="package"
            label={t('kpi.totalAssets')}
            value={assets.total}
            to="/assets"
          />
        )}
        {data.assignments && (
          <KpiTile
            icon="arrow-right-left"
            label={t('kpi.currentlyOut')}
            value={data.assignments.currentlyOut}
            to="/assets"
          />
        )}
        {data.workstationLicenses && (
          <KpiTile
            icon="key-round"
            label={t('kpi.licenses')}
            value={data.workstationLicenses.total}
            to="/licenses"
          />
        )}
        {data.serverLicenseCount != null && (
          <div data-testid="kpi-server-licenses">
            <KpiTile
              icon="server"
              label={t('kpi.serverLicenses')}
              value={data.serverLicenseCount}
              to="/licenses"
            />
          </div>
        )}
        {data.people && (
          <KpiTile
            icon="users"
            label={t('kpi.employees')}
            value={data.people.employeeCount}
            to="/employees"
          />
        )}
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {assets && (
          <StatusBreakdown
            byStatus={assets.byStatus}
            total={assets.total}
            statuses={[
              { id: 'st_warehouse', name: t('status.st_warehouse'), color: 'gray' },
              { id: 'st_assigned',  name: t('status.st_assigned'),  color: 'green' },
              { id: 'st_repair',    name: t('status.st_repair'),    color: 'orange' },
              { id: 'st_disposed',  name: t('status.st_disposed'),  color: 'red' },
            ]}
          />
        )}
        {assets && <GroupBreakdown byGroup={assets.byGroup} />}
        {assets && <BranchBreakdown branches={assets.topBranches} />}
        {data.workstationLicenses && (
          <div data-testid="section-licenses">
            <LicenseStatTile stats={data.workstationLicenses} />
          </div>
        )}
        {data.people && (
          <div data-testid="section-people">
            <PeopleTile
              employeeCount={data.people.employeeCount}
              pendingUsersCount={data.people.pendingUsersCount}
            />
          </div>
        )}
        <RecentActivityList
          title={t('recentActivity')}
          icon="arrow-right-left"
          rows={activityRows}
          emptyLabel={t('noActivity')}
        />
        {data.recentAudit && (
          <div data-testid="section-recent-audit">
            <RecentActivityList
              title={t('recentAudit')}
              icon="history"
              rows={auditRows}
              emptyLabel={t('noAudit')}
              moreTo="/audit"
            />
          </div>
        )}
      </div>
    </div>
  )
}
