# Plan — Branded AMS Loader + Skeleton Fidelity

Slug: `branded-loader-and-skeleton-fidelity`
Owner: warehouse-orchestrator (AMS)
Working dir: `C:/Users/DELL/Desktop/assets-crm`
Date: 2026-06-23

## Goal
1. **Branded main loader** — replace the generic `LoadingState` used in the route guard (`RequireAuth`, `status==='loading'`) with a centered AMS-logo loader (pulse/glow + spinner ring), dark theme. This is the auth/route-resolve loader.
2. **Skeleton fidelity** — page-level data skeletons stay skeletons but match the REAL block's dimensions + count. Priority: Assets + Employees lists must render a TABLE-SHAPED skeleton (44px header + exactly 10 rows, each row `flex 1 1 0; minHeight 58px`) filling the same full-height ListCard as the real table. Audit other pages so no skeleton is noticeably thinner/shorter than its real block.

## Grounding facts (verified by reading source)
- Brand mark: Sidebar uses an AMS gradient square (`from-[#F97316] to-[#C2410C]`, `rounded-xl`, text "AMS"). LoginPage uses an orange `package` icon square (`bg-[#F97316]`, `rounded-xl`). Page background dark: `#111315` (shell), `#0D1117` (login), card `#1B1F24`, border `#2A2F36`.
- Skeleton animation utility: `.anim-skeleton` (shimmer) in `src/index.css` line ~283. KEEP and reuse.
- `LoadingState` (`src/components/ui/loading-state.tsx`): generic `{rows}` API → list of small chip rows (~58px incl padding). Used in ~18 pages.
- `RequireAuth` (`src/components/routing/RequireAuth.tsx`): `status==='loading'` → centered box with `<LoadingState rows={4}/>`. REPLACE with branded loader.
- Assets list table (`AssetsTable.tsx`): sticky header `height:44px`; body `flex 1 1 0`; each real row + placeholder row is `flex 1 1 0; minHeight 58px`; `minRows = PAGE_SIZE = 10`; full `height:100%`. 7 grid cols (`AssetRow.GRID_COLS`). Loading currently `<LoadingState rows={8}/>` — WRONG (thin, only 8, doesn't fill).
- Employees list table (`EmployeesTable.tsx`): same shape, 8 grid cols, `minRows=10`, header 44px, rows `flex 1 1 0; minHeight 58px`. Loading currently `<LoadingState rows={8}/>` — WRONG.
- Both list pages render the loading region INSIDE `<ListCard>` Zone 2 (`flex-1 min-h-0 overflow-hidden`) via `renderTableRegion()`. So a table-shaped skeleton placed there inherits the full-height footprint automatically.
- Tests that constrain us:
  - `route-guards.test.tsx` line 83: asserts loading markup matches `.anim-skeleton, [class*="skeleton"]`. Branded loader MUST include an element matching that selector OR update the test. DECISION: update the test to assert a branded loader testid/role AND keep selector tolerance; simplest = give branded loader an element with class containing "skeleton"? No — cleaner to UPDATE the test to look for the branded loader. Branded loader will expose `data-testid="app-loader"` + `role="status"`.
  - `primitives.test.tsx` LoadingState test: `rows=3 → root.children.length === 3`. KEEP `LoadingState` row-based default behavior intact (don't break the variant API for the generic path).
- Baseline: `tsc --noEmit` exit 0. Full vitest: 1 failed / 1725 passed. The ONLY failure is `src/locales/parts.i18n.test.ts` (Parts module, pre-existing, NOT ours). `vite build`/`tsc -b` may fail on Parts module errors (PartCard/WarehouseTab/firestorePartRepository/PartsPage/parts tests) — pre-existing, not ours.

## Components to build (component-first, reusable)
### A. `src/components/ui/AppLoader.tsx` — branded full-area loader
- Centered AMS gradient mark (orange `from-[#F97316] to-[#C2410C]`, rounded-2xl, "AMS" text OR `package` icon — use the AMS gradient square to match the primary brand). Around it: a pulsing glow (animated box-shadow / opacity) + a subtle thin spinner ring (orange, `animate-spin` or custom keyframe).
- Props: `label?: string` (defaults to ru `common:loading` or hardcoded "Загрузка…"), `fullScreen?: boolean` (true = `min-h-screen` viewport center on `#111315`; false = fill parent `h-full w-full` center). Default `fullScreen=false` (fills available area).
- Accessibility: `role="status"`, `aria-live="polite"`, `data-testid="app-loader"`, visually-hidden label text for SR.
- New keyframes in `src/index.css` if needed: `amsLoaderGlow` (pulse glow) — reuse `animate-spin` from tailwind for the ring. Keep dark-theme tokens.

### B. `src/components/ui/TableSkeleton.tsx` — table-shaped list skeleton
- Mirrors AssetsTable/EmployeesTable structure: a flex column `width:100% height:100%`; sticky-style header row `height:44px` with N column-header shimmer bars; body `flex 1 1 0` containing exactly `rows` row divs, each `flex 1 1 0; minHeight:58px` with a per-column shimmer cell layout (icon block + text bars) so it visually matches a real row's height and column rhythm.
- Props: `rows?: number` (default 10), `columns?: number` (col count for header bars; default 6), optional `firstColWide?: boolean` (asset/employee first col has icon+2-line). Keep it generic enough for both lists.
- Uses `.anim-skeleton` for shimmer. Dark borders `#2A2F36`/`rgba(42,47,54,…)` matching table.
- `data-testid="table-skeleton"`.

### C. Parameterize `LoadingState` (KEEP existing API)
- Keep `rows` prop and existing row markup (primitives.test relies on `root.children.length === rows`). OPTIONAL: add a `variant`/sizing prop only if a page needs taller rows — but do NOT change default behavior. Likely no change needed; non-list pages keep generic LoadingState but with right `rows` count tuned to their real block.

## Wiring changes
1. `RequireAuth.tsx`: `status==='loading'` → `return <AppLoader fullScreen />`. Remove the `LoadingState` import if now unused.
2. `AssetsPage.tsx` `renderTableRegion()`: `if (loading) return <TableSkeleton rows={PAGE_SIZE} columns={6} firstColWide />` (replaces `<LoadingState rows={8}/>`). This sits inside ListCard Zone 2 → full-height, 10 rows, 58px each, 44px header. Keep the toolbar/filter skeletons that already exist (they're at real heights: 52px / 40px).
3. `EmployeesPage.tsx` `renderTableRegion()`: `if (loading) return <TableSkeleton rows={PAGE_SIZE} columns={7} firstColWide />` (8 cols incl trailing 56px action — use 7 visible-text cols). Replaces `<LoadingState rows={8}/>`.
4. Other pages — match real block sizes:
   - `DashboardPage`: loading currently `<LoadingState rows={6}/>` under a PageHeader. Dashboard real content = KPI tiles + breakdown cards (a grid of cards), NOT a list. Build/await a light tile-grid skeleton OR raise rows to better fill. DECISION: keep `LoadingState` but ensure it isn't thinner than tiles — acceptable to leave as a generic list skeleton IF tiles ~ same height; otherwise add a small `KpiSkeleton` row of 4 tiles + breakdown bars. Keep minimal — match height, don't over-engineer.
   - `AssetDetailPage`: loading `<LoadingState rows={5}/>` under PageHeader → detail is hero + cards. Leave generic but tune rows so it's not too short; the real hero is tall. Acceptable to keep generic LoadingState (rows=5) — it's not a fixed-height table. Confirm not thinner than real cards; if needed bump.
   - Catalog/list-ish pages (`LicensesPage`, `BranchesPage`, `CategoriesPage`, `StatusesPage`, `DepartmentsPage`, `RolesPage`, `AuditPage`, `MyAssetsPage`, `MyActsPage`, `PendingUsersPage`, `ProfilePage`, `SettingsPage`): audit each. If the page uses `ListCard`/full-height table like Assets/Employees → use `TableSkeleton`. If it's a simple card list → keep `LoadingState` with row count matching the real item count/height. Goal: no skeleton noticeably thinner/shorter than its real block.

## Tests to add/update
- `route-guards.test.tsx` (RequireAuth loading): update the assertion to find the branded loader (`screen.getByTestId('app-loader')` or `getByRole('status')`) instead of (or in addition to) the `.anim-skeleton` selector. Keep "inner not rendered".
- `AppLoader` unit test (`src/components/ui/AppLoader.test.tsx`): renders mark + `role="status"` + label; `fullScreen` toggles min-h-screen.
- `TableSkeleton` unit test (`src/components/ui/TableSkeleton.test.tsx`): renders `rows` row blocks + `columns` header cells; has `data-testid`.
- Existing `primitives.test.tsx` LoadingState test: must still pass (don't change default LoadingState markup).
- Update any page test that asserted on the old loading skeleton shape if it breaks (likely AssetsPage/EmployeesPage tests don't assert loading markup — verify; only touch if they fail).

## HARD RULES
- RUSSIAN-ONLY locale edits (`src/locales/ru/*.json`); never en/hy. If a loader label key is added, add to `ru` common namespace only (or hardcode "Загрузка…").
- Component-first; no scattered ad-hoc skeleton markup — all via AppLoader / TableSkeleton / LoadingState.
- Do NOT change pagination text (range format «{from}–{to} из {total}») — leave PaginationBar untouched.
- Display-only; preserve all behavior.
- No git commit/push.

## DoD
- `npm run typecheck` (tsc --noEmit) → exit 0.
- `npm run build` may fail ONLY on pre-existing Parts module errors; no NEW errors outside Parts.
- `npm run test` → no NEW failures vs baseline (baseline = 1 fail: parts.i18n.test.ts). Updated loader/skeleton tests pass.
- Manual reasoning: refresh → centered AMS logo loader (not card skeleton); /assets data skeleton = 10 full-height rows matching real table; no skeleton thinner than its real block.
