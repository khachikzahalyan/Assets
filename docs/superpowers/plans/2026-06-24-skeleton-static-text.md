# Skeleton Static-Text Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reclassify every loading skeleton so static/i18n text renders as real text immediately and only DB-driven values remain as `anim-skeleton` shimmer bars.

**Architecture:** Pure presentational change — no data, no hooks, no logic altered. Each skeleton block is edited in-place. `TableSkeleton` gets an optional `headers?: string[]` prop; when supplied it renders real text in header cells instead of shimmer bars. Callers (AssetsPage, EmployeesPage) are updated to pass the real column-header labels. No new dependencies introduced.

**Tech Stack:** React 19, TypeScript JSDoc only, Tailwind CSS, react-i18next (`useTranslation`), Vite. Verify with `npx vite build`.

---

## Element classification reference

| Element type | Classification | Rule |
|---|---|---|
| Card/section titles («ТЕХ. ХАРАКТЕРИСТИКИ», «НАЗНАЧЕНИЕ», «ИСТОРИЯ», …) | **REAL** | Constant i18n string |
| Tab labels («Тех. характеристики», «История», «Устройства», «Склад») | **REAL** | Constant i18n string |
| Table column headers | **REAL** | Constant i18n string |
| Stat-tile LABELS («НА СКЛАДЕ», «УСТАНОВЛЕНО», …) | **REAL** | Constant i18n string |
| Fixed button labels («Копировать», «Передать», «Добавить запчасть») | **REAL** | Constant i18n string |
| Constant section icons (lucide / MS logo) | **REAL** | No fetch needed |
| Asset/employee names, inv codes, serials, status chips | **SHIMMER** | DB fetch |
| Spec tile labels and values (depend on category from DB) | **SHIMMER** | Category-dependent |
| Counts, quantities, dates, assignee names, location text | **SHIMMER** | DB fetch |
| History/audit rows | **SHIMMER** | DB fetch |
| Category names in lists | **SHIMMER** | DB fetch |
| Domain list rows in AuthSettings | **SHIMMER** | DB fetch |

---

## File map

| File | Action |
|---|---|
| `src/components/ui/TableSkeleton.tsx` | Add `headers?: string[]` prop; render real header text when provided |
| `src/pages/assets/AssetsPage.tsx` | Pass `headers` to `TableSkeleton` |
| `src/pages/employees/EmployeesPage.tsx` | Pass `headers` to `TableSkeleton` |
| `src/pages/assets/AssetDetailPage.tsx` | Refactor `if (loading)` block |
| `src/pages/parts/PartsPage.tsx` | Refactor `if (loading)` block |
| `src/pages/dashboard/DashboardPage.tsx` | Refactor `if (loading)` block |
| `src/pages/licenses/LicensesPage.tsx` | Refactor `wLoading` and `subsLoading` skeleton blocks |
| `src/pages/self-service/MyAssetsPage.tsx` | Refactor `if (loading)` block |
| `src/pages/self-service/MyActsPage.tsx` | Refactor `if (loading)` block |
| `src/pages/self-service/ProfilePage.tsx` | Refactor `if (loading)` block |
| `src/pages/auth/PendingUsersPage.tsx` | Refactor `renderBody()` loading block |
| `src/components/features/settings/AuthSettingsPanel.tsx` | Refactor `if (loading)` block |
| `src/components/features/assets/detail/LicenseBlock.tsx` | Already correct — leave unchanged |
| `src/components/ui/CardListSkeleton.tsx` | Already correct (all-DB card rows) — leave unchanged |

---

## Task 1: TableSkeleton — add `headers?: string[]` prop

**Files:**
- Modify: `src/components/ui/TableSkeleton.tsx`

