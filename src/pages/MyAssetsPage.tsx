import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PageHeader, SectionCard, Chip, LoadingState, ErrorState, EmptyState,
} from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import type { Asset, AssetRepository, AssetReferenceData } from '@/domain/asset'
import type { ChipColor } from '@/components/ui/chip'
import { FirestoreAssetRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'

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

  const defaultRepo = useMemo<AssetRepository>(
    () => new FirestoreAssetRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo

  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [assets, setAssets]       = useState<Asset[]>([])
  const [ref, setRef]             = useState<AssetReferenceData | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [mine, refData] = await Promise.all([
        repo.listAssetsForEmployee(user.id),
        repo.loadReferenceData(),
      ])
      setAssets(mine)
      setRef(refData)
    } catch {
      setLoadError(t('validation.saveFailed'))
    } finally {
      setLoading(false)
    }
  }, [repo, user.id, t])

  useEffect(() => {
    void load()
  }, [load])

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
      <div className="anim-content-enter space-y-5">
        <PageHeader icon="package" title="…" />
        <LoadingState rows={5} />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="anim-content-enter space-y-5">
        <PageHeader icon="package" title={t('self.myAssets')} />
        <ErrorState onRetry={load} />
      </div>
    )
  }

  return (
    <div className="anim-content-enter space-y-5">
      <PageHeader icon="package" title={t('self.myAssets')} />

      <SectionCard title={t('self.myAssets')} icon="package">
        {assets.length === 0 ? (
          <EmptyState icon="package" title={t('self.noAssets')} />
        ) : (
          <ul className="space-y-2">
            {assets.map(a => {
              const status   = statusMap.get(a.statusId)
              const category = categoryMap.get(a.categoryId)
              const color    = toChipColor(status?.color ?? 'gray')
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-md border border-[#1E293B] bg-[#0F172A] px-3 py-2"
                >
                  <span className="font-mono text-[12px] text-[#94A3B8] min-w-[80px]">{a.invCode}</span>
                  <span className="flex-1 text-[13px] text-[#F8FAFC]">
                    {[a.brand, a.model].filter(Boolean).join(' ') || category?.name || '—'}
                  </span>
                  {status && (
                    <Chip color={color} dot>
                      {status.name}
                    </Chip>
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
