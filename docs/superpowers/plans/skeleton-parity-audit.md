# Skeleton Parity Audit — loading-state fixes across all pages

Date: 2026-07-07. Branch: refactor/pages-structure (uncommitted perf /assets + /licenses skeleton work present — DO NOT revert).

## Two hard principles (owner-mandated)

1. **Skeleton = exact copy of the real loaded block.** Same dimensions, paddings,
   positions, row structure, row counts, card chrome. A 30×30 div gets a 30×30 shimmer
   in the same place.
2. **Only unknown (async Firebase data) is skeletonized.** Everything local/static —
   tab labels, search inputs, "+" buttons, filter chips from constants, headers —
   renders immediately as real components. Skeleton only covers the data region.
   Counts inside otherwise-local chrome may render blank/0 until loaded — but with
   ZERO layout shift.

## Known violations (verified by orchestrator recon)

### /assets (AssetsPage.tsx ~294-333) — Principle 2
- At `!ref` the WHOLE toolbar (AssetsToolbar) and filter bar (AssetsFilterBar) are
  replaced by shimmer bars. Tabs, search, import/export/create buttons, sort control
  are all LOCAL. Fix: render the real AssetsToolbar/AssetsFilterBar immediately;
  make their data-dependent parts (group counts, status/branch option lists from ref)
  degrade gracefully (empty/disabled options, count hidden or reserved-width) without
  layout jumps. May require making `ref` optional in AssetsFilterBar props (loading-
  behavior-only change; keep types strict, exactOptionalPropertyTypes idiom).

### /licenses (LicensesPage.tsx ~423-485) — Principle 1
- Keys tab mobile: `CardListSkeleton variant="asset"` but real rows are
  KeyRowMobile → MobileListRow: outer `px-[14px] py-[9px] border-b border-l-[3px]`,
  28×28 rounded-[8px] icon tile, gap-[9px], mono 13px title + 11px subline, right
  column = pill (h~18) over invcode (10px). Add NEW variant `"key"` to
  CardListSkeleton mirroring these exact classes.
- Keys tab desktop: verify TableSkeleton gridTemplate matches the real
  WindowsKeysSection/WorkstationLicenseTable desktop grid (columns, template, header
  height, row minHeight). Fix template/columns to mirror the real table exactly.
- Subs tab (both breakpoints): real content is SubscriptionCard layout (check
  SubscriptionsSection) — NOT a catalog list / table. Mirror the real card grid.
  Add a variant or a dedicated shimmer that copies SubscriptionCard footprint if no
  variant fits.
- Local chrome inside WindowsKeysSection (free/in_use filter chips etc.): if cheap,
  render real chips pre-data (counts blank, no jumps); otherwise skeleton must mirror
  them at exact size/position — document choice in code comment.

### /parts (PartsPage.tsx ~228-317) — both principles
- Principle 2: tab strip shimmered (labels local — PartsTabsHeader), mobile search
  row + «+» shimmered (local), desktop add-button shimmered (local), stat tile
  LABELS shimmered (labels local — only values async), history filter chips
  shimmered (local constants). Render real chrome immediately; shimmer only values/
  rows.
- Principle 1: left list skeleton rows (px-4 py-3, w-10 icon, h-22 chip) don't match
  the real cards. Real mobile device card (DeviceGridCard isMobile):
  `p-[14px] rounded-xl border flex items-center gap-2.5`, 34×34 rounded-[9px] icon,
  14px bold title + 11.5px mono subline, right cluster chip px-[7px] py-[2px]
  rounded-[6px]. Real warehouse tab rows: see WarehouseTab/WarehouseSkuRowMobile.
  Skeleton must mirror the DEFAULT tab's real rows per breakpoint.
- PartsReceivePage.tsx (~272-315): same audit — static header/back/labels render
  real; shimmer only async lists (mirror PartsReceiveSizedCatCard/SmallCatCard
  footprints).

### /audit + /roles desktop — Principle 1
- AuditPage desktop uses generic `LoadingState` (card rows w-9 icon) but real
  desktop render is the AuditTable grid. Replace with TableSkeleton using
  AuditTable's real grid template (no icon col — adjust via props; if TableSkeleton
  can't express it, extend it minimally, don't hand-roll).
- RolesPage desktop uses `LoadingState` too — real render is DataTable. Mirror it.

### Remaining pages — audit & fix only if violating
dashboard, employees (+EmployeeDetailPage), branches/departments/categories,
settings, my-assets, my-acts, profile, pending-users, scan, AssetDetailSkeleton,
AssetCreatePage, EmployeeCreatePage. For each: compare skeleton vs real loaded
markup on mobile AND desktop; check nothing local is skeletonized (page titles,
static labels); check async regions do have skeletons. Employees/catalogs are
believed correct (CardListSkeleton variants were built from their real cards) —
verify, don't churn.

## Implementation rules
- Reuse TableSkeleton/CardListSkeleton; new footprints = new CardListSkeleton
  variants (exact classes copied from the real row component), never ad-hoc page
  shimmers for list rows.
- No data-behavior changes. Loading states only.
- Update skeleton tests (data-testid="card-list-skeleton", data-variant=...) when
  variants change; keep 1870/163 green.
- Mobile fill-contract: don't break flex chains (flex-1 min-h-0 wrappers stay).
- exactOptionalPropertyTypes: `{...(cond ? { prop: value } : {})}`.
- NO git operations.

## Verification
- `npm run build` (tsc -b, strict)
- `npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4`