The header band currently renders shimmer bars for every column. Add an optional `headers` prop. When provided, render real text labels (same styling as the real table's `columnheader` cells: `text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary`) instead of shimmer bars. Existing callers that don't pass `headers` continue to get shimmer bars — no breaking change.

**Important:** The existing tests check for `anim-skeleton` elements in header cells when no `headers` prop is given. The tests also check `gridTemplateColumns` and row counts. None of that changes. The new `headers` path adds real text nodes instead of shimmer divs.

- [ ] **Step 1: Read the current file to confirm starting state**

  Open `src/components/ui/TableSkeleton.tsx`. Confirm the header band renders shimmer bars in the `Array.from({ length: columns }).map(...)` block (lines 75–93).

- [ ] **Step 2: Update `TableSkeletonProps` interface — add `headers` field**

  Replace the `TableSkeletonProps` interface to add the optional field. The full updated interface:

  ```tsx
  export interface TableSkeletonProps {
    rows?: number
    columns?: number
    firstColWide?: boolean
    gridTemplate?: string
    lastColAction?: boolean
    /**
     * When provided, renders real column-header text in the header band instead
     * of shimmer bars. The array must have exactly `columns` entries (pass an
     * empty string `''` for the action column). When omitted, the original
     * shimmer-bar header is rendered.
     */
    headers?: string[]
  }
  ```

- [ ] **Step 3: Destructure `headers` in the function signature**

  Update the function signature to include `headers`:

  ```tsx
  export function TableSkeleton({
    rows = 10,
    columns = 6,
    firstColWide = false,
    gridTemplate,
    lastColAction = false,
    headers,
  }: TableSkeletonProps) {
  ```

- [ ] **Step 4: Replace the header band cell rendering**

  The header cell rendering block is currently inside `Array.from({ length: columns }).map(...)`. Replace the inner return to check `headers`:

  ```tsx
  {Array.from({ length: columns }).map((_, colIdx) => {
    const isLast = lastColAction && colIdx === columns - 1
    const pl = colIdx === 0 ? 20 : 12
    if (headers) {
      // Real header text — static i18n label, no shimmer
      const label = headers[colIdx] ?? ''
      return (
        <div
          key={colIdx}
          style={{ paddingLeft: pl, paddingRight: 12 }}
          className={
            label
              ? 'text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary truncate overflow-hidden'
              : ''
          }
        >
          {label}
        </div>
      )
    }
    // Legacy shimmer header (no headers prop)
    return (
      <div
        key={colIdx}
        style={{ paddingLeft: pl, paddingRight: 12 }}
      >
        {!isLast && (
          <div
            className="anim-skeleton rounded"
            style={{
              height: 10,
              width: HEADER_WIDTHS[colIdx % HEADER_WIDTHS.length],
            }}
          />
        )}
      </div>
    )
  })}
  ```

- [ ] **Step 5: Verify existing tests still pass**

  Run: `npx vitest run src/components/ui/TableSkeleton.test.tsx`

  Expected: All 9 tests pass. The `anim-skeleton` and `gridTemplateColumns` tests use the default (no `headers` prop) path.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/ui/TableSkeleton.tsx
  git commit -m "feat: TableSkeleton headers prop — render real header text when provided"
  ```

---

## Task 2: AssetsPage — pass real headers to TableSkeleton

**Files:**
- Modify: `src/pages/assets/AssetsPage.tsx`

The column headers come from `t('cols.asset')`, `t('cols.branch')`, `t('cols.code')`, `t('cols.assignee')`, `t('cols.status')`, `t('cols.updated')` in the `assets` namespace (7 columns total including the empty action column).

- [ ] **Step 1: Locate the TableSkeleton call in AssetsPage**

  In `src/pages/assets/AssetsPage.tsx`, find `renderTableRegion()` (around line 224). The call is:
  ```tsx
  <TableSkeleton rows={PAGE_SIZE} columns={7} firstColWide lastColAction gridTemplate="..." />
  ```

- [ ] **Step 2: Add headers array to the TableSkeleton call**

  Replace that single `TableSkeleton` line with:

  ```tsx
  <TableSkeleton
    rows={PAGE_SIZE}
    columns={7}
    firstColWide
    lastColAction
    gridTemplate="minmax(240px,2.4fr) minmax(130px,1fr) minmax(100px,0.85fr) minmax(150px,1.2fr) minmax(110px,1fr) minmax(100px,0.9fr) 56px"
    headers={[
      t('cols.asset', { ns: 'assets' }),
      t('cols.branch', { ns: 'assets' }),
      t('cols.code', { ns: 'assets' }),
      t('cols.assignee', { ns: 'assets' }),
      t('cols.status', { ns: 'assets' }),
      t('cols.updated', { ns: 'assets' }),
      '',
    ]}
  />
  ```

  Note: `AssetsPage` already calls `useTranslation(['assets', 'nav'])`, so `t` is already available. No new import needed.

- [ ] **Step 3: Verify build**

  Run: `npx vite build`

  Expected: Build succeeds with 0 errors in `AssetsPage.tsx`.

- [ ] **Step 4: Commit**

  ```bash
  git add src/pages/assets/AssetsPage.tsx
  git commit -m "feat: AssetsPage TableSkeleton — render real column headers"
  ```

---

## Task 3: EmployeesPage — pass real headers to TableSkeleton

**Files:**
- Modify: `src/pages/employees/EmployeesPage.tsx`

The column headers come from `t('table.employee')`, `t('table.branch')`, `t('table.position')`, `t('table.phone')`, `t('table.gmail')`, `t('table.assets')`, `t('table.status')` in the `employees` namespace (8 columns total including the empty action column).

- [ ] **Step 1: Locate the TableSkeleton call in EmployeesPage**

  In `src/pages/employees/EmployeesPage.tsx`, find the `TableSkeleton` call (around line 692):
  ```tsx
  <TableSkeleton rows={PAGE_SIZE} columns={8} firstColWide lastColAction gridTemplate="..." />
  ```

- [ ] **Step 2: Add headers array to the TableSkeleton call**

  Replace that line with:

  ```tsx
  <TableSkeleton
    rows={PAGE_SIZE}
    columns={8}
    firstColWide
    lastColAction
    gridTemplate="minmax(180px,1.6fr) minmax(120px,0.9fr) minmax(140px,1.2fr) minmax(110px,0.85fr) minmax(160px,1.4fr) minmax(80px,0.6fr) minmax(100px,0.9fr) 56px"
    headers={[
      t('table.employee'),
      t('table.branch'),
      t('table.position'),
      t('table.phone'),
      t('table.gmail'),
      t('table.assets'),
      t('table.status'),
      '',
    ]}
  />
  ```

  Note: `EmployeesPage` uses `useTranslation('employees')`, so `t` is already available.

- [ ] **Step 3: Verify build**

  Run: `npx vite build`

  Expected: Build succeeds with 0 errors in `EmployeesPage.tsx`.

- [ ] **Step 4: Commit**

  ```bash
  git add src/pages/employees/EmployeesPage.tsx
  git commit -m "feat: EmployeesPage TableSkeleton — render real column headers"
  ```

---

## Task 4: AssetDetailPage skeleton refactor

**Files:**
- Modify: `src/pages/assets/AssetDetailPage.tsx`

**Classification decisions:**

| Element | Was | Becomes |
|---|---|---|
| Hero card accent gradient band | shimmer bar | shimmer bar (decorative, OK) |
| Category icon tile (w-12 h-12) | shimmer | shimmer (DB: category) |
| Asset title text bar | shimmer | shimmer (DB: brand+model) |
| Inv-code chip + category chip | shimmer | shimmer (DB) |
| Status chip | shimmer | shimmer (DB) |
| **Tab strip — 3 tab buttons** | shimmer bars | **REAL text**: `t('detail.tabs.specs')`, `t('detail.tabs.history')`, `t('detail.tabs.docs')` |
| Tab panel card header icon | shimmer | shimmer (keep as tile for symmetry with real; alternatively use real Icon — but since this is inside a spec card that's DB-dependent, keep shimmer) |
| **TechSpecsCard title** («ТЕХ. ХАРАКТЕРИСТИКИ») | shimmer bar | **REAL text**: `t('detail.specs.title')` |
| **«Копировать» button stub** | shimmer bar | **REAL** disabled button with `t('detail.specs.copy')` text |
| Spec tile grid (6 tiles: label+value) | shimmer | shimmer (both label and value are category-dependent — category comes from DB) |
| License block footer | shimmer | shimmer (license name and key are DB) |
| **Right sidebar card titles** (3 cards) | shimmer bars | **REAL text**: `t('detail.assignment.title')`, `t('detail.location.title')`, `t('detail.repair.title')` with their real Icon components |
| Right sidebar data rows (3 text bars per card) | shimmer | shimmer (DB: assignee, location, repair status) |

**i18n keys used** (all in `assets` namespace, already imported via `useTranslation('assets')`):
- `detail.tabs.specs` → «Тех. характеристики»
- `detail.tabs.history` → «История»  
- `detail.tabs.docs` → «Документы»
- `detail.specs.title` → «ТЕХ. ХАРАКТЕРИСТИКИ»
- `detail.specs.copy` → «Копировать»
- `detail.assignment.title` → «НАЗНАЧЕНИЕ»
- `detail.location.title` → «МЕСТОНАХОЖДЕНИЕ»
- `detail.repair.title` → «РЕМОНТ»

**Icon components used** (same as real cards):
- TechSpecsCard uses `icon="cpu"` (from `SectionCard title={t('detail.specs.title')} icon="cpu"`)
- AssignmentCard uses `icon="user"` (from `SectionCard title={t('detail.assignment.title')} icon="user"`)
- LocationCard uses `icon="map-pin"` (from `SectionCard title={t('detail.location.title')} icon="map-pin"`)
- RepairCard uses `icon="wrench"` (from `SectionCard title={t('detail.repair.title')} icon="wrench"`)

Verify actual icon names:

```bash
grep -n 'icon=' /c/Users/DELL/Desktop/assets-crm/src/components/features/assets/detail/AssignmentCard.tsx
grep -n 'icon=' /c/Users/DELL/Desktop/assets-crm/src/components/features/assets/detail/LocationCard.tsx
grep -n 'icon=' /c/Users/DELL/Desktop/assets-crm/src/components/features/assets/detail/RepairCard.tsx
grep -n 'icon=' /c/Users/DELL/Desktop/assets-crm/src/components/features/assets/detail/TechSpecsCard.tsx
```

- [ ] **Step 1: Verify the icon names match before writing code**

  Run the grep command above. Confirm `AssignmentCard` uses `icon="user"`, `LocationCard` uses `icon="map-pin"`, `RepairCard` uses `icon="wrench"`, `TechSpecsCard` uses `icon="cpu"`.

- [ ] **Step 2: Refactor the `if (loading)` block**

  The loading return starts at line 328 and ends at line 426. Replace the entire block with the version below. The change replaces:
  1. The 3 tab shimmer bars → 3 real tab buttons (non-interactive during loading, styled the same as inactive tabs)
  2. The TechSpecsCard header shimmer bars → real Icon + real title text + real disabled «Копировать» button
  3. The 3 right-sidebar card header rows (icon shimmer + title shimmer) → real `Icon` + real title text

  ```tsx
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start" aria-hidden="true">
        {/* LEFT column */}
        <div className="lg:col-span-2 space-y-0">
          {/* Hero card */}
          <div className="bg-surface rounded-t-2xl border border-b-0 border-border overflow-hidden">
            <div className="h-1 w-full anim-skeleton opacity-50" />
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-4 max-md:flex-wrap">
                <div className="w-12 h-12 rounded-xl anim-skeleton flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-[18px] w-[55%] rounded anim-skeleton" />
                  <div className="flex items-center gap-2">
                    <div className="h-[20px] w-[88px] rounded-md anim-skeleton" />
                    <div className="h-[20px] w-[72px] rounded-md anim-skeleton" />
                  </div>
                </div>
                <div className="h-[22px] w-[80px] rounded-md anim-skeleton flex-shrink-0 max-md:mt-1" />
              </div>
            </div>
          </div>

          {/* Tab strip — REAL tab labels (static i18n), non-interactive during loading */}
          <div className="bg-surface border-x border-border px-5 flex items-center gap-1 h-[44px]">
            {(['detail.tabs.specs', 'detail.tabs.history', 'detail.tabs.docs'] as const).map((key, i) => (
              <span
                key={key}
                className={`flex items-center gap-1.5 px-3 py-3 text-[13.5px] font-medium flex-shrink-0 ${
                  i === 0 ? 'text-accent-light' : 'text-text-subtle'
                }`}
              >
                <Icon name={i === 0 ? 'cpu' : i === 1 ? 'history' : 'file-text'} size={14} />
                {t(key)}
              </span>
            ))}
          </div>

          {/* Tab panel body */}
          <div className="bg-surface rounded-b-2xl border-x border-b border-border px-5 sm:px-6 py-5">
            {/* Card header: REAL icon + REAL title + REAL disabled copy button */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Icon name="cpu" size={18} className="text-violet-400 flex-shrink-0" />
                <span className="text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
                  {t('detail.specs.title')}
                </span>
              </div>
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 h-[32px] px-3 rounded-lg text-[12.5px] font-medium border bg-surface-2 border-border text-text-tertiary opacity-50 cursor-default flex-shrink-0"
                aria-label={t('detail.specs.copy')}
              >
                <Icon name="copy" size={13} />
                {t('detail.specs.copy')}
              </button>
            </div>

            {/* Spec tiles — shimmer (category-dependent, DB) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-bg border border-border">
                  <div className="w-9 h-9 rounded-lg anim-skeleton flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="h-[9px] w-[42%] rounded anim-skeleton" />
                    <div className="h-[12px] w-[68%] rounded anim-skeleton" />
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border my-4" />

            {/* License block — shimmer (DB: license name + key) */}
            <div className="flex items-center gap-3.5 p-4 rounded-xl bg-bg border border-border">
              <div className="w-11 h-11 rounded-lg anim-skeleton flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-[14px] w-[46%] rounded anim-skeleton" />
                <div className="h-[12px] w-[62%] rounded anim-skeleton" />
              </div>
              <div className="h-8 w-[96px] rounded-lg anim-skeleton flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* RIGHT column — 3 sidebar cards with REAL titles */}
        <div className="space-y-4">
          {(
            [
              { titleKey: 'detail.assignment.title', icon: 'user' },
              { titleKey: 'detail.location.title',   icon: 'map-pin' },
              { titleKey: 'detail.repair.title',     icon: 'wrench' },
            ] as const
          ).map(({ titleKey, icon }) => (
            <div key={titleKey} className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
                <Icon name={icon} size={15} className="text-text-subtle flex-shrink-0" />
                <span className="text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
                  {t(titleKey)}
                </span>
              </div>
              <div className="p-5 space-y-3">
                {Array.from({ length: 3 }).map((__, r) => (
                  <div key={r} className="h-[13px] rounded anim-skeleton" style={{ width: `${65 - r * 10}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  ```

  Note: `Icon` is already imported in `AssetDetailPage.tsx` from `@/components/ui`. The `t` is already available from `useTranslation('assets')`.

- [ ] **Step 3: Verify the TS error count**

  Run: `npx tsc -b 2>&1 | grep "AssetDetailPage.tsx" | wc -l`

  Expected: 0 new errors in `AssetDetailPage.tsx` (pre-existing errors from other files are unrelated).

- [ ] **Step 4: Verify build**

  Run: `npx vite build`

  Expected: Successful build.

- [ ] **Step 5: Commit**

  ```bash
  git add src/pages/assets/AssetDetailPage.tsx
  git commit -m "feat: AssetDetailPage skeleton — tab labels and card titles render as real text"
  ```

---

## Task 5: PartsPage skeleton refactor

**Files:**
- Modify: `src/pages/parts/PartsPage.tsx`

**Classification decisions:**

| Element | Was | Becomes |
|---|---|---|
| Stat-tile icon tile (w-8 h-8) | shimmer | shimmer (icon is category-specific — but actually icon IS static per stat position; however the StatTile is showing stat-specific icons that ARE constant, not DB-driven. Make icon REAL.) |
| **Stat-tile LABEL** («НА СКЛАДЕ», «УСТАНОВЛЕНО», «СЛОМАНО», «УСТРОЙСТВА») | shimmer bar | **REAL text** via `t('stats.onHand')`, etc. |
| Stat-tile VALUE | shimmer bar | shimmer (DB: count) |
| **Tab labels** («Устройства», «Склад») | shimmer bars | **REAL text** via `t('tabs.devices')`, `t('tabs.warehouse')` |
| **«Добавить запчасть» button** | shimmer bar | **REAL** disabled button with `t('actions.add')` |
| Category list rows (left panel) | shimmer rows | shimmer (DB: category names + counts) |
| Right panel header icon + title | shimmer | shimmer (DB: selected category name) |
| **«История» subheader** (right panel) | shimmer bar | **REAL text** via `t('warehouse.history')` |
| Filter chips | shimmer | shimmer (depend on movement data) |
| History rows | shimmer | shimmer (DB) |

**i18n keys used** (all in `parts` namespace, already imported via `useTranslation('parts')`):
- `stats.onHand` → «На складе»
- `stats.installed` → «Установлено»
- `stats.broken` → «Сломано»
- `stats.devices` → «Устройства»
- `tabs.devices` → «Устройства»
- `tabs.warehouse` → «Склад»
- `actions.add` → «Добавить запчасть»
- `warehouse.history` → «ИСТОРИЯ» (the history subheader)

Stat-tile icons in the real render: `inbox` (onHand), `wrench` (installed), `x-octagon` (broken), `monitor-smartphone` (devices) — these are constant, not DB-driven, so render real icons in the stat tiles.

- [ ] **Step 1: Refactor the `if (loading)` block in PartsPage**

  The loading return starts at line 209 and ends at line 293. Replace with:

  ```tsx
  if (loading) {
    return (
      <div className="flex flex-col h-full p-2 gap-3 overflow-hidden max-md:overflow-y-auto max-md:overflow-x-hidden max-md:h-auto max-md:p-0 max-md:gap-3" aria-hidden="true">
        {/* Stat strip — REAL icons and REAL labels, shimmer values */}
        <div className="relative grid grid-cols-4 gap-2.5 max-md:grid-cols-2 max-md:gap-[10px] flex-shrink-0">
          {(
            [
              { labelKey: 'stats.onHand',    icon: 'inbox' },
              { labelKey: 'stats.installed', icon: 'wrench' },
              { labelKey: 'stats.broken',    icon: 'x-octagon' },
              { labelKey: 'stats.devices',   icon: 'monitor-smartphone' },
            ] as const
          ).map(({ labelKey, icon }) => (
            <div key={labelKey} className="bg-surface border border-border rounded-xl p-3 flex items-center gap-3">
              <Icon name={icon} size={18} className="text-text-subtle flex-shrink-0 w-8 h-8 flex items-center justify-center" />
              <div className="flex-1 min-w-0 space-y-2">
                <span className="block text-[11px] uppercase tracking-[0.07em] font-semibold text-text-subtle">
                  {t(labelKey)}
                </span>
                <div className="h-[16px] w-[45%] rounded anim-skeleton" />
              </div>
            </div>
          ))}
        </div>

        {/* Tab strip — REAL tab labels + REAL disabled add button */}
        <div className="flex items-center justify-between border-b border-border flex-shrink-0 h-[44px]">
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'devices',   labelKey: 'tabs.devices',   icon: 'monitor-smartphone' },
                { id: 'warehouse', labelKey: 'tabs.warehouse', icon: 'package' },
              ] as const
            ).map(({ id, labelKey, icon }) => (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 px-4 py-3 text-[15px] font-semibold text-text-subtle"
              >
                <Icon name={icon} size={14} />
                {t(labelKey)}
              </span>
            ))}
          </div>
          <button
            type="button"
            disabled
            className="mr-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-[13.5px] font-semibold opacity-50 cursor-default max-md:hidden"
            aria-label={t('actions.add')}
          >
            <Icon name="plus" size={14} />
            <span>{t('actions.add')}</span>
          </button>
        </div>

        {/* Content region */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 pt-1">
          {/* LEFT — category card list (shimmer — DB data) */}
          <div className="lg:col-span-5 space-y-2 min-h-0">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-xl min-h-[64px] max-md:min-h-[56px]">
                <div className="w-10 h-10 rounded-lg anim-skeleton flex-shrink-0 max-md:w-7 max-md:h-7" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="h-[13px] w-[40%] rounded anim-skeleton" />
                  <div className="h-[10px] w-[55%] rounded anim-skeleton" />
                </div>
                <div className="h-[22px] w-[44px] rounded-md anim-skeleton flex-shrink-0" />
              </div>
            ))}
          </div>

          {/* RIGHT — detail/history panel (desktop only) */}
          <div className="hidden lg:flex lg:col-span-7 min-h-0 flex-col bg-surface border border-border rounded-xl overflow-hidden">
            {/* Panel header: icon+title (shimmer — DB: selected category) + qty chip (shimmer) */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
              <div className="w-8 h-8 rounded-lg anim-skeleton flex-shrink-0" />
              <div className="h-[15px] w-[180px] rounded anim-skeleton" />
              <div className="h-[22px] w-[44px] rounded-md anim-skeleton ml-auto flex-shrink-0" />
            </div>
            {/* REAL «История» subheader + summary chips (shimmer — DB: movement counts) */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border flex-shrink-0">
              <span className="text-[11px] uppercase tracking-[0.07em] font-semibold text-text-tertiary">
                {t('warehouse.history')}
              </span>
              <div className="h-[20px] w-[112px] rounded-md anim-skeleton ml-auto" />
              <div className="h-[20px] w-[120px] rounded-md anim-skeleton" />
            </div>
            {/* Filter chips (shimmer) */}
            <div className="flex items-center gap-2 px-5 pt-3 flex-shrink-0">
              <div className="h-[24px] w-[124px] rounded-md anim-skeleton" />
              <div className="h-[24px] w-[110px] rounded-md anim-skeleton" />
            </div>
            {/* History rows (shimmer — DB) */}
            <div className="p-5 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full anim-skeleton flex-shrink-0" />
                  <div className="w-7 h-7 rounded-md anim-skeleton flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-[12px] w-[38%] rounded anim-skeleton" />
                    <div className="h-[10px] w-[56px] rounded anim-skeleton" />
                  </div>
                  <div className="h-[22px] w-[140px] rounded-md anim-skeleton flex-shrink-0" />
                  <div className="h-[11px] w-[82px] rounded anim-skeleton flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }
  ```

  Note: `Icon` is already imported. `t` is already available from `useTranslation('parts')`.

- [ ] **Step 2: Verify build**

  Run: `npx vite build`

  Expected: Successful build.

- [ ] **Step 3: Commit**

  ```bash
  git add src/pages/parts/PartsPage.tsx
  git commit -m "feat: PartsPage skeleton — stat-tile labels, tab labels, history header render as real text"
  ```

---

## Task 6: DashboardPage skeleton refactor

**Files:**
- Modify: `src/pages/dashboard/DashboardPage.tsx`

**Classification decisions:**

| Element | Was | Becomes |
|---|---|---|
| **KPI tile LABELS** («ВСЕГО АКТИВОВ», «НАЗНАЧЕНО», «ЛИЦЕНЗИИ», «СОТРУДНИКИ») | shimmer bars | **REAL text** via `t('kpi.totalAssets')`, `t('kpi.currentlyOut')`, `t('kpi.licenses')`, `t('kpi.employees')` |
| KPI tile values | shimmer bars | shimmer (DB: counts) |
| KPI tile icon tile | shimmer | real icon (constant per tile) |
| **Panel card titles** (4 detail panels) | shimmer bars | They depend on data to know WHICH panels show — but structurally, the skeleton shows 4 panel placeholders. The actual panel titles (StatusBreakdown, GroupBreakdown, etc.) are all static i18n. However: since during loading we don't know which 4 panels will render (role-dependent, data-dependent), we can use the expected panel titles from `t('status.title')`, `t('groups.title')`, `t('branches.title')`, `t('recentActivity')` — all are constant. **Make REAL.** |
| Panel body rows | shimmer | shimmer (DB) |

**i18n keys used** (all in `dashboard` namespace, already imported via `useTranslation('dashboard')`):
- `kpi.totalAssets` → «Всего активов»
- `kpi.currentlyOut` → «Назначено»
- `kpi.licenses` → «Лицензии»
- `kpi.employees` → «Сотрудники»
- `title` → «Панель управления» (PageHeader — already rendered as REAL in the existing code)

KPI tile icons: `package` (totalAssets), `arrow-right-left` (currentlyOut), `key-round` (licenses), `users` (employees) — all constant.

For detail panel titles, use: `t('status.title')` for status breakdown, `t('groups.title')` for group breakdown, `t('branches.title')` for branch breakdown, `t('recentActivity')` for recent activity. These are the keys actually used by the real components.

Check: `grep -n "t('" /c/Users/DELL/Desktop/assets-crm/src/components/features/dashboard/StatusBreakdown.tsx 2>/dev/null | head -5` to confirm the title key.

- [ ] **Step 1: Verify dashboard panel title i18n keys**

  Run:
  ```bash
  grep -n "title\|SectionCard" /c/Users/DELL/Desktop/assets-crm/src/components/features/dashboard/StatusBreakdown.tsx
  grep -n "title\|SectionCard" /c/Users/DELL/Desktop/assets-crm/src/components/features/dashboard/GroupBreakdown.tsx
  grep -n "title\|SectionCard" /c/Users/DELL/Desktop/assets-crm/src/components/features/dashboard/BranchBreakdown.tsx
  grep -n "title\|SectionCard" /c/Users/DELL/Desktop/assets-crm/src/components/features/dashboard/RecentActivityList.tsx
  ```

  Confirm which i18n keys each panel uses for its card header title.

- [ ] **Step 2: Refactor the `if (loading)` block in DashboardPage**

  The loading return is lines 37–78. Note that the `PageHeader` is already rendered as REAL text (existing code already does `title={t('title')}`). The shimmer is in the KPI tiles and the detail panels.

  Replace the loading block with:

  ```tsx
  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <PageHeader icon="layout-dashboard" title={t('title')} />
        {/* KPI tile row — REAL icon + REAL label, shimmer value */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(
            [
              { labelKey: 'kpi.totalAssets',  icon: 'package' },
              { labelKey: 'kpi.currentlyOut', icon: 'arrow-right-left' },
              { labelKey: 'kpi.licenses',     icon: 'key-round' },
              { labelKey: 'kpi.employees',    icon: 'users' },
            ] as const
          ).map(({ labelKey, icon }) => (
            <div key={labelKey} className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
              <Icon name={icon} size={18} className="text-text-subtle flex-shrink-0 w-9 h-9 flex items-center justify-center" />
              <div className="space-y-2">
                <span className="block text-[12px] uppercase tracking-[0.07em] font-semibold text-text-subtle">
                  {t(labelKey)}
                </span>
                <div className="h-[22px] w-[40%] rounded anim-skeleton" />
              </div>
            </div>
          ))}
        </div>
        {/* Detail panels — REAL panel titles, shimmer body rows */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(
            [
              { titleKey: 'status.title',    icon: 'bar-chart-2' },
              { titleKey: 'groups.title',    icon: 'layers' },
              { titleKey: 'branches.title',  icon: 'git-branch' },
              { titleKey: 'recentActivity',  icon: 'arrow-right-left' },
            ] as const
          ).map(({ titleKey, icon }) => (
            <div key={titleKey} className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
                <Icon name={icon} size={15} className="text-text-subtle flex-shrink-0 w-7 h-7 flex items-center justify-center" />
                <span className="text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
                  {t(titleKey)}
                </span>
              </div>
              <div className="p-5 space-y-3">
                {Array.from({ length: 4 }).map((__, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <div className="h-[12px] flex-1 rounded anim-skeleton" style={{ maxWidth: `${55 + j * 8}%` }} />
                    <div className="h-[12px] w-[48px] rounded anim-skeleton flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  ```

  Note: `Icon` must be imported. Check if it's already imported in `DashboardPage.tsx`. If not, add it to the import from `@/components/ui`.

- [ ] **Step 3: Ensure Icon is imported**

  Check line 4 of `DashboardPage.tsx`: `import { PageHeader, ErrorState } from '@/components/ui'`. Add `Icon` if not present:

  ```tsx
  import { PageHeader, ErrorState, Icon } from '@/components/ui'
  ```

- [ ] **Step 4: Verify i18n keys exist**

  Run:
  ```bash
  grep -n "\"status\"" /c/Users/DELL/Desktop/assets-crm/src/locales/en/dashboard.json
  grep -n "\"groups\"" /c/Users/DELL/Desktop/assets-crm/src/locales/en/dashboard.json
  grep -n "\"branches\"" /c/Users/DELL/Desktop/assets-crm/src/locales/en/dashboard.json
  grep -n "recentActivity" /c/Users/DELL/Desktop/assets-crm/src/locales/en/dashboard.json
  ```

  If a key is missing or uses a different path (e.g., `status.breakdown` not `status.title`), adjust the `titleKey` values to match the actual keys used by the panel components (confirmed in Step 1).

- [ ] **Step 5: Verify build**

  Run: `npx vite build`

  Expected: Successful build.

- [ ] **Step 6: Commit**

  ```bash
  git add src/pages/dashboard/DashboardPage.tsx
  git commit -m "feat: DashboardPage skeleton — KPI labels and panel titles render as real text"
  ```

---

## Task 7: LicensesPage skeleton refactor

**Files:**
- Modify: `src/pages/licenses/LicensesPage.tsx`

**Classification decisions:**

There are two inline skeletons: `wLoading` (keys tab) and `subsLoading` (subs tab). Both are inside card containers that appear AFTER the real PageHeader + tab-strip (which render immediately).

| Element | Was | Becomes |
|---|---|---|
| **Card header title** (keys-tab skeleton card) | shimmer bar | **REAL text**: `t('keys.sectionTitle')` |
| Card header icon stub | shimmer | real `Icon name="key-round"` |
| Table rows (license name+meta+status+action) | shimmer | shimmer (DB) |
| **Card header title** (subs-tab skeleton card) | shimmer bar | **REAL text**: `t('subs.sectionTitle')` |
| Card header icon stub | shimmer | real `Icon name="boxes"` |
| Sub-card grid rows | shimmer | shimmer (DB) |

**i18n keys used** (`licenses` namespace, already imported):
- `keys.sectionTitle` → «Windows-ключи» (confirmed via `WindowsKeysSection.tsx`)
- `subs.sectionTitle` → «Подписки и ПО» (confirmed via `SubscriptionsSection.tsx`)

**Icon names:**
- Keys section uses `key-round` icon (from the real `WindowsKeysSection`)
- Subs section uses `boxes` icon (from the real `SubscriptionsSection`)

- [ ] **Step 1: Verify keys.sectionTitle and subs.sectionTitle in the locale**

  Run:
  ```bash
  grep -n "sectionTitle" /c/Users/DELL/Desktop/assets-crm/src/locales/en/licenses.json
  ```

  Confirm both `keys.sectionTitle` and `subs.sectionTitle` exist in the locale.

- [ ] **Step 2: Refactor the `wLoading` skeleton block (keys tab)**

  Find the block starting at `{wLoading && (` (around line 392–420). The card header stub currently has:
  ```tsx
  <div className="w-7 h-7 rounded-md anim-skeleton flex-shrink-0" />
  <div className="h-[12px] w-[30%] rounded anim-skeleton" />
  ```

  Replace with:
  ```tsx
  <Icon name="key-round" size={15} className="text-text-subtle flex-shrink-0 w-7 h-7 flex items-center justify-center" />
  <span className="text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
    {t('keys.sectionTitle')}
  </span>
  ```

  `Icon` is already imported in `LicensesPage.tsx` from `@/components/ui`.

- [ ] **Step 3: Refactor the `subsLoading` skeleton block (subs tab)**

  Find the block starting at `{subsLoading && (` (around line 441–476). The card header stub currently has:
  ```tsx
  <div className="w-7 h-7 rounded-md anim-skeleton flex-shrink-0" />
  <div className="h-[12px] w-[25%] rounded anim-skeleton" />
  ```

  Replace with:
  ```tsx
  <Icon name="boxes" size={15} className="text-text-subtle flex-shrink-0 w-7 h-7 flex items-center justify-center" />
  <span className="text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
    {t('subs.sectionTitle')}
  </span>
  ```

- [ ] **Step 4: Verify build**

  Run: `npx vite build`

  Expected: Successful build.

- [ ] **Step 5: Commit**

  ```bash
  git add src/pages/licenses/LicensesPage.tsx
  git commit -m "feat: LicensesPage skeleton — card section titles render as real text"
  ```

---

## Task 8: MyAssetsPage skeleton refactor

**Files:**
- Modify: `src/pages/self-service/MyAssetsPage.tsx`

**Classification decisions:**

| Element | Was | Becomes |
|---|---|---|
| `PageHeader title="…"` | literal `"…"` placeholder | **REAL**: `t('self.myAssets')` |
| **Card header icon** | shimmer | real `Icon name="package"` |
| **Card header title** | shimmer bar | **REAL text**: `t('self.myAssets')` |
| Asset rows (inv-code, name, status chip) | shimmer | shimmer (DB) |

**i18n keys used** (`employees` namespace, already imported via `useTranslation('employees')`):
- `self.myAssets` → used for both `PageHeader title` and section card title

- [ ] **Step 1: Refactor the `if (loading)` block**

  Find the loading return at line 69. Replace:

  ```tsx
  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <PageHeader icon="package" title={t('self.myAssets')} />
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
            <Icon name="package" size={15} className="text-text-subtle flex-shrink-0 w-7 h-7 flex items-center justify-center" />
            <span className="text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
              {t('self.myAssets')}
            </span>
          </div>
          <div className="p-5 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md border border-border bg-bg px-3 py-2 min-h-[44px]">
                <div className="h-[12px] w-[80px] rounded anim-skeleton flex-shrink-0" />
                <div className="h-[13px] flex-1 rounded anim-skeleton" style={{ maxWidth: `${40 + (i % 4) * 10}%` }} />
                <div className="h-[20px] w-[60px] rounded-md anim-skeleton flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
  ```

  Note: `Icon` must be imported. Check if it's already imported in `MyAssetsPage.tsx`. The current imports are `PageHeader, SectionCard, Chip, ErrorState, EmptyState` from `@/components/ui`. Add `Icon`:

  ```tsx
  import {
    PageHeader, SectionCard, Chip, ErrorState, EmptyState, Icon,
  } from '@/components/ui'
  ```

- [ ] **Step 2: Verify build**

  Run: `npx vite build`

  Expected: Successful build.

- [ ] **Step 3: Commit**

  ```bash
  git add src/pages/self-service/MyAssetsPage.tsx
  git commit -m "feat: MyAssetsPage skeleton — page title and section title render as real text"
  ```

---

## Task 9: MyActsPage skeleton refactor

**Files:**
- Modify: `src/pages/self-service/MyActsPage.tsx`

**Classification decisions:**

| Element | Was | Becomes |
|---|---|---|
| `PageHeader title="…"` | literal `"…"` | **REAL**: `t('self.myActs')` |
| **Card header icon** | shimmer | real `Icon name="file-text"` |
| **Card header title** | shimmer bar | **REAL text**: `t('self.myActs')` |
| Act rows (assetId mono + view-scan button) | shimmer | shimmer (DB: assetId); view-scan button is a **fixed label** but the button stub is correct as-is since it's a shimmer bar matching the button size. Alternatively: render disabled real «Просмотреть» button. Let's render it REAL since it's a constant label. |

**i18n keys used** (`employees` namespace, already imported):
- `self.myActs` → used for PageHeader and SectionCard title
- `detail.viewScan` → «Просмотреть акт» (real button label in the act row stubs)

- [ ] **Step 1: Refactor the `if (loading)` block**

  Find the loading return at line 58. Replace:

  ```tsx
  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <PageHeader icon="file-text" title={t('self.myActs')} />
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
            <Icon name="file-text" size={15} className="text-text-subtle flex-shrink-0 w-7 h-7 flex items-center justify-center" />
            <span className="text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
              {t('self.myActs')}
            </span>
          </div>
          <div className="p-5 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 min-h-[44px]">
                {/* assetId stub — DB data */}
                <div className="h-[12px] w-[96px] rounded anim-skeleton flex-shrink-0" />
                {/* view-scan button — REAL disabled label */}
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 h-[32px] px-3 rounded-lg text-[12.5px] font-medium border bg-surface-2 border-border text-text-tertiary opacity-50 cursor-default flex-shrink-0"
                >
                  <Icon name="arrow-right-left" size={13} />
                  {t('detail.viewScan')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
  ```

  Note: `Icon` is already imported in `MyActsPage.tsx` from `@/components/ui`.

- [ ] **Step 2: Verify build**

  Run: `npx vite build`

  Expected: Successful build.

- [ ] **Step 3: Commit**

  ```bash
  git add src/pages/self-service/MyActsPage.tsx
  git commit -m "feat: MyActsPage skeleton — page title, section title, view-scan label render as real text"
  ```

---

## Task 10: ProfilePage skeleton refactor

**Files:**
- Modify: `src/pages/self-service/ProfilePage.tsx`

**Classification decisions:**

| Element | Was | Becomes |
|---|---|---|
| `PageHeader title="…"` | literal `"…"` | **REAL**: `t('detail.profile')` (same key used in the real render) |
| **Card header icon** | shimmer | real `Icon name="user"` |
| **Card header title** | shimmer bar | **REAL text**: `t('detail.profile')` |
| Field label stubs (6 items: firstName, lastName, email, position, branch, department) | shimmer | **REAL text** field labels — these are constant i18n strings |
| Field value stubs (6 items) | shimmer | shimmer (DB: employee data) |

**i18n keys used** (`employees` namespace, already imported):
- `detail.profile` → «Профиль» — used for PageHeader and SectionCard title
- `form.firstName` → «Имя»
- `form.lastName` → «Фамилия»
- `form.email` → «Email»
- `form.position` → «Должность»
- `form.branch` → «Филиал»
- `form.department` → «Отдел»

- [ ] **Step 1: Refactor the `if (loading)` block**

  Find the loading return at line 71. Replace:

  ```tsx
  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <PageHeader icon="user" title={t('detail.profile')} />
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
            <Icon name="user" size={15} className="text-text-subtle flex-shrink-0 w-7 h-7 flex items-center justify-center" />
            <span className="text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
              {t('detail.profile')}
            </span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {(
                ['form.firstName', 'form.lastName', 'form.email', 'form.position', 'form.branch', 'form.department'] as const
              ).map((labelKey, i) => (
                <div key={labelKey} className="space-y-2">
                  {/* Field label — REAL static i18n text */}
                  <span className="block text-[11px] uppercase tracking-[0.06em] font-semibold text-text-subtle">
                    {t(labelKey)}
                  </span>
                  {/* Field value — shimmer (DB) */}
                  <div className="h-[13px] rounded anim-skeleton" style={{ width: `${50 + (i % 3) * 15}%` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }
  ```

  Note: `Icon` must be added to imports. Current imports: `PageHeader, SectionCard, Field, Chip, ErrorState, EmptyState`. Add `Icon`:

  ```tsx
  import {
    PageHeader, SectionCard, Field, Chip, ErrorState, EmptyState, Icon,
  } from '@/components/ui'
  ```

- [ ] **Step 2: Verify build**

  Run: `npx vite build`

  Expected: Successful build.

- [ ] **Step 3: Commit**

  ```bash
  git add src/pages/self-service/ProfilePage.tsx
  git commit -m "feat: ProfilePage skeleton — page title, section title, field labels render as real text"
  ```

---

## Task 11: PendingUsersPage skeleton refactor

**Files:**
- Modify: `src/pages/auth/PendingUsersPage.tsx`

**Classification decisions:**

The skeleton renders inside `renderBody()` (lines 273–305). The outer `PendingUsersPage` already renders `PageHeader` as REAL (it's outside the loading check, in the main return). Only the table skeleton inside `renderBody()` needs reclassification.

| Element | Was | Becomes |
|---|---|---|
| **Table header row** (user, email, signed-in, action) | 4 shimmer bars | **REAL text** column headers: `t('col.user')`, `t('col.email')`, `t('col.signedIn')`, `''` |
| Table data rows (avatar + name + email + date + action button) | shimmer | shimmer (DB) |

**i18n keys used** (`pending-users` namespace, already imported):
- `col.user` → «Пользователь»
- `col.email` → «Email»
- `col.signedIn` → «Дата входа»

- [ ] **Step 1: Refactor the `if (loading)` block inside `renderBody()`**

  Find the block starting at `if (loading) {` inside `renderBody()` (lines 273–305). Replace the table header stub:

  Old header:
  ```tsx
  <div className="flex items-center gap-3 border-b border-border py-2.5 px-3">
    {[35, 30, 20, 10].map((w, i) => (
      <div key={i} className="h-[10px] rounded anim-skeleton" style={{ width: `${w}%` }} />
    ))}
  </div>
  ```

  New header:
  ```tsx
  <div className="flex items-center gap-3 border-b border-border py-2.5 px-3">
    {(
      [
        { label: t('col.user'),     widthPct: '35%' },
        { label: t('col.email'),    widthPct: '30%' },
        { label: t('col.signedIn'), widthPct: '20%' },
        { label: '',                widthPct: '10%' },
      ] as const
    ).map(({ label, widthPct }, i) => (
      <div
        key={i}
        className="text-[11px] uppercase tracking-[0.06em] font-semibold text-text-subtle"
        style={{ width: widthPct, flexShrink: 0 }}
      >
        {label}
      </div>
    ))}
  </div>
  ```

  The shimmer body rows remain unchanged.

- [ ] **Step 2: Verify build**

  Run: `npx vite build`

  Expected: Successful build.

- [ ] **Step 3: Commit**

  ```bash
  git add src/pages/auth/PendingUsersPage.tsx
  git commit -m "feat: PendingUsersPage skeleton — column headers render as real text"
  ```

---

## Task 12: AuthSettingsPanel skeleton refactor

**Files:**
- Modify: `src/components/features/settings/AuthSettingsPanel.tsx`

**Classification decisions:**

The skeleton renders inside `if (loading)` (lines 245–279), inside a `<SectionCard title={t('auth.title')} icon="shield-check">` wrapper. The SectionCard title is ALREADY rendered as real text (it's a prop to SectionCard, not a shimmer). So the card title is already correct.

| Element | Was | Becomes |
|---|---|---|
| SectionCard title wrapper | **Already REAL** (`t('auth.title')`) | leave as-is |
| Subtitle text stub | shimmer bar | **REAL text**: `t('auth.subtitle')` |
| Domain list rows | shimmer rows | shimmer (DB: fetched domain list) |
| **Add-domain field LABEL** | shimmer bar | **REAL text**: `t('auth.addLabel')` |
| Add-domain input stub | shimmer bar | shimmer (OK — the empty input box is a DB-driven state) |
| Add-domain button stub | shimmer bar | **REAL** disabled button: `t('auth.addBtn')` |
| **Save button stub** | shimmer bar | **REAL** disabled save button: `t('auth.saveBtn')` |

**i18n keys used** (`settings` namespace, already imported):
- `auth.subtitle` → «Список разрешённых доменов…»
- `auth.addLabel` → «Добавить домен»
- `auth.addBtn` → «Добавить»
- `auth.saveBtn` → «Сохранить»

- [ ] **Step 1: Refactor the `if (loading)` block**

  Find the loading block at line 245. Replace:

  ```tsx
  if (loading) {
    return (
      <SectionCard title={t('auth.title')} icon="shield-check">
        <div className="space-y-5" aria-hidden="true">
          {/* Subtitle — REAL static text */}
          <p className="text-[13px] text-text-subtle">{t('auth.subtitle')}</p>
          {/* Domain list rows — shimmer (DB: the actual saved domains) */}
          <div className="space-y-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-bg min-h-[36px]">
                <div className="h-[13px] rounded anim-skeleton" style={{ width: `${40 + i * 12}%` }} />
                <div className="w-6 h-6 rounded anim-skeleton flex-shrink-0" />
              </div>
            ))}
          </div>
          {/* Add-domain row — REAL label + shimmer input + REAL disabled button */}
          <div className="space-y-1.5">
            <label className="block text-[11px] uppercase tracking-[0.06em] font-semibold text-text-subtle">
              {t('auth.addLabel')}
            </label>
            <div className="flex gap-2">
              <div className="flex-1 h-9 rounded-lg anim-skeleton" />
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-medium border bg-surface-2 border-border text-text-tertiary opacity-50 cursor-default flex-shrink-0"
              >
                <Icon name="plus" size={13} />
                {t('auth.addBtn')}
              </button>
            </div>
          </div>
          {/* Save button — REAL disabled */}
          <div className="flex justify-end pt-2 border-t border-border">
            <button
              type="button"
              disabled
              className="inline-flex items-center h-9 px-4 rounded-lg text-[13px] font-semibold bg-accent text-white opacity-50 cursor-default"
            >
              {t('auth.saveBtn')}
            </button>
          </div>
        </div>
      </SectionCard>
    )
  }
  ```

  Note: `Icon` is already imported in `AuthSettingsPanel.tsx` from `@/components/ui`.

- [ ] **Step 2: Verify build**

  Run: `npx vite build`

  Expected: Successful build.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/features/settings/AuthSettingsPanel.tsx
  git commit -m "feat: AuthSettingsPanel skeleton — subtitle, field label, and button labels render as real text"
  ```

---

## Task 13: Final verification

- [ ] **Step 1: Full build check**

  Run: `npx vite build`

  Expected: 0 errors. Paste last 10 lines of output.

- [ ] **Step 2: TypeScript check**

  Run: `npx tsc -b 2>&1 | tail -20`

  List all errors. Confirm none are in the files edited by this plan (the only pre-existing errors should be in `parts/`, `SearchSelect`, `AssetsTable` — unchanged files).

- [ ] **Step 3: Component unit tests**

  Run: `npx vitest run src/components/ui/ src/pages/`

  Expected: No new failures vs baseline. Pre-existing failures from AssetCreatePage licenseMode and other known flakes are acceptable if they also failed before this change.

- [ ] **Step 4: Final commit if nothing staged**

  All commits were made per-task. Confirm `git status` is clean.

---

## Self-review: spec coverage checklist

| Spec requirement | Task covering it |
|---|---|
| AssetDetailPage: tab labels real | Task 4 |
| AssetDetailPage: TechSpecsCard title real | Task 4 |
| AssetDetailPage: «Копировать» button real | Task 4 |
| AssetDetailPage: sidebar card titles real | Task 4 |
| AssetDetailPage: spec tiles shimmer (category-dependent) | Task 4 (left as shimmer) |
| PartsPage: stat-tile labels real | Task 5 |
| PartsPage: tab labels real | Task 5 |
| PartsPage: «Добавить запчасть» button real | Task 5 |
| PartsPage: «История» header real | Task 5 |
| DashboardPage: KPI tile labels real | Task 6 |
| DashboardPage: panel titles real | Task 6 |
| TableSkeleton: headers prop | Task 1 |
| AssetsPage: pass real headers | Task 2 |
| EmployeesPage: pass real headers | Task 3 |
| CardListSkeleton: no change (all DB rows) | not applicable |
| LicensesPage wLoading: card title real | Task 7 |
| LicensesPage subsLoading: card title real | Task 7 |
| MyAssetsPage: page title + section title real | Task 8 |
| MyActsPage: page title + section title real | Task 9 |
| ProfilePage: page title + section title + field labels real | Task 10 |
| PendingUsersPage: column headers real | Task 11 |
| AuthSettingsPanel: subtitle + field label + buttons real | Task 12 |
| LicenseBlock: already correct — no change | not applicable |

All 13 spec requirements covered. No placeholders.
