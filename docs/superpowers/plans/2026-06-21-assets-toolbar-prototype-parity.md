# Assets-List Toolbar Prototype Parity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the production `/assets` page toolbar/header exactly match the prototype `asset-list.html` — two-row layout inside the card (no separate PageHeader above), with group tabs + search + Import + Export + Create in row 1, and filter chips in row 2.

**Architecture:** Split `AssetsFilterBar` into two focused sub-rows. Create a new `AssetsToolbar` component that owns row 1 (GroupTabs + search + action buttons). Rename `AssetsFilterBar` to manage only row 2 (Status + Branch + Sort + TempToggle + Reset). Compose both inside `AssetsPage`'s `SectionCard` instead of the standalone `PageHeader`. The `Импорт` button renders disabled with a "Phase 2" tooltip — no import logic is built.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, shadcn/ui (`Btn`, `Icon`), react-i18next (ru locale only), react-router-dom v7, Vitest + Testing Library.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/features/assets/AssetsToolbar.tsx` | **Create** | Row 1: GroupTabs + search input + Import (disabled) + Export + Create buttons |
| `src/components/features/assets/AssetsFilterBar.tsx` | **Modify** | Row 2 only: Status + Branch + ViewSort + TempToggle + Reset (remove GroupTabs, search, Export from here) |
| `src/components/features/assets/index.ts` | **Modify** | Export `AssetsToolbar` |
| `src/pages/AssetsPage.tsx` | **Modify** | Remove `<PageHeader>`, compose `<AssetsToolbar>` + `<AssetsFilterBar>` in card with border-b separator |
| `src/locales/ru/assets.json` | **Modify** | Add `"toolbar.import": "Импорт"`, `"toolbar.importSoon": "Скоро"`, `"toolbar.create": "Создать"`, `"groups.network": "Сетевые устройства"` |
| `src/pages/AssetsPage.test.tsx` | **Modify** | Update 4 assertions: `"Создать актив"` → `"Создать"`, `"Сетевые"` → `"Сетевые устройства"` |

---

## Task 1: Add locale keys

**Files:**
- Modify: `src/locales/ru/assets.json`

- [ ] **Step 1: Add missing keys to ru/assets.json**

Open `src/locales/ru/assets.json`. Make the following changes:

1. Change `"groups.network"` from `"Сетевые"` to `"Сетевые устройства"`.
2. Change `"create"` from `"Создать актив"` to `"Создать"`.  
   (Keep the old value as reference — tests that assert "Создать актив" will be updated in Task 4.)
3. Add a `"toolbar"` key block after `"sort"`:

The final relevant sections of the file should look like:

```json
{
  "create": "Создать",
  "groups": {
    "all": "Все",
    "devices": "Устройства",
    "furniture": "Мебель",
    "network": "Сетевые устройства"
  },
  "toolbar": {
    "import": "Импорт",
    "importSoon": "Скоро",
    "create": "Создать"
  }
}
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/locales/ru/assets.json','utf8')); console.log('OK')"` from `C:/Users/DELL/Desktop/assets-crm`.

Expected output: `OK`

---

## Task 2: Create AssetsToolbar component (Row 1)

**Files:**
- Create: `src/components/features/assets/AssetsToolbar.tsx`

