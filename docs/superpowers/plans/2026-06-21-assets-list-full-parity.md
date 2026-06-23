# Plan — Assets List FULL parity with prototype `asset-list.html`

Date: 2026-06-21
Owner: warehouse-orchestrator (AMS)
Target screen: production React Assets list (`src/pages/AssetsPage.tsx` + `src/components/features/assets/*`)
Reference (design + logic only, NEVER import): `C:/Users/DELL/Desktop/Warehouse/prototypes/asset-list.html`

## Goal
Achieve full design + logic parity with the prototype's asset-list screen, building on the existing
React implementation (do not regress). Component-first. Russian-only locale edits. Data from Firestore
repos. All mutations through existing `withAudit` repository methods. No Cloud Functions dependency.

## Baseline (verified before work)
- `npx tsc --noEmit` → exit 0.
- `npx vitest run` → 94 files / 845 tests, all green.

## Prototype → React diff (the work)

| # | Feature | React today | Action |
|---|---|---|---|
| 1 | `deriveStatus(asset)` — status derived from `assignment.mode` (warehouse↔assigned); lifecycle (st_repair/st_disposed) wins | table reads raw `statusId` → chip color | NEW `deriveDisplayStatus()` in `assetFormat.ts`; table uses it for chip + status filter must match |
| 2 | `ViewPopover` "Вид" sort popover (portal, hint sub-lines, colored icons, orange dot when non-default) | sort is a plain `SelectMini` | NEW `ViewPopover.tsx` |
| 3 | "Временно выданные" green toggle + count | missing | NEW temp toggle in filter bar; forward-compatible `isTemporary` signal |
| 4 | `SelectMini` portal custom dropdown: colored dots/icons per option, orange active row, orange non-default trigger | native `<select>` overlay, no colors/active highlight | UPGRADE `SelectMini` (portal, option dot/icon/iconColor, active state) — keep API back-compat |
| 5 | `AssigneeCell` — branch per mode incl. temporary + audit/intern role labels; "На Складе / Ожидает выдачи"; no leading icons | inline in table; icons left of names; no temporary | NEW `AssigneeCell.tsx`; branches employee/department/branch/warehouse/temporary |
| 6 | `assetTitle` furniture → category-name fallback | invCode-only fallback | UPGRADE `assetTitle(a, categoryName?, group?)` |
| 7 | `relativeTime` — week/month/year buckets | day max | EXTEND `relativeBucket` (+ week/month/year) |
| 8 | Updated column = absolute date `09/Dec/2026` | relative time | MATCH prototype: absolute `fmtDate` (DD/Mon/YYYY) |
| 9 | `GroupTabs` icons + per-group counts, orange-filled active | no icons/counts, lighter active | UPGRADE group tabs (counts + lucide icons + orange fill) |
| 10 | Status chip palette `STATUS_CHIP_COLOR` (warehouse=blue) | uses `status.color` from data | derive chip color via `STATUS_CHIP_COLOR[derivedStatus.id]` fallback to data color |
| 11 | "Удалённый" remote badge | cyan + house icon (LOCKED) | KEEP React cyan+house (brief locks it) |
| 12 | "Нет характеристик" amber badge (`needsSpecs`) | missing | SKIP — mock-only flag, no Firestore field |
| 13 | Empty / pagination / loading | present, different styling | ALIGN: numbered-window pagination, empty-state icon variants, "Показано X–Y из Z" |
| 14 | Bulk assign/transfer (DEFERRED) | only bulk write-off | NEW audited `bulkAssign` (employee/branch) via existing `changeStatus(...,{assignment})`; BulkActionBar + modal |
| 15 | Mobile card list | desktop table only | NEW responsive card list (CSS-driven), trivial |

## Domain change (firebase-engineer)
- Extend `AssetAssignment` (`src/domain/asset/types.ts`) with OPTIONAL forward-compatible temporary fields so
  the temporary filter + AssigneeCell temporary branch are real and wired without breaking existing data:
  `isTemporary?: boolean`, `expiresAt?: string | null`, `tempKind?: 'audit' | 'intern' | 'staff' | null`.
  These are read-through (already cast from Firestore by `toAsset` via `assignment as Asset['assignment']`).
  No mutation writes them in MVP; default-absent → zero temp count → no regression.
