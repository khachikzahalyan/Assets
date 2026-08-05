import { useState, useEffect, useRef } from 'react'
import type { Asset, AssetReferenceData, AssetRepository } from '@/domain/asset'
import type { Employee, EmployeeRepository } from '@/domain/employee'
import type { Branch, BranchRepository } from '@/domain/branch'

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

export interface SearchPaletteRepos {
  assetRepo: Pick<AssetRepository, 'listAssets' | 'loadReferenceData'>
  employeeRepo: Pick<EmployeeRepository, 'listEmployees'>
  branchRepo: Pick<BranchRepository, 'listBranches'>
}

/**
 * Lazy one-shot loader for the SearchPalette. Data is fetched the FIRST time
 * `open` becomes true, then held in component state for the rest of the session.
 * Repositories are injected by the caller so the hook stays infra-free.
 * `repos` may be null while the palette has never been opened — the caller
 * resolves them lazily so shell mounts don't construct Firestore singletons.
 */
export function useSearchPaletteData(open: boolean, repos: SearchPaletteRepos | null): SearchPaletteDataState {
  const [state, setState] = useState<SearchPaletteDataState>({ status: 'idle' })
  // Track whether we've already fetched so reopening doesn't re-fetch.
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (!open || repos === null) return
    if (fetchedRef.current) return
    fetchedRef.current = true

    setState({ status: 'loading' })

    const { assetRepo, employeeRepo, branchRepo } = repos

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
  // repos identity is memoized at the call site (flips null → object once).
  }, [open, repos])

  return state
}
