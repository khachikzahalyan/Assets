import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { Btn, Icon, ErrorState, TableSkeleton, CardListSkeleton, SearchInput, SectionCard, TabStrip } from '@/components/ui'
import type { TabStripItem } from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  WindowsKeysSection,
  SubscriptionsSection,
  AddSubscriptionModal,
} from '@/components/features/licenses'
import type {
  WorkstationLicenseRepository,
  WorkstationLicense,
} from '@/domain/license'
import type { AuditLogRepository, AuditLog } from '@/domain/audit'
import type { SubscriptionRepository, Subscription } from '@/domain/subscription'
import type { EmployeeRepository, Employee } from '@/domain/employee'
import type { AssetRepository, Actor } from '@/domain/asset'
import type { CreateSubscriptionInput } from '@/domain/subscription'
import {
  getSharedWorkstationLicenseRepository,
  getSharedAuditLogRepository,
  getSharedSubscriptionRepository,
  getSharedEmployeeRepository,
  getSharedAssetRepository,
} from '@/infra/repositories'
import { db } from '@/lib/firebase'
import { getMaskedLicenseKey } from '@/lib/licenses/maskedKey'
import { cacheIdentity, readResourceCache, writeResourceCache } from '@/hooks/useCachedResource'

import { resolveCategoryCapabilities } from '@/domain/asset/categoryCapabilities'
import type { KeylessAsset } from '@/components/features/licenses/ActivateKeyModal'
import type { Asset, CategoryRow } from '@/domain/asset'

interface WorkstationSnapshot {
  rows: WorkstationLicense[]
  maskedKeys: Record<string, string>
}

interface SubsSnapshot {
  subs: Subscription[]
}

type ActiveTab = 'keys' | 'subs'

export interface LicensesPageProps {
  workstationRepo?: WorkstationLicenseRepository
  /** @deprecated serverRepo is no longer used (server tab removed in this version). Kept for test backwards-compat. */
  serverRepo?: unknown
  auditRepo?: AuditLogRepository
  subscriptionRepo?: SubscriptionRepository
  employeeRepo?: EmployeeRepository
  assetRepo?: AssetRepository
}

