# List-Page SWR Cache + Memoization Sweep — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.
> **HARD CONSTRAINT: NO git add / commit / push anywhere in this plan. Verification is build + tests only.**
> **GOLDEN RULE (pass to every subagent): search the codebase for existing solutions FIRST and reuse/extend them; create new code only if nothing exists. NO new dependencies (no react-query).**

**Goal:** Repeat visits to list pages (Активы, Запчасти, Лицензии, Сотрудники, Филиалы, Дашборд, Журнал аудита) render last-known data instantly (no skeleton flash) and revalidate in the background; skeleton appears only on true first load. Plus a targeted memoization sweep.

**Architecture:** A tiny module-scope stale-while-revalidate cache (`useCachedResource`) in `src/hooks/` — NOT a new dependency. Existing feature hooks (`useAssets`, `useParts`, `useDashboard`, `useAuditLogs`) are re-implemented on top of it with their public APIs preserved. Pages with bespoke loaders (Employees, Licenses, catalog pages) get either the hook or a seed-from-cache/write-back variant. Default Firestore repos are hoisted to module-level lazy singletons (pattern already established in AssetsPage) so cache keys stay stable across mounts. Cache is cleared on auth user/role change (security).

**Tech stack:** React 19, TypeScript strict + `exactOptionalPropertyTypes` (use conditional-spread for optional props), Vitest + Testing Library. Firebase repos untouched.

**Why this design (decisions):**
- No react-query/SWR dep — the project's repository + hook pattern already exists; a ~90-line hook covers the need (golden rule).
- Cache keys embed **repository identity** (WeakMap counter) so injected test repos never share cache entries with prod singletons or with each other; test isolation is automatic.
- **Always revalidate on mount** — realtime correctness: if data changed while away, the background refetch updates the list in place. Same-page mutations already call `reload()`, which now also updates the cache. Cross-page mutations (create/edit/handover) self-heal on the next mount's revalidation.
- `loading` is true ONLY when there is no cached data for the key. A `refreshing` flag is exposed for optional subtle indicators (not required by pages).
- On background-refresh failure with cached data present, keep showing data (pages show ErrorState only when `error && no data`).
- Security: `clearResourceCache()` on auth user change / signOut / role change — no cross-user or cross-role data leakage within one JS session. Only masked license keys are ever in the cache (raw keys never leave the Cloud Function path).

---

## File map

| Action | File |
|---|---|
| Create | `src/hooks/useCachedResource.ts` (cache store + hook + `cacheIdentity` + `clearResourceCache`) |
| Create | `src/hooks/useCachedResource.test.ts` |
| Modify | `src/hooks/index.ts` (export new hook) |
| Modify | `src/hooks/useAssets.ts`, `src/hooks/useParts.ts`, `src/hooks/useDashboard.ts`, `src/hooks/useAuditLogs.ts` |
| Modify | `src/contexts/AuthContext.tsx` (clear cache on user/role change) |
| Modify | `src/pages/assets/AssetsPage.tsx` (error guard, pageRows useMemo, handler useCallbacks) |
| Modify | `src/pages/parts/PartsPage.tsx`, `src/pages/dashboard/DashboardPage.tsx`, `src/pages/audit/AuditPage.tsx` (module-singleton repos, error guards) |
| Modify | `src/pages/employees/useEmployeesData.ts` (module-singleton repos, seed-from-cache + write-back) |
| Modify | `src/pages/licenses/LicensesPage.tsx` (module-singleton repos, seed-from-cache for wRows/maskedKeys/subs) |
| Modify | `src/pages/catalogs/BranchesPage.tsx`, `DepartmentsPage.tsx`, `CategoriesPage.tsx` (same pattern) |
| Modify | row components for React.memo: `src/components/features/assets/AssetRow.tsx`, `AssetRowMobile.tsx`, `AssigneeCell.tsx`, `src/components/features/employees/EmployeeRow.tsx`, parts + audit row/card components (see Task 5) |
| Create | `src/pages/assets/AssetsPage.cache.test.tsx` (warm-cache remount = no skeleton) |

Out of scope (follow-up backlog): self-service pages, PendingUsersPage, RolesPage, ScanPage, detail pages.

---

## Task 1 — `useCachedResource` (TDD)

**Files:** Create `src/hooks/useCachedResource.ts`, `src/hooks/useCachedResource.test.ts`; modify `src/hooks/index.ts`.

- [ ] **Step 1: failing tests** — `src/hooks/useCachedResource.test.ts` using `renderHook` from `@testing-library/react` (check `src/test-utils/` for an existing harness first):
  - cold start: `loading=true`, `data=null`; after fetcher resolves → `data`, `loading=false`.
  - warm start: pre-populate via first mount, unmount, remount with same key → `data` present synchronously on first render, `loading=false`, `refreshing=true`; when second fetch resolves with NEW value → `data` updates in place.
  - background error with cached data: fetcher rejects on 2nd mount → data stays visible, `error` set, `loading=false`.
  - cold error: fetcher rejects with no cache → `error` set, `data=null`.
  - key change: switching to an uncached key → `loading=true`; switching back to cached key → instant data.
  - `key=null`: no caching, always cold-fetch semantics.
  - `reload()`: refetches and updates cache; `clearResourceCache('a')` deletes only `a*` keys; `clearResourceCache()` deletes all.
