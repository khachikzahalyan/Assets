import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Chip, ErrorState, EmptyState, Icon, DataTable, TabStrip, TableSkeleton, MobileListPlaceholders,
} from '@/components/ui'
import type { DataTableColumn, TabStripItem } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { Asset, AssetRepository, SelfServiceRefData } from '@/domain/asset'
import { ASSET_STATUS } from '@/domain/asset'
import {
  assetTitle,
  assetSubtitle,
  deriveDisplayStatus,
  statusLabel,
} from '@/components/features/assets/assetFormat'
import { resolveCategoryColor } from '@/components/common/categoryColors'
import { getSharedAssetRepository, getSharedSubscriptionRepository } from '@/infra/repositories'
import { confirmReceipt } from '@/lib/notifications/confirmReceipt'
import { canAccess } from '@/config/access'
import type { EmployeeRepository } from '@/domain/employee'
import type { SubscriptionRepository, Subscription } from '@/domain/subscription'
import { LicensesPagination } from '@/components/features/licenses/LicensesPagination'
import { fmtDate } from '@/components/features/licenses/licenseHelpers'
import { formatDateRu } from '@/components/features/employees/employeeFormat'

// ── Constants ──────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10

type ActiveTab = 'assets' | 'subs'

// ── Helpers ────────────────────────────────────────────────────────────────────

// ── Mobile row sub-component ────────────────────────────────────────────────────
interface MobileAssetRowProps {
  asset: Asset
  statusMap: Map<string, { id: string; name: string; color: string }>
  categoryMap: Map<string, { id: string; name: string; lucideIcon: string }>
  canOpenAsset: boolean
  confirmingId: string | null
  onConfirm: (id: string) => void
  navigate: ReturnType<typeof useNavigate>
  t: ReturnType<typeof useTranslation>['t']
  tAssets: ReturnType<typeof useTranslation>['t']
  refData?: SelfServiceRefData | null
}

function MobileAssetRow({
  asset: a,
  statusMap,
  categoryMap,
  canOpenAsset,
  confirmingId,
  onConfirm,
  navigate,
  t,
  tAssets,
  refData,
}: MobileAssetRowProps) {
  const category = categoryMap.get(a.categoryId)
  const catColor  = resolveCategoryColor(a.categoryId, category?.lucideIcon)
  const title     = assetTitle(a, category?.name || '—')
  const isPending = a.statusId === ASSET_STATUS.pending
  const isBusy    = confirmingId === a.id
  const displayStatus = refData ? deriveDisplayStatus(a, refData.statuses) : statusMap.get(a.statusId) ?? null

  return (
    <div
      role={canOpenAsset ? 'button' : undefined}
      tabIndex={canOpenAsset ? 0 : undefined}
      aria-label={canOpenAsset ? title : undefined}
      onClick={canOpenAsset ? () => navigate('/assets/' + a.id) : undefined}
      onKeyDown={canOpenAsset ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/assets/' + a.id) }
      } : undefined}
      data-testid={`my-asset-row-mobile-${a.id}`}
      className={[
        'flex items-center gap-3 px-3.5 py-[0.4375rem] border-b border-border/50',
        canOpenAsset ? 'cursor-pointer hover:bg-surface-2/50' : '',
        isPending ? 'bg-amber-500/5' : '',
      ].filter(Boolean).join(' ')}
      style={{ flexGrow: 1, flexShrink: 0 }}
    >
      {/* Category icon tile */}
      <span
        className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center text-text-tertiary shrink-0"
        style={catColor ? { backgroundColor: catColor.bg, color: catColor.icon } : undefined}
      >
        <Icon name={category?.lucideIcon ?? 'box'} size={15} />
      </span>

      {/* Middle: title + subtitle (инв. код + дата выдачи / pending-чип) */}
      <div className="min-w-0 flex-1">
        <div className="text-13 font-bold text-text-primary leading-snug mb-0.5 truncate">{title}</div>
        <div className="text-11 text-text-tertiary leading-snug flex items-center gap-1">
          <span className="font-mono">{a.invCode}</span>
          <span className="text-text-subtle">·</span>
          {isPending && displayStatus ? (
            <Chip color="amber" dot>
              {statusLabel(displayStatus, tAssets)}
            </Chip>
          ) : (
            <span className="tabular-nums text-text-tertiary">
              {formatDateRu(new Date(a.updatedAt))}
            </span>
          )}
        </div>
      </div>

      {/* Confirm button — pending rows only */}
      {isPending && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onConfirm(a.id) }}
          disabled={isBusy}
          aria-label={t('self.confirmReceipt')}
          className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg text-accent bg-accent/10 border border-accent/30 hover:bg-accent/15 transition-colors disabled:opacity-60 disabled:pointer-events-none"
        >
          <Icon name="check" size={14} />
        </button>
      )}
    </div>
  )
}