export function LicensesPage({
  workstationRepo,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  serverRepo: _serverRepo,
  auditRepo,
  subscriptionRepo,
  employeeRepo,
  assetRepo,
}: LicensesPageProps) {
  const { t } = useTranslation('licenses')
  const { user, role } = useAuth()
  const isMobile = useIsMobile()

  const canReveal = role === 'super_admin' || role === 'tech_admin'

  const actor = useMemo<Actor>(() => ({ uid: user.id, role, displayName: user.name }), [user.id, role, user.name])

  // ── Composition root — use injected repos (tests) or module singletons ──────
  const wRepo = workstationRepo ?? getSharedWorkstationLicenseRepository()
  const aRepo = auditRepo ?? getSharedAuditLogRepository()
  const subRepo = subscriptionRepo ?? getSharedSubscriptionRepository()
  const empRepo = employeeRepo ?? getSharedEmployeeRepository()
  const assRepo = assetRepo ?? getSharedAssetRepository()

  // ── Tab state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('keys')
  const [keySearch, setKeySearch] = useState('')

  // ── Workstation licenses ─────────────────────────────────────────────────────
  const [wRows, setWRows] = useState<WorkstationLicense[]>([])
  const [wLoading, setWLoading] = useState(true)
  const [wError, setWError] = useState<string | null>(null)

  // ── Masked keys map ─────────────────────────────────────────────────────────
  const [maskedKeys, setMaskedKeys] = useState<Record<string, string>>({})

  // ── Audit entries ────────────────────────────────────────────────────────────
  const [auditMap, setAuditMap] = useState<Record<string, AuditLog[]>>({})

  // ── Assets for keyless OEM pool ─────────────────────────────────────────────
  const [assets, setAssets] = useState<Asset[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])

  // ── Subscriptions ────────────────────────────────────────────────────────────
  const [subs, setSubs] = useState<Subscription[]>([])
  const [subsLoading, setSubsLoading] = useState(true)
  const [subsError, setSubsError] = useState<string | null>(null)
  // Transient, user-visible feedback for an assignee-save failure (the list reloads
  // to re-sync, but the user must be told the change did not persist).
  const [assigneeError, setAssigneeError] = useState<string | null>(null)

  // ── Employees ────────────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([])

  // ── Add subscription modal ───────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false)
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // ── Load workstation licenses ────────────────────────────────────────────────
  const loadWorkstation = useCallback(async (guard?: { value: boolean }) => {
    const snapKey = `licenses:${cacheIdentity(wRepo)}:workstation`
    const cached = readResourceCache<WorkstationSnapshot>(snapKey)
    if (cached) {
      setWRows(cached.rows)
      setMaskedKeys(cached.maskedKeys)
    } else {
      setWLoading(true)
    }
    setWError(null)
    try {
      const rows = await wRepo.listLicenses()
      if (guard && !guard.value) return
      setWRows(rows)

      // Load masked keys for all visible rows (simple: fetch all in parallel)
      const pairs = await Promise.all(
        rows.map(async r => ({
          id: r.id,
          masked: await getMaskedLicenseKey(db(), 'licenses', r.id).catch(() => '—'),
        })),
      )
      if (guard && !guard.value) return
      const map: Record<string, string> = {}
      for (const { id, masked } of pairs) map[id] = masked
      setMaskedKeys(map)
      writeResourceCache(snapKey, { rows, maskedKeys: map })
    } catch {
      if (guard && !guard.value) return
      setWError(t('error'))
    } finally {
      if (!guard || guard.value) setWLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wRepo])

  // ── Load audit for license tab ───────────────────────────────────────────────
  const loadAudit = useCallback(async () => {
    try {
      const page = await aRepo.listAuditLogs(
        { entityType: 'license', action: 'all', actorUid: 'all', fromDate: null, toDate: null, search: '', pageSize: 200 },
        null,
      )
      const map: Record<string, AuditLog[]> = {}
      for (const entry of page.rows) {
        if (!map[entry.entityId]) map[entry.entityId] = []
        map[entry.entityId]!.push(entry)
      }
      setAuditMap(prev => ({ ...prev, ...map }))
    } catch {
      // Best-effort; never block main UI
    }
  }, [aRepo])

  // ── Load assets + categories (for keyless OEM pool) ─────────────────────────
  const loadAssets = useCallback(async (guard?: { value: boolean }) => {
    try {
      const refData = await assRepo.loadReferenceData()
      if (guard && !guard.value) return
      setCategories(refData.categories)
      const all = await assRepo.listAssets({})
      if (guard && !guard.value) return
      setAssets(all)
    } catch {
      // Best-effort — keyless pool stays empty
    }
  }, [assRepo])

  // ── Load subscriptions ───────────────────────────────────────────────────────
  const loadSubs = useCallback(async (guard?: { value: boolean }) => {
    const snapKey = `licenses:${cacheIdentity(subRepo)}:subs`
    const cached = readResourceCache<SubsSnapshot>(snapKey)
    if (cached) {
      setSubs(cached.subs)
    } else {
      setSubsLoading(true)
    }
    setSubsError(null)
    try {
      const rows = await subRepo.listSubscriptions()
      if (guard && !guard.value) return
      setSubs(rows)
      writeResourceCache(snapKey, { subs: rows })
    } catch {
      if (guard && !guard.value) return
      setSubsError(t('error'))
    } finally {
      if (!guard || guard.value) setSubsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subRepo])

  // ── Load employees ───────────────────────────────────────────────────────────
  const loadEmployees = useCallback(async (guard?: { value: boolean }) => {
    try {
      const rows = await empRepo.listEmployees({ status: 'active' })
      if (guard && !guard.value) return
      setEmployees(rows)
    } catch {
      // Best-effort; no employees means selects stay empty
    }
  }, [empRepo])

  // ── Initial load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const guard = { value: true }
    void loadWorkstation(guard)
    void loadAudit()
    void loadAssets(guard)
    void loadSubs(guard)
    void loadEmployees(guard)
    return () => { guard.value = false }
  }, [loadWorkstation, loadAudit, loadAssets, loadSubs, loadEmployees])

  // ── Asset name map (assetId → { name, invCode }) ─────────────────────────────
  const assetNameMap = useMemo<Record<string, { name: string; invCode: string }>>(() => {
    const map: Record<string, { name: string; invCode: string }> = {}
    for (const a of assets) {
      const name = [a.brand, a.model].filter(Boolean).join(' ') || a.type || a.invCode
      map[a.id] = { name, invCode: a.invCode }
    }
    return map
  }, [assets])

  // ── Derive keyless OEM assets ────────────────────────────────────────────────
  const keylessAssets = useMemo<KeylessAsset[]>(() => {
    // IDs of assets already assigned a device-bound active license
    const inUseAssetIds = new Set(
      wRows
        .filter(l => l.assignmentType === 'device' && l.lifecycleStatus === 'active' && l.assignedToAssetId)
        .map(l => l.assignedToAssetId!),
    )

    const catMap: Record<string, CategoryRow> = {}
    for (const c of categories) catMap[c.id] = c

    return assets
      .filter(a => {
        const cat = catMap[a.categoryId]
        if (!cat) return false
        const caps = resolveCategoryCapabilities(cat)
        return caps.hasOemLicense && !inUseAssetIds.has(a.id)
      })
      .map(a => {
        const cat = catMap[a.categoryId]
        const assetName = [a.brand, a.model].filter(Boolean).join(' ') || a.type || cat?.name || a.id
        return {
          id: a.id,
          assetName,
          invCode: a.invCode,
          catName: cat?.name ?? '',
        }
      })
  }, [assets, categories, wRows])

  // ── Tab counts ───────────────────────────────────────────────────────────────
  const keyCount = useMemo(
    () => wRows.filter(l => l.lifecycleStatus === 'active' && l.assignmentType !== 'employee').length,
    [wRows],
  )

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleActivated = useCallback(() => {
    void loadWorkstation()
  }, [loadWorkstation])

  const handleUpdateAssignees = useCallback(async (subId: string, ids: string[]) => {
    setAssigneeError(null)
    try {
      await subRepo.updateAssignees(subId, ids, actor)
      // Optimistic update in-place
      setSubs(prev => prev.map(s =>
        s.id === subId ? { ...s, assignedEmployeeIds: ids } : s,
      ))
    } catch {
      // Surface the failure to the user, then reload to re-sync the true state.
      setAssigneeError(t('error'))
      await loadSubs()
    }
  }, [subRepo, actor, loadSubs, t])

  const handleAddSubscription = useCallback(async (input: CreateSubscriptionInput) => {
    setAddSubmitting(true)
    setAddError(null)
    try {
      await subRepo.createSubscription(input, actor)
      setAddOpen(false)
      await loadSubs()
    } catch {
      setAddError(t('error'))
    } finally {
      setAddSubmitting(false)
    }
  }, [subRepo, actor, loadSubs, t])

  // ── Tab definitions ──────────────────────────────────────────────────────────
  const tabItems: TabStripItem<ActiveTab>[] = [
    { id: 'keys', icon: 'key-round', label: t('tabs.keys'), count: keyCount,    testId: 'tab-keys' },
    { id: 'subs', icon: 'boxes',     label: t('tabs.subs'), count: subs.length, testId: 'tab-subs' },
  ]

  return (
    /* Full-height flex column on BOTH breakpoints (assets etalon):
       Mobile: the shell puts /licenses in .app-shell-content-flush (flex column,
       zero side padding) — the page carries its own 10px gutters and stretches
       (flex-1) so the keys card can fill down to the BottomNav, like /assets.
       Desktop: h-full inside .app-shell-content so the keys card stretches to the
       content-area bottom and DataTable rows distribute the height (flex:1 1 0),
       exactly like AssetsTable. space-y (margins) kept over gap — the mobile
       keys card cancels its top margin via !mt-0 to fuse with the tab chrome. */
    <div className="flex flex-col h-full min-h-0 space-y-5 max-md:space-y-3 max-md:mx-[10px] max-md:flex-1">
      {/* Tab strip + search + add button — one line, no page title.
          Mobile: assets-etalon header — card chrome, surface-2 tab strip, then a
          search+«+» row; on the keys tab the chrome fuses with the card below. */}
      <div className={`border-b border-border max-md:bg-surface max-md:border max-md:border-border max-md:rounded-t-xl max-md:overflow-hidden ${
        activeTab === 'keys' ? 'max-md:border-b-0' : 'max-md:rounded-b-xl'
      }`}>
        <div className="flex items-center justify-between gap-3 max-md:bg-surface-2 max-md:border-b max-md:border-border max-md:px-[6px]">
          {/* Tab buttons — scrollable on mobile */}
          <TabStrip<ActiveTab>
            tabs={tabItems}
            active={activeTab}
            onChange={setActiveTab}
            size="md"
          />

          {/* Right cluster — search (keys tab, desktop) + add button, one line.
              Mobile keys tab hides it (the «+» moves down next to the search row);
              subs tab keeps the square «+» here since it has no search row. */}
          <div className={`flex items-center gap-2 self-end pb-2 shrink-0 ${
            activeTab === 'keys' ? 'max-md:hidden' : 'max-md:self-center max-md:pb-0 max-md:pr-1'
          }`}>
            {activeTab === 'keys' && (
              <SearchInput
                value={keySearch}
                onChange={setKeySearch}
                placeholder={t('keys.searchPlaceholder')}
                aria-label={t('keys.searchPlaceholder')}
                containerClassName="hidden md:block w-[280px]"
              />
            )}
            {/* Desktop: full-label button */}
            <Btn
              variant="primary"
              size="sm"
              onClick={() => { setAddError(null); setAddOpen(true) }}
              data-testid="add-subscription-btn"
              className="max-md:hidden"
            >
              <Icon name="plus" size={13} />
              {t('actions.addLicense')}
            </Btn>
            {/* Mobile square «+» here only on the subs tab (keys tab renders it in the
                search row below); conditional render avoids a duplicate testid. */}
            {activeTab === 'subs' && (
              <button
                type="button"
                onClick={() => { setAddError(null); setAddOpen(true) }}
                aria-label={t('actions.addLicense')}
                data-testid="add-subscription-btn-mobile"
                className="md:hidden w-[36px] h-[36px] min-w-[36px] flex-shrink-0 rounded-[9px] bg-accent text-white inline-flex items-center justify-center shadow-[0_2px_10px] shadow-accent/35 transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <Icon name="plus" size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Keys-tab search + «+» — mobile only, assets-etalon row:
            bg-bg px-[14px] py-[7px], input flex-1 (rounded-[9px], 11.5px), 36px square button */}
        {activeTab === 'keys' && (
          <div className="md:hidden flex items-center gap-[8px] bg-bg px-[14px] py-[7px]">
            <div className="relative flex-1">
              <Icon name="search" size={14} className="absolute left-[10px] top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
              <input
                value={keySearch}
                onChange={e => setKeySearch(e.target.value)}
                placeholder={t('keys.searchPlaceholder')}
                aria-label={t('keys.searchPlaceholder')}
                className="w-full rounded-[9px] py-[9px] pl-[30px] pr-[12px] text-[11.5px] caret-accent bg-bg border border-border text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 transition-all"
              />
            </div>
            {/* 36×36 square accent «+» — mirrors AssetsToolbar mobile create button */}
            <button
              type="button"
              onClick={() => { setAddError(null); setAddOpen(true) }}
              aria-label={t('actions.addLicense')}
              data-testid="add-subscription-btn-mobile"
              className="w-[36px] h-[36px] min-w-[36px] flex-shrink-0 rounded-[9px] bg-accent text-white inline-flex items-center justify-center shadow-[0_2px_10px] shadow-accent/35 transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <Icon name="plus" size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Tab body */}
      {activeTab === 'keys' && (
        <>
          {wLoading && (
            /*
             * Keys-tab skeleton — section header band + card body.
             * Header band mirrors WindowsKeysSection header exactly:
             *   Desktop: real icon + title (local chrome, no async data).
             *   Mobile:  shimmer strip — filter labels are local chrome but counts
             *            are async; rendering real labels with 0 would be misleading,
             *            so we shimmer the full strip instead.
             * Card body: CardListSkeleton (mobile) / TableSkeleton (desktop).
             */
            <div
              className="bg-surface border border-border rounded-xl overflow-hidden max-md:rounded-t-none max-md:border-t-0 max-md:!mt-0 max-md:flex-1 max-md:min-h-0 md:flex md:flex-col md:flex-1 md:min-h-0"
              aria-hidden="true"
            >
              {/* Section header band — matches WindowsKeysSection header (chips only,
                  no title; vertical padding on the chip stubs like the real buttons).
                  Shimmer strip: filter labels are local chrome but counts are async —
                  real labels with 0 would mislead. */}
              <header className="flex items-center px-5 border-b border-border max-md:px-[14px]">
                <div className="max-md:w-full flex items-center gap-0.5 py-3 max-md:py-2.5 overflow-x-auto no-scrollbar flex-nowrap">
                  <div className="h-[21px] w-[110px] mx-3 rounded anim-skeleton flex-shrink-0" />
                  <div className="h-[21px] w-[90px] mx-3 rounded anim-skeleton flex-shrink-0" />
                </div>
              </header>
              {isMobile
                ? <CardListSkeleton rows={10} variant="key" />
                : (
                  /* flex-1 min-h-0 gives TableSkeleton (height:100%) the remaining
                     card height so its flex rows stretch like the real DataTable */
                  <div className="flex-1 min-h-0">
                    <TableSkeleton rows={10} columns={4} gridTemplate="minmax(160px,1.2fr) minmax(160px,1.1fr) minmax(120px,0.8fr) minmax(220px,1.3fr)" headers={[t('keys.colAsset'), t('keys.colVersion'), t('keys.colStatus'), t('keys.colKey')]} />
                  </div>
                )}
            </div>
          )}
          {wError && <ErrorState onRetry={loadWorkstation} />}
          {!wLoading && !wError && (
            <WindowsKeysSection
              licenses={wRows}
              keylessAssets={keylessAssets}
              maskedKeys={maskedKeys}
              auditMap={auditMap}
              assetNameMap={assetNameMap}
              canReveal={canReveal}
              actor={actor}
              wRepo={wRepo}
              search={keySearch}
              onActivated={handleActivated}
            />
          )}
        </>
      )}

      {activeTab === 'subs' && (
        <>
          {subsLoading && (
            /*
             * Subs-tab skeleton — real SectionCard with real header (local chrome) +
             * subscription shimmer in the body.
             * SectionCard provides shadow, rounded-xl, border, header (px-5 py-3.5 / max-md px-3.5 py-3).
             * bodyClassName="!p-0": CardListSkeleton variant="subscription" already carries p-5 on
             * its outer grid wrapper; zeroing SectionCard's body padding avoids double-spacing.
             * Mobile padding is p-5 (vs real p-3.5 from SectionCard); 6px diff is acceptable for a skeleton.
             */
            <div aria-hidden="true">
              <SectionCard title={t('subs.sectionTitle')} icon="boxes" bodyClassName="!p-0">
                <CardListSkeleton rows={6} variant="subscription" />
              </SectionCard>
            </div>
          )}
          {subsError && <ErrorState onRetry={loadSubs} />}
          {!subsLoading && !subsError && (
            <SubscriptionsSection
              subs={subs}
              employees={employees}
              onUpdateAssignees={handleUpdateAssignees}
            />
          )}
        </>
      )}

      {/* Add subscription modal */}
      {addOpen && (
        <AddSubscriptionModal
          employees={employees}
          submitting={addSubmitting}
          submitError={addError}
          onSubmit={handleAddSubscription}
          onClose={() => setAddOpen(false)}
        />
      )}

      {/* Transient error feedback for a failed assignee save */}
      {assigneeError && (
        <AssigneeErrorToast msg={assigneeError} onDone={() => setAssigneeError(null)} />
      )}
    </div>
  )
}

/** Auto-dismissing error toast (rose tone) for transient assignee-save failures. */
function AssigneeErrorToast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 3500)
    return () => clearTimeout(id)
  }, [onDone])
  return (
    <div
      className="fixed top-4 right-4 z-[90]"
      style={{ animation: 'toastSlide 220ms cubic-bezier(.22,1,.36,1) both' }}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center gap-2.5 bg-surface border border-rose-500/30 text-text-primary px-4 py-3 rounded-xl shadow-xl shadow-black/60 text-[14px] font-medium max-w-xs">
        <span className="w-5 h-5 rounded-full bg-rose-500 inline-flex items-center justify-center flex-shrink-0">
          <Icon name="triangle-alert" size={12} className="text-white" />
        </span>
        {msg}
      </div>
    </div>
  )
}
