# Firestore Quota Exhaustion — Root-Cause Fix + Graceful UX

Date: 2026-08-05. Status: approved for execution.

## Symptom

Parts-warehouse replace (Install modal, action=replace, disposal=broken) fails with a raw
red toast «Quota exceeded.» — Firebase's `resource-exhausted` FirebaseError surfaced
verbatim by `handleInstallConfirm` in `src/pages/parts/PartsPage.tsx`.

## Root-cause conclusion (systematic-debugging, evidence-backed)

**Exhausted daily READ quota (50k/day, Spark plan) — not writes.** The replace transaction
itself costs only ~4 writes, but `fsInstallPart` performs `txn.get()` READS inside the
transaction (SKU + asset), plus rules-side `get(/users/{uid})` + `exists(part_categories)`
(~5 billed reads). When the read quota is exhausted, the very next "write" op fails with
`resource-exhausted` — matching the toast exactly.

Reads are burned by structural amplification (H3 confirmed):

| # | Defect | File:line |
|---|---|---|
| D1 | Unbounded full scan of the ever-growing `part_movements` journal on every Parts ref load | `src/infra/repositories/firestorePartRepository.reads.ts:84` (no `limit()`) |
| D2 | `useAssets` cache key includes `search` → full `assets` collection scan per keystroke (repo filters search client-side anyway) | `src/hooks/useAssets.ts:29` + `src/pages/assets/AssetsPage.tsx:60-64` + `firestoreAssetRepository.ts:161-166` |
| D3 | Dashboard full scans (`assets`, `licenses`, `employees`, `parts`, `branches`, `categories` + capped audit/movements + 4 aggregations) re-run on every Dashboard mount; SWR always revalidates; repo has no TTL cache | `src/infra/repositories/firestoreDashboardRepository.ts` + `src/hooks/useDashboard.ts` + `src/hooks/useCachedResource.ts:90-114` |
| D4 | **Stale-after-write bug (freshness, found during investigation):** `FirestorePartRepository` write methods never call `invalidateRefCache()`; the repo is a shared singleton with a 60s TTL ref cache (P1.3), so `useParts`' post-write `reload()` returns the STALE cached promise — UI shows pre-write stock/history for up to 60s | `src/infra/repositories/firestorePartRepository.ts:73-83, 95-128` |

Ruled out: H2 write-loop (only one `onSnapshot` in the app, read-only callback; no writes in
effects; no Firestore-trigger Cloud Functions; no auto-retry). H4 rules get() storm (all role
helpers funnel through one deduped `userDoc()` get; ≤5 billed rule reads per install txn).

Architecture note: the SKU doc `onHand`/`broken` snapshot is the **authoritative** stock
source since P1.1 (`firestorePartRepository.reads.ts` header comment). Components still
deriving stock from the full journal (`deriveStock(movements)`) is a leftover that BLOCKS
capping the journal query — so display must migrate to the snapshot as part of this fix.

## Fix scope

### Task 1 — firebase-engineer (infra + domain constants/predicates)

1. `src/domain/part/partStock.ts`: export `PARTS_MOVEMENTS_CAP = 1000` (doc comment: bounds
   the journal fetch; journal-derived display niceties — «Осталось N шт» running labels,
   header «installed» counter, replace-stats — silently cover only the most recent CAP
   movements once the journal exceeds it; authoritative stock is the SKU snapshot).
2. `src/domain/shared/errors.ts` (+ barrel `src/domain/shared/index.ts` if it re-exports):
   add `isQuotaExceededError(e: unknown): boolean` — structural check, NO firebase import in
   domain: true when `e` has `code === 'resource-exhausted'`, OR is an `Error` whose message
   matches `/quota exceeded|resource.?exhausted/i`. Follow the existing predicate patterns
   in that file.
3. `src/infra/repositories/firestorePartRepository.reads.ts`: add
   `fsLimit(PARTS_MOVEMENTS_CAP)` to the movements query (line 84); update the header
   comment (P1.x note).
4. `src/infra/repositories/firestorePartRepository.ts`: every successful write invalidates
   the ref cache — `installPart`, `uninstallPart`, `recordService`, `receiveParts`,
   `createModelSku` (and the deprecated `createGpu` path, which delegates): await the fs*
   call, `this.invalidateRefCache()`, return. Do NOT invalidate on rejection.
