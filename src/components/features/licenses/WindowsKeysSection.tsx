/**
 * WindowsKeysSection — paginated table of Windows (workstation OEM) licenses.
 *
 * Key mapping from WorkstationLicense:
 *   - version = license.name
 *   - status `in_use`  ↔ assignmentType==='device' && lifecycleStatus==='active'
 *   - status `free`    ↔ assignmentType==='unassigned' && lifecycleStatus==='active'
 *   - Retired / employee-assigned rows are excluded from this view.
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip, Icon, DataTable } from '@/components/ui'
import type { DataTableColumn } from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import type { Actor } from '@/domain/asset'
import type { WorkstationLicenseRepository } from '@/domain/license'
import { KeyDetailsModal } from './KeyDetailsModal'
import { ActivateKeyModal, type KeylessAsset } from './ActivateKeyModal'
import { KeyRowMobile } from './KeyRowMobile'
import { LicensesPagination } from './LicensesPagination'
import { MobileListPlaceholders } from '@/components/ui'
import { fmtDate } from './licenseHelpers'
import { revealLicenseKey } from '@/lib/licenses/revealKey'

const PAGE_SIZE = 10

type KeyStatus = 'in_use' | 'free'

function licenseStatus(lic: WorkstationLicense): KeyStatus | null {
  if (lic.lifecycleStatus === 'retired') return null
  if (lic.assignmentType === 'employee') return null // employee-assigned: excluded
  if (lic.assignmentType === 'device' && lic.lifecycleStatus === 'active') return 'in_use'
  if (lic.assignmentType === 'unassigned' && lic.lifecycleStatus === 'active') return 'free'
  return null
}

/** Simple Toast — top-right, green check, auto-dismiss 2.6s */
function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div
      className="fixed top-4 right-4 z-[90]"
      style={{ animation: 'toastSlide 220ms cubic-bezier(.22,1,.36,1) both' }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5 bg-surface border border-border text-text-primary px-4 py-3 rounded-xl shadow-xl shadow-black/60 text-[14px] font-medium max-w-xs">
        <span className="w-5 h-5 rounded-full bg-emerald-500 inline-flex items-center justify-center flex-shrink-0">
          <Icon name="check" size={12} className="text-white" />
        </span>
        {msg}
      </div>
    </div>
  )
}

export interface AssetNameEntry {
  name: string
  invCode: string
}

export interface WindowsKeysSectionProps {
  /** All workstation licenses — component filters to OEM/device-bound only */
  licenses: WorkstationLicense[]
  /** Assets with no active device-bound license in OEM categories */
  keylessAssets: KeylessAsset[]
  /** Masked keys map: licenseId → masked string */
  maskedKeys: Record<string, string>
  /** Audit log entries keyed by licenseId */
  auditMap: Record<string, AuditLog[]>
  /** Human-readable asset names keyed by asset id */
  assetNameMap: Record<string, AssetNameEntry>
  /** Can the current user reveal (copy) the full key? */
  canReveal: boolean
  /** Actor for mutations */
  actor: Actor
  /** Workstation repo for assignLicense */
  wRepo: WorkstationLicenseRepository
  /** Search query from parent tab strip */
  search?: string
  /** Callback after a key is activated (parent reloads) */
  onActivated?: () => void
}

