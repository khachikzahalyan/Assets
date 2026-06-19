import { useEffect, useState, useCallback } from 'react'
import type { Asset, AssetListQuery } from '@/domain/asset'
import type { AssetRepository, AssetReferenceData } from '@/domain/asset/AssetRepository'

export interface UseAssetsResult {
  assets: Asset[]
  ref: AssetReferenceData | null
  loading: boolean
  error: Error | null
  reload: () => void
}

/**
 * Fetches assets and reference data for the given query.
 *
 * @param repository Must be a STABLE reference (memoized via useMemo, or a
 *   module/instance singleton). Passing a new instance each render triggers a
 *   re-fetch on every render.
 * @param query The list query (group, statusId, branchId, search, sort).
 *   Serialised with JSON.stringify so only value changes trigger a re-fetch.
 */
export function useAssets(
  repository: AssetRepository,
  query: AssetListQuery,
): UseAssetsResult {
  const [assets, setAssets] = useState<Asset[]>([])
  const [ref, setRef] = useState<AssetReferenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick(t => t + 1), [])

  // Stable serialised key so the effect only re-runs when query values change.
  const queryKey = JSON.stringify(query)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const [assetList, refData] = await Promise.all([
          repository.listAssets(query),
          repository.loadReferenceData(),
        ])
        if (!active) return
        setAssets(assetList)
        setRef(refData)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository, queryKey, tick])

  return { assets, ref, loading, error, reload }
}
