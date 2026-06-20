import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader, LoadingState } from '@/components/ui'
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
  const { data, loading } = useDashboard(activeRepo, role)

  if (loading) {
    return (
      <div className="anim-content-enter space-y-5">
        <PageHeader icon="layout-dashboard" title={t('title')} />
        <LoadingState rows={6} />
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
    <div className="anim-content-enter space-y-5">
      <PageHeader icon="layout-dashboard" title={t('title')} />

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
