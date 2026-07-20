import { useCallback, useEffect, useRef, useState } from 'react'

/** Module-scope SWR cache. Entries live for the JS session; cleared on auth change. */
const store = new Map<string, unknown>()
const MAX_ENTRIES = 50

let nextIdentity = 1
const identities = new WeakMap<object, number>()

/** Stable id for a repository instance — embeds test-repo isolation into cache keys. */
export function cacheIdentity(obj: object): string {
  let id = identities.get(obj)
  if (id === undefined) { id = nextIdentity++; identities.set(obj, id) }
  return `r${id}`
}

export function clearResourceCache(prefix?: string): void {
  if (prefix === undefined) { store.clear(); return }
  for (const key of [...store.keys()]) if (key.startsWith(prefix)) store.delete(key)
}

/** Read a cached value without triggering a fetch. Returns undefined when not cached. */
export function readResourceCache<T>(key: string): T | undefined {
  return store.has(key) ? (store.get(key) as T) : undefined
}

/** Write a value to the cache directly (honors MAX_ENTRIES eviction). */
export function writeResourceCache(key: string, data: unknown): void {
  writeCache(key, data)
}

function writeCache(key: string, data: unknown): void {
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
  }
  store.set(key, data)
}

export interface UseCachedResourceResult<T> {
  data: T | null
  /** True ONLY when there is no cached data yet (true first load). */
  loading: boolean
  /** True while a background revalidation is in flight (data already shown). */
  refreshing: boolean
  error: Error | null
  reload: () => void
}

interface S<T> {
  key: string | null
  data: T | null
  loading: boolean
  refreshing: boolean
  error: Error | null
}

function initialState<T>(key: string | null): S<T> {
  const has = key !== null && store.has(key)
  return {
    key,
    data: has ? (store.get(key as string) as T) : null,
    loading: !has,
    refreshing: has,
    error: null,
  }
}

/**
 * Stale-while-revalidate fetch. Renders cached data immediately on repeat
 * visits (loading=false) and refreshes in the background; skeleton only on
 * true first load. `key=null` disables caching (plain fetch-on-mount).
 * The fetcher is read through a ref — it may close over query values freely.
 */
export function useCachedResource<T>(
  key: string | null,
  fetcher: () => Promise<T>,
): UseCachedResourceResult<T> {
  const fetcherRef = useRef(fetcher)
  useEffect(() => { fetcherRef.current = fetcher })

  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick(t => t + 1), [])

  const [state, setState] = useState<S<T>>(() => initialState<T>(key))

  // React-endorsed "adjust state during render" — avoids a stale-data frame on key change.
  if (state.key !== key) setState(initialState<T>(key))

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const data = await fetcherRef.current()
        if (key !== null) writeCache(key, data)
        if (!active) return
        setState(prev =>
          prev.key === key
            ? { key, data, loading: false, refreshing: false, error: null }
            : prev,
        )
      } catch (err) {
        if (!active) return
        const e = err instanceof Error ? err : new Error(String(err))
        // Keep stale data visible on a failed background refresh.
        setState(prev =>
          prev.key === key
            ? { ...prev, loading: false, refreshing: false, error: e }
            : prev,
        )
      }
    })()
    return () => { active = false }
  }, [key, tick])

  return {
    data: state.data,
    loading: state.loading,
    refreshing: state.refreshing,
    error: state.error,
    reload,
  }
}