This is the new Row 1 component. It owns:
- GroupTabs (left, flex-shrink-0)
- Search input (flex-1, max-w-[320px] — matches prototype's `w-full max-w-[320px]` inside `flex items-center gap-2 flex-1 ml-auto justify-end`)
- Import button (disabled, shows "Скоро" tooltip — Phase 2 deferred)
- Export button (matches prototype's `ams-toolbar-export` style)
- Create button (orange primary, role-gated, icon `plus` + label "Создать")

**Layout structure from prototype:**
```
<div class="flex items-center justify-between gap-3 flex-wrap">
  <GroupTabs .../>                        <!-- left -->
  <div class="flex items-center gap-2 flex-1 ml-auto justify-end">
    <div class="w-full max-w-[320px]">
      <SearchInput />
    </div>
    <button Import ... disabled />
    <button Export ... />
    <Btn primary Create />
  </div>
</div>
```

- [ ] **Step 1: Write the component**

Create `src/components/features/assets/AssetsToolbar.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Btn, Icon } from '@/components/ui'
import { GroupTabs } from './GroupTabs'
import type { GroupTab } from './GroupTabs'
import type { AssetListQuery, AssetGroupFilter } from '@/domain/asset'

export interface AssetsToolbarProps {
  query: AssetListQuery
  onChange: (patch: Partial<AssetListQuery>) => void
  groupCounts: Record<string, number>
  totalCount: number
  canMutate: boolean
  onExport: () => void
  onNavigateCreate: () => void
}

export function AssetsToolbar({
  query,
  onChange,
  groupCounts,
  totalCount,
  canMutate,
  onExport,
  onNavigateCreate,
}: AssetsToolbarProps) {
  const { t } = useTranslation('assets')

  const groupTabs: GroupTab[] = [
    { id: 'all',       label: t('groups.all'),       icon: 'layers' },
    { id: 'devices',   label: t('groups.devices'),   icon: 'monitor-smartphone' },
    { id: 'network',   label: t('groups.network'),   icon: 'server' },
    { id: 'furniture', label: t('groups.furniture'), icon: 'armchair' },
  ]

  const activeGroup = query.group ?? 'all'

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3">
      {/* Left: group tabs */}
      <GroupTabs
        tabs={groupTabs}
        selected={activeGroup}
        onSelect={g => onChange({ group: g as AssetGroupFilter })}
        counts={groupCounts}
      />

      {/* Right: search + action buttons */}
      <div className="flex items-center gap-2 flex-1 ml-auto justify-end">
        {/* Search */}
        <div className="w-full max-w-[320px]">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none">
              <Icon name="search" size={13} />
            </span>
            <input
              id="assets-search"
              type="search"
              value={query.search ?? ''}
              onChange={e => onChange({ search: e.target.value })}
              placeholder={t('search')}
              className="w-full h-9 pl-8 pr-3 text-sm bg-[#111315] border border-[#2A2F36] rounded-lg text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[rgba(249,115,22,0.40)] transition-all duration-150"
              aria-label={t('search')}
            />
          </div>
        </div>

        {/* Import — Phase 2 deferred. Rendered disabled with tooltip. */}
        <button
          type="button"
          disabled
          title={t('toolbar.importSoon')}
          aria-label={t('toolbar.import')}
          className="bg-[#1B1F24] border border-[#3A4048] text-[#F8FAFC] h-9 px-3.5 rounded-lg text-[15px] font-semibold inline-flex items-center gap-1.5 transition-colors duration-150 opacity-40 cursor-not-allowed"
        >
          <Icon name="file-up" size={14} className="text-sky-300" />
          <span>{t('toolbar.import')}</span>
        </button>

        {/* Export */}
        <button
          type="button"
          disabled={totalCount === 0}
          onClick={onExport}
          title={t('export.xlsx')}
          aria-label={t('export.xlsx')}
          className="bg-[#1B1F24] border border-[#3A4048] text-[#F8FAFC] hover:bg-[#111315] h-9 px-3.5 rounded-lg text-[15px] font-semibold inline-flex items-center gap-1.5 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="file-spreadsheet" size={14} className="text-emerald-300" />
          <span>{t('export.xlsx')}</span>
        </button>

        {/* Create — role-gated */}
        {canMutate && (
          <Btn variant="primary" size="md" onClick={onNavigateCreate}>
            <Icon name="plus" size={14} />
            {t('toolbar.create')}
          </Btn>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```
cd C:/Users/DELL/Desktop/assets-crm && npx tsc --noEmit
```

Expected: exit 0 (or only pre-existing errors unrelated to the new file).

---

## Task 3: Refactor AssetsFilterBar to Row 2 only

**Files:**
- Modify: `src/components/features/assets/AssetsFilterBar.tsx`

Currently `AssetsFilterBar` contains: GroupTabs, search input, Status, Branch, ViewSort, TempToggle, Reset, Export.

After refactor it contains only: Status, Branch, ViewSort, TempToggle, Reset.

- [ ] **Step 1: Remove GroupTabs, search, and Export from AssetsFilterBar**

Replace the entire file with:

```tsx
import { useTranslation } from 'react-i18next'
import { SelectMini, Btn, Icon } from '@/components/ui'
import type { AssetListQuery, AssetSort } from '@/domain/asset'
import type { AssetReferenceData } from '@/domain/asset/AssetRepository'
import type { SelectMiniOption } from '@/components/ui/SelectMini'
import { ViewPopover } from './ViewPopover'
import type { ViewSortOption } from './ViewPopover'

export interface AssetsFilterBarProps {
  query: AssetListQuery
  onChange: (patch: Partial<AssetListQuery>) => void
  ref: AssetReferenceData
  // Temp toggle
  showTemp?: boolean
  onToggleTemp?: () => void
  tempCount?: number
  // Full reset (resets filters + temp in one shot from the page)
  onReset?: () => void
}

const STATUS_DOT_COLORS: Record<string, string> = {
  st_warehouse: '#38BDF8',
  st_assigned:  '#10B981',
  st_repair:    '#F59E0B',
  st_disposed:  '#F43F5E',
}

const DEFAULT_QUERY_STATUS  = 'all'
const DEFAULT_QUERY_BRANCH  = 'all'
const DEFAULT_SORT          = 'updated_desc'

function isDirty(query: AssetListQuery, showTemp: boolean): boolean {
  return (
    (query.statusId ?? 'all') !== DEFAULT_QUERY_STATUS ||
    (query.branchId ?? 'all') !== DEFAULT_QUERY_BRANCH ||
    (query.sort ?? 'updated_desc') !== DEFAULT_SORT ||
    showTemp === true
  )
}

export function AssetsFilterBar({
  query,
  onChange,
  ref: refData,
  showTemp = false,
  onToggleTemp,
  tempCount = 0,
  onReset,
}: AssetsFilterBarProps) {
  const { t } = useTranslation('assets')

  // ── Status options (colored dots) ─────────────────────────────────────────
  const statusOptions: SelectMiniOption[] = [
    { value: 'all', label: t('filters.allStatuses') },
    ...refData.statuses.map(s => ({
      value: s.id,
      label: s.name,
      dotColor: STATUS_DOT_COLORS[s.id],
    })),
  ]

  // ── Branch options (per-branch icon+color) ────────────────────────────────
  const branchOptions: SelectMiniOption[] = [
    { value: 'all', label: t('filters.allBranches') },
    ...refData.branches.map(b => ({
      value: b.id,
      label: b.name,
      icon:      b.id === 'br_main' ? 'landmark' : 'building',
      iconColor: b.id === 'br_main' ? '#10B981'  : '#38BDF8',
    })),
  ]

  // ── Sort / view options ───────────────────────────────────────────────────
  const sortOptions: ViewSortOption[] = [
    {
      value: 'updated_desc',
      label: t('sort.updated_desc'),
      shortLabel: t('sort.short.updated_desc'),
      hint: t('sort.hint.updated'),
      icon: 'arrow-down-narrow-wide',
      iconColor: '#10B981',
    },
    {
      value: 'updated_asc',
      label: t('sort.updated_asc'),
      shortLabel: t('sort.short.updated_asc'),
      hint: t('sort.hint.updated'),
      icon: 'arrow-up-narrow-wide',
      iconColor: '#94A3B8',
    },
    {
      value: 'name_asc',
      label: t('sort.name_asc'),
      shortLabel: t('sort.short.name_asc'),
      hint: t('sort.hint.alpha'),
      icon: 'arrow-down-a-z',
      iconColor: '#A78BFA',
    },
    {
      value: 'name_desc',
      label: t('sort.name_desc'),
      shortLabel: t('sort.short.name_desc'),
      hint: t('sort.hint.alpha'),
      icon: 'arrow-down-z-a',
      iconColor: '#F472B6',
    },
    {
      value: 'inv_asc',
      label: t('sort.inv_asc'),
      shortLabel: t('sort.short.inv_asc'),
      hint: t('sort.hint.inv'),
      icon: 'hash',
      iconColor: '#38BDF8',
    },
  ]

  const dirty = isDirty(query, showTemp)

  function handleReset() {
    if (onReset) {
      onReset()
    } else {
      onChange({
        statusId: 'all',
        branchId: 'all',
        sort: 'updated_desc',
      })
      if (showTemp && onToggleTemp) onToggleTemp()
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2">
      {/* Status */}
      <SelectMini
        id="assets-status"
        label={t('filters.status')}
        leadingIcon="circle-dot"
        value={query.statusId ?? 'all'}
        onChange={v => onChange({ statusId: v })}
        options={statusOptions}
      />

      {/* Branch */}
      <SelectMini
        id="assets-branch"
        label={t('filters.branch')}
        leadingIcon="building"
        value={query.branchId ?? 'all'}
        onChange={v => onChange({ branchId: v })}
        options={branchOptions}
      />

      {/* View / Sort popover */}
      <ViewPopover
        sort={query.sort ?? 'updated_desc'}
        onChangeSort={v => onChange({ sort: v as AssetSort })}
        options={sortOptions}
        defaultSort="updated_desc"
        viewLabel={t('sort.view')}
        title={t('sort.viewTitle')}
        subtitle={t('sort.viewSubtitle')}
      />

      {/* Temp toggle */}
      <button
        type="button"
        onClick={onToggleTemp}
        className={[
          'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[14px] font-semibold tracking-tight transition-all duration-150',
          showTemp
            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/25 ring-1 ring-emerald-700/15'
            : 'bg-[#1B1F24] text-[#F8FAFC] border border-[#2A2F36] hover:border-[#3A4048] hover:bg-[#111315]',
        ].join(' ')}
        aria-pressed={showTemp}
      >
        <Icon
          name="clock"
          size={13}
          className={showTemp ? 'text-white' : 'text-[#94A3B8]'}
        />
        {t('filters.temp')}
        <span
          aria-hidden="true"
          className={[
            'tabular-nums text-[13px]',
            showTemp ? 'text-emerald-100' : 'text-[#64748B]',
          ].join(' ')}
        >
          {tempCount}
        </span>
      </button>

      {/* Reset */}
      {dirty && (
        <Btn
          variant="ghost"
          size="sm"
          onClick={handleReset}
        >
          <Icon name="x" size={13} />
          {t('filters.reset')}
        </Btn>
      )}
    </div>
  )
}
```

**Key changes from original:**
- Removed `GroupTabs`, search input, Export button, and `totalCount` prop
- Removed `groupCounts` prop (no longer used here)
- `isDirty` no longer checks `group` or `search` — those live in Row 1 now
- Padding changed from `px-5 pt-4` (old wrapper) to `px-4 py-2` (self-contained, matching `ams-filter-bar` in prototype)

- [ ] **Step 2: Run typecheck**

```
cd C:/Users/DELL/Desktop/assets-crm && npx tsc --noEmit
```

Expected: exit 0 or pre-existing errors only.

---

## Task 4: Export AssetsToolbar from features/assets/index.ts

**Files:**
- Modify: `src/components/features/assets/index.ts`

- [ ] **Step 1: Add AssetsToolbar export**

Read the file first, then add `AssetsToolbar` to the exports. The file likely looks like:

```ts
export { AssetsFilterBar } from './AssetsFilterBar'
export { AssetsTable } from './AssetsTable'
// ... other exports
```

Add:
```ts
export { AssetsToolbar } from './AssetsToolbar'
```

- [ ] **Step 2: Run typecheck**

```
cd C:/Users/DELL/Desktop/assets-crm && npx tsc --noEmit
```

---

## Task 5: Refactor AssetsPage — remove PageHeader, compose two-row toolbar

**Files:**
- Modify: `src/pages/AssetsPage.tsx`

The goal is:
- Remove the `<PageHeader>` above `<SectionCard>`
- Inside `<SectionCard>`, add `<AssetsToolbar>` (Row 1) then a `border-b border-[#2A2F36]` divider, then `<AssetsFilterBar>` (Row 2) — matching prototype's card layout
- Remove `totalCount` and `onExport` from `AssetsFilterBar` call (no longer accepted)
- Pass `groupCounts`, `canMutate`, `onExport`, `onNavigateCreate` to `AssetsToolbar`
- Remove `PageHeader` from the import line

- [ ] **Step 1: Update the import line**

In `AssetsPage.tsx` line 5, change:
```tsx
import { PageHeader, SectionCard, Btn, Icon, EmptyState, LoadingState, ErrorState } from '@/components/ui'
```
to:
```tsx
import { SectionCard, EmptyState, LoadingState, ErrorState } from '@/components/ui'
```

- [ ] **Step 2: Update the features import**

In `AssetsPage.tsx` line 6, change:
```tsx
import { AssetsFilterBar, AssetsTable, BulkActionBar, WriteOffConfirmModal, BulkAssignModal } from '@/components/features/assets'
```
to:
```tsx
import { AssetsToolbar, AssetsFilterBar, AssetsTable, BulkActionBar, WriteOffConfirmModal, BulkAssignModal } from '@/components/features/assets'
```

- [ ] **Step 3: Replace the return JSX**

Replace the entire `return (...)` block at the bottom of `AssetsPage` (lines 315–378 in the original) with:

```tsx
  return (
    <div className="space-y-5">
      <SectionCard noHeader>
        <div className="flex flex-col">
          {/* Row 1: Group tabs + Search + Import + Export + Create */}
          {ref ? (
            <AssetsToolbar
              query={query}
              onChange={handleQueryChange}
              groupCounts={groupCounts}
              totalCount={totalCount}
              canMutate={canMutate}
              onExport={handleExport}
              onNavigateCreate={() => navigate('/assets/new')}
            />
          ) : (
            /* Toolbar skeleton while ref is loading */
            <div className="h-[52px] px-4 py-3">
              <div className="h-9 rounded-lg anim-skeleton w-full" />
            </div>
          )}

          {/* Divider between Row 1 and Row 2 */}
          <div className="border-t border-[#2A2F36]" />

          {/* Row 2: Status + Branch + Sort + Temp toggle + Reset */}
          {ref ? (
            <AssetsFilterBar
              query={query}
              onChange={handleQueryChange}
              ref={ref}
              showTemp={showTemp}
              onToggleTemp={handleToggleTemp}
              tempCount={tempCount}
              onReset={handleReset}
            />
          ) : (
            <div className="h-[40px] px-4 py-2">
              <div className="h-8 rounded-lg anim-skeleton w-full" />
            </div>
          )}

          {/* Divider between filter row and table */}
          <div className="border-t border-[#2A2F36]" />

          {/* Body: loading / error / empty / table */}
          {renderBody()}
        </div>
      </SectionCard>

      {writeOffModal.open && ref && (
        <WriteOffConfirmModal
          assetIds={writeOffModal.ids}
          assets={displayed}
          refData={ref}
          onConfirm={handleWriteOffConfirm}
          onClose={handleWriteOffClose}
        />
      )}

      {assignModal.open && ref && (
        <BulkAssignModal
          assetIds={assignModal.ids}
          assets={displayed}
          employees={ref.employees}
          branches={ref.branches}
          onConfirm={handleAssignConfirm}
          onClose={handleAssignClose}
        />
      )}
    </div>
  )
```

Note: `Btn` and `Icon` are no longer needed in AssetsPage directly — they've moved to AssetsToolbar. Remove them from the ui import (already done in Step 1 above).

- [ ] **Step 4: Run typecheck**

```
cd C:/Users/DELL/Desktop/assets-crm && npx tsc --noEmit
```

Expected: exit 0.

---

## Task 6: Update tests for the new labels

**Files:**
- Modify: `src/pages/AssetsPage.test.tsx`

Four assertions reference `"Создать актив"` (old label). The create button now reads `"Создать"` (from `t('toolbar.create')`). One assertion references `"Сетевые"` (old network tab label). The group tab now reads `"Сетевые устройства"`.

- [ ] **Step 1: Update create button assertions**

In `AssetsPage.test.tsx`, replace all four occurrences:

- Line 162: `expect(screen.getByText('Создать актив')).toBeInTheDocument()` → `expect(screen.getByText('Создать')).toBeInTheDocument()`
- Line 173: `expect(screen.queryByText('Создать актив')).toBeNull()` → `expect(screen.queryByText('Создать')).toBeNull()`
- Line 233: `expect(screen.getByText('Создать актив')).toBeInTheDocument()` → `expect(screen.getByText('Создать')).toBeInTheDocument()`
- Line 244: `expect(screen.queryByText('Создать актив')).toBeNull()` → `expect(screen.queryByText('Создать')).toBeNull()`

- [ ] **Step 2: Update network tab assertion**

- Line 256: `const networkTab = screen.getByRole('button', { name: 'Сетевые' })` → `const networkTab = screen.getByRole('button', { name: 'Сетевые устройства' })`

And update the comment on line 255:
- `// Click the "Сетевые" (network) group tab` → `// Click the "Сетевые устройства" (network) group tab`

- [ ] **Step 3: Run tests**

```
cd C:/Users/DELL/Desktop/assets-crm && npx vitest run --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass except the one known flaky timeout in `AssetCreateForm.freekey.test.tsx`. No new failures.

---

## Task 7: Full verification

- [ ] **Step 1: Run typecheck**

```
cd C:/Users/DELL/Desktop/assets-crm && npx tsc --noEmit 2>&1 | tail -20
```

Expected: exit code 0.

- [ ] **Step 2: Run full test suite**

```
cd C:/Users/DELL/Desktop/assets-crm && npx vitest run 2>&1 | tail -30
```

Expected: green except the one known flaky `AssetCreateForm.freekey.test.tsx` timeout (which passes in isolation).

- [ ] **Step 3: Mental render walkthrough**

Verify the following paths are correctly handled:
1. **Loading (ref is null):** Both toolbar and filter bar show skeleton divs. `renderBody()` shows `<LoadingState>`.
2. **Error:** `renderBody()` shows `<ErrorState>` with retry.
3. **Empty:** `renderBody()` shows `<EmptyState>` with appropriate icon.
4. **Happy path:** Row 1 has group tabs + search + disabled Import + Export + (if canMutate) Create. Row 2 has Status + Branch + Sort + Temp + (if dirty) Reset.
5. **Create button role gate:** `canMutate` is true only for `super_admin` / `asset_admin` — button absent for `tech_admin` / `employee`.
6. **Import button:** Always disabled, `opacity-40 cursor-not-allowed`, title="Скоро". No onClick handler.

---

## Self-Review Against Spec

**Spec requirements covered:**

1. No separate PageHeader above card ✓ (Task 5 removes it)
2. Row 1: GroupTabs (left) + search + Import + Export + Create (right) ✓ (Task 2)
3. Row 2: Status + Branch + Sort + Temp toggle ✓ (Task 3)
4. Group tab "Сетевые" → "Сетевые устройства" ✓ (Task 1)
5. Counts in group tabs from real data ✓ (already worked; groupCounts prop unchanged)
6. Create button = "+ Создать", orange, navigates /assets/new, role-gated ✓ (Task 2)
7. Import = disabled/deferred, "Скоро" affordance ✓ (Task 2)
8. Export stays functional ✓ (moved to Row 1)
9. All existing functionality preserved (group filter, search, status/branch/sort, temp toggle, bulk select, write-off, assign, export, pagination) ✓
10. Tests updated ✓ (Task 6)
11. Only ru locale edited ✓ (Task 1 touches only ru/assets.json)
12. Component-first: toolbar is composable children ✓
13. No mock/prototype data imported ✓
14. No commit/push ✓

**Potential issues to watch:**

- `AssetsFilterBar` had `ref` as a prop name (shadowed by `ref: refData` destructuring). This is a known TSX quirk — the file already uses this pattern, so it carries over fine.
- `isDirty` in AssetsFilterBar no longer checks `group` or `search` (those now live in AssetsToolbar). This is correct — the Reset button in Row 2 should only light up if Row 2 filters are dirty. The full-page `handleReset` (passed via `onReset`) still resets everything including group and search.
- The `AssetsPage` no longer uses `Btn` or `Icon` directly — removed from import. If TypeScript reports unused imports, they're cleanly removed.
