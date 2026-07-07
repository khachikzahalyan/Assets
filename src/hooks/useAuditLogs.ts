import { useEffect, useState, useCallback, useRef } from 'react'
import type {
  AuditLog, AuditLogQuery, AuditCursor, AuditLogReferenceData, AuditLogRepository,
} from '@/domain/audit'

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
 * back. The query is serialised so changing any filter resets to page 1.
 *
 * @param repository MUST be a stable reference (useMemo / singleton).
 */
export function useAuditLogs(
  repository: AuditLogRepository,
  query: AuditLogQuery,
): UseAuditLogsResult {
  const [rows, setRows] = useState<AuditLog[]>([])
  const [ref, setRef] = useState<AuditLogReferenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  // Cursor stack: cursorStack[i] is the cursor used to fetch page i+1.
  // Page 1 uses null. We store the NEXT cursor of each fetched page to advance.
  const [cursorStack, setCursorStack] = useState<(AuditCursor | null)[]>([null])
  const [nextCursor, setNextCursor] = useState<AuditCursor | null>(null)

  const queryKey = JSON.stringify(query)
  const prevQueryKey = useRef(queryKey)

  // Reset pagination when the query changes.
  useEffect(() => {
    if (prevQueryKey.current !== queryKey) {
      prevQueryKey.current = queryKey
      setCursorStack([null])
    }
  }, [queryKey])

  const reload = useCallback(() => setTick(t => t + 1), [])

  const currentCursor = cursorStack[cursorStack.length - 1] ?? null

  // Page fetch — re-runs on every page turn, filter change, or explicit reload.
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const page = await repository.listAuditLogs(query, currentCursor)
        if (!active) return
        setRows(page.rows)
        setNextCursor(page.nextCursor)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository, queryKey, currentCursor, tick])

  // Reference data fetch — re-runs only when the repository changes or on reload.
  // Stable actor/reference data does not need to be re-fetched on every page turn.
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const refData = await repository.loadReferenceData()
        if (!active) return
        setRef(refData)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err : new Error(String(err)))
      }
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository, tick])

  const next = useCallback(() => {
    if (nextCursor != null) setCursorStack(s => [...s, nextCursor])
  }, [nextCursor])

  const prev = useCallback(() => {
    setCursorStack(s => (s.length > 1 ? s.slice(0, -1) : s))
  }, [])

  const goto = useCallback((p: number) => {
    setCursorStack(s => {
      if (p >= 1 && p < s.length) return s.slice(0, p)                    // backward jump
      if (p === s.length + 1 && nextCursor != null) return [...s, nextCursor] // forward one step
      return s                                                            // same page / out of range
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
