import { useState, useEffect, useRef } from 'react'
import type { Asset, AssetReferenceData } from '@/domain/asset'
import type { Employee } from '@/domain/employee'
import type { Branch } from '@/domain/branch'
import {
  getSharedAssetRepository,
  getSharedEmployeeRepository,
  getSharedBranchRepository,
} from '@/infra/repositories'

/** All data the palette needs — loaded once per open, cached until unmount. */
export interface SearchPaletteData {
  assets: Asset[]
  ref: AssetReferenceData
  employees: Employee[]
  branches: Branch[]
}

/** Null = not yet loaded. */
export type SearchPaletteDataState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: SearchPaletteData }
  | { status: 'error'; error: Error }

/**
 * Lazy one-shot loader for the SearchPalette. Data is fetched the FIRST time
 * `open` becomes true, then held in component state for the rest of the session.
 * Uses the shared repository singletons so it composes with the app-wide SWR cache.
 */
export function useSearchPaletteData(open: boolean): SearchPaletteDataState {
  const [state, setState] = useState<SearchPaletteDataState>({ status: 'idle' })
  // Track whether we've already fetched so reopening doesn't re-fetch.
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!open) return
    if (fetchedRef.current) return
    fetchedRef.current = true

    setState({ status: 'loading' })

    const assetRepo    = getSharedAssetRepository()
    const employeeRepo = getSharedEmployeeRepository()
    const branchRepo   = getSharedBranchRepository()

    let cancelled = false
    void (async () => {
      try {
        const [assets, ref, employees, branches] = await Promise.all([
          assetRepo.listAssets({}),
          assetRepo.loadReferenceData(),
          employeeRepo.listEmployees({ status: 'active' }),
          branchRepo.listBranches(),
        ])
        if (cancelled) return
        setState({ status: 'ready', data: { assets, ref, employees, branches } })
      } catch (err) {
        if (cancelled) return
        setState({ status: 'error', error: err instanceof Error ? err : new Error(String(err)) })
      }
    })()

    return () => { cancelled = true }
  }, [open])

  return state
}