export function WindowsKeysSection({
  licenses,
  keylessAssets,
  maskedKeys,
  auditMap,
  assetNameMap,
  canReveal,
  actor,
  wRepo,
  search = '',
  onActivated,
}: WindowsKeysSectionProps) {
  const { t } = useTranslation('licenses')
  const isMobile = useIsMobile()
  const [filter, setFilter] = useState<KeyStatus>('in_use')
  const [page, setPage] = useState(1)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  // Filter to device-assignable keys (exclude retired + employee-assigned) AND
  // only those where a manual key was actually entered. OEM licenses created
  // keyless (key «вшит»/absent → masked '—') belong to the activation pool, NOT
  // this table. An OEM license whose key was activated later DOES qualify here.
  const keyRows = useMemo(() => {
    return licenses.filter(lic => {
      if (licenseStatus(lic) === null) return false
      const masked = maskedKeys[lic.id]
      return Boolean(masked) && masked !== '—'
    })
  }, [licenses, maskedKeys])

  const counts = useMemo(() => ({
    in_use: keyRows.filter(l => licenseStatus(l) === 'in_use').length,
    free:   keyRows.filter(l => licenseStatus(l) === 'free').length,
  }), [keyRows])

  const rows = useMemo(() => {
    const byStatus = keyRows.filter(l => licenseStatus(l) === filter)
    const q = search.trim().toLowerCase()
    if (!q) return byStatus
    return byStatus.filter(l => {
      if (l.name.toLowerCase().includes(q)) return true
      const entry = l.assignedToAssetId ? assetNameMap[l.assignedToAssetId] : undefined
      if (entry) {
        if (entry.name.toLowerCase().includes(q)) return true
        if (entry.invCode.toLowerCase().includes(q)) return true
      }
      return false
    })
  }, [keyRows, filter, search, assetNameMap])

  useEffect(() => { setPage(1) }, [filter, search])

  const pageRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page],
  )

  const detailsLic = detailsId ? licenses.find(l => l.id === detailsId) ?? null : null
  const activatingLic = activatingId ? licenses.find(l => l.id === activatingId) ?? null : null

  const handleActivate = async (assetId: string) => {
    if (!activatingId) return
    setActivating(true)
    setActivateError(null)
    try {
      await wRepo.assignLicense(activatingId, { to: 'device', assetId }, actor)
      setActivatingId(null)
      const lic = licenses.find(l => l.id === activatingId)
      setToast(t('keys.activatedToast', { name: lic?.name ?? '' }))
      onActivated?.()
    } catch {
      setActivateError(t('error'))
    } finally {
      setActivating(false)
    }
  }

  const showAction = filter === 'free'

  // ── Desktop DataTable columns ────────────────────────────────────────────────
  const columns = useMemo<DataTableColumn<WorkstationLicense>[]>(() => {
    const cols: DataTableColumn<WorkstationLicense>[] = [
      {
        key: 'key',
        header: t('keys.colKey'),
        width: 'minmax(180px,2fr)',
        cell: (lic) => (
          <span className="font-mono text-[13px] text-text-primary tracking-tight">
            {maskedKeys[lic.id] ?? '—'}
          </span>
        ),
      },
      {
        key: 'version',
        header: t('keys.colVersion'),
        width: 'minmax(120px,1fr)',
        cell: (lic) => (
          <span className="text-[13.5px] text-text-secondary">{lic.name}</span>
        ),
      },
      {
        key: 'status',
        header: t('keys.colStatus'),
        width: 'minmax(90px,0.7fr)',
        cell: (lic) => {
          const isFree = licenseStatus(lic) === 'free'
          return isFree
            ? <Chip color="green" dot>{t('keys.statusFree')}</Chip>
            : <Chip color="blue" dot>{t('keys.statusInUse')}</Chip>
        },
      },
      {
        key: 'asset',
        header: t('keys.colAsset'),
        width: 'minmax(140px,1.4fr)',
        cell: (lic) => {
          const isFree = licenseStatus(lic) === 'free'
          if (isFree) {
            return (
              <div className="leading-tight">
                <div className="text-[13.5px] text-text-primary font-medium">{'—'}</div>
                {lic.retiredAt && (
                  <div className="text-[12px] text-text-tertiary">
                    {t('keys.freedOn', { date: fmtDate(lic.retiredAt, 'ru') })}
                  </div>
                )}
                {lic.assignedAt && !lic.retiredAt && (
                  <div className="text-[12px] text-text-tertiary">
                    {t('keys.freedOn', { date: fmtDate(lic.assignedAt, 'ru') })}
                  </div>
                )}
              </div>
            )
          }
          const assetId = lic.assignedToAssetId ?? null
          const entry = assetId ? (assetNameMap[assetId] ?? null) : null
          const displayName = entry ? entry.name : (assetId ?? '—')
          const displayInvCode = entry ? entry.invCode : null
          return (
            <div className="leading-tight">
              <div className="text-[13.5px] text-text-primary font-semibold">{displayName}</div>
              {displayInvCode && (
                <div className="font-mono text-[12px] text-text-tertiary">{displayInvCode}</div>
              )}
            </div>
          )
        },
      },
    ]

    if (showAction) {
      cols.push({
        key: 'action',
        header: t('keys.colAction'),
        width: '96px',
        align: 'right',
        cell: (lic) => (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setActivatingId(lic.id) }}
            data-testid={`activate-btn-${lic.id}`}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-semibold text-accent-light border border-accent/30 bg-accent/10 hover:bg-accent/20 transition-colors"
          >
            <Icon name="zap" size={12} />
            {t('keys.activate')}
          </button>
        ),
      })
    }

    return cols
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, maskedKeys, assetNameMap, showAction])

  const FILTERS: { id: KeyStatus; label: string }[] = [
    { id: 'in_use', label: t('keys.statusInUse') },
    { id: 'free',   label: t('keys.statusFree')  },
  ]

  const filterChips = (
    <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar flex-nowrap">
      {FILTERS.map(f => {
        const active = filter === f.id
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            data-testid={`filter-${f.id}`}
            className={`relative py-1.5 px-3 text-[13px] font-medium transition-colors flex items-center gap-1.5 flex-shrink-0 ${
              active ? 'text-accent' : 'text-text-primary hover:text-text-secondary'
            }`}
          >
            {f.label}
            <span className={`text-[11.5px] font-semibold px-1.5 py-0.5 rounded-md ${
              active ? 'bg-accent/15 text-accent-light' : 'bg-surface-2 text-text-subtle'
            }`}>
              {counts[f.id]}
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
  )

  return (
    <>
      <section
        /* max-md:flex-1: inside the mobile flush flex chain the card stretches to the
           BottomNav (like /assets ListCard); the rows area absorbs the space and the
           pagination pins to the card bottom. Desktop keeps natural height.
           max-md:rounded-t-none/border-t-0/!mt-0: fuses with the page tab+search
           header above into ONE visual card (assets etalon). */
        className="bg-surface border border-border rounded-xl shadow-sm shadow-black/30 overflow-hidden flex flex-col max-md:flex-1 max-md:min-h-0 max-md:rounded-t-none max-md:border-t-0 max-md:!mt-0"
        aria-label={t('keys.sectionTitle')}
      >
        {/* Section header — mobile hides the icon+title (owner request), keeps only the filter chips */}
        <header className="flex items-center justify-between px-5 py-2.5 border-b border-border max-md:px-[14px] max-md:py-2">
          <div className="flex items-center gap-2.5 max-md:hidden">
            <span className="w-7 h-7 rounded-md bg-surface-2 text-violet-400 inline-flex items-center justify-center">
              <Icon name="key-round" size={14} />
            </span>
            <h2 className="text-[13.5px] font-bold uppercase tracking-[0.04em] text-text-primary">
              {t('keys.sectionTitle')}
            </h2>
          </div>
          <div className="max-md:w-full max-md:overflow-x-auto max-md:no-scrollbar">
            {filterChips}
          </div>
        </header>

        {rows.length === 0 ? (
          /* max-md:flex-1 keeps the empty state vertically centered in the stretched card */
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center max-md:flex-1">
            <span className="w-12 h-12 rounded-xl bg-surface-2 text-text-subtle inline-flex items-center justify-center mb-3">
              <Icon name="key-round" size={20} />
            </span>
            <p className="text-[14.5px] font-semibold text-text-primary mb-1">{t('keys.emptyTitle')}</p>
            <p className="text-[13px] text-text-tertiary">{t('keys.emptyDesc')}</p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            {isMobile ? (
              /* ── Mobile card list — same fill contract as AssetsTable mobile:
                    rows + dashed placeholder slots pad to PAGE_SIZE, every slot
                    flexGrow:1 so the block fills the card and the paginator
                    stays pinned at a constant position. ── */
              <div className="flex-1 min-h-0 flex flex-col">
                {pageRows.map(lic => {
                  const isFree = licenseStatus(lic) === 'free'
                  const masked = maskedKeys[lic.id] ?? '—'
                  const assetId = lic.assignedToAssetId ?? null
                  const entry = assetId ? (assetNameMap[assetId] ?? null) : null
                  return (
                    <KeyRowMobile
                      key={lic.id}
                      lic={lic}
                      masked={masked}
                      isFree={isFree}
                      assetName={entry?.name ?? null}
                      assetInvCode={entry?.invCode ?? null}
                      showAction={showAction}
                      onRowClick={() => setDetailsId(lic.id)}
                      onActivate={e => { e.stopPropagation(); setActivatingId(lic.id) }}
                      outerStyle={{ flexGrow: 1, flexShrink: 0 }}
                    />
                  )
                })}
                {/* Placeholder slots — mirror AssetsTable's mobile placeholders exactly */}
                <MobileListPlaceholders
                  count={Math.max(0, PAGE_SIZE - pageRows.length)}
                  dataTestId="key-card-placeholder"
                />
              </div>
            ) : (
              /* ── Desktop DataTable ────────────────────────────────────────── */
              <DataTable<WorkstationLicense>
                columns={columns}
                rows={pageRows}
                getRowKey={(lic) => lic.id}
                getRowDataTestId={(lic) => `key-row-${lic.id}`}
                onRowClick={(lic) => setDetailsId(lic.id)}
                minRows={PAGE_SIZE}
                aria-label={t('keys.sectionTitle')}
              />
            )}

            <LicensesPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={rows.length}
              onPage={setPage}
            />
          </div>
        )}
      </section>

      {/* KeyDetailsModal */}
      {detailsLic && (
        <KeyDetailsModal
          licenseId={detailsLic.id}
          maskedKey={maskedKeys[detailsLic.id] ?? '—'}
          version={detailsLic.name}
          isInUse={licenseStatus(detailsLic) === 'in_use'}
          assetName={
            detailsLic.assignedToAssetId
              ? (assetNameMap[detailsLic.assignedToAssetId]?.name ?? detailsLic.assignedToAssetId)
              : null
          }
          invCode={
            detailsLic.assignedToAssetId
              ? (assetNameMap[detailsLic.assignedToAssetId]?.invCode ?? null)
              : null
          }
          assetNameMap={assetNameMap}
          auditEntries={auditMap[detailsLic.id] ?? []}
          canReveal={canReveal}
          revealFn={revealLicenseKey}
          onClose={() => setDetailsId(null)}
        />
      )}

      {/* ActivateKeyModal */}
      {activatingLic && (
        <ActivateKeyModal
          maskedKey={maskedKeys[activatingLic.id] ?? '—'}
          version={activatingLic.name}
          keylessAssets={keylessAssets}
          submitting={activating}
          submitError={activateError}
          onConfirm={handleActivate}
          onClose={() => { setActivatingId(null); setActivateError(null) }}
        />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast} onDone={clearToast} />}
    </>
  )
}
