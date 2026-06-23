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
import { Chip, Icon } from '@/components/ui'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import type { Actor } from '@/domain/asset'
import type { WorkstationLicenseRepository } from '@/domain/license'
import { KeyDetailsModal } from './KeyDetailsModal'
import { ActivateKeyModal, type KeylessAsset } from './ActivateKeyModal'
import { LicensesPagination } from './LicensesPagination'
import { fmtDate } from './licenseHelpers'
import { revealLicenseKey } from '@/lib/licenses/revealKey'

const PAGE_SIZE = 10
const ROW_H = 56

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
  const [filter, setFilter] = useState<KeyStatus>('in_use')
  const [page, setPage] = useState(1)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  // Filter to only OEM-style keys (device-assignable), exclude retired+employee
  const keyRows = useMemo(() => {
    return licenses.filter(lic => licenseStatus(lic) !== null)
  }, [licenses])

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

  const FILTERS: { id: KeyStatus; label: string }[] = [
    { id: 'in_use', label: t('keys.statusInUse') },
    { id: 'free',   label: t('keys.statusFree')  },
  ]

  const filterChips = (
    <div className="flex items-center gap-0.5">
      {FILTERS.map(f => {
        const active = filter === f.id
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            data-testid={`filter-${f.id}`}
            className={`relative py-1.5 px-3 text-[13px] font-medium transition-colors flex items-center gap-1.5 ${
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

  const showAction = filter === 'free'

  return (
    <>
      <section
        className="bg-surface border border-border rounded-xl shadow-sm shadow-black/30 overflow-hidden flex flex-col"
        aria-label={t('keys.sectionTitle')}
      >
        {/* Section header */}
        <header className="flex items-center justify-between px-5 py-2.5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-md bg-surface-2 text-violet-400 inline-flex items-center justify-center">
              <Icon name="key-round" size={14} />
            </span>
            <h2 className="text-[13.5px] font-bold uppercase tracking-[0.04em] text-text-primary">
              {t('keys.sectionTitle')}
            </h2>
          </div>
          {filterChips}
        </header>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <span className="w-12 h-12 rounded-xl bg-surface-2 text-text-subtle inline-flex items-center justify-center mb-3">
              <Icon name="key-round" size={20} />
            </span>
            <p className="text-[14.5px] font-semibold text-text-primary mb-1">{t('keys.emptyTitle')}</p>
            <p className="text-[13px] text-text-tertiary">{t('keys.emptyDesc')}</p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse" aria-label={t('keys.sectionTitle')}>
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.09em] text-text-tertiary border-b border-border">
                    <th className="px-5 py-3.5 font-semibold bg-bg">{t('keys.colKey')}</th>
                    <th className="px-5 py-3.5 font-semibold bg-bg">{t('keys.colVersion')}</th>
                    <th className="px-5 py-3.5 font-semibold bg-bg">{t('keys.colStatus')}</th>
                    <th className="px-5 py-3.5 font-semibold bg-bg">{t('keys.colAsset')}</th>
                    {showAction && (
                      <th className="px-5 py-3.5 font-semibold bg-bg text-right">{t('keys.colAction')}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(lic => {
                    const isFree = licenseStatus(lic) === 'free'
                    const masked = maskedKeys[lic.id] ?? '—'
                    return (
                      <tr
                        key={lic.id}
                        style={{ height: ROW_H }}
                        onClick={() => setDetailsId(lic.id)}
                        data-testid={`key-row-${lic.id}`}
                        className="border-b border-border hover:bg-surface-2 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3">
                          <span className="font-mono text-[13px] text-text-primary tracking-tight">{masked}</span>
                        </td>
                        <td className="px-5 py-3 text-[13.5px] text-text-secondary">{lic.name}</td>
                        <td className="px-5 py-3">
                          {isFree
                            ? <Chip color="green" dot>{t('keys.statusFree')}</Chip>
                            : <Chip color="blue" dot>{t('keys.statusInUse')}</Chip>
                          }
                        </td>
                        <td className="px-5 py-3">
                          {isFree ? (
                            <div className="leading-tight">
                              <div className="text-[13.5px] text-text-primary font-medium">
                                {'—'}
                              </div>
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
                          ) : (
                            (() => {
                              const assetId = lic.assignedToAssetId ?? null
                              const entry = assetId ? (assetNameMap[assetId] ?? null) : null
                              const displayName = entry ? entry.name : (assetId ?? '—')
                              const displayInvCode = entry ? entry.invCode : null
                              return (
                                <div className="leading-tight">
                                  <div className="text-[13.5px] text-text-primary font-semibold">
                                    {displayName}
                                  </div>
                                  {displayInvCode && (
                                    <div className="font-mono text-[12px] text-text-tertiary">
                                      {displayInvCode}
                                    </div>
                                  )}
                                </div>
                              )
                            })()
                          )}
                        </td>
                        {showAction && (
                          <td className="px-5 py-3 text-right">
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); setActivatingId(lic.id) }}
                              data-testid={`activate-btn-${lic.id}`}
                              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[12px] font-semibold text-accent-light border border-accent/30 bg-accent/10 hover:bg-accent/20 transition-colors"
                            >
                              <Icon name="zap" size={12} />
                              {t('keys.activate')}
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}

                  {/* Placeholder rows to keep block height constant */}
                  {Array.from({ length: Math.max(0, PAGE_SIZE - pageRows.length) }).map((_, i) => (
                    <tr
                      key={`__ph_${i}`}
                      aria-hidden="true"
                      style={{ height: ROW_H, borderBottom: '1px solid rgba(42,47,54,0.35)' }}
                    >
                      <td colSpan={showAction ? 5 : 4} className="px-5" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
