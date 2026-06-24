import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader, Btn, Icon, LoadingState, ErrorState } from '@/components/ui'
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
  FirestoreWorkstationLicenseRepository,
  FirestoreAuditLogRepository,
  FirestoreSubscriptionRepository,
  FirestoreEmployeeRepository,
  FirestoreAssetRepository,
} from '@/infra/repositories'
import { db } from '@/lib/firebase'
import { getMaskedLicenseKey } from '@/lib/licenses/maskedKey'
import { resolveCategoryCapabilities } from '@/domain/asset/categoryCapabilities'
import type { KeylessAsset } from '@/components/features/licenses/ActivateKeyModal'
import type { Asset, CategoryRow } from '@/domain/asset'

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

  const canReveal = role === 'super_admin' || role === 'tech_admin'

  const actor = useMemo<Actor>(() => ({ uid: user.id, role }), [user.id, role])

  // ── Composition root ────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dbInstance = useMemo(() => db(), [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const defaultWRepo = useMemo<WorkstationLicenseRepository>(() => new FirestoreWorkstationLicenseRepository(dbInstance), [dbInstance])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const defaultAuditRepo = useMemo<AuditLogRepository>(() => new FirestoreAuditLogRepository(dbInstance), [dbInstance])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const defaultSubRepo = useMemo<SubscriptionRepository>(() => new FirestoreSubscriptionRepository(dbInstance), [dbInstance])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const defaultEmpRepo = useMemo<EmployeeRepository>(() => new FirestoreEmployeeRepository(dbInstance), [dbInstance])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const defaultAssetRepo = useMemo<AssetRepository>(() => new FirestoreAssetRepository(dbInstance), [dbInstance])

  const wRepo = workstationRepo ?? defaultWRepo
  const aRepo = auditRepo ?? defaultAuditRepo
  const subRepo = subscriptionRepo ?? defaultSubRepo
  const empRepo = employeeRepo ?? defaultEmpRepo
  const assRepo = assetRepo ?? defaultAssetRepo

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
    setWLoading(true)
    setWError(null)
    try {
      const rows = await wRepo.listLicenses()
      if (guard && !guard.value) return
      setWRows(rows)

      // Load masked keys for all visible rows (simple: fetch all in parallel)
      const pairs = await Promise.all(
        rows.map(async r => ({
          id: r.id,
          masked: await getMaskedLicenseKey(dbInstance, 'licenses', r.id).catch(() => '—'),
        })),
      )
      if (guard && !guard.value) return
      const map: Record<string, string> = {}
      for (const { id, masked } of pairs) map[id] = masked
      setMaskedKeys(map)
    } catch {
      if (guard && !guard.value) return
      setWError(t('error'))
    } finally {
      if (!guard || guard.value) setWLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wRepo, dbInstance])

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
    setSubsLoading(true)
    setSubsError(null)
    try {
      const rows = await subRepo.listSubscriptions()
      if (guard && !guard.value) return
      setSubs(rows)
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
  const TABS: { id: ActiveTab; icon: string; labelKey: string; count: number }[] = [
    { id: 'keys', icon: 'key-round',  labelKey: 'tabs.keys',  count: keyCount },
    { id: 'subs', icon: 'boxes',      labelKey: 'tabs.subs',  count: subs.length },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        icon="key-round"
        title={t('title')}
        actions={
          <Btn
            variant="primary"
            size="md"
            onClick={() => { setAddError(null); setAddOpen(true) }}
            data-testid="add-subscription-btn"
          >
            <Icon name="plus" size={14} />
            {t('actions.addLicense')}
          </Btn>
        }
      />

      {/* Tab strip + search */}
      <div className="border-b border-border">
        <div className="flex items-center justify-between gap-3">
          {/* Tab buttons — scrollable on mobile */}
          <div className="flex gap-0.5 overflow-x-auto no-scrollbar flex-nowrap min-w-0">
            {TABS.map(tab => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  data-testid={`tab-${tab.id}`}
                  className={`relative py-3 px-4 text-[13.5px] font-medium transition-colors flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${
                    active ? 'text-accent' : 'text-text-primary hover:text-text-secondary'
                  }`}
                >
                  <Icon name={tab.icon} size={14} />
                  {t(tab.labelKey)}
                  <span className={`text-[12px] font-semibold px-1.5 py-0.5 rounded-md ${
                    active ? 'bg-accent/15 text-accent-light' : 'bg-surface-2 text-text-subtle'
                  }`}>
                    {tab.count}
                  </span>
                  {active && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-light rounded-full"
                      style={{ animation: 'tabIndicatorIn 160ms cubic-bezier(0.16,1,0.3,1) both' }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          {/* Keys-tab search — desktop only (hidden on mobile, shown below) */}
          <div className="hidden md:flex items-center gap-2 self-end pb-2 shrink-0">
            {activeTab === 'keys' && (
              <div className="relative">
                <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
                <input
                  value={keySearch}
                  onChange={e => setKeySearch(e.target.value)}
                  placeholder={t('keys.searchPlaceholder')}
                  aria-label={t('keys.searchPlaceholder')}
                  className="w-60 h-9 pl-9 pr-3 text-[13.5px] rounded-lg bg-bg border border-border text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 transition-all"
                />
              </div>
            )}
          </div>
        </div>

        {/* Keys-tab search — mobile only (below tabs) */}
        {activeTab === 'keys' && (
          <div className="md:hidden pb-2 pt-1">
            <div className="relative">
              <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
              <input
                value={keySearch}
                onChange={e => setKeySearch(e.target.value)}
                placeholder={t('keys.searchPlaceholder')}
                aria-label={t('keys.searchPlaceholder')}
                className="w-full h-9 pl-9 pr-3 text-[13.5px] rounded-lg bg-bg border border-border text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15 transition-all"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tab body */}
      {activeTab === 'keys' && (
        <>
          {wLoading && <LoadingState rows={5} />}
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
          {subsLoading && <LoadingState rows={4} />}
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