- NEW audited bulk method on `AssetWriteRepository` is NOT needed — `changeStatus(id, 'st_assigned', actor, { assignment })`
  already audits assignment+status atomically. Bulk = `Promise.all` of per-asset `changeStatus` (same pattern as bulk write-off).
  BUT add a thin convenience method `bulkChangeAssignment(ids, assignment, actor)` to BOTH repos (Firestore + InMemory)
  that loops `changeStatus` so the page does not reach into per-id details, and so it can be unit-tested for audit-per-asset.
  Each call goes through `withAudit`. No audit bypass. No Cloud Function.

## Component tree (component-first)
```
AssetsPage (compose)
├── PageHeader (existing ui) — title + count + Create
├── AssetsFilterBar (UPGRADE)
│   ├── GroupTabs (NEW component, extracted) — icons + counts
│   ├── SearchInput (inline, existing)
│   ├── SelectMini ×2 (UPGRADE primitive) — Status, Branch (colored dots/icons)
│   ├── ViewPopover (NEW) — sort
│   ├── TempToggle (inline button) — "Временно выданные" + count
│   └── Reset + Export (existing)
├── AssetsTable (UPGRADE)
│   └── AssetRow (UPGRADE)
│       └── AssigneeCell (NEW component)
├── AssetCardsMobile (NEW) — mobile responsive list
├── BulkActionBar (UPGRADE) — + Assign action
│   └── BulkAssignModal (NEW) — employee/branch picker
├── WriteOffConfirmModal (existing)
├── EmptyState (ALIGN styling, icon variants)
└── PaginationBar (NEW numbered-window component, replaces inline prev/next)
```

## Tasks (sequential, each gated by test-engineer)
1. **firebase-engineer** — domain `AssetAssignment` optional temp fields; `bulkChangeAssignment` on both repos (audited per asset); update `AssetReferenceData` not needed. Tests: audit-per-asset, assignment+status atomic.
2. **react-ui-engineer (logic helpers)** — `assetFormat.ts`: `deriveDisplayStatus`, extend `relativeBucket`, `fmtDate`, `assetTitle` overload, `STATUS_CHIP_COLOR`, `assigneeKind` (+temporary). Pure-function tests.
3. **react-ui-engineer (primitives)** — UPGRADE `SelectMini` (portal + option colors + active); NEW `ViewPopover`; NEW `GroupTabs`.
4. **react-ui-engineer (table)** — NEW `AssigneeCell`; UPGRADE `AssetRow` (use AssigneeCell, absolute date, derived status chip, furniture title); UPGRADE `AssetsTable`.
5. **react-ui-engineer (filter + page)** — UPGRADE `AssetsFilterBar` (GroupTabs+ViewPopover+TempToggle); NEW `PaginationBar`; ALIGN `EmptyState`; NEW `AssetCardsMobile`; wire temp filter + sort + derived-status filter in `AssetsPage`.
6. **react-ui-engineer (bulk assign)** — NEW `BulkAssignModal`; UPGRADE `BulkActionBar` (Assign btn); wire in `AssetsPage` via `bulkChangeAssignment`.
7. **i18n-engineer** — add ru keys: `sort.*` hints, `filters.temp*`, `assignee.onShelf/onShelfSub`, `bulk.assign*`, `groups.all`, pagination "Показано".
8. **test-engineer** after EACH task. Then spec + quality + security review. Then verify.

## i18n keys to add (ru only)
- `sort.hint.updated`, `sort.hint.alpha`, `sort.hint.inv`, `sort.view`, `sort.viewTitle`, `sort.viewSubtitle`, short labels `sort.short.*`
- `filters.temp` ("Временно выданные"), `filters.tempShort` ("Временно")
- `groups.all` ("Все")
- `assignee.onShelf` ("На складе"), `assignee.onShelfSub` ("Ожидает выдачи"), `assignee.dept` ("Отдел"), `assignee.branchLabel` ("Филиал"), `assignee.temp` ("Временно"), role labels `assignee.role.audit/intern`
- `bulk.assign` ("Назначить"), `bulk.assignTitle`, `bulk.assignConfirm`, `bulk.assignEmployee`, `bulk.assignBranch`
- `pagination.shown` ("Показано {{from}}–{{to}} из {{total}}")

## Hard rules honored
- RU-only locale edits. Firestore data only. withAudit for all mutations. No git ops. No CF dependency.
- LOCKED: no "Новый" badge; cyan "Удалённый"+house for remote; warehouse/no-assignee → «Склад/На складе» never «—».

## Definition of done
- typecheck exit 0; full vitest no NEW failures vs 845 baseline; new logic covered by tests; visual parity on dark theme.