// ── Mobile subscription row ────────────────────────────────────────────────────
interface MobileSubRowProps {
  sub: Subscription
  locale: string
  tLicenses: ReturnType<typeof useTranslation>['t']
}

function MobileSubRow({ sub, locale, tLicenses }: MobileSubRowProps) {
  const seatsUsed = sub.assignedEmployeeIds.length
  return (
    <div
      data-testid={`my-sub-row-mobile-${sub.id}`}
      className="flex items-center gap-3 px-3.5 py-[0.4375rem] border-b border-border/50"
      style={{ flexGrow: 1, flexShrink: 0 }}
    >
      {/* Icon tile */}
      <span
        className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center text-text-tertiary shrink-0"
        aria-hidden="true"
      >
        <Icon name="boxes" size={15} />
      </span>

      {/* Middle: name + email */}
      <div className="min-w-0 flex-1">
        <div className="text-13 font-bold text-text-primary leading-snug mb-0.5 truncate">{sub.name}</div>
        {sub.vendorEmail && (
          <div className="text-11 text-text-tertiary font-mono leading-snug truncate">{sub.vendorEmail}</div>
        )}
      </div>

      {/* Seats + expiry */}
      <div className="text-right shrink-0">
        <div className="text-13 font-semibold text-text-primary leading-snug">
          {tLicenses('subs.seatsProgress', { used: seatsUsed, total: sub.seatsTotal })}
        </div>
        {sub.expiryDate && (
          <div className="text-11 text-text-tertiary leading-snug">
            {fmtDate(sub.expiryDate, locale)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Props ───────────────────────────────────────────────────────────────────────
export interface MyAssetsPageProps {
  repository?: AssetRepository
  /** @deprecated kept for backward-compat with tests; no longer used by the component */
  employeeRepository?: EmployeeRepository
  subscriptionRepo?: SubscriptionRepository
}

// ── Component ───────────────────────────────────────────────────────────────────
export function MyAssetsPage({ repository, subscriptionRepo }: MyAssetsPageProps) {
  const { t }          = useTranslation('employees')
  const tAssets        = useTranslation('assets').t
  const { t: tLic, i18n } = useTranslation('licenses')
  const { user, role } = useAuth()
  const { showToast }  = useToast()
  const navigate       = useNavigate()
  const isMobile       = useIsMobile()
  const canOpenAsset   = canAccess(role, 'assets')
  const employeeDocId  = user.employeeId ?? user.id

  const repo    = repository ?? getSharedAssetRepository()
  const subRepo = subscriptionRepo ?? getSharedSubscriptionRepository()

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('assets')

  // ── Pagination — shared, reset on tab change ──────────────────────────────
  const [page, setPage] = useState(1)

  // ── Assets ────────────────────────────────────────────────────────────────
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [assets, setAssets]       = useState<Asset[]>([])
  const [ref, setRef]             = useState<SelfServiceRefData | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // ── Subscriptions — best-effort ───────────────────────────────────────────
  const [subs, setSubs] = useState<Subscription[]>([])
  useEffect(() => {
    subRepo.listSubscriptionsForEmployee(employeeDocId).then(setSubs).catch(() => { /* hidden */ })
  }, [subRepo, employeeDocId])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [mine, refData] = await Promise.all([
        repo.listAssetsForEmployee(employeeDocId),
        repo.loadSelfServiceRefData(),
      ])
      setAssets(mine)
      setRef(refData)
    } catch {
      setLoadError(t('validation.saveFailed'))
    } finally {
      setLoading(false)
    }
  }, [repo, employeeDocId, t])

  // In-app receipt confirmation
  const handleConfirm = useCallback(async (assetId: string) => {
    setConfirmingId(assetId)
    const { ok } = await confirmReceipt(assetId)
    if (ok) {
      showToast(t('self.confirmReceiptDone'))
      setAssets(prev => prev.map(a =>
        a.id === assetId ? { ...a, statusId: ASSET_STATUS.assigned } : a,
      ))
      if (typeof repo.subscribeAssetsForEmployee !== 'function') void load()
    } else {
      showToast(t('self.confirmReceiptFailed'), { variant: 'error' })
    }
    setConfirmingId(null)
  }, [repo, load, showToast, t])

  // Realtime subscription or one-shot load
  useEffect(() => {
    if (typeof repo.subscribeAssetsForEmployee !== 'function') {
      void load()
      return
    }
    let active = true
    setLoading(true)
    setLoadError(null)
    repo.loadSelfServiceRefData()
      .then(refData => { if (active) setRef(refData) })
      .catch(() => { /* best-effort */ })
    const unsub = repo.subscribeAssetsForEmployee(
      employeeDocId,
      mine => { if (!active) return; setAssets(mine); setLoading(false) },
      () => { if (!active) return; setLoadError(t('validation.saveFailed')); setLoading(false) },
    )
    return () => { active = false; unsub() }
  }, [repo, employeeDocId, load, t])

  // ── Maps ──────────────────────────────────────────────────────────────────
  const statusMap = useMemo(
    () => new Map((ref?.statuses ?? []).map(s => [s.id, s])),
    [ref],
  )
  const categoryMap = useMemo(
    () => new Map((ref?.categories ?? []).map(c => [c.id, c])),
    [ref],
  )

  // ── Computed asset slices ─────────────────────────────────────────────────
  // All non-disposed assets: pending first, then assigned/others
  const tableAssets = useMemo(() => {
    const nonDisposed = assets.filter(a => a.statusId !== ASSET_STATUS.disposed)
    const pending  = nonDisposed.filter(a => a.statusId === ASSET_STATUS.pending)
    const rest     = nonDisposed.filter(a => a.statusId !== ASSET_STATUS.pending)
    return [...pending, ...rest]
  }, [assets])

  // Subscriptions pagination slice
  const subsPageRows = useMemo(
    () => subs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [subs, page],
  )

  // Assets pagination slice
  const assetPageRows = useMemo(
    () => tableAssets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [tableAssets, page],
  )

  // ── Desktop DataTable columns — assets ───────────────────────────────────
  const myPropertyColumns = useMemo<DataTableColumn<Asset>[]>(() => [
    {
      key: 'asset',
      header: tAssets('cols.asset'),
      width: 'minmax(12rem,2fr)',
      cellClassName: 'flex items-center gap-2.5 min-w-0',
      cell: (a) => {
        const cat      = categoryMap.get(a.categoryId)
        const catColor = resolveCategoryColor(a.categoryId, cat?.lucideIcon)
        const title    = assetTitle(a, cat?.name || '—', cat?.group)
        const sub      = assetSubtitle(a, cat?.name ?? '', cat?.group)
        return (
          <>
            <span
              className="w-9 h-9 rounded-lg bg-surface-2 border border-border text-text-tertiary inline-flex items-center justify-center flex-shrink-0 transition-colors duration-[180ms]"
              style={catColor ? { backgroundColor: catColor.bg, color: catColor.icon, borderColor: catColor.icon } : undefined}
            >
              <Icon name={cat?.lucideIcon ?? 'box'} size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-15.5 font-semibold text-text-primary truncate leading-tight">
                {title}
              </div>
              {sub && (
                <div className="text-13.5 text-text-tertiary truncate leading-tight mt-0.5">
                  {sub}
                </div>
              )}
            </div>
          </>
        )
      },
    },
    {
      key: 'code',
      header: tAssets('cols.code'),
      width: 'minmax(6rem,0.85fr)',
      cell: (a) => (
        <span className="inline-block max-w-full truncate font-mono text-14 font-semibold text-text-secondary bg-bg border border-border rounded-md px-1.5 py-0.5">
          {a.invCode}
        </span>
      ),
    },
    {
      key: 'handedOverAt',
      header: t('self.handedOverAt'),
      width: 'minmax(6.5rem,0.9fr)',
      cell: (a) => {
        if (a.statusId === ASSET_STATUS.pending) {
          const displayStatus = ref ? deriveDisplayStatus(a, ref.statuses) : statusMap.get(a.statusId)
          if (!displayStatus) return null
          return <Chip color="amber" dot>{statusLabel(displayStatus, tAssets)}</Chip>
        }
        return (
          <span className="tabular-nums text-text-tertiary text-14">
            {formatDateRu(new Date(a.updatedAt))}
          </span>
        )
      },
    },
    {
      key: 'action',
      header: '',
      width: '9rem',
      align: 'right',
      cell: (a) => {
        if (a.statusId !== ASSET_STATUS.pending) return null
        const isBusy = confirmingId === a.id
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void handleConfirm(a.id) }}
            disabled={isBusy}
            aria-label={t('self.confirmReceipt')}
            data-testid={`confirm-btn-${a.id}`}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-12 font-semibold text-accent border border-accent/30 bg-accent/10 hover:bg-accent/20 transition-colors whitespace-nowrap disabled:opacity-60 disabled:pointer-events-none"
          >
            <Icon name="check" size={12} />
            {t('self.confirmReceipt')}
          </button>
        )
      },
    },
  ], [tAssets, categoryMap, ref, statusMap, confirmingId, handleConfirm, t])

  // ── Desktop DataTable columns — subscriptions ─────────────────────────────
  const subColumns = useMemo<DataTableColumn<Subscription>[]>(() => [
    {
      key: 'name',
      header: tLic('subs.colSubscription'),
      width: 'minmax(11rem,2fr)',
      cellClassName: 'flex items-center gap-2.5 min-w-0',
      cell: (s) => (
        <>
          <span
            className="w-9 h-9 rounded-lg bg-surface-2 border border-border text-text-tertiary inline-flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            <Icon name="boxes" size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-15.5 font-semibold text-text-primary truncate leading-tight">
              {s.name}
            </div>
          </div>
        </>
      ),
    },
    {
      key: 'account',
      header: tLic('subs.colAccount'),
      width: 'minmax(9rem,1.5fr)',
      cell: (s) => s.vendorEmail
        ? (
          <span className="font-mono text-14 text-text-secondary truncate block max-w-full">
            {s.vendorEmail}
          </span>
        )
        : <span className="text-text-subtle italic text-13.5">—</span>,
    },
    {
      key: 'seats',
      header: tLic('subs.seats'),
      width: 'minmax(5rem,0.8fr)',
      cell: (s) => {
        const used = s.assignedEmployeeIds.length
        const total = s.seatsTotal
        return (
          <span className="text-14 font-semibold text-text-primary">
            {used}
            <span className="text-text-subtle font-normal"> / {total}</span>
          </span>
        )
      },
    },
    {
      key: 'purchaseDate',
      header: tLic('subs.purchaseDate'),
      width: 'minmax(6rem,0.85fr)',
      cell: (s) => s.purchaseDate
        ? <span className="font-mono text-14 text-text-secondary">{fmtDate(s.purchaseDate, i18n.language)}</span>
        : <span className="text-text-subtle">—</span>,
    },
    {
      key: 'expiryDate',
      header: tLic('subs.expiryDate'),
      width: 'minmax(6rem,0.85fr)',
      cell: (s) => s.expiryDate
        ? <span className="font-mono text-14 text-text-secondary">{fmtDate(s.expiryDate, i18n.language)}</span>
        : <span className="text-text-subtle">—</span>,
    },
  ], [tLic, i18n.language])

  // ── Tab items ─────────────────────────────────────────────────────────────
  const tabItems: TabStripItem<ActiveTab>[] = [
    { id: 'assets', icon: 'package', label: t('self.myAssets'),       count: tableAssets.length, testId: 'tab-my-assets' },
    { id: 'subs',   icon: 'boxes',   label: t('self.mySubscriptions'), count: subs.length,        testId: 'tab-my-subs'   },
  ]

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        aria-busy="true"
        className="flex flex-col h-full min-h-0 max-md:flex-none max-md:h-[var(--flush-locked-height)] max-md:overflow-hidden"
      >
        {/* Card wrapper */}
        <div className="bg-surface border border-border rounded-xl shadow-sm shadow-black/30 light:shadow-slate-200/80 overflow-hidden flex flex-col flex-1 min-h-0 max-md:mx-2.5 max-md:rounded-xl">

          {/* Tab strip shimmer — real tabs, count=0 to avoid layout shift */}
          <div className="border-b border-border shrink-0">
            <div className="flex items-center px-5 max-md:px-3.5">
              <TabStrip<ActiveTab>
                tabs={[
                  { id: 'assets', icon: 'package', label: t('self.myAssets'),       count: 0, testId: 'tab-my-assets-sk' },
                  { id: 'subs',   icon: 'boxes',   label: t('self.mySubscriptions'), count: 0, testId: 'tab-my-subs-sk'   },
                ]}
                active="assets"
                onChange={() => {}}
                size="md"
              />
            </div>
          </div>

          {/* Table skeleton — fills remaining height (no layout shift) */}
          <div className="flex-1 min-h-0" aria-hidden="true">
            <TableSkeleton
              rows={PAGE_SIZE}
              columns={4}
              firstColWide
              gridTemplate="minmax(12rem,2fr) minmax(6rem,0.85fr) minmax(6.5rem,0.9fr) 9rem"
              headers={[tAssets('cols.asset'), tAssets('cols.code'), t('self.handedOverAt'), '']}
            />
          </div>

          {/* Pagination — always mounted (no layout shift) */}
          <LicensesPagination page={1} pageSize={PAGE_SIZE} total={0} onPage={() => {}} />
        </div>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex flex-col h-full min-h-0 max-md:flex-none max-md:h-[var(--flush-locked-height)] max-md:overflow-hidden max-md:mx-2.5">
        <div className="bg-surface border border-border rounded-xl shadow-sm shadow-black/30 light:shadow-slate-200/80 overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="flex-1 flex items-center justify-center p-6">
            <ErrorState onRetry={load} />
          </div>
        </div>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    /*
     * Full-height viewport-locked column — mirrors LicensesPage exactly.
     * Desktop: h-full inside .app-shell-content → the card stretches to the bottom.
     * Mobile: max-md:h-[var(--flush-locked-height)] + overflow-hidden so the tab
     *   chrome stays pinned; only the tab body scrolls inside its own region.
     * FLUSH_ROUTES must include 'my-assets' in AppShell.tsx for this to work.
     */
    <div className="flex flex-col h-full min-h-0 max-md:space-y-0 max-md:flex-none max-md:h-[var(--flush-locked-height)] max-md:overflow-hidden max-md:mx-2.5">
      {/* Single card containing tabs + body */}
      <div className="bg-surface border border-border rounded-xl shadow-sm shadow-black/30 light:shadow-slate-200/80 overflow-hidden flex flex-col flex-1 min-h-0">

        {/* ── 1. Tab strip — shrink-0 ── */}
        <div className="border-b border-border shrink-0">
          <div className="flex items-center px-5 max-md:px-3.5">
            <TabStrip<ActiveTab>
              tabs={tabItems}
              active={activeTab}
              onChange={(tab) => { setActiveTab(tab); setPage(1) }}
              size="md"
            />
          </div>
        </div>

        {/* ── 2. Tab body — flex-1 min-h-0 ── */}

        {/* Assets tab */}
        {activeTab === 'assets' && (
          <div className="flex flex-col flex-1 min-h-0">
            {tableAssets.length === 0 ? (
              /* Empty state fills the stretch zone */
              <div className="flex flex-col flex-1 items-center justify-center px-6 py-12 text-center">
                <EmptyState
                  icon="package"
                  title={t('self.noAssets')}
                />
              </div>
            ) : (
              <>
                {isMobile ? (
                  /* ── Mobile card list — fill contract identical to WindowsKeysSection ── */
                  <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
                    {assetPageRows.map(a => (
                      <MobileAssetRow
                        key={a.id}
                        asset={a}
                        statusMap={statusMap}
                        categoryMap={categoryMap}
                        canOpenAsset={canOpenAsset}
                        confirmingId={confirmingId}
                        onConfirm={(id) => { void handleConfirm(id) }}
                        navigate={navigate}
                        t={t}
                        tAssets={tAssets}
                        refData={ref}
                      />
                    ))}
                    <MobileListPlaceholders
                      count={PAGE_SIZE - assetPageRows.length}
                      dataTestId="my-asset-placeholder"
                    />
                  </div>
                ) : (
                  /* ── Desktop DataTable — fillHeight fill contract ── */
                  <DataTable<Asset>
                    columns={myPropertyColumns}
                    rows={assetPageRows}
                    getRowKey={a => a.id}
                    getRowDataTestId={a => `my-asset-row-${a.id}`}
                    {...(canOpenAsset ? { onRowClick: (a) => navigate('/assets/' + a.id) } : {})}
                    minRows={PAGE_SIZE}
                    fillHeight
                    aria-label={t('self.myProperty')}
                  />
                )}

                {/* Pagination — always mounted, pinned at bottom */}
                <LicensesPagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={tableAssets.length}
                  onPage={setPage}
                />
              </>
            )}
          </div>
        )}

        {/* Subscriptions tab */}
        {activeTab === 'subs' && (
          <div className="flex flex-col flex-1 min-h-0">
            {subs.length === 0 ? (
              /* Empty state fills the stretch zone */
              <div className="flex flex-col flex-1 items-center justify-center px-6 py-12 text-center">
                <EmptyState
                  icon="boxes"
                  title={t('self.mySubscriptions')}
                />
              </div>
            ) : (
              <>
                {isMobile ? (
                  /* ── Mobile list — one-column card rows ── */
                  <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
                    {subsPageRows.map(s => (
                      <MobileSubRow
                        key={s.id}
                        sub={s}
                        locale={i18n.language}
                        tLicenses={tLic}
                      />
                    ))}
                    <MobileListPlaceholders
                      count={PAGE_SIZE - subsPageRows.length}
                      dataTestId="my-sub-placeholder"
                    />
                  </div>
                ) : (
                  /* ── Desktop DataTable — fillHeight fill contract ── */
                  <DataTable<Subscription>
                    columns={subColumns}
                    rows={subsPageRows}
                    getRowKey={s => s.id}
                    getRowDataTestId={s => `my-sub-row-${s.id}`}
                    minRows={PAGE_SIZE}
                    fillHeight
                    aria-label={t('self.mySubscriptions')}
                  />
                )}

                {/* Pagination — always mounted, pinned at bottom */}
                <LicensesPagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={subs.length}
                  onPage={setPage}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
