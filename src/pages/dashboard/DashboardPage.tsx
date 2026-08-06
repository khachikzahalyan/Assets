import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { ErrorState } from '@/components/ui'
import { StatCard, DomainBox } from '@/components/features/dashboard'
import type { DomainBoxAlert } from '@/components/features/dashboard'
import { useDashboard } from '@/hooks'
import type { DashboardRepository, DashboardData, DomainBoxKey } from '@/domain/dashboard'
import { ASSET_STATUS } from '@/domain/asset'
import { getSharedDashboardRepository } from '@/infra/repositories'
import { canAccess } from '@/config/access'
import type { RouteId } from '@/config/nav'

export interface DashboardPageProps {
  repo?: DashboardRepository
}

// ── Domain-box presentation config (icon/tone/bar colour + list route) ─────────
interface BoxMeta {
  icon: string
  iconTone?: 'accent' | 'amber' | 'rose' | 'violet' | 'green' | 'cyan' | 'blue' | 'orange'
  barClass: string
  routeId: RouteId
  path: string
}

// iconTone matches entity palette:
//   assets → accent(orange), employees → amber, parts → rose
//   subscriptions → violet, branches → green, departments → cyan
const BOX_META: Record<DomainBoxKey, BoxMeta> = {
  assets:        { icon: 'package',   iconTone: 'accent', barClass: 'bg-accent/70',      routeId: 'assets',      path: '/assets' },
  employees:     { icon: 'users',     iconTone: 'amber',  barClass: 'bg-amber-400/70',   routeId: 'employees',   path: '/employees' },
  parts:         { icon: 'cpu',       iconTone: 'rose',   barClass: 'bg-rose-400/70',    routeId: 'parts',       path: '/parts' },
  subscriptions: { icon: 'key-round', iconTone: 'violet', barClass: 'bg-violet-400/70',  routeId: 'licenses',    path: '/licenses' },
  branches:      { icon: 'building',  iconTone: 'green',  barClass: 'bg-emerald-400/70', routeId: 'branches',    path: '/branches' },
  departments:   { icon: 'network',   iconTone: 'cyan',   barClass: 'bg-cyan-400/70',    routeId: 'departments', path: '/departments' },
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

// ── Layout constants ────────────────────────────────────────────────────────────

/**
 * ROW 1: asymmetric 12-col grid — cards span 5 / 4 / 3.
 * On mobile: 2-col (card 1 full width col-span-2, cards 2+3 each 1 col).
 * On desktop ≥lg: 5fr 4fr 3fr.
 */
const ROW1_GRID = 'grid grid-cols-2 gap-[1rem] lg:grid-cols-[5fr_4fr_3fr]'

/**
 * ROW 2: 3 compact horizontal KPI cards.
 * Mobile: 1-col stack.
 * Desktop ≥lg: 3 equal columns.
 */
const ROW2_GRID = 'grid grid-cols-1 gap-[1rem] lg:grid-cols-3'

/**
 * ROW 3: 2 domain boxes — АКТИВЫ (span 7) + ЗАПЧАСТИ (span 5).
 * No fixed heights — grid stretch aligns both cells naturally.
 * Mobile: stacked.
 * Desktop: 7fr 5fr.
 */
const ROW3_GRID = 'grid grid-cols-1 gap-[1rem] lg:grid-cols-[7fr_5fr]'

/**
 * ROW 4: 3 equal domain boxes, min-h-200px each.
 * Mobile: stacked.
 * Desktop: 3 equal columns.
 */
const ROW4_GRID = 'grid grid-cols-1 gap-[1rem] md:grid-cols-2 lg:grid-cols-3'

export function DashboardPage({ repo }: DashboardPageProps) {
  const { t } = useTranslation('dashboard')
  const { role } = useAuth()

  const activeRepo = repo ?? getSharedDashboardRepository()
  const { data, loading, error, reload } = useDashboard(activeRepo, role)

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-[1rem]" aria-busy="true">

        {/* ROW 1: asymmetric 5/4/3 skeleton — hero + 2 wide cards */}
        <div className={ROW1_GRID}>
          {/* Hero card: col-span-2 on mobile, 5fr on desktop */}
          <div
            className="col-span-2 lg:col-span-1 bg-surface rounded-[1.25rem] border border-white/[0.06] anim-skeleton"
            style={{ minHeight: '12rem' }}
          />
          {/* Wide card 2 */}
          <div
            className="bg-surface rounded-[1.25rem] border border-white/[0.06] anim-skeleton"
            style={{ minHeight: '9rem' }}
          />
          {/* Wide card 3 */}
          <div
            className="bg-surface rounded-[1.25rem] border border-white/[0.06] anim-skeleton"
            style={{ minHeight: '9rem' }}
          />
        </div>

        {/* ROW 2: 3 compact KPI card shimmers */}
        <div className={ROW2_GRID}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="bg-surface rounded-[1rem] border border-white/[0.06] anim-skeleton"
              style={{ height: '4.5rem' }}
            />
          ))}
        </div>

        {/* ROW 3: АКТИВЫ + ЗАПЧАСТИ — natural height, no fixed h */}
        <div className={ROW3_GRID}>
          {/* АКТИВЫ shimmer */}
          <div className="bg-surface rounded-[1.125rem] border border-white/[0.06] overflow-hidden" style={{ minHeight: '16rem' }}>
            <div style={{ padding: '1.5rem 1.625rem 0' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '1.125rem' }}>
                <div className="flex items-center" style={{ gap: '0.625rem' }}>
                  <div className="w-4 h-4 rounded anim-skeleton" />
                  <div className="h-3 w-16 rounded anim-skeleton" />
                </div>
                <div className="h-3 w-20 rounded anim-skeleton" />
              </div>
            </div>
            <div style={{ padding: '0 1.625rem 1.5rem' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center"
                  style={{ gap: '0.625rem', paddingTop: '0.8125rem', paddingBottom: '0.8125rem' }}
                >
                  <div className="w-[0.4375rem] h-[0.4375rem] rounded-full bg-border flex-shrink-0" />
                  <div className="h-3 flex-1 rounded anim-skeleton" />
                  <div className="h-3 w-10 rounded anim-skeleton" />
                </div>
              ))}
            </div>
          </div>

          {/* ЗАПЧАСТИ shimmer */}
          <div className="bg-surface rounded-[1.125rem] border border-white/[0.06] overflow-hidden" style={{ minHeight: '16rem' }}>
            <div style={{ padding: '1.5rem 1.625rem 0' }}>
              <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: '1.125rem' }}>
                <div className="flex items-center" style={{ gap: '0.625rem' }}>
                  <div className="w-4 h-4 rounded anim-skeleton" />
                  <div className="h-3 w-16 rounded anim-skeleton" />
                </div>
                <div className="h-5 w-20 rounded-full anim-skeleton" />
              </div>
              <div className="flex items-baseline" style={{ gap: '0.375rem', marginBottom: '0.5rem' }}>
                <div className="h-7 w-12 rounded anim-skeleton" />
                <div className="h-3 w-24 rounded anim-skeleton" />
              </div>
            </div>
            <div style={{ padding: '0 1.625rem 1.5rem' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-start"
                  style={{ gap: '0.625rem', paddingTop: '0.8125rem', paddingBottom: '0.8125rem' }}
                >
                  <div className="w-[0.4375rem] h-[0.4375rem] rounded-full bg-border flex-shrink-0 mt-1" />
                  <div className="flex-1 flex flex-col" style={{ gap: '0.25rem' }}>
                    <div className="h-3 w-full rounded anim-skeleton" />
                    <div className="h-2.5 w-3/4 rounded anim-skeleton" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ROW 4: 3 domain-box shimmers — min-h-200px each */}
        <div className={ROW4_GRID}>
          {(['employees', 'subscriptions', 'branches'] as DomainBoxKey[]).map(key => (
            <div
              key={key}
              className="bg-surface rounded-[1.125rem] border border-white/[0.06] overflow-hidden"
              style={{ minHeight: '12.5rem' }}
            >
              <div style={{ padding: '1.5rem 1.625rem 0', marginBottom: '1.125rem' }}>
                <div className="flex items-center" style={{ gap: '0.625rem' }}>
                  <div className="w-4 h-4 rounded anim-skeleton" />
                  <div className="h-3 w-20 rounded anim-skeleton" />
                </div>
              </div>
              <div style={{ padding: '0 1.625rem 1.5rem' }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center"
                    style={{ gap: '0.625rem', paddingTop: '0.8125rem', paddingBottom: '0.8125rem' }}
                  >
                    <div className="w-[0.4375rem] h-[0.4375rem] rounded-full bg-border flex-shrink-0" />
                    <div className="h-3 flex-1 rounded anim-skeleton" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ROW 5: slim Отделы shimmer */}
        <div
          className="bg-surface rounded-[1.125rem] border border-white/[0.06] anim-skeleton"
          style={{ height: '4rem' }}
        />
      </div>
    )
  }

  const assets = data.assets

  // Strip linkTo from events when the role can't reach the target list/detail
  function resolveEvents(key: DomainBoxKey) {
    if (!data.boxes) return []
    const box = data.boxes[key]
    const linked = canAccess(role, BOX_META[key].routeId)
    return linked
      ? box.events
      : box.events.map(({ linkTo: _linkTo, ...rest }) => rest)
  }

  function resolveBox(key: DomainBoxKey) {
    if (!data.boxes) return null
    return data.boxes[key]
  }

  return (
    <div className="space-y-[1rem]">
      {error && (
        <div data-testid="dashboard-error">
          <ErrorState onRetry={reload} compact />
        </div>
      )}

      {/* ── ROW 1: асимметричные KPI-карты 5fr / 4fr / 3fr ───────────────────── */}
      {/*
          Card 1 — «Всего активов»: variant='hero' — col-span-2 mobile, 5fr desktop.
          Card 2 — «Выдано сейчас»: variant='wide' — 4fr.
          Card 3 — «На складе»: variant='wide' — 3fr.
          Radius 20px (1.25rem), padding 26px 28px, gradient bg, colored border ~15%.
      */}
      <div className={ROW1_GRID}>
        {assets && (
          <StatCard
            icon="package"
            label={t('kpi.totalAssets')}
            value={assets.total}
            to="/assets"
            accent="orange"
            variant="hero"
            days={resolveBox('assets')?.days ?? [0,0,0,0,0,0,0]}
            delta7d={resolveBox('assets')?.delta7d ?? 0}
            barClass="bg-accent/70"
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
            variant="wide"
          />
        )}
        {assets && (
          <StatCard
            icon="inbox"
            label={t('kpi.inWarehouse')}
            value={assets.byStatus[ASSET_STATUS.warehouse]}
            to="/assets"
            accent="blue"
            variant="wide"
          />
        )}
      </div>

      {/* ── ROW 2: три КОМПАКТНЫХ горизонтальных KPI-карты ───────────────────── */}
      {/*
          bg-surface, border white/6%, radius 16px (1rem), padding 18px 22px,
          icon-box 32px radius 9px colored, число 22px белое, подпись 13px muted.
      */}
      <div className={ROW2_GRID}>
        {data.workstationLicenses && (
          <StatCard
            icon="key-round"
            label={t('kpi.licenses')}
            value={data.workstationLicenses.total}
            {...(canAccess(role, 'licenses') ? { to: '/licenses' } : {})}
            accent="violet"
            variant="compact"
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
            variant="compact"
            testId="section-people"
          />
        )}
        {assets && (
          <StatCard
            icon="archive-x"
            label={t('kpi.writtenOff')}
            value={assets.byStatus[ASSET_STATUS.disposed]}
            to="/assets"
            accent="rose"
            variant="compact"
            testId="section-written-off"
          />
        )}
      </div>

      {/* ── ROW 3: АКТИВЫ (7fr) + ЗАПЧАСТИ (5fr) ────────────────────────────── */}
      {/* Height is natural — grid stretch aligns both. No lg:h-[19rem] fixed heights. */}
      {data.boxes && (
        <div className={ROW3_GRID}>
          {/* АКТИВЫ: standard variant, headerLink=true → «Все активы →» in header */}
          {(() => {
            const key: DomainBoxKey = 'assets'
            const meta = BOX_META[key]
            const box = data.boxes[key]
            const linked = canAccess(role, meta.routeId)
            const events = resolveEvents(key)
            const pending = data.assets?.byStatus.st_pending ?? 0
            const inRepair = data.assets?.byStatus.st_repair ?? 0
            const assetAlerts: DomainBoxAlert[] = [
              ...(pending > 0
                ? [{ id: 'pending', label: t('boxes.alerts.pending', { n: pending }), chipClass: 'text-warning bg-warning/15', ...(linked ? { to: '/assets' } : {}) }]
                : []),
              ...(inRepair > 0
                ? [{ id: 'repair', label: t('boxes.alerts.repair', { n: inRepair }), chipClass: 'text-info bg-info/15', ...(linked ? { to: '/assets' } : {}) }]
                : []),
            ]
            return (
              <DomainBox
                key={key}
                icon={meta.icon}
                {...(meta.iconTone ? { iconTone: meta.iconTone } : {})}
                title={t(`boxes.${key}.title`)}
                total={boxTotal(key, data)}
                delta7d={box.delta7d}
                events={events}
                barClass={meta.barClass}
                headerLink={linked}
                fillHeight
                {...(assetAlerts.length > 0 ? { alerts: assetAlerts } : {})}
                {...(linked ? { viewAllTo: meta.path } : {})}
                viewAllLabel={t(`boxes.${key}.viewAll`)}
                emptyLabel={t('boxes.empty')}
                variant="standard"
                testId={`domain-box-${key}`}
              />
            )
          })()}

          {/* ЗАПЧАСТИ: parts variant — hero-число + feed flex-1 centered + rose link */}
          {(() => {
            const key: DomainBoxKey = 'parts'
            const meta = BOX_META[key]
            const box = data.boxes[key]
            const linked = canAccess(role, meta.routeId)
            const events = resolveEvents(key)
            return (
              <DomainBox
                key={key}
                icon={meta.icon}
                {...(meta.iconTone ? { iconTone: meta.iconTone } : {})}
                title={t(`boxes.${key}.title`)}
                total={boxTotal(key, data)}
                delta7d={box.delta7d}
                events={events}
                barClass={meta.barClass}
                fillHeight
                {...(linked ? { viewAllTo: meta.path } : {})}
                viewAllLabel={t(`boxes.${key}.viewAll`)}
                emptyLabel={t('boxes.empty')}
                totalCaption={t('boxes.partsUnits')}
                variant="parts"
                testId={`domain-box-${key}`}
              />
            )
          })()}
        </div>
      )}

      {/* ── ROW 4: СОТРУДНИКИ + ПОДПИСКИ + ФИЛИАЛЫ ───────────────────────────── */}
      {/* min-h-200px (12.5rem) each, flex-col, empty-state circle, footer link */}
      {data.boxes && (
        <div className={ROW4_GRID}>
          {(['employees', 'subscriptions', 'branches'] as DomainBoxKey[]).map(key => {
            const meta = BOX_META[key]
            const box = data.boxes![key]
            const linked = canAccess(role, meta.routeId)
            const events = resolveEvents(key)
            return (
              <DomainBox
                key={key}
                icon={meta.icon}
                {...(meta.iconTone ? { iconTone: meta.iconTone } : {})}
                title={t(`boxes.${key}.title`)}
                total={boxTotal(key, data)}
                delta7d={box.delta7d}
                events={events}
                barClass={meta.barClass}
                {...(linked ? { viewAllTo: meta.path } : {})}
                viewAllLabel={t(`boxes.${key}.viewAll`)}
                emptyLabel={t('boxes.empty')}
                variant="standard"
                testId={`domain-box-${key}`}
              />
            )
          })}
        </div>
      )}

      {/* ── ROW 5: ОТДЕЛЫ — slim strip на всю ширину ──────────────────────────── */}
      {/* flex items-center gap 28px, padding 24px 26px, vertical divider 1px×24px */}
      {data.boxes && (() => {
        const key: DomainBoxKey = 'departments'
        const meta = BOX_META[key]
        const box = data.boxes[key]
        const linked = canAccess(role, meta.routeId)
        const events = resolveEvents(key)
        return (
          <DomainBox
            icon={meta.icon}
            {...(meta.iconTone ? { iconTone: meta.iconTone } : {})}
            title={t(`boxes.${key}.title`)}
            total={boxTotal(key, data)}
            delta7d={box.delta7d}
            events={events}
            barClass={meta.barClass}
            {...(linked ? { viewAllTo: meta.path } : {})}
            viewAllLabel={t(`boxes.${key}.viewAll`)}
            emptyLabel={t('boxes.empty')}
            variant="slim"
            testId={`domain-box-${key}`}
          />
        )
      })()}
    </div>
  )
}

