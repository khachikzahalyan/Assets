import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PageHeader, SectionCard, Chip, ErrorState, EmptyState,
} from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { Asset, AssetRepository, SelfServiceRefData } from '@/domain/asset'
import { ASSET_STATUS } from '@/domain/asset'
import { statusLabel } from '@/components/features/assets/assetFormat'
import type { ChipColor } from '@/components/ui/chip'
import { getSharedAssetRepository } from '@/infra/repositories'
import { confirmReceipt } from '@/lib/notifications/confirmReceipt'

const VALID_CHIP_COLORS: ReadonlySet<string> = new Set<ChipColor>([
  'gray', 'green', 'blue', 'red', 'amber', 'orange', 'indigo', 'violet', 'teal', 'cyan',
])
function toChipColor(c: string): ChipColor {
  return (VALID_CHIP_COLORS.has(c) ? c : 'gray') as ChipColor
}

export interface MyAssetsPageProps {
  repository?: AssetRepository
}

export function MyAssetsPage({ repository }: MyAssetsPageProps) {
  const { t } = useTranslation('employees')
  const { user } = useAuth()
  const { showToast } = useToast()
  // Invited employees: HR record id differs from uid — server-provisioned link wins.
  const employeeDocId = user.employeeId ?? user.id

  const repo = repository ?? getSharedAssetRepository()

  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [assets, setAssets]       = useState<Asset[]>([])
  const [ref, setRef]             = useState<SelfServiceRefData | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

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

  // In-app receipt confirmation: flips st_pending → st_assigned via the authed API.
  // The realtime subscription (or load() fallback) refreshes the row afterwards.
  const handleConfirm = useCallback(async (assetId: string) => {
    setConfirmingId(assetId)
    const { ok } = await confirmReceipt(assetId)
    if (ok) {
      showToast(t('self.confirmReceiptDone'))
      // Optimistic: reflect the flip immediately (realtime will reconcile).
      setAssets(prev => prev.map(a =>
        a.id === assetId ? { ...a, statusId: ASSET_STATUS.assigned } : a,
      ))
      if (typeof repo.subscribeAssetsForEmployee !== 'function') void load()
    } else {
      showToast(t('self.confirmReceiptFailed'), { variant: 'error' })
    }
    setConfirmingId(null)
  }, [repo, load, showToast, t])

  useEffect(() => {
    // Realtime path: subscribe so an admin's transfer appears without a reload.
    // Ref data (statuses/categories) is static enough for a one-shot fetch.
    // Adapters without realtime (tests) fall back to the one-shot load().
    if (typeof repo.subscribeAssetsForEmployee !== 'function') {
      void load()
      return
    }
    let active = true
    setLoading(true)
    setLoadError(null)
    repo.loadSelfServiceRefData()
      .then(refData => { if (active) setRef(refData) })
      .catch(() => { /* ref is best-effort; the asset list still renders */ })
    const unsub = repo.subscribeAssetsForEmployee(
      employeeDocId,
      mine => { if (!active) return; setAssets(mine); setLoading(false) },
      () => { if (!active) return; setLoadError(t('validation.saveFailed')); setLoading(false) },
    )
    return () => { active = false; unsub() }
  }, [repo, employeeDocId, load, t])

  const statusMap = useMemo(
    () => new Map((ref?.statuses ?? []).map(s => [s.id, s])),
    [ref],
  )
  const categoryMap = useMemo(
    () => new Map((ref?.categories ?? []).map(c => [c.id, c])),
    [ref],
  )

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        {/* PageHeader: title is local i18n — render real; max-md:hidden matches real loaded state */}
        <PageHeader icon="package" title={t('self.myAssets')} className="max-md:hidden" />
        {/* SectionCard: title and icon are local — render real; only body rows are async */}
        <SectionCard title={t('self.myAssets')} icon="package">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md border border-border bg-bg px-3 py-2 min-h-[44px]">
                <div className="h-[0.75rem] w-[5rem] rounded anim-skeleton flex-shrink-0" />
                <div className="h-[0.8125rem] flex-1 rounded anim-skeleton" style={{ maxWidth: `${40 + (i % 4) * 10}%` }} />
                <div className="h-[1.25rem] w-[3.75rem] rounded-md anim-skeleton flex-shrink-0" />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-5">
        <PageHeader icon="package" title={t('self.myAssets')} />
        <ErrorState onRetry={load} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* SectionCard below already shows the same title on mobile — hide PageHeader to avoid duplicate */}
      <PageHeader icon="package" title={t('self.myAssets')} className="max-md:hidden" />

      <SectionCard title={t('self.myAssets')} icon="package">
        {assets.length === 0 ? (
          <EmptyState icon="package" title={t('self.noAssets')} />
        ) : (
          <ul className="space-y-2">
            {assets.map(a => {
              const status    = statusMap.get(a.statusId)
              const category  = categoryMap.get(a.categoryId)
              const color     = toChipColor(status?.color ?? 'gray')
              const isPending = a.statusId === ASSET_STATUS.pending
              const isBusy    = confirmingId === a.id
              return (
                <li
                  key={a.id}
                  className="rounded-md border border-border bg-bg px-3 py-2"
                >
                  <div className="flex items-center gap-3 min-h-[var(--ctl-h-xs)]">
                    <span className="font-mono text-12 text-text-tertiary min-w-[80px]">{a.invCode}</span>
                    <span className="flex-1 text-13 text-text-primary">
                      {[a.brand, a.model].filter(Boolean).join(' ') || category?.name || '—'}
                    </span>
                    {status && (
                      <Chip color={color} dot>
                        {statusLabel(status, t)}
                      </Chip>
                    )}
                  </div>
                  {isPending && (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void handleConfirm(a.id)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 h-8 max-md:h-11 px-3 rounded-lg text-13 font-semibold text-accent light:text-accent bg-accent/10 border border-accent/30 hover:bg-accent/15 hover:border-accent/50 transition-colors disabled:opacity-60 disabled:pointer-events-none"
                      >
                        <span aria-hidden="true">✓</span>
                        {t('self.confirmReceipt')}
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
