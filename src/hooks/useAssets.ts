import type { Asset, AssetListQuery } from '@/domain/asset'
import type { AssetRepository, AssetReferenceData } from '@/domain/asset/AssetRepository'
import { useCachedResource, cacheIdentity } from './useCachedResource'

export interface UseAssetsResult {
  assets: Asset[]
  ref: AssetReferenceData | null
  loading: boolean
  error: Error | null
  reload: () => void
}

/**
 * Fetches assets and reference data for the given query, with SWR caching.
 *
 * Repeat visits render cached data instantly (loading=false) and revalidate
 * in the background. Skeleton only on true first load.
 *
 * @param repository Must be a STABLE reference (module singleton or memoized).
 *   Passing a new instance each render changes the cache key and triggers a
 *   re-fetch on every render.
 * @param query The list query. Serialised with JSON.stringify so only value
 *   changes trigger a re-fetch and a new cache entry.
 */
export function useAssets(
  repository: AssetRepository,
  query: AssetListQuery,
): UseAssetsResult {
  const queryKey = JSON.stringify(query)
  const key = `assets:${cacheIdentity(repository)}:${queryKey}`

  const { data, loading, error, reload } = useCachedResource(
    key,
    async () => {
      const [assets, ref] = await Promise.all([
        repository.listAssets(query),
        repository.loadReferenceData(),
      ])
      return { assets, ref }
    },
  )

  return {
    assets: data?.assets ?? [],
    ref: data?.ref ?? null,
    loading,
    error,
    reload,
  }
}
