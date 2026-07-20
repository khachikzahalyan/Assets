import { useState, useCallback, useEffect, useRef } from 'react'
import type {
  AuditLog, AuditLogQuery, AuditCursor, AuditLogReferenceData, AuditLogRepository,
} from '@/domain/audit'
import { useCachedResource, cacheIdentity } from './useCachedResource'

export interface UseAuditLogsResult {
  rows: AuditLog[]
  ref: AuditLogReferenceData | null
  loading: boolean
  error: Error | null
  /** True when there is a next page to fetch. */
  hasNext: boolean
  /** True when not on the first page (a prev page exists). */
  hasPrev: boolean
  /** 1-based page number for display. */
  page: number
  next: () => void
  prev: () => void
  /**
   * Jump to a 1-based page. Backward jumps to ANY visited page are supported
   * (the cursor stack holds every cursor); forward only one step (cursor
   * pagination cannot skip ahead). Out-of-range values are ignored.
   */
  goto: (p: number) => void
  reload: () => void
}

/**
 * Cursor-paginated audit fetch. Maintains a stack of cursors so prev() can walk
 * back. Page 1 is SWR-cached (loading=false on warm remount); deep pages are
 * uncached (plain fetch, same as before). The query is serialised so changing
 * any filter resets to page 1.
 *
 * @param repository MUST be a stable reference (useMemo / singleton).
 */
export function useAuditLogs(
  repository: AuditLogRepository,
  query: AuditLogQuery,
): UseAuditLogsResult {
  // Cursor stack: cursorStack[i] is the cursor used to fetch page i+1.
  // Page 1 uses null. We store the NEXT cursor of each fetched page to advance.
  const [cursorStack, setCursorStack] = useState<(AuditCursor | null)[]>([null])

  const queryKey = JSON.stringify(query)
  const prevQueryKey = useRef(queryKey)

  // Reset pagination when the query changes.
  useEffect(() => {
    if (prevQueryKey.current !== queryKey) {
      prevQueryKey.current = queryKey
      setCursorStack([null])
    }
  }, [queryKey])

  const currentCursor = cursorStack[cursorStack.length - 1] ?? null

  // Cache page 1 only; deep pages are uncached (key=null → plain fetch semantics).
  const repoId = cacheIdentity(repository)
  const pageKey = currentCursor === null ? `audit:${repoId}:${queryKey}` : null

  const { data: pageData, loading, error: pageError, reload: reloadPage } = useCachedResource(
    pageKey,
    () => repository.listAuditLogs(query, currentCursor),
  )

  // Reference data is cached independently — not re-fetched on page turns.
  const { data: ref, error: refError, reload: reloadRef } = useCachedResource(
    `audit:${repoId}:ref`,
    () => repository.loadReferenceData(),
  )

  const rows = pageData?.rows ?? []
  const nextCursor = pageData?.nextCursor ?? null
  const error = pageError ?? refError

  // Combined reload — refreshes both page data and ref data.
  const reload = useCallback(() => {
    reloadPage()
    reloadRef()
  }, [reloadPage, reloadRef])

  const next = useCallback(() => {
    if (nextCursor != null) setCursorStack(s => [...s, nextCursor])
  }, [nextCursor])

  const prev = useCallback(() => {
    setCursorStack(s => (s.length > 1 ? s.slice(0, -1) : s))
  }, [])

  const goto = useCallback((p: number) => {
    setCursorStack(s => {
      if (p >= 1 && p < s.length) return s.slice(0, p)                       // backward jump
      if (p === s.length + 1 && nextCursor != null) return [...s, nextCursor] // forward one step
      return s                                                                // same page / out of range
    })
  }, [nextCursor])

  return {
    rows, ref, loading, error,
    hasNext: nextCursor != null,
    hasPrev: cursorStack.length > 1,
    page: cursorStack.length,
    next, prev, goto, reload,
  }
}
