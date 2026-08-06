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
import { Chip, Icon, DataTable, TabStrip, MobileListPlaceholders, EmptyState, Btn } from '@/components/ui'
import type { DataTableColumn, TabStripItem } from '@/components/ui'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import type { Actor } from '@/domain/asset'
import type { WorkstationLicenseRepository } from '@/domain/license'
import { KeyDetailsModal } from './KeyDetailsModal'
import { ActivateKeyModal, type KeylessAsset } from './ActivateKeyModal'
import { KeyRowMobile } from './KeyRowMobile'
import { LicensesPagination } from './LicensesPagination'
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
      <div className="flex items-center gap-2.5 bg-surface border border-border text-text-primary px-4 py-3 rounded-xl shadow-xl shadow-black/60 light:shadow-slate-300/60 text-14 font-medium max-w-xs">
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
  /** Activation-target assets: keyless devices + manual-keyed devices (swap) */
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
  /** Called when the user clicks «Reset filters» in the filtered empty state */
  onSearchReset?: () => void
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
  onSearchReset,
  onActivated,
}: WindowsKeysSectionProps) {
  const { t } = useTranslation('licenses')
  const isMobile = useIsMobile()
  const [filter, setFilter] = useState<KeyStatus>('in_use')
  const hasActiveSearch = search.trim() !== ''
  const [page, setPage] = useState(1)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  // Revealed full key per FREE license id (mobile-only, reveal-capable roles).
  const [revealedFree, setRevealedFree] = useState<Record<string, string>>({})

  // Filter to device-assignable keys (exclude retired + employee-assigned) AND
  // only those where a manual key was actually entered. OEM licenses created
  // keyless (key «вшит»/absent → masked '—') are hidden from this table — the
  // embedded key is already active on its device, so that device is NOT an
  // activation target either (see assetHasProductKey in @/domain/license).
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

  // Reveal the actual key for FREE rows on mobile — a free key is meant to be
  // re-activated on another device, so a reveal-capable admin must read it.
  // Desktop stays masked (owner: mobile only). In-use keys are never revealed here.
  const freeIdsKey = pageRows.filter(l => licenseStatus(l) === 'free').map(l => l.id).join(',')
  useEffect(() => {
    if (!isMobile || !canReveal) return
    let cancelled = false
    for (const id of freeIdsKey ? freeIdsKey.split(',') : []) {
      if (revealedFree[id]) continue
      revealLicenseKey('licenses', id)
        .then(key => { if (!cancelled) setRevealedFree(prev => (prev[id] ? prev : { ...prev, [id]: key })) })
        .catch(() => { /* stay masked on failure */ })
    }
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, canReveal, freeIdsKey])

  const detailsLic = detailsId ? licenses.find(l => l.id === detailsId) ?? null : null
  const activatingLic = activatingId ? licenses.find(l => l.id === activatingId) ?? null : null

  const handleActivate = async (assetId: string) => {
    if (!activatingId) return
    setActivating(true)
    setActivateError(null)
    try {
      // A manual-keyed target → KEY SWAP: the repository atomically frees the
      // old license (decoupledFromAssetId = assetId, same as write-off) and
      // binds the new one, writing both audit entries in one atomic unit.
      const target = keylessAssets.find(a => a.id === assetId)
      if (target?.currentKey) {
        await wRepo.swapDeviceKey(activatingId, target.currentKey.licenseId, assetId, actor)
      } else {
        await wRepo.assignLicense(activatingId, { to: 'device', assetId }, actor)
      }
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
        key: 'asset',
        header: t('keys.colAsset'),
        width: 'minmax(12.5rem,1.5fr)',
        cell: (lic) => {
          const isFree = licenseStatus(lic) === 'free'
          if (isFree) {
            // Free key: show the ORIGIN device the key came from — lic.name is
            // «{Brand Model} — Ключ продукта», keep only the device part.
            const device = lic.name.includes(' — ') ? lic.name.split(' — ')[0]! : lic.name
            return (
              <div className="leading-tight">
                <div className="text-13.5 text-text-primary font-medium">{device}</div>
                {lic.retiredAt && (
                  <div className="text-12 text-text-tertiary">
                    {t('keys.freedOn', { date: fmtDate(lic.retiredAt, 'ru') })}
                  </div>
                )}
                {lic.assignedAt && !lic.retiredAt && (
                  <div className="text-12 text-text-tertiary">
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
              <div className="text-13.5 text-text-primary font-semibold">{displayName}</div>
              {displayInvCode && (
                <div className="font-mono text-12 text-text-tertiary">{displayInvCode}</div>
              )}
            </div>
          )
        },
      },
      {
        key: 'status',
        header: t('keys.colStatus'),
        width: 'minmax(7.5rem,0.8fr)',
        cell: (lic) => {
          const isFree = licenseStatus(lic) === 'free'
          return isFree
            ? <Chip color="green" dot>{t('keys.statusFree')}</Chip>
            : <Chip color="blue" dot>{t('keys.statusInUse')}</Chip>
        },
      },
      {
        key: 'key',
        header: t('keys.colKey'),
        width: 'minmax(13.75rem,1.4fr)',
        cell: (lic) => (
          <span className="font-mono text-13 text-text-primary tracking-tight">
            {maskedKeys[lic.id] ?? '—'}
          </span>
        ),
      },
    ]

    if (showAction) {
      cols.push({
        key: 'action',
        header: t('keys.colAction'),
        // Wide enough for «Активировать» + icon in one line (96px clipped it)
        width: '9.375rem',
        align: 'right',
        cell: (lic) => (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setActivatingId(lic.id) }}
            data-testid={`activate-btn-${lic.id}`}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-12 font-semibold text-accent-light border border-accent/30 bg-accent/10 hover:bg-accent/20 transition-colors whitespace-nowrap"
          >
            <Icon name="circle-check" size={12} />
            {t('keys.activate')}
          </button>
        ),
      })
    }

    return cols
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, maskedKeys, assetNameMap, showAction])

  const filterItems: TabStripItem<KeyStatus>[] = [
    { id: 'in_use', label: t('keys.statusInUse'), count: counts.in_use, testId: 'filter-in_use' },
    { id: 'free',   label: t('keys.statusFree'),  count: counts.free,   testId: 'filter-free'   },
  ]

  const filterChips = (
    <TabStrip<KeyStatus>
      tabs={filterItems}
      active={filter}
      onChange={setFilter}
      size="sm"
    />
  )

  return (
    <>
      <section
        /* flex-1 min-h-0 on BOTH breakpoints (assets etalon): inside the page's
           full-height flex column the card stretches to the content-area bottom
           (mobile: BottomNav top; desktop: shell content bottom); the rows area
           absorbs the space and the pagination pins to the card bottom.
           max-md:rounded-t-none/border-t-0/!mt-0: fuses with the page tab+search
           header above into ONE visual card (assets etalon). */
        className="bg-surface border border-border rounded-xl shadow-sm shadow-black/30 light:shadow-slate-200/80 overflow-hidden flex flex-col flex-1 min-h-0 max-md:rounded-t-none max-md:border-t-0 max-md:!mt-0"
        aria-label={t('keys.sectionTitle')}
      >
        {/* Section header — icon+title removed on BOTH breakpoints (owner request),
            only the filter chips remain. Vertical padding lives on the chip buttons
            (tab etalon) so the active underline sits ON the header's bottom border. */}
        <header className="flex items-center px-5 border-b border-border max-md:px-3.5">
          <div className="max-md:w-full max-md:overflow-x-auto max-md:no-scrollbar">
            {filterChips}
          </div>
        </header>

        {rows.length === 0 ? (
          /* flex-1 keeps the empty state vertically centered in the stretched card */
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={hasActiveSearch ? 'search-x' : 'key-round'}
              title={t(hasActiveSearch ? 'keys.emptyTitleFiltered' : 'keys.emptyTitle')}
              description={t(hasActiveSearch ? 'keys.emptyDescFiltered' : 'keys.emptyDesc')}
              {...(hasActiveSearch && onSearchReset ? {
                action: (
                  <Btn variant="primary" size="sm" onClick={onSearchReset}>
                    <Icon name="rotate-ccw" size={13} />
                    {t('keys.emptyReset')}
                  </Btn>
                ),
              } : {})}
            />
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            {isMobile ? (
              /* ── Mobile card list — IDENTICAL fill contract to AssetsTable mobile:
                    real rows AND blank placeholder slots each flexGrow:1 flexShrink:0
                    so all PAGE_SIZE slots distribute the card height evenly. The last
                    real row's own border-b closes the list; fillers stay blank (no
                    guide lines — owner request). This keeps the paginator pinned at
                    the SAME position on every filter tab, regardless of row count. ── */
              <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
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
                      revealedKey={revealedFree[lic.id] ?? null}
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
                {/* Blank filler slots pad the list to PAGE_SIZE — shared with the
                    assets etalon so both lists (and both filter tabs) look identical. */}
                <MobileListPlaceholders
                  count={PAGE_SIZE - pageRows.length}
                  dataTestId="key-card-placeholder"
                />
              </div>
            ) : (
              /* ── Desktop DataTable — fillHeight: rows flex-stretch to fill the
                    card exactly like AssetsTable (58px floor, paginator pinned) ── */
              <DataTable<WorkstationLicense>
                columns={columns}
                rows={pageRows}
                getRowKey={(lic) => lic.id}
                getRowDataTestId={(lic) => `key-row-${lic.id}`}
                onRowClick={(lic) => setDetailsId(lic.id)}
                minRows={PAGE_SIZE}
                fillHeight
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