- [ ] **Step 2:** run `npx vitest run src/hooks/useCachedResource.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: implementation** — `src/hooks/useCachedResource.ts`:

```ts
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

interface S<T> { key: string | null; data: T | null; loading: boolean; refreshing: boolean; error: Error | null }

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
export function useCachedResource<T>(key: string | null, fetcher: () => Promise<T>): UseCachedResourceResult<T> {
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
        setState(prev => (prev.key === key ? { key, data, loading: false, refreshing: false, error: null } : prev))
      } catch (err) {
        if (!active) return
        const e = err instanceof Error ? err : new Error(String(err))
        // Keep stale data visible on a failed background refresh.
        setState(prev => (prev.key === key ? { ...prev, loading: false, refreshing: false, error: e } : prev))
      }
    })()
    return () => { active = false }
  }, [key, tick])

  return { data: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error, reload }
}
```

  Add `export * from './useCachedResource'` to `src/hooks/index.ts`.
  Note for reload(): the effect re-runs on `tick` but `initialState` isn't re-applied (key unchanged) — the in-flight flags stay as-is, which is correct (data keeps showing; a `refreshing` transition on reload is optional — if tests want it, set it via a setState at effect start guarded by `prev.data !== null`).
- [ ] **Step 4:** run the test file again — expect PASS.
- [ ] **Step 5:** check for a global vitest setup file (`vite.config.ts` → `test.setupFiles`); if one exists, add `afterEach(() => clearResourceCache())` insurance there. If none exists, skip (repo-identity keys already isolate tests).

## Task 2 — Refactor the four shared hooks (public APIs preserved)

**Files:** `src/hooks/useAssets.ts`, `useParts.ts`, `useDashboard.ts`, `useAuditLogs.ts`.

- [ ] **useAssets** — same signature/result. Body becomes:

```ts
export function useAssets(repository: AssetRepository, query: AssetListQuery): UseAssetsResult {
  const queryKey = JSON.stringify(query)
  const key = `assets:${cacheIdentity(repository)}:${queryKey}`
  const { data, loading, error, reload } = useCachedResource(key, async () => {
    const [assets, ref] = await Promise.all([
      repository.listAssets(query),
      repository.loadReferenceData(),
    ])
    return { assets, ref }
  })
  return { assets: data?.assets ?? [], ref: data?.ref ?? null, loading, error, reload }
}
```

- [ ] **useParts** — keep write methods exactly as-is; replace the ref/loading/error/tick block with `useCachedResource(`parts:${cacheIdentity(repo)}`, () => repo.loadReferenceData())`. `reload` comes from the hook (write methods keep calling it — cache updates on revalidate).
- [ ] **useDashboard** — key `dashboard:${cacheIdentity(repo)}:${role}`. Fetcher = existing body (permissions → Promise.allSettled → derive `currentlyOut`) returning `{ data: DashboardData; anyError: boolean }`. Map result: `data: cached?.data ?? EMPTY`, `error: (cached?.anyError ?? false) || fetchError !== null`.
- [ ] **useAuditLogs** — cache ONLY page 1: `const pageKey = currentCursor === null ? `audit:${id}:${queryKey}` : null` (null key = uncached deep pages, semantics unchanged there). Cached value: `{ rows, nextCursor }`. Reference data via a second `useCachedResource(`audit:${id}:ref`, () => repository.loadReferenceData())`. Preserve the cursor-stack API untouched.
- [ ] Run `npm run build` — expect clean. Fix `exactOptionalPropertyTypes` fallout with conditional spreads.

## Task 3 — Auth-change cache clear (security)

**Files:** `src/contexts/AuthContext.tsx`.

- [ ] In the production provider: wherever the subscribed auth user transitions (new uid, or null on sign-out), call `clearResourceCache()`. Also clear in `signOut` and on role override change (`setRole`) in BOTH mock and production providers. Import from `@/hooks/useCachedResource` (verify no circular import; if `src/hooks` imports contexts anywhere (useParts imports useAuth!), import DIRECTLY from the file `@/hooks/useCachedResource`, not the barrel).
- [ ] `npm run build` clean.

## Task 4 — Page wiring: singleton repos + error guards

Pattern for every page: default prod repos become **module-level lazy singletons** (copy the `getSharedRepo()` pattern from `AssetsPage.tsx:34-38`); injected test repos keep working. ErrorState renders only when `error && no data`.

- [ ] **AssetsPage** — `renderTableRegion`: change `if (error)` to `if (error && !ref)`. Wrap `pageRows` in `useMemo`. `onRowClick` and `onNavigateCreate` inline arrows → `useCallback` (`handleRowClick`, `handleNavigateCreate`).
- [ ] **PartsPage** — hoist its repo to a module lazy singleton (check `src/infra/repositories/factories.ts` for how it's built); error guard `error && !ref`.
- [ ] **DashboardPage** — hoist `FirestoreDashboardRepository` to module lazy singleton.
- [ ] **AuditPage** — hoist `FirestoreAuditLogRepository` to module lazy singleton; error guard `error && rows.length === 0 && !ref`.
- [ ] **useEmployeesData** — hoist `defaultRepo`, `defaultAssetRepo`, `defaultAsnRepo` to module lazy singletons. Seed-from-cache + write-back (setters/actions untouched):
  - `const snapKey = `employees:${cacheIdentity(repo)}:${JSON.stringify(query)}``
  - In `reload()`: first `const cached = readEmployeesSnapshot(snapKey)`; if present, apply all setters from it and DO NOT `setLoading(true)`; else `setLoading(true)`. After a successful fetch, write `{ employees, former, branches, departments, categories, assetCounts }` back to the cache. Implement read/write via two tiny module helpers on top of exported cache primitives — add `readResourceCache<T>(key): T | undefined` and `writeResourceCache(key, data)` exports to `useCachedResource.ts` (thin wrappers over the store honoring MAX_ENTRIES).
  - `loading` initial state: `useState(() => readResourceCache(initialSnapKey) === undefined)` — seed initial slices from the snapshot in their `useState` initializers when present.
- [ ] **LicensesPage** — hoist the five default repos to module lazy singletons (`let _x: T | null` + getter using `db()`). In `loadWorkstation`: seed `wRows`+`maskedKeys` from `readResourceCache('licenses:<id>:workstation')` and skip `setWLoading(true)` when seeded; write-back after fetch. Same for `loadSubs` with `licenses:<id>:subs`. auditMap/assets/employees loaders stay as-is (they don't gate skeletons).
- [ ] **BranchesPage / DepartmentsPage / CategoriesPage** — replace the local `load()`/`useEffect`/`loading` state with `useCachedResource` (keys `branches:<id>`, `departments:<id>`, `categories:<id>`); mutations keep calling `reload()`. Hoist repos to module lazy singletons. Preserve each page's exported behavior and test-injection props.
- [ ] `npm run build` clean.

## Task 5 — Memoization sweep (targeted, not blanket)

- [ ] `React.memo` on pure list row/card components (verify each takes stable props after Task 4):
  - assets: `AssetRow`, `MobileCard` (AssetRowMobile.tsx), `AssigneeCell`, `PaginationBar`, `GroupTabs`
  - employees: `EmployeeRow` (+ its mobile card if separate)
  - parts: `DeviceGridCard` and the movement/journal row component (check `src/components/features/parts/`)
  - audit: the desktop row inside `AuditTable` (extract to component only if already separate — do NOT split files just to memo) and `AuditRowMobile`
- [ ] `useCallback` for handlers passed into those components from their pages (search each page for inline `on*={() => ...}` props feeding memoized children — AssetsPage done in Task 4; sweep Employees/Parts/Audit/Licenses tables).
- [ ] `useMemo` for derived arrays feeding memoized children (AssetsPage `pageRows` done; check EmployeesPage pagination slice and parts/audit equivalents).
- [ ] Verify keys on all mapped rows are entity ids (fix any index keys found).
- [ ] Do NOT memo components whose props change every render (e.g. anything receiving a fresh inline object that can't be stabilized cheaply) — keep the code idiomatic.
- [ ] `npm run build` clean.

## Task 6 — Warm-cache page tests

**Files:** create `src/pages/assets/AssetsPage.cache.test.tsx` (mirror the harness of `AssetsPage.test.tsx`).

- [ ] Test: render AssetsPage with ONE in-memory repo instance seeded with 2 assets; `await` rows visible; `unmount()`; render AGAIN with the SAME repo instance; assert rows are present IMMEDIATELY (synchronous query — `screen.getByText(...)` without waitFor) and no skeleton element is rendered (locate the skeleton by its class `anim-skeleton` or the TableSkeleton testid — check `src/components/ui`).
- [ ] Test: background refresh updates in place — after warm remount, if the repo now returns 3 assets, `await` the third row appearing without any skeleton in between.
- [ ] Optional (cheap): same warm-remount test for Employees (reuse EmployeesPage test harness).
- [ ] Full suite: `npm test -- --run`. Known pre-existing flakes (routes.test.tsx dashboard testid; AssetsPage/EmployeesPage waitFor timeouts under full parallel load) are NOT to be "fixed" here unless caused by this change.

## Task 7 — Verification (no commits)

- [ ] `npm run build` — clean (tsc -b + vite).
- [ ] `npm test -- --run` — pass except the documented pre-existing flakes; any NEW failure must be triaged against this change.
