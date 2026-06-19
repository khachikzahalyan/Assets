import { useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader, SectionCard, Btn, Icon, EmptyState, LoadingState, ErrorState } from '@/components/ui'
import { AssetsFilterBar, AssetsTable } from '@/components/features/assets'
import { useAssets } from '@/hooks'
import type { AssetListQuery, Asset } from '@/domain/asset'
import type { AssetRepository } from '@/domain/asset/AssetRepository'
import { FirestoreAssetRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'

const PAGE_SIZE = 15

const DEFAULT_QUERY: Required<AssetListQuery> = {
  group: 'all',
  statusId: 'all',
  branchId: 'all',
  search: '',
  sort: 'updated_desc',
}

export interface AssetsPageProps {
  repository?: AssetRepository
}

export function AssetsPage({ repository }: AssetsPageProps) {
  const { t } = useTranslation(['assets', 'nav'])
  const { role } = useAuth()

  // Composition root: build default Firestore repo lazily; test callers pass their own.
  const defaultRepo = useMemo<AssetRepository>(
    () => new FirestoreAssetRepository(db()),
    // db() is stable across renders — the firebase sdk returns the same Firestore instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo

  const canMutate = role === 'super_admin' || role === 'asset_admin'

  const [query, setQuery] = useState<AssetListQuery>({ ...DEFAULT_QUERY })
  const [page, setPage] = useState(1)

  const handleQueryChange = useCallback((patch: Partial<AssetListQuery>) => {
    setQuery(prev => ({ ...prev, ...patch }))
    setPage(1)
  }, [])

  const { assets, ref, loading, error, reload } = useAssets(repo, query)

  // Paginate the returned asset list in the UI layer.
  const totalCount = assets.length
  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, totalCount)
  const pageRows: Asset[] = assets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const canPrev = page > 1
  const canNext = to < totalCount

  function renderBody() {
    if (loading) return <LoadingState rows={8} />
    if (error) return <ErrorState onRetry={reload} />
    if (assets.length === 0) {
      return (
        <EmptyState
          icon="package"
          title={t('empty.title', { ns: 'assets' })}
          description={t('empty.desc', { ns: 'assets' })}
        />
      )
    }
    return (
      <>
        <AssetsTable
          rows={pageRows}
          ref={ref!}
          canMutate={canMutate}
        />

        {/* Pagination */}
        {totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-4 border-t border-[#2A2F36] mt-2">
            <span className="text-[12px] text-[#64748B]">
              {t('pagination.range', { ns: 'assets', from, to, total: totalCount })}
            </span>
            <div className="flex items-center gap-2">
              <Btn
                variant="secondary"
                size="sm"
                disabled={!canPrev}
                onClick={() => setPage(p => p - 1)}
              >
                <Icon name="chevron-right" size={13} className="rotate-180" />
              </Btn>
              <Btn
                variant="secondary"
                size="sm"
                disabled={!canNext}
                onClick={() => setPage(p => p + 1)}
              >
                <Icon name="chevron-right" size={13} />
              </Btn>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="anim-content-enter space-y-5">
      <PageHeader
        icon="package"
        title={t('items.assets', { ns: 'nav' })}
        {...(!loading ? { count: totalCount } : {})}
        {...(canMutate ? {
          actions: (
            <Btn variant="primary" size="md" onClick={() => console.info('[AssetsPage] create stub')}>
              <Icon name="package" size={14} />
              {t('create', { ns: 'assets' })}
            </Btn>
          ),
        } : {})}
      />

      <SectionCard noHeader>
        <div className="space-y-4">
          {ref && (
            <AssetsFilterBar
              query={query}
              onChange={handleQueryChange}
              ref={ref}
            />
          )}
          {/* Render filter bar skeleton while ref is loading */}
          {!ref && !error && (
            <div className="h-9 rounded-lg anim-skeleton w-full" />
          )}
          {renderBody()}
        </div>
      </SectionCard>
    </div>
  )
}
