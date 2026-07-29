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
  LicensesPagination,
} from '@/components/features/licenses'
import type {
  WorkstationLicenseRepository,
  WorkstationLicense,
} from '@/domain/license'
import { resolveAssetKeyState, isKeyActivationTarget } from '@/domain/license'
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

  // ── Derive activation-target assets ──────────────────────────────────────────
  const keylessAssets = useMemo<KeylessAsset[]>(() => {
    // Shared domain predicate (resolveAssetKeyState + isKeyActivationTarget):
    // an asset with an embedded OEM key — a bound in_use OEM doc OR a category
    // that assumes one (hasOemLicense cap, non-disposed — the detail page's
    // oemCapAssumed rule) — is never a target. A MANUAL-keyed asset (bound
    // non-OEM doc) IS a target: activation becomes a key swap, and the pool
    // entry carries the old license so the modal can show what will be freed.
    const catMap: Record<string, CategoryRow> = {}
    for (const c of categories) catMap[c.id] = c

    return assets.flatMap<KeylessAsset>(a => {
      const cat = catMap[a.categoryId]
      if (!cat) return []
      const caps = resolveCategoryCapabilities(cat)
      const keyState = resolveAssetKeyState(a, wRows, caps)
      if (!isKeyActivationTarget(a, keyState, caps)) return []
      const assetName = [a.brand, a.model].filter(Boolean).join(' ') || a.type || cat.name || a.id
      return [{
        id: a.id,
        assetName,
        invCode: a.invCode,
        catName: cat.name ?? '',
        ...(keyState.source === 'manual' && keyState.licenseId
          ? { currentKey: { licenseId: keyState.licenseId, maskedKey: maskedKeys[keyState.licenseId] ?? '—' } }
          : {}),
      }]
    })
  }, [assets, categories, wRows, maskedKeys])

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
    /* Mobile: viewport-locked column (topbar 52 + content pt 10 + pb 74 = 136,
       the PartsReceiveMobileForm constant) — the tab chrome stays pinned and
       ONLY the tab body scrolls. Deterministic, unlike body-relative sticky. */
    <div className="flex flex-col h-full min-h-0 space-y-5 max-md:space-y-3 max-md:mx-[10px] max-md:flex-none max-md:h-[calc(100dvh-136px)] max-md:overflow-hidden">
      {/* Tab strip + search + add button — one line, no page title.
          Mobile: assets-etalon header — card chrome, surface-2 tab strip, then a
          search+«+» row; on the keys tab the chrome fuses with the card below. */}
      <div className="border-b border-border max-md:border-0 max-md:flex-shrink-0">
        <div className={`max-md:bg-surface max-md:border max-md:border-border max-md:rounded-t-xl max-md:overflow-hidden ${
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

        {/* Keys-tab search + «+» — mobile only, assets-etalon row: shared SearchInput
            (36px height, matches the square «+» button) + 36px square button */}
        {activeTab === 'keys' && (
          <div className="md:hidden flex items-center gap-[8px] bg-bg px-[14px] py-[7px]">
            <SearchInput
              value={keySearch}
              onChange={setKeySearch}
              placeholder={t('keys.searchPlaceholder')}
              aria-label={t('keys.searchPlaceholder')}
              containerClassName="flex-1"
            />
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
      </div>

      {/* Tab body */}
      {activeTab === 'keys' && (
        <>
          {wLoading && (
            /*
             * Keys-tab skeleton — pixel copy of WindowsKeysSection:
             *   section (flex flex-col flex-1 min-h-0) → header (real filter TabStrip)
             *   → body (flex flex-col flex-1 min-h-0) → skeleton rows → REAL pagination.
             *
             * P2: the filter tab LABELS are local chrome (known strings) — render the
             * REAL TabStrip (size="sm") with the same tabs, mirroring the default
             * 'in_use' active state. Counts are async → pass 0 (badge always present,
             * zero layout shift when the real count arrives) — the AssetsToolbar /
             * GroupTabs precedent (always render the badge, default 0 during load).
             *
             * Pagination: WindowsKeysSection ALWAYS mounts LicensesPagination at the
             * card bottom; the skeleton mounts it too (total=0 → totalPages=1, disabled
             * prev/next, identical footprint) so there's no ~44px shift on data arrival.
             *
             * Default 'in_use' filter → 3-column table (no action column, which only
             * appears on the 'free' filter), matching the loaded default view.
             */
            <section
              className="bg-surface border border-border rounded-xl shadow-sm shadow-black/30 overflow-hidden flex flex-col flex-1 min-h-0 max-md:rounded-t-none max-md:border-t-0 max-md:!mt-0"
              aria-hidden="true"
            >
              {/* Header — identical geometry to WindowsKeysSection: real filter TabStrip */}
              <header className="flex items-center px-5 border-b border-border max-md:px-[14px]">
                <div className="max-md:w-full max-md:overflow-x-auto max-md:no-scrollbar">
                  <TabStrip<'in_use' | 'free'>
                    tabs={[
                      { id: 'in_use', label: t('keys.statusInUse'), count: 0, testId: 'filter-in_use' },
                      { id: 'free',   label: t('keys.statusFree'),  count: 0, testId: 'filter-free'   },
                    ]}
                    active="in_use"
                    onChange={() => {}}
                    size="sm"
                  />
                </div>
              </header>

              {/* Body — flex column that stretches; skeleton rows then real pagination */}
              <div className="flex flex-col flex-1 min-h-0">
                {isMobile
                  ? (
                    <div className="flex-1 min-h-0 flex flex-col">
                      <CardListSkeleton rows={10} variant="key" />
                    </div>
                  )
                  : (
                    /* flex-1 min-h-0 gives TableSkeleton (height:100%) the remaining
                       card height so its flex rows stretch like the real DataTable */
                    <div className="flex-1 min-h-0">
                      <TableSkeleton rows={10} columns={3} gridTemplate="minmax(200px,1.5fr) minmax(120px,0.8fr) minmax(220px,1.4fr)" headers={[t('keys.colAsset'), t('keys.colStatus'), t('keys.colKey')]} />
                    </div>
                  )}

                {/* Real pagination — mirrors WindowsKeysSection's always-mounted bar;
                    total=0 renders the same footprint (no layout shift on load). */}
                <LicensesPagination page={1} pageSize={10} total={0} onPage={() => {}} />
              </div>
            </section>
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
        /* Mobile: the ONLY scrolling region of the locked column — the tab
           chrome above never leaves the screen. Desktop scrolls as before. */
        <div className="max-md:flex-1 max-md:min-h-0 max-md:overflow-y-auto">
          {subsLoading && (
            /*
             * Subs-tab skeleton — real SectionCard with real header (local chrome) +
             * subscription shimmer in the body.
             * SectionCard provides shadow, rounded-xl, border, header (px-5 py-3.5 / max-md px-3.5 py-3).
             * bodyClassName="!p-0": CardListSkeleton variant="subscription" carries the body padding on
             * its outer grid wrapper (p-5 max-md:p-3.5 — identical to SectionCard's real body padding),
             * so zeroing SectionCard's body padding avoids double-spacing with zero mobile drift.
             */
            <div aria-hidden="true">
              {/* Header hidden on mobile — mirrors SubscriptionsSection (owner request) */}
              <SectionCard title={t('subs.sectionTitle')} icon="boxes" bodyClassName="!p-0" className="max-md:[&>header]:hidden">
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
        </div>
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
