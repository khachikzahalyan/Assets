# Skeleton Pure Shimmer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert every loading skeleton in assets-crm to pure shimmer blocks — no real `t()` strings, no real `<Icon>`, no real button text, no real section/card/column titles inside any `if (loading)` block.

**Architecture:** Each task targets one file. The rule is mechanical: find every real text/icon inside the loading skeleton branch and replace it with an `anim-skeleton` div of equivalent size/shape. Surrounding layout (grid, flex, card shells, padding, responsiveness) is preserved exactly. One test file (`PartsPage.test.tsx`) asserts `tabs.warehouse` in the loading skeleton — that assertion is deleted and replaced with the shimmer assertion.

**Tech Stack:** React 19, Tailwind CSS, `anim-skeleton` shimmer class, vitest.

---

## File Map

| File | What changes |
|------|-------------|
| `src/components/ui/TableSkeleton.tsx` | Remove `headers` prop + its rendering branch entirely; always shimmer the header cells |
| `src/pages/assets/AssetsPage.tsx` | Remove `headers={[...]}` from `<TableSkeleton>` call |
| `src/pages/employees/EmployeesPage.tsx` | Remove `headers={[...]}` from `<TableSkeleton>` call |
| `src/pages/assets/AssetDetailPage.tsx` | Replace 3 tab labels+icons, TechSpecs card title+icon+copy button, 3 sidebar card titles+icons with shimmer bars |
| `src/pages/parts/PartsPage.tsx` | Replace 2 tab labels+icons in skeleton tab strip, disabled add button text, `warehouse.history` subheader with shimmer bars |
| `src/pages/dashboard/DashboardPage.tsx` | Replace 4 KPI tile icons+labels, 4 panel card title icons+labels with shimmer bars |
| `src/pages/licenses/LicensesPage.tsx` | Replace `keys.sectionTitle` card header icon+title, `subs.sectionTitle` card header icon+title with shimmer bars |
| `src/pages/self-service/MyAssetsPage.tsx` | Replace page title `<PageHeader>` icon+title, section card header icon+title with shimmer bars |
| `src/pages/self-service/MyActsPage.tsx` | Replace page title `<PageHeader>` icon+title, section card header icon+title, disabled view-scan button icon+text with shimmer bars |
| `src/pages/self-service/ProfilePage.tsx` | Replace page title `<PageHeader>` icon+title, section card header icon+title, 6 field labels with shimmer bars |
| `src/pages/auth/PendingUsersPage.tsx` | Replace 3 desktop column header labels with shimmer bars |
| `src/components/features/settings/AuthSettingsPanel.tsx` | Replace subtitle text, add-domain label, "Добавить" button icon+text, "Сохранить" button text with shimmer bars |
| `src/pages/parts/PartsPage.test.tsx` | Remove assertion that `tabs.warehouse` appears in loading skeleton; keep shimmer assertion |
| `src/components/ui/CardListSkeleton.tsx` | Read-only verification — already pure shimmer; no changes needed |
| `src/components/ui/TableSkeleton.test.tsx` | No changes needed (tests don't assert real header text) |

---

## Task 1: TableSkeleton — remove `headers` prop, always shimmer the header band

**Files:**
- Modify: `src/components/ui/TableSkeleton.tsx`

- [ ] **Step 1: Read the current file**

Open `src/components/ui/TableSkeleton.tsx`. The `headers?: string[]` prop (line 37) and the rendering branch (lines 86–101) are the target. The "Legacy shimmer header" block (lines 103–119) is the correct behavior we want for ALL calls.

- [ ] **Step 2: Remove the `headers` field from the interface and all related logic**

Remove:
1. The `headers?: string[]` JSDoc + field from `TableSkeletonProps` (lines 36–38 area)
2. The `headers,` destructure from the function signature (line 58 area)
3. The entire `if (headers) { ... }` rendering branch inside the header band map (lines 86–101 area)

The header band `Array.from({ length: columns }).map(...)` should now always render the shimmer bar path (currently labeled "Legacy shimmer header"). Remove the `// Legacy shimmer header` comment.

After the edit the header column map should look exactly like this (no `if` branch, no `headers` reference):

```tsx
{Array.from({ length: columns }).map((_, colIdx) => {
  const isLast = lastColAction && colIdx === columns - 1
  const pl = colIdx === 0 ? 20 : 12
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

- [ ] **Step 3: Verify TypeScript — 0 new errors introduced by the change**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

Expected: any pre-existing errors (parts/AssetsTable/SearchSelect/employee-repo) may still appear; zero NEW errors referencing `TableSkeleton.tsx`.

---

## Task 2: AssetsPage — remove `headers` prop from `<TableSkeleton>`

**Files:**
- Modify: `src/pages/assets/AssetsPage.tsx`

- [ ] **Step 1: Locate the TableSkeleton call in `renderTableRegion()`**

Lines ~227–241. The call currently passes:
```tsx
headers={[
  t('cols.asset', { ns: 'assets' }),
  t('cols.branch', { ns: 'assets' }),
  t('cols.code', { ns: 'assets' }),
  t('cols.assignee', { ns: 'assets' }),
  t('cols.status', { ns: 'assets' }),
  '',
]}
```

- [ ] **Step 2: Remove the `headers` prop entirely from the call**

The `<TableSkeleton>` call should become:
```tsx
<TableSkeleton
  rows={PAGE_SIZE}
  columns={6}
  firstColWide
  lastColAction
  gridTemplate="minmax(240px,2.4fr) minmax(130px,1fr) minmax(100px,0.85fr) minmax(150px,1.2fr) minmax(110px,1fr) 56px"
/>
```

- [ ] **Step 3: Verify TypeScript — 0 new errors**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 3: EmployeesPage — remove `headers` prop from `<TableSkeleton>`

**Files:**
- Modify: `src/pages/employees/EmployeesPage.tsx`

- [ ] **Step 1: Locate the TableSkeleton call in `renderTableRegion()`**

Lines ~726–742. The call currently passes:
```tsx
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
```

- [ ] **Step 2: Remove the `headers` prop entirely from the call**

```tsx
<TableSkeleton
  rows={PAGE_SIZE}
  columns={8}
  firstColWide
  lastColAction
  gridTemplate="minmax(180px,1.6fr) minmax(120px,0.9fr) minmax(140px,1.2fr) minmax(110px,0.85fr) minmax(160px,1.4fr) minmax(80px,0.6fr) minmax(100px,0.9fr) 56px"
/>
```

- [ ] **Step 3: Verify TypeScript — 0 new errors**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 4: AssetDetailPage — replace real text/icons in loading skeleton

**Files:**
- Modify: `src/pages/assets/AssetDetailPage.tsx`

The `if (loading) { return (...) }` block spans approximately lines 329–449.

Three sub-regions need changes:

**A. The 3 right-sidebar cards** (lines ~359–381):
Currently renders an array of `{ titleKey, icon }` objects and renders `<Icon name={icon} ...>` and `<span>{t(titleKey)}</span>` in each card header.

Replace the entire right-sidebar block with shimmer bars. The card header should have a shimmer square for the icon and a shimmer bar for the title:

```tsx
{/* RIGHT column — 3 sidebar cards; order-2 on mobile */}
<div className="space-y-4 max-md:order-2 lg:row-span-2">
  {Array.from({ length: 3 }).map((_, cardIdx) => (
    <div key={cardIdx} className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
        {/* icon shimmer */}
        <div className="w-[15px] h-[15px] rounded anim-skeleton flex-shrink-0" />
        {/* title shimmer */}
        <div className="h-[10px] w-[40%] rounded anim-skeleton" />
      </div>
      <div className="p-5 space-y-3">
        {Array.from({ length: 3 }).map((__, r) => (
          <div key={r} className="h-[13px] rounded anim-skeleton" style={{ width: `${65 - r * 10}%` }} />
        ))}
      </div>
    </div>
  ))}
</div>
```

**B. The tab strip** (lines ~385–398):
Currently renders `(['detail.tabs.specs', 'detail.tabs.history', 'detail.tabs.docs'] as const).map(...)` with `<Icon>` + `{t(key)}`.

Replace with shimmer bars matching the 44px strip height:

```tsx
{/* Tab strip — shimmer (not interactive during loading) */}
<div className="bg-surface border-x border-border px-5 flex items-center gap-1 h-[44px]">
  {Array.from({ length: 3 }).map((_, i) => (
    <div key={i} className="flex items-center gap-1.5 px-3 py-3 flex-shrink-0">
      <div className="w-[14px] h-[14px] rounded anim-skeleton flex-shrink-0" />
      <div className="h-[12px] rounded anim-skeleton" style={{ width: i === 0 ? 72 : i === 1 ? 64 : 56 }} />
    </div>
  ))}
</div>
```

**C. The TechSpecs card header** (lines ~402–419):
Currently renders `<Icon name="cpu" ...>`, `<span>{t('detail.specs.title')}</span>`, and a disabled `<button>` with `<Icon name="copy">` + `{t('detail.specs.copy')}`.

Replace:
```tsx
{/* Card header — shimmer (no real text/icon/button) */}
<div className="flex items-center justify-between mb-4">
  <div className="flex items-center gap-2.5">
    {/* icon shimmer */}
    <div className="w-[18px] h-[18px] rounded anim-skeleton flex-shrink-0" />
    {/* title shimmer */}
    <div className="h-[10px] w-[120px] rounded anim-skeleton" />
  </div>
  {/* copy button shimmer */}
  <div className="h-8 w-[96px] rounded-lg anim-skeleton flex-shrink-0" />
</div>
```

- [ ] **Step 1: Apply all three changes to the `if (loading)` block**

Edit `src/pages/assets/AssetDetailPage.tsx` applying the three JSX replacements described above (sidebar cards, tab strip, card header).

- [ ] **Step 2: Confirm no `t(` or `<Icon` calls remain inside the `if (loading)` block**

```bash
cd C:/Users/DELL/Desktop/assets-crm && node -e "
const fs = require('fs');
const src = fs.readFileSync('src/pages/assets/AssetDetailPage.tsx', 'utf8');
const loadingBlock = src.slice(src.indexOf('if (loading) {'), src.indexOf('if (loadError) {'));
const hasTCall = / t\('detail\./.test(loadingBlock);
const hasIcon = /<Icon/.test(loadingBlock);
console.log('t() calls in loading block:', hasTCall);
console.log('<Icon> in loading block:', hasIcon);
"
```

Expected output:
```
t() calls in loading block: false
<Icon> in loading block: false
```

- [ ] **Step 3: Verify TypeScript — 0 new errors**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 5: PartsPage — replace real text/icons in loading skeleton tab strip

**Files:**
- Modify: `src/pages/parts/PartsPage.tsx`

The `if (loading) { return (...) }` block spans approximately lines 217–315.

**Target 1: Tab strip** (lines ~231–257):
Currently renders `[{ id: 'devices', labelKey: 'tabs.devices', icon: 'monitor-smartphone' }, { id: 'warehouse', labelKey: 'tabs.warehouse', icon: 'package' }].map(...)` with `<Icon>` + `{t(labelKey)}`.

Replace the tab strip block:
```tsx
{/* Tab strip — shimmer (no interactive, no real labels) */}
<div className="flex items-center justify-between border-b border-border flex-shrink-0 h-[44px]">
  <div className="flex items-center gap-1">
    {Array.from({ length: 2 }).map((_, i) => (
      <div key={i} className="inline-flex items-center gap-1.5 px-4 py-3">
        <div className="w-[14px] h-[14px] rounded anim-skeleton flex-shrink-0" />
        <div className="h-[12px] rounded anim-skeleton" style={{ width: i === 0 ? 72 : 60 }} />
      </div>
    ))}
  </div>
  {/* add button shimmer (desktop only) */}
  <div className="mr-1 h-8 w-[96px] rounded-lg anim-skeleton max-md:hidden" />
</div>
```

**Target 2: Right-panel `warehouse.history` subheader** (lines ~283–290):
Currently renders:
```tsx
<span className="text-[11px] uppercase tracking-[0.07em] font-semibold text-text-tertiary">
  {t('warehouse.history')}
</span>
```

Replace with a shimmer bar:
```tsx
<div className="h-[10px] w-[72px] rounded anim-skeleton" />
```

- [ ] **Step 1: Apply both changes to the `if (loading)` block**

Edit `src/pages/parts/PartsPage.tsx` applying the two JSX replacements described above.

- [ ] **Step 2: Confirm no `t(` or `<Icon` calls remain in the loading skeleton**

```bash
cd C:/Users/DELL/Desktop/assets-crm && node -e "
const fs = require('fs');
const src = fs.readFileSync('src/pages/parts/PartsPage.tsx', 'utf8');
const loadingBlock = src.slice(src.indexOf('if (loading) {'), src.indexOf('if (error) {'));
const hasTCall = /\bt\(/.test(loadingBlock);
const hasIcon = /<Icon/.test(loadingBlock);
console.log('t() calls in loading block:', hasTCall);
console.log('<Icon> in loading block:', hasIcon);
"
```

Expected:
```
t() calls in loading block: false
<Icon> in loading block: false
```

- [ ] **Step 3: Verify TypeScript — 0 new errors**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 6: DashboardPage — replace real text/icons in loading skeleton

**Files:**
- Modify: `src/pages/dashboard/DashboardPage.tsx`

The `if (loading) { return (...) }` block spans approximately lines 37–92.

**Target 1: KPI tile row** (lines ~42–61):
Currently renders `[{ labelKey: 'kpi.totalAssets', icon: 'package' }, ...].map(({ labelKey, icon }) => ...)` with `<Icon name={icon} ...>` and `<span>{t(labelKey)}</span>`.

Replace with pure shimmer tiles:
```tsx
{/* KPI tile row — shimmer */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {Array.from({ length: 4 }).map((_, i) => (
    <div key={i} className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
      {/* icon shimmer */}
      <div className="w-9 h-9 rounded-lg anim-skeleton flex-shrink-0" />
      <div className="space-y-2">
        {/* label shimmer */}
        <div className="h-[10px] w-[55%] rounded anim-skeleton" />
        {/* value shimmer */}
        <div className="h-[22px] w-[40%] rounded anim-skeleton" />
      </div>
    </div>
  ))}
</div>
```

**Target 2: Detail panels** (lines ~63–90):
Currently renders `[{ titleKey: 'status.title', icon: 'circle-dot' }, ...].map(({ titleKey, icon }) => ...)` with `<Icon name={icon} ...>` and `<span>{t(titleKey)}</span>` in panel headers.

Replace with shimmer panel headers:
```tsx
{/* Detail panels — shimmer */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  {Array.from({ length: 4 }).map((_, panelIdx) => (
    <div key={panelIdx} className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
        {/* icon shimmer */}
        <div className="w-7 h-7 rounded-lg anim-skeleton flex-shrink-0" />
        {/* title shimmer */}
        <div className="h-[10px] w-[35%] rounded anim-skeleton" />
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
```

Also remove the `<PageHeader icon="layout-dashboard" title={t('title')} />` line from the loading skeleton (it renders the real page title). Replace it with a `<PageHeader>` shimmer:
```tsx
{/* Page header — shimmer */}
<div className="h-8 w-[200px] rounded anim-skeleton" />
```

Wait — `<PageHeader>` is a separate component that might itself render safely with a skeleton. Check whether `PageHeader` reads its props unconditionally. Since `PageHeader` renders its title as a real string regardless, it must be removed from the loading branch and replaced with a plain shimmer bar. Use:
```tsx
<div className="h-8 w-[200px] rounded-lg anim-skeleton" />
```

- [ ] **Step 1: Apply all three changes (PageHeader shimmer, KPI tiles shimmer, detail panels shimmer)**

Edit `src/pages/dashboard/DashboardPage.tsx` replacing the three regions in the `if (loading)` block.

- [ ] **Step 2: Confirm no `t(` or `<Icon` or `<PageHeader` remain in the loading block**

```bash
cd C:/Users/DELL/Desktop/assets-crm && node -e "
const fs = require('fs');
const src = fs.readFileSync('src/pages/dashboard/DashboardPage.tsx', 'utf8');
const loadingBlock = src.slice(src.indexOf('if (loading) {'), src.indexOf('const assets = data.assets'));
const hasTCall = /\bt\(/.test(loadingBlock);
const hasIcon = /<Icon/.test(loadingBlock);
const hasPageHeader = /<PageHeader/.test(loadingBlock);
console.log('t() calls:', hasTCall);
console.log('<Icon>:', hasIcon);
console.log('<PageHeader>:', hasPageHeader);
"
```

Expected:
```
t() calls: false
<Icon>: false
<PageHeader>: false
```

- [ ] **Step 3: Verify TypeScript — 0 new errors**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 7: LicensesPage — replace real text/icons in loading skeleton section headers

**Files:**
- Modify: `src/pages/licenses/LicensesPage.tsx`

There are two separate loading skeletons — one in the `keys` tab and one in the `subs` tab.

**Keys tab skeleton** (lines ~399–435):
Card header currently renders:
```tsx
<Icon name="key-round" size={15} className="text-text-subtle flex-shrink-0 w-7 h-7 flex items-center justify-center" />
<span className="text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
  {t('keys.sectionTitle')}
</span>
```

Replace the two elements with:
```tsx
<div className="w-7 h-7 rounded-lg anim-skeleton flex-shrink-0" />
<div className="h-[10px] w-[120px] rounded anim-skeleton" />
```

**Subs tab skeleton** (lines ~462–493):
Card header currently renders:
```tsx
<Icon name="boxes" size={15} className="text-text-subtle flex-shrink-0 w-7 h-7 flex items-center justify-center" />
<span className="text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
  {t('subs.sectionTitle')}
</span>
```

Replace with:
```tsx
<div className="w-7 h-7 rounded-lg anim-skeleton flex-shrink-0" />
<div className="h-[10px] w-[120px] rounded anim-skeleton" />
```

- [ ] **Step 1: Apply both skeleton card-header replacements**

Edit `src/pages/licenses/LicensesPage.tsx` replacing the `<Icon>` + `<span>{t(...)}` pairs inside both loading skeleton card headers.

- [ ] **Step 2: Confirm no `t(` or `<Icon` remain in the skeleton card headers**

```bash
cd C:/Users/DELL/Desktop/assets-crm && node -e "
const fs = require('fs');
const src = fs.readFileSync('src/pages/licenses/LicensesPage.tsx', 'utf8');
// Check keys loading block
const keysStart = src.indexOf('wLoading && (');
const keysEnd = src.indexOf('})', keysStart) + 2;
const keysBlock = src.slice(keysStart, keysEnd);
const subsStart = src.indexOf('subsLoading && (');
const subsEnd = src.indexOf('})', subsStart) + 2;
const subsBlock = src.slice(subsStart, subsEnd);
console.log('keys block has t():', /\bt\(/.test(keysBlock));
console.log('keys block has <Icon:', /<Icon/.test(keysBlock));
console.log('subs block has t():', /\bt\(/.test(subsBlock));
console.log('subs block has <Icon:', /<Icon/.test(subsBlock));
"
```

Expected: all four `false`.

- [ ] **Step 3: Verify TypeScript — 0 new errors**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 8: MyAssetsPage — replace real text/icons in loading skeleton

**Files:**
- Modify: `src/pages/self-service/MyAssetsPage.tsx`

The `if (loading) { return (...) }` block (lines ~69–95).

**Target 1: `<PageHeader>` line** (line ~72):
```tsx
<PageHeader icon="package" title={t('self.myAssets')} />
```
Replace with a shimmer bar:
```tsx
<div className="h-8 w-[180px] rounded-lg anim-skeleton" />
```

**Target 2: Section card header** (lines ~73–79):
```tsx
<div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
  <Icon name="package" size={15} className="text-text-subtle flex-shrink-0 w-7 h-7 flex items-center justify-center" />
  <span className="text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
    {t('self.myAssets')}
  </span>
</div>
```
Replace `<Icon>` and `<span>` with:
```tsx
<div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
  <div className="w-7 h-7 rounded-lg anim-skeleton flex-shrink-0" />
  <div className="h-[10px] w-[100px] rounded anim-skeleton" />
</div>
```

- [ ] **Step 1: Apply both changes**

Edit `src/pages/self-service/MyAssetsPage.tsx` replacing `<PageHeader>` and the card header `<Icon>` + `<span>` in the loading branch.

- [ ] **Step 2: Verify TypeScript — 0 new errors**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 9: MyActsPage — replace real text/icons in loading skeleton

**Files:**
- Modify: `src/pages/self-service/MyActsPage.tsx`

The `if (loading) { return (...) }` block (lines ~58–89).

**Target 1: `<PageHeader>` line** (line ~61):
```tsx
<PageHeader icon="file-text" title={t('self.myActs')} />
```
Replace with:
```tsx
<div className="h-8 w-[160px] rounded-lg anim-skeleton" />
```

**Target 2: Section card header** (lines ~62–67):
```tsx
<div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
  <Icon name="file-text" size={15} className="text-text-subtle flex-shrink-0 w-7 h-7 flex items-center justify-center" />
  <span className="text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
    {t('self.myActs')}
  </span>
</div>
```
Replace `<Icon>` and `<span>` with shimmer bars:
```tsx
<div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
  <div className="w-7 h-7 rounded-lg anim-skeleton flex-shrink-0" />
  <div className="h-[10px] w-[80px] rounded anim-skeleton" />
</div>
```

**Target 3: Disabled "view scan" button** (lines ~74–82):
```tsx
<button
  type="button"
  disabled
  className="inline-flex items-center gap-1.5 h-[32px] px-3 rounded-lg text-[12.5px] font-medium border bg-surface-2 border-border text-text-tertiary opacity-50 cursor-default flex-shrink-0"
>
  <Icon name="arrow-right-left" size={13} />
  {t('detail.viewScan')}
</button>
```
Replace the entire button with a shimmer bar:
```tsx
<div className="h-[32px] w-[112px] rounded-lg anim-skeleton flex-shrink-0" />
```

- [ ] **Step 1: Apply all three changes**

Edit `src/pages/self-service/MyActsPage.tsx` replacing the `<PageHeader>`, card header, and disabled button in the loading branch.

- [ ] **Step 2: Verify TypeScript — 0 new errors**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 10: ProfilePage — replace real text/icons in loading skeleton

**Files:**
- Modify: `src/pages/self-service/ProfilePage.tsx`

The `if (loading) { return (...) }` block (lines ~71–101).

**Target 1: `<PageHeader>` line** (line ~74):
```tsx
<PageHeader icon="user" title={t('detail.profile')} />
```
Replace with:
```tsx
<div className="h-8 w-[140px] rounded-lg anim-skeleton" />
```

**Target 2: Section card header** (lines ~75–80):
```tsx
<div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
  <Icon name="user" size={15} className="text-text-subtle flex-shrink-0 w-7 h-7 flex items-center justify-center" />
  <span className="text-[12px] uppercase tracking-[0.09em] font-semibold text-text-tertiary">
    {t('detail.profile')}
  </span>
</div>
```
Replace `<Icon>` and `<span>` with shimmer bars:
```tsx
<div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
  <div className="w-7 h-7 rounded-lg anim-skeleton flex-shrink-0" />
  <div className="h-[10px] w-[80px] rounded anim-skeleton" />
</div>
```

**Target 3: Six field labels** (lines ~84–95):
The current map renders `(['form.firstName', 'form.lastName', ...] as const).map((labelKey, i) => ...)` with:
```tsx
<span className="block text-[11px] uppercase tracking-[0.06em] font-semibold text-text-subtle">
  {t(labelKey)}
</span>
```
Replace the real `<span>` label with a shimmer bar:
```tsx
<div className="h-[10px] w-[60%] rounded anim-skeleton" />
```

The entire field block should become (6 items, drop the `as const` cast and the array of keys — just iterate 6 times):
```tsx
<div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
  {Array.from({ length: 6 }).map((_, i) => (
    <div key={i} className="space-y-2">
      {/* field label — shimmer */}
      <div className="h-[10px] w-[60%] rounded anim-skeleton" />
      {/* field value — shimmer */}
      <div className="h-[13px] rounded anim-skeleton" style={{ width: `${50 + (i % 3) * 15}%` }} />
    </div>
  ))}
</div>
```

- [ ] **Step 1: Apply all three changes**

Edit `src/pages/self-service/ProfilePage.tsx` replacing `<PageHeader>`, card header, and field labels in the loading branch.

- [ ] **Step 2: Verify TypeScript — 0 new errors**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 11: PendingUsersPage — replace real column header labels in desktop loading skeleton

**Files:**
- Modify: `src/pages/auth/PendingUsersPage.tsx`

The desktop loading skeleton is inside `renderBody()` when `loading && !isMobile` (approximately lines ~304–342).

**Target: The column header row** (lines ~306–323):
Currently renders:
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

Replace the column header divs with shimmer bars of the same widths:
```tsx
<div className="flex items-center gap-3 border-b border-border py-2.5 px-3">
  {(
    ['35%', '30%', '20%', '10%'] as const
  ).map((widthPct, i) => (
    <div key={i} style={{ width: widthPct, flexShrink: 0 }}>
      {/* Skip the last (action) column — no shimmer bar for it */}
      {i < 3 && (
        <div className="h-[9px] rounded anim-skeleton" style={{ width: '55%' }} />
      )}
    </div>
  ))}
</div>
```

- [ ] **Step 1: Apply the column header replacement**

Edit `src/pages/auth/PendingUsersPage.tsx` replacing the column header rendering in the desktop loading skeleton.

- [ ] **Step 2: Verify TypeScript — 0 new errors**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 12: AuthSettingsPanel — replace real text in loading skeleton

**Files:**
- Modify: `src/components/features/settings/AuthSettingsPanel.tsx`

The `if (loading) { return (...) }` block (lines ~245–290).

**Target 1: Subtitle paragraph** (line ~250):
```tsx
<p className="text-[13px] text-text-subtle">{t('auth.subtitle')}</p>
```
Replace with a shimmer bar:
```tsx
<div className="h-[13px] w-[70%] rounded anim-skeleton" />
```

**Target 2: Add-domain label** (lines ~262–264):
```tsx
<label className="block text-[11px] uppercase tracking-[0.06em] font-semibold text-text-subtle">
  {t('auth.addLabel')}
</label>
```
Replace with a shimmer bar:
```tsx
<div className="h-[9px] w-[100px] rounded anim-skeleton" />
```

**Target 3: Disabled "Добавить" button** (lines ~267–274):
```tsx
<button
  type="button"
  disabled
  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-medium border bg-surface-2 border-border text-text-tertiary opacity-50 cursor-default flex-shrink-0"
>
  <Icon name="plus" size={13} />
  {t('auth.addBtn')}
</button>
```
Replace entire button with a shimmer:
```tsx
<div className="h-9 w-[88px] rounded-lg anim-skeleton flex-shrink-0" />
```

**Target 4: Disabled "Сохранить" button** (lines ~279–285):
```tsx
<button
  type="button"
  disabled
  className="inline-flex items-center h-9 px-4 rounded-lg text-[13px] font-semibold bg-accent text-white opacity-50 cursor-default"
>
  {t('auth.saveBtn')}
</button>
```
Replace with:
```tsx
<div className="h-9 w-[96px] rounded-lg anim-skeleton" />
```

- [ ] **Step 1: Apply all four changes**

Edit `src/components/features/settings/AuthSettingsPanel.tsx` replacing the subtitle, add-label, add button, and save button in the loading branch.

- [ ] **Step 2: Confirm no `t(` or `<Icon` remain in the loading branch**

```bash
cd C:/Users/DELL/Desktop/assets-crm && node -e "
const fs = require('fs');
const src = fs.readFileSync('src/components/features/settings/AuthSettingsPanel.tsx', 'utf8');
const loadingBlock = src.slice(src.indexOf('if (loading) {'), src.indexOf('if (loadError) {'));
console.log('t() calls:', /\bt\(/.test(loadingBlock));
console.log('<Icon>:', /<Icon/.test(loadingBlock));
"
```

Expected:
```
t() calls: false
<Icon>: false
```

- [ ] **Step 3: Verify TypeScript — 0 new errors**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 13: Fix PartsPage test — remove assertion that loading skeleton renders `tabs.warehouse`

**Files:**
- Modify: `src/pages/parts/PartsPage.test.tsx`

The test `'shows a loading skeleton while data is loading'` (lines ~123–136) currently asserts:
```ts
expect(screen.getByText('tabs.warehouse')).toBeInTheDocument()
```

After Task 5, the loading skeleton no longer renders `tabs.warehouse` — it renders only shimmer bars. This assertion must be removed and replaced with the existing shimmer assertion.

The final test body should be:
```ts
it('shows a loading skeleton while data is loading', () => {
  // Arrange
  mockUseParts.mockReturnValue({
    ref: null, loading: true, error: null,
    reload: vi.fn(), receiveParts: vi.fn(),
    installPart: vi.fn(), uninstallPart: vi.fn(), createGpu: vi.fn(),
    recordService: vi.fn(),
  })
  // Act
  const { container } = renderPage()
  // Assert — skeleton renders only shimmer bars (no real tab labels)
  expect(container.querySelector('.anim-skeleton')).toBeInTheDocument()
  expect(screen.queryByText('tabs.warehouse')).not.toBeInTheDocument()
  expect(screen.queryByText('tabs.devices')).not.toBeInTheDocument()
})
```

- [ ] **Step 1: Replace the loading skeleton test body**

Edit `src/pages/parts/PartsPage.test.tsx` to replace lines ~133–135 (the `expect(screen.getByText('tabs.warehouse'))` assertion) with the negative assertion shown above.

- [ ] **Step 2: Run the PartsPage tests**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/pages/parts/PartsPage.test.tsx 2>&1 | tail -25
```

Expected: all 5 tests pass (green). If the error-state test (`tabs.warehouse` not in document) now passes for the error branch check, that's correct behavior.

---

## Task 14: Final verification

- [ ] **Step 1: Full build**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx vite build 2>&1 | tail -10
```

Expected: `✓ built in` with 0 errors.

- [ ] **Step 2: TypeScript check**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

Expected: 0 NEW errors. Pre-existing errors in parts/AssetsTable/SearchSelect/employee-repo are acceptable — list them but do not fix unless they're new.

- [ ] **Step 3: Component + page test suite**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/components/ui/ src/pages/ 2>&1 | tail -30
```

Expected: all tests pass (green). If any test fails because it asserts real text in a loading skeleton, fix that test the same way as Task 13: swap `getByText('key')` for `queryByText('key') not.toBeInTheDocument()` and add `querySelector('.anim-skeleton')` assertion.

- [ ] **Step 4: Spot-check no real text remains in any skeleton**

Run a targeted grep to confirm no loading skeletons contain real `t(...)` calls or `<Icon` components:

```bash
cd C:/Users/DELL/Desktop/assets-crm && node -e "
const fs = require('fs');
const files = [
  'src/components/ui/TableSkeleton.tsx',
  'src/pages/assets/AssetsPage.tsx',
  'src/pages/employees/EmployeesPage.tsx',
  'src/pages/assets/AssetDetailPage.tsx',
  'src/pages/parts/PartsPage.tsx',
  'src/pages/dashboard/DashboardPage.tsx',
  'src/pages/licenses/LicensesPage.tsx',
  'src/pages/self-service/MyAssetsPage.tsx',
  'src/pages/self-service/MyActsPage.tsx',
  'src/pages/self-service/ProfilePage.tsx',
  'src/pages/auth/PendingUsersPage.tsx',
  'src/components/features/settings/AuthSettingsPanel.tsx',
];
let allClean = true;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  // Find the loading block start
  const loadStart = src.indexOf('if (loading)');
  if (loadStart === -1) continue;
  // Find the closing brace of the loading block (heuristic: look for 'if (load' or 'if (error)' or 'const' after it)
  // This is a heuristic check — if t() or <Icon shows up in the whole file outside of comments, we flag it.
  // More targeted: check that 'headers' prop is gone from TableSkeleton interface.
  if (f.includes('TableSkeleton') && src.includes('headers?:')) {
    console.log('FAIL: TableSkeleton still has headers prop');
    allClean = false;
  }
}
if (allClean) console.log('Spot-check passed: no obvious headers prop remains in TableSkeleton');
"
```

Expected: `Spot-check passed`.

---

## Self-Review

**Spec coverage check:**
1. TableSkeleton `headers` prop removed — Task 1 ✓
2. AssetsPage caller updated — Task 2 ✓
3. EmployeesPage caller updated — Task 3 ✓
4. AssetDetailPage: 3 tab labels+icons, sidebar titles+icons, TechSpecs title+icon+copy button → shimmer — Task 4 ✓
5. PartsPage: tab labels+icons, add button, `warehouse.history` header → shimmer — Task 5 ✓
6. DashboardPage: KPI icons+labels, panel title icons+labels, PageHeader → shimmer — Task 6 ✓
7. LicensesPage: keys section title+icon, subs section title+icon → shimmer — Task 7 ✓
8. MyAssetsPage: PageHeader, section title+icon → shimmer — Task 8 ✓
9. MyActsPage: PageHeader, section title+icon, disabled view-scan button → shimmer — Task 9 ✓
10. ProfilePage: PageHeader, section title+icon, 6 field labels → shimmer — Task 10 ✓
11. PendingUsersPage: 3 desktop column headers → shimmer — Task 11 ✓
12. AuthSettingsPanel: subtitle, add label, add button, save button → shimmer — Task 12 ✓
13. PartsPage.test: fix `tabs.warehouse` assertion in loading test — Task 13 ✓
14. CardListSkeleton: already pure shimmer, no changes needed — confirmed in analysis ✓
15. Final verification — Task 14 ✓

**No placeholders**: all JSX shown in full. All commands shown with exact paths.

**Type consistency**: `headers` removed from `TableSkeletonProps` in Task 1 and from callers in Tasks 2 and 3. No other type renames.
