import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import {
  PageHeader, SectionCard, Btn, Icon, EmptyState, LoadingState, ErrorState,
} from '@/components/ui'
import {
  WorkstationLicenseTable,
  ServerLicenseTable,
  LicenseFormDialog,
  AssignLicenseDialog,
  RevealKeyButton,
  LicenseHistory,
} from '@/components/features/licenses'
import type { LicenseFormDialogValues } from '@/components/features/licenses/LicenseFormDialog'
import type {
  WorkstationLicenseRepository,
  ServerLicenseRepository,
  WorkstationLicense,
  ServerLicense,
  AssignWorkstationLicenseInput,
} from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import type { AuditLogRepository } from '@/domain/audit'
import type { Actor } from '@/domain/asset'
import { FirestoreWorkstationLicenseRepository, FirestoreServerLicenseRepository, FirestoreAuditLogRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'

type ActiveTab = 'workstation' | 'server'

export interface LicensesPageProps {
  workstationRepo?: WorkstationLicenseRepository
  serverRepo?: ServerLicenseRepository
  auditRepo?: AuditLogRepository
}

export function LicensesPage({ workstationRepo, serverRepo, auditRepo }: LicensesPageProps) {
  const { t } = useTranslation('licenses')
  const { user, role } = useAuth()

  const canManageWorkstation = role === 'super_admin' || role === 'tech_admin'
  const canManageServer = role === 'super_admin'
  const canReveal = role === 'super_admin'

  const actor = useMemo<Actor>(() => ({ uid: user.id, role }), [user.id, role])

  // Composition root — default Firestore repos; test callers inject their own
  const defaultWRepo = useMemo<WorkstationLicenseRepository>(
    () => new FirestoreWorkstationLicenseRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const defaultSRepo = useMemo<ServerLicenseRepository>(
    () => new FirestoreServerLicenseRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const defaultAuditRepo = useMemo<AuditLogRepository>(
    () => new FirestoreAuditLogRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const wRepo = workstationRepo ?? defaultWRepo
  const sRepo = serverRepo ?? defaultSRepo
  const aRepo = auditRepo ?? defaultAuditRepo

  // Tab state — super_admin sees both; tech_admin only sees workstation
  const [activeTab, setActiveTab] = useState<ActiveTab>('workstation')

  // Workstation list state
  const [wRows, setWRows] = useState<WorkstationLicense[]>([])
  const [wLoading, setWLoading] = useState(true)
  const [wError, setWError] = useState<string | null>(null)

  // Server list state
  const [sRows, setSRows] = useState<ServerLicense[]>([])
  const [sLoading, setSLoading] = useState(false)
  const [sError, setSError] = useState<string | null>(null)

  // Audit entries for LicenseHistory (keyed by licenseId)
  const [auditMap, setAuditMap] = useState<Record<string, AuditLog[]>>({})

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Assign dialog state
  const [assignTarget, setAssignTarget] = useState<WorkstationLicense | null>(null)
  const [assignSubmitting, setAssignSubmitting] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  // Load workstation licenses
  const loadWorkstation = useCallback(async () => {
    setWLoading(true)
    setWError(null)
    try {
      const rows = await wRepo.listLicenses()
      setWRows(rows)
    } catch {
      setWError(t('error'))
    } finally {
      setWLoading(false)
    }
  }, [wRepo, t])

  // Load server licenses
  const loadServer = useCallback(async () => {
    if (!canManageServer) return
    setSLoading(true)
    setSError(null)
    try {
      const rows = await sRepo.listLicenses()
      setSRows(rows)
    } catch {
      setSError(t('error'))
    } finally {
      setSLoading(false)
    }
  }, [sRepo, canManageServer, t])

  // Load audit entries for the active tab
  const loadAudit = useCallback(async (entityType: 'license' | 'server_license') => {
    try {
      const page = await aRepo.listAuditLogs(
        {
          entityType,
          action: 'all',
          actorUid: 'all',
          fromDate: null,
          toDate: null,
          search: '',
          pageSize: 200,
        },
        null,
      )
      const map: Record<string, AuditLog[]> = {}
      for (const entry of page.rows) {
        if (!map[entry.entityId]) map[entry.entityId] = []
        map[entry.entityId]!.push(entry)
      }
      setAuditMap(prev => ({ ...prev, ...map }))
    } catch {
      // Audit history is best-effort; don't block the main UI
    }
  }, [aRepo])

  // Initial load
  useEffect(() => {
    void loadWorkstation()
  }, [loadWorkstation])

  useEffect(() => {
    if (canManageServer) void loadServer()
  }, [loadServer, canManageServer])

  // Load audit when tab changes
  useEffect(() => {
    const entityType = activeTab === 'workstation' ? 'license' : 'server_license'
    void loadAudit(entityType)
  }, [activeTab, loadAudit])

  // Handle create
  async function handleCreate(values: LicenseFormDialogValues) {
    setCreateSubmitting(true)
    setCreateError(null)
    try {
      if (values.kind === 'workstation') {
        const { kind: _k, ...input } = values
        await wRepo.createLicense(input, actor)
        await loadWorkstation()
      } else {
        const { kind: _k, ...input } = values
        await sRepo.createLicense(input, actor)
        await loadServer()
      }
      setCreateOpen(false)
    } catch {
      setCreateError(t('error'))
    } finally {
      setCreateSubmitting(false)
    }
  }

  // Handle assign
  async function handleAssign(input: AssignWorkstationLicenseInput) {
    if (!assignTarget) return
    setAssignSubmitting(true)
    setAssignError(null)
    try {
      await wRepo.assignLicense(assignTarget.id, input, actor)
      setAssignTarget(null)
      await loadWorkstation()
    } catch {
      setAssignError(t('error'))
    } finally {
      setAssignSubmitting(false)
    }
  }

  // Handle decouple
  async function handleDecouple(license: WorkstationLicense) {
    if (!window.confirm(t('decoupleConfirm'))) return
    try {
      await wRepo.decoupleLicense(license.id, actor)
      await loadWorkstation()
    } catch {
      // Silent failure on decouple — the list will stay stale; page-level error handling omitted for MVP
    }
  }

  const currentTab = canManageServer ? activeTab : 'workstation'

  return (
    <div className="anim-content-enter space-y-5">
      <PageHeader
        icon="key-round"
        title={t('title')}
        actions={
          canManageWorkstation ? (
            <Btn
              variant="primary"
              size="md"
              onClick={() => {
                setCreateError(null)
                setCreateOpen(true)
              }}
              data-testid="create-license-btn"
            >
              <Icon name="plus" size={14} />
              {t('actions.create')}
            </Btn>
          ) : undefined
        }
      />

      <SectionCard noHeader>
        <div className="space-y-4">
          {/* Tabs */}
          {canManageServer && (
            <div className="flex items-center gap-1 border-b border-[#2A2F36] pb-0">
              <TabBtn
                active={activeTab === 'workstation'}
                onClick={() => setActiveTab('workstation')}
                label={t('tabs.workstation')}
                testId="tab-workstation"
              />
              <TabBtn
                active={activeTab === 'server'}
                onClick={() => setActiveTab('server')}
                label={t('tabs.server')}
                testId="tab-server"
              />
            </div>
          )}

          {/* Workstation tab body */}
          {currentTab === 'workstation' && (
            <>
              {wLoading && <LoadingState rows={5} />}
              {wError && <ErrorState onRetry={loadWorkstation} />}
              {!wLoading && !wError && wRows.length === 0 && (
                <EmptyState
                  icon="key-round"
                  title={t('empty.title')}
                  description={t('empty.desc')}
                />
              )}
              {!wLoading && !wError && wRows.length > 0 && (
                <WorkstationLicenseTable
                  rows={wRows}
                  {...(canManageWorkstation ? {
                    renderActions: (lic: WorkstationLicense) => (
                      <WorkstationRowActions
                        license={lic}
                        canReveal={canReveal}
                        auditEntries={auditMap[lic.id] ?? []}
                        onAssign={() => {
                          setAssignError(null)
                          setAssignTarget(lic)
                        }}
                        onDecouple={() => handleDecouple(lic)}
                      />
                    ),
                  } : {})}
                />
              )}
            </>
          )}

          {/* Server tab body */}
          {currentTab === 'server' && canManageServer && (
            <>
              {sLoading && <LoadingState rows={5} />}
              {sError && <ErrorState onRetry={loadServer} />}
              {!sLoading && !sError && sRows.length === 0 && (
                <EmptyState
                  icon="key-round"
                  title={t('empty.title')}
                  description={t('empty.desc')}
                />
              )}
              {!sLoading && !sError && sRows.length > 0 && (
                <ServerLicenseTable
                  rows={sRows}
                  renderActions={(lic) => (
                    <ServerRowActions
                      license={lic}
                      canReveal={canReveal}
                      auditEntries={auditMap[lic.id] ?? []}
                    />
                  )}
                />
              )}
            </>
          )}
        </div>
      </SectionCard>

      {/* Create dialog */}
      <LicenseFormDialog
        open={createOpen}
        kind={currentTab}
        submitting={createSubmitting}
        submitError={createError}
        onSubmit={handleCreate}
        onCancel={() => setCreateOpen(false)}
      />

      {/* Assign dialog */}
      <AssignLicenseDialog
        open={assignTarget !== null}
        licenseId={assignTarget?.id ?? ''}
        submitting={assignSubmitting}
        submitError={assignError}
        onSubmit={handleAssign}
        onCancel={() => setAssignTarget(null)}
      />
    </div>
  )
}

// ── Internal sub-components ────────────────────────────────────────────────

interface TabBtnProps {
  active: boolean
  onClick: () => void
  label: string
  testId?: string
}

function TabBtn({ active, onClick, label, testId }: TabBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={[
        'px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors',
        active
          ? 'border-[#F97316] text-[#F97316]'
          : 'border-transparent text-[#64748B] hover:text-[#94A3B8]',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

interface WorkstationRowActionsProps {
  license: WorkstationLicense
  canReveal: boolean
  auditEntries: AuditLog[]
  onAssign: () => void
  onDecouple: () => void
}

function WorkstationRowActions({
  license,
  canReveal,
  auditEntries,
  onAssign,
  onDecouple,
}: WorkstationRowActionsProps) {
  const { t } = useTranslation('licenses')

  const isRetired = license.lifecycleStatus === 'retired'
  const isUnassigned = license.assignmentType === 'unassigned'

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Btn
        variant="ghost"
        size="sm"
        disabled={isRetired}
        onClick={onAssign}
        data-testid={`assign-btn-${license.id}`}
      >
        <Icon name="user-check" size={13} />
        {t('actions.assign')}
      </Btn>

      <Btn
        variant="ghost"
        size="sm"
        disabled={isUnassigned || isRetired}
        onClick={onDecouple}
        data-testid={`decouple-btn-${license.id}`}
      >
        <Icon name="unlink" size={13} />
        {t('actions.decouple')}
      </Btn>

      {canReveal && (
        <RevealKeyButton
          collection="licenses"
          licenseId={license.id}
        />
      )}

      <LicenseHistory entries={auditEntries} />
    </div>
  )
}

interface ServerRowActionsProps {
  license: ServerLicense
  canReveal: boolean
  auditEntries: AuditLog[]
}

function ServerRowActions({ license, canReveal, auditEntries }: ServerRowActionsProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {canReveal && (
        <RevealKeyButton
          collection="server_licenses"
          licenseId={license.id}
        />
      )}
      <LicenseHistory entries={auditEntries} />
    </div>
  )
}