5. Extract the asset search predicate into a pure domain helper (e.g.
   `matchesAssetSearch(asset, search)` — place in an EXISTING suitable module under
   `src/domain/asset/`, reuse-first) and make
   `firestoreAssetRepository.listAssets` (lines 161-166) use it. Same fields, same
   lowercase-includes semantics: invCode, brand, model, serial.
6. In-memory part adapter: leave as-is (no cache, small data) unless a parity test fails.

### Task 2 — react-ui-engineer (hooks + pages + components)

1. `src/pages/parts/PartsPage.tsx`:
   - `stats` memo: `onHand`/`broken` totals from the SKU snapshot (`ref.parts[i].onHand`,
     `.broken`, via `workingStock`), NOT `deriveStock(ref.movements)`. `installed` stays
     movements-derived (add a comment referencing PARTS_MOVEMENTS_CAP drift horizon).
   - `stockMap` memo (UninstallModal preview): build from the parts snapshot
     (`{ [sku.id]: { onHand, broken } }`), not `deriveStock`.
   - All four write handlers (`handleInstallConfirm`, `handleUninstallConfirm`,
     `handleGpuConfirm`, `handleServiceConfirm`): classify the error first —
     `isQuotaExceededError(err) ? t('errors.quotaExceeded') : (err instanceof Error ? err.message : t('<modal>.errorFailed'))`.
2. `src/components/features/parts/WarehouseTab.tsx`: `stockMap` from the `parts` prop
   snapshot instead of `deriveStock(movements)`; fix the stale «(from movements,
   authoritative)» comment — the SNAPSHOT is authoritative since P1.1. `remainingAfterMap`
   stays movements-derived (display nicety; comment the cap horizon).
3. `src/pages/assets/AssetsPage.tsx`: remove `search` from `fetchQuery` (pass `search: ''`),
   apply `matchesAssetSearch` client-side to `allGroupsAssets` FIRST (new `searched` memo),
   then feed `searched` into both the `assets` memo and `groupCounts` (preserves current
   semantics where search affected tab counts). Typing no longer changes the SWR key → no
   per-keystroke collection scan.
4. `src/hooks/useCachedResource.ts`: optional third param `opts?: { ttlMs?: number }`.
   Track a fetchedAt timestamp per cache key (module-scope Map, written in `writeCache`).
   In the fetch effect: when `ttlMs` is set AND the key is cached AND fresh AND `tick === 0`
   (i.e. mount-time revalidation, not an explicit `reload()`), skip the fetch and settle
   state from cache. `reload()` always fetches. Default behavior (no opts) unchanged.
5. `src/hooks/useDashboard.ts`: opt in with `{ ttlMs: 60_000 }`.
6. exactOptionalPropertyTypes discipline: conditional-spread for optional props everywhere.

### Task 3 — i18n-engineer

Add to `src/locales/{ru,en,hy}/parts.json` a new top-level `errors` group with key
`quotaExceeded` (identical key sets — localesSync test enforces):
- ru: «Превышена дневная квота базы данных. Попробуйте позже или обновите тарифный план Firebase.»
- en: "Daily database quota exceeded. Try again later or upgrade the Firebase plan."
- hy: «Տվյալների բազայի օրական սահմանաչափը սպառված է։ Փորձեք ավելի ուշ կամ թարմացրեք Firebase-ի սակագնային պլանը։»

## Explicit non-goals

- NO `persistentLocalCache` — it does not reduce billed reads for one-shot `getDocs`.
- NO restructuring of Dashboard full scans into aggregations (Phase-2 candidate).
- NO TTL for the assets LIST query (would hide a freshly-created asset for 60s after
  navigating back from /assets/new).
- NO changes to `firestore.rules` (H4 ruled out).
- NO git operations anywhere (hard rule for every agent).
- NotificationBell full-asset scan (`useHoldNotifications`) — documented follow-up only.

## Audit / rules impact

None. No new writes; no rules changes; no audit-schema changes. The install path already
runs through `withAudit`.

## Verification

- `npm run build` (tsc -b — exactOptionalPropertyTypes) from C:/Users/DELL/Desktop/assets-crm
- `npm test -- --run` (full suite; localesSync + parts + hooks suites are the sensitive ones)

## Rollback

Every change is additive/local: revert the individual edits (cap constant + limit call,
invalidate calls, predicate, handler mapping, memo sources, TTL opt-in, locale keys).
