# Empty State Standardization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize every list/table page in AMS to use the shared `<EmptyState>` component with a distinct filtered-empty-state (search-x icon + reset button) vs. truly-empty state (inbox icon + no reset).

**Architecture:** All changes are purely presentational — data logic, filter state and reset handlers already exist per page; we wire them to `EmptyState` props. New i18n keys follow the `assets` namespace shape: `empty.titleFiltered / descFiltered / titleEmpty / descEmpty / reset`. Only namespaces that need filtered/empty split get new keys; the three-file parity rule (`localesSync.test.ts`) is maintained by adding every new key to all three locale files simultaneously.

**Tech Stack:** React 19, Tailwind CSS, shadcn/ui, react-i18next (ru/en/hy), TypeScript (strict, `exactOptionalPropertyTypes`).

---

## File Map

### Modified components
- `src/pages/employees/EmployeesPage.tsx` — add `hasActiveFilters` bool + split EmptyState rendering
- `src/components/features/parts/DevicesTab.tsx` — replace inline filtered-div with EmptyState + reset; fix reset to clear family+search
- `src/pages/audit/AuditPage.tsx` — add `hasActiveFilters` bool + split EmptyState rendering
- `src/components/features/licenses/WindowsKeysSection.tsx` — replace custom inline empty markup with EmptyState
- `src/pages/catalogs/RolesPage.tsx` — add `hasActiveFilters` bool + reset handler + split EmptyState rendering (it already effectively shows only the filtered case)

### Modified locale files (all 3 locales per namespace)
- `src/locales/{ru,en,hy}/employees.json` — add `empty.titleFiltered`, `empty.descFiltered`, `empty.titleEmpty`, `empty.descEmpty`, `empty.reset`
- `src/locales/{ru,en,hy}/audit.json` — add `empty.titleFiltered`, `empty.descFiltered`, `empty.titleEmpty`, `empty.descEmpty`, `empty.reset`  
- `src/locales/{ru,en,hy}/licenses.json` — add `keys.emptyTitleFiltered`, `keys.emptyDescFiltered`, `keys.emptyReset`
- `src/locales/{ru,en,hy}/roles.json` — add `empty.titleFiltered`, `empty.descFiltered`, `empty.titleEmpty`, `empty.descEmpty`, `empty.reset`
- `src/locales/{ru,en,hy}/parts.json` — add `devices.emptyDescFiltered`, `devices.emptyReset`

### NOT modified (already correct or intentionally skipped)
- `src/components/ui/empty-state.tsx` — already supports all needed props; no change needed
- `src/pages/assets/AssetsPage.tsx` — the reference; not touched
- `src/components/features/licenses/SubscriptionsSection.tsx` — no filter state; already uses EmptyState correctly
- `src/pages/licenses/LicensesPage.tsx` — delegates to child sections; no independent empty state
- `src/pages/catalogs/BranchesPage.tsx` — no active filter UI on the page (search is in the repo query sent at startup); already uses EmptyState; no change needed
- `src/pages/catalogs/DepartmentsPage.tsx` — no filter state; already uses EmptyState correctly
- `src/pages/catalogs/CategoriesPage.tsx` — selectedGroupId is a navigation selection, not a search filter; already uses EmptyState; acceptable as-is
- `src/components/features/parts/WarehouseSkuList.tsx` — has its own specialized placeholder UI (`SkuPlaceholderDesktop`/`SkuPlaceholderMobile`); the category-selector is navigation not search; NOTE: acceptable as-is per spec
- `src/pages/self-service/MyActsPage.tsx` — already uses `<EmptyState>` correctly; no change
- `src/pages/self-service/MyAssetsPage.tsx` — no standalone EmptyState needed (inline section handling); skip per spec

---

## Key Contract: hasActiveFilters per page

| Page | hasActiveFilters expression |
|---|---|
| EmployeesPage | `query.status !== DEFAULT_QUERY.status \|\| query.branchId !== DEFAULT_QUERY.branchId \|\| query.departmentId !== DEFAULT_QUERY.departmentId \|\| search.trim() !== ''` |
| DevicesTab | `family !== 'all' \|\| search.trim() !== ''` |
| AuditPage | `query.entityType !== 'all' \|\| query.action !== 'all' \|\| query.actorUid !== 'all' \|\| (query.fromDate ?? null) !== null \|\| (query.toDate ?? null) !== null \|\| (query.search ?? '').trim() !== ''` |
| WindowsKeysSection | `filter !== 'in_use' \|\| search.trim() !== ''` — using `in_use` as the default (initial state); only the search makes it "filtered" beyond the tab choice; see notes |
| RolesPage | `search.trim() !== '' \|\| roleFilter !== 'all' \|\| statusFilter !== 'all'` |

> **WindowsKeysSection note:** The `filter` state (in_use/free) is a tab strip, not a traditional filter. The empty state for `in_use` with no search = "truly empty" (no keys in use yet). The empty state for `free` with no search = "truly empty" (no free keys). The empty state for any tab + search active = "filtered". So the split is: `search.trim() !== ''` = filtered; otherwise = truly empty.

---

## i18n Keys to Add

### employees namespace
```
empty.titleFiltered  → ru: "Сотрудников не найдено"       en: "No employees found"              hy: "Աշխատակիցներ չեն գտնվել"
empty.descFiltered   → ru: "Попробуйте сменить фильтр или поисковый запрос."  en: "Try changing the filter or search query."  hy: "Փորձեք փոխել ֆիլտրը կամ որոնման հարցումը։"
empty.titleEmpty     → ru: "Сотрудников пока нет"          en: "No employees yet"                hy: "Աշխատակիցներ դեռ չկան"
empty.descEmpty      → ru: "Добавьте первого сотрудника"   en: "Add the first employee"          hy: "Ավելացրեք առաջին աշխատակցին"
empty.reset          → ru: "Сбросить фильтры"              en: "Reset filters"                   hy: "Զրոյացնել ֆիլտրերը"
```

Note: `empty.titleEmpty` / `empty.descEmpty` = current `empty.title` / `empty.desc` values. **Keep** existing `empty.title` and `empty.desc` keys (for backward-compat, since the test doesn't assert their removal). Only add the new keys.

### audit namespace
```
empty.titleFiltered  → ru: "Записей не найдено"            en: "No entries found"               hy: "Գրառումներ չեն գտնվել"
empty.descFiltered   → ru: "Попробуйте сменить фильтр или поисковый запрос."  en: "Try changing the filter or search query."  hy: "Փորձեք փոխել ֆիլտրը կամ որոնման հարցումը։"
empty.titleEmpty     → ru: "Записей нет"                   en: "No entries"                     hy: "Գրառումներ չկան"
empty.descEmpty      → ru: "Записи журнала аудита появятся здесь по мере изменений в системе."  en: "Audit log entries will appear here as changes are made in the system."  hy: "Աուդիտի մատյանի գրառումները կհայտնվեն այստեղ համակարգում փոփոխությունների հետ։"
empty.reset          → ru: "Сбросить фильтры"              en: "Reset filters"                  hy: "Զրոյացնել ֆիլտրերը"
```

Note: `empty.titleEmpty` = current `empty.title`; `empty.descEmpty` = current `empty.desc`. Keep the old keys intact (the `localesSync.test.ts` line 380 asserts `ruVal === 'Записей нет'` via `empty.title` — that assertion still passes since `empty.title` stays).

### licenses namespace (keys sub-object only)
```
keys.emptyTitleFiltered  → ru: "Ключей не найдено"         en: "No keys found"                 hy: "Բանալիներ չեն գտնվել"
keys.emptyDescFiltered   → ru: "Попробуйте сменить фильтр или поисковый запрос."  en: "Try changing the filter or search query."  hy: "Փորձեք փոխել ֆիլտրը կամ որոնման հարցումը։"
keys.emptyReset          → ru: "Сбросить фильтры"          en: "Reset filters"                 hy: "Զրոյացնել ֆիլտրերը"
```

Note: Keep `keys.emptyTitle` and `keys.emptyDesc` (used for the truly-empty state without search).

### roles namespace
```
empty.titleFiltered  → ru: "Пользователей не найдено"      en: "No users found"                hy: "Օգտատերեր չեն գտնվել"
empty.descFiltered   → ru: "Попробуйте сменить фильтр или поисковый запрос."  en: "Try changing the filter or search query."  hy: "Փորձեք փոխել ֆիլտրը կամ որոնման հարցումը։"
empty.titleEmpty     → ru: "Пользователей нет"              en: "No users"                      hy: "Օգտատերեր չկան"
empty.descEmpty      → ru: "Назначьте роли пользователям через эту страницу."  en: "Assign roles to users via this page."  hy: "Հատկացրեք դերեր օգտատերերին այս էջի միջոցով։"
empty.reset          → ru: "Сбросить фильтры"               en: "Reset filters"                hy: "Զրոյացնել ֆիլտրերը"
```

Note: Keep existing `empty.title` and `empty.desc` (they already read "Пользователи не найдены / Измените фильтры или поиск" which is the filtered phrasing; those old keys stay but are now superseded for the component).

### parts namespace (devices sub-object only)
```
devices.emptyDescFiltered  → ru: "Попробуйте сменить фильтр или поисковый запрос."  en: "Try changing the filter or search query."  hy: "Փորձեք փոխել ֆիլտրը կամ որոնման հարցումը։"
devices.emptyReset         → ru: "Сбросить фильтры"           en: "Reset filters"              hy: "Զրոյացնել ֆիլտրերը"
```

Note: Keep `devices.emptyFiltered` (already existed; now unused in DevicesTab but present for sync parity — OR remove it from all 3 and clean up). **Preferred: remove `devices.emptyFiltered` from all 3 locale files** since DevicesTab will no longer reference it. This minimizes locale drift. The localesSync test will pass because the key is removed from ALL three files simultaneously.

---

## Tasks

### Task 1: Add new i18n keys to all three locale files

**Files:**
- Modify: `src/locales/ru/employees.json`
- Modify: `src/locales/en/employees.json`
- Modify: `src/locales/hy/employees.json`
- Modify: `src/locales/ru/audit.json`
- Modify: `src/locales/en/audit.json`
- Modify: `src/locales/hy/audit.json`
- Modify: `src/locales/ru/licenses.json`
- Modify: `src/locales/en/licenses.json`
- Modify: `src/locales/hy/licenses.json`
- Modify: `src/locales/ru/roles.json`
- Modify: `src/locales/en/roles.json`
- Modify: `src/locales/hy/roles.json`
- Modify: `src/locales/ru/parts.json`
- Modify: `src/locales/en/parts.json`
- Modify: `src/locales/hy/parts.json`

- [ ] **Step 1.1: Update employees locale files**

In `src/locales/ru/employees.json`, find `"empty": {` and expand it to:
```json
"empty": {
  "desc": "Добавьте первого сотрудника",
  "title": "Сотрудников пока нет",
  "titleFiltered": "Сотрудников не найдено",
  "descFiltered": "Попробуйте сменить фильтр или поисковый запрос.",
  "titleEmpty": "Сотрудников пока нет",
  "descEmpty": "Добавьте первого сотрудника",
  "reset": "Сбросить фильтры"
},
```

In `src/locales/en/employees.json`, expand `"empty":` to:
```json
"empty": {
  "desc": "Add the first employee",
  "title": "No employees yet",
  "titleFiltered": "No employees found",
  "descFiltered": "Try changing the filter or search query.",
  "titleEmpty": "No employees yet",
  "descEmpty": "Add the first employee",
  "reset": "Reset filters"
},
```

In `src/locales/hy/employees.json`, expand `"empty":` to:
```json
"empty": {
  "desc": "Ավելացրեք առաջին աշխատակցին",
  "title": "Աշխատակիցներ դեռ չկան",
  "titleFiltered": "Աշխատակիցներ չեն գտնվել",
  "descFiltered": "Փորձեք փոխել ֆիլտրը կամ որոնման հարցումը։",
  "titleEmpty": "Աշխատակիցներ դեռ չկան",
  "descEmpty": "Ավելացրեք առաջին աշխատակցին",
  "reset": "Զրոյացնել ֆիլտրերը"
},
```

- [ ] **Step 1.2: Update audit locale files**

In `src/locales/ru/audit.json`, expand `"empty":` to:
```json
"empty": {
  "title": "Записей нет",
  "desc": "Записи журнала аудита появятся здесь по мере изменений в системе.",
  "titleFiltered": "Записей не найдено",
  "descFiltered": "Попробуйте сменить фильтр или поисковый запрос.",
  "titleEmpty": "Записей нет",
  "descEmpty": "Записи журнала аудита появятся здесь по мере изменений в системе.",
  "reset": "Сбросить фильтры"
}
```

In `src/locales/en/audit.json`, expand `"empty":` to:
```json
"empty": {
  "title": "No entries",
  "desc": "Audit log entries will appear here as changes are made in the system.",
  "titleFiltered": "No entries found",
  "descFiltered": "Try changing the filter or search query.",
  "titleEmpty": "No entries",
  "descEmpty": "Audit log entries will appear here as changes are made in the system.",
  "reset": "Reset filters"
}
```

In `src/locales/hy/audit.json`, expand `"empty":` to:
```json
"empty": {
  "title": "Գրառումներ չկան",
  "desc": "Աուդիտի մատյանի գրառումները կհայտնվեն այստեղ համակարգում փոփոխությունների հետ։",
  "titleFiltered": "Գրառումներ չեն գտնվել",
  "descFiltered": "Փորձեք փոխել ֆիլտրը կամ որոնման հարցումը։",
  "titleEmpty": "Գրառումներ չկան",
  "descEmpty": "Աուդիտի մատյանի գրառումները կհայտնվեն այստեղ համակարգում փոփոխությունների հետ։",
  "reset": "Զրոյացնել ֆիլտրերը"
}
```

- [ ] **Step 1.3: Update licenses locale files (keys sub-object)**

In `src/locales/ru/licenses.json`, inside `"keys": {` add after `"emptyTitle":` and `"emptyDesc":`:
```json
"emptyTitleFiltered": "Ключей не найдено",
"emptyDescFiltered": "Попробуйте сменить фильтр или поисковый запрос.",
"emptyReset": "Сбросить фильтры",
```

In `src/locales/en/licenses.json`, inside `"keys": {` add:
```json
"emptyTitleFiltered": "No keys found",
"emptyDescFiltered": "Try changing the filter or search query.",
"emptyReset": "Reset filters",
```

In `src/locales/hy/licenses.json`, inside `"keys": {` add:
```json
"emptyTitleFiltered": "Բանալիներ չեն գտնվել",
"emptyDescFiltered": "Փորձեք փոխել ֆիլտրը կամ որոնման հարցումը։",
"emptyReset": "Զրոյացնել ֆիլտրերը",
```

- [ ] **Step 1.4: Update roles locale files**

In `src/locales/ru/roles.json`, expand `"empty":` to:
```json
"empty": {
  "title": "Пользователи не найдены",
  "desc": "Измените фильтры или поиск",
  "titleFiltered": "Пользователей не найдено",
  "descFiltered": "Попробуйте сменить фильтр или поисковый запрос.",
  "titleEmpty": "Пользователей нет",
  "descEmpty": "Назначьте роли пользователям через эту страницу.",
  "reset": "Сбросить фильтры"
},
```

In `src/locales/en/roles.json`, expand `"empty":` to:
```json
"empty": {
  "title": "No users found",
  "desc": "Adjust filters or search",
  "titleFiltered": "No users found",
  "descFiltered": "Try changing the filter or search query.",
  "titleEmpty": "No users",
  "descEmpty": "Assign roles to users via this page.",
  "reset": "Reset filters"
},
```

In `src/locales/hy/roles.json`, expand `"empty":` to:
```json
"empty": {
  "title": "Օգտատերեր չեն գտնվել",
  "desc": "Փոխեք զտիչները կամ որոնումը",
  "titleFiltered": "Օգտատերեր չեն գտնվել",
  "descFiltered": "Փորձեք փոխել ֆիլտրը կամ որոնման հարցումը։",
  "titleEmpty": "Օգտատերեր չկան",
  "descEmpty": "Հատկացրեք դերեր օգտատերերին այս էջի միջոցով։",
  "reset": "Զրոյացնել ֆիլտրերը"
},
```

- [ ] **Step 1.5: Update parts locale files (devices sub-object), and REMOVE devices.emptyFiltered from all 3**

In `src/locales/ru/parts.json`, inside `"devices": {`:
- REMOVE the line `"emptyFiltered": "По заданным фильтрам устройств не найдено",`
- ADD after `"emptyDesc":`:
```json
"emptyDescFiltered": "Попробуйте сменить фильтр или поисковый запрос.",
"emptyReset": "Сбросить фильтры",
```

In `src/locales/en/parts.json`, inside `"devices": {`:
- REMOVE the line `"emptyFiltered": "No devices match the current filters",`
- ADD after `"emptyDesc":`:
```json
"emptyDescFiltered": "Try changing the filter or search query.",
"emptyReset": "Reset filters",
```

In `src/locales/hy/parts.json`, inside `"devices": {`:
- REMOVE the line `"emptyFiltered": "Տրված զտիչներով սարքեր չեն գտնվել",`
- ADD after `"emptyDesc":`:
```json
"emptyDescFiltered": "Փորձեք փոխել ֆիլտրը կամ որոնման հարցումը։",
"emptyReset": "Զրոյացնել ֆիլտրերը",
```

- [ ] **Step 1.6: Run locale-sync test to verify all three locales are in parity**

```
npx vitest run src/locales/localesSync.test.ts
```

Expected: All tests PASS. If any test fails due to key mismatch between ru/en/hy, fix the inconsistency before continuing.

---

### Task 2: EmployeesPage — add filtered/empty split

**Files:**
- Modify: `src/pages/employees/EmployeesPage.tsx`

The current empty state (lines 135–141) uses a custom `<div className="flex-1 flex items-center justify-center">` wrapper around `<EmptyState>`. The reference AssetsPage does NOT add this extra wrapper — the `EmptyState` component itself handles centering. However, looking at the page structure, `renderTableRegion()` is placed inside `<div className="h-full max-md:h-auto ...">` which is a flex container, so we keep the wrapper to maintain the same layout behavior as the existing code.

- [ ] **Step 2.1: Add hasActiveFilters and handleReset to EmployeesPage**

After line 83 (destructuring from `data`), insert:

```tsx
const hasActiveFilters =
  query.status !== DEFAULT_QUERY.status ||
  query.branchId !== DEFAULT_QUERY.branchId ||
  query.departmentId !== DEFAULT_QUERY.departmentId ||
  search.trim() !== ''

const handleReset = useCallback(() => {
  data.setQuery({ ...DEFAULT_QUERY })
  setSearch('')
  setPage(1)
}, [data, setSearch, setPage])
```

Then update `renderTableRegion()` — replace lines 135–141:

```tsx
// OLD:
if (sorted.length === 0) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <EmptyState icon="users" title={t('empty.title')} description={t('empty.desc')} />
    </div>
  )
}

// NEW:
if (sorted.length === 0) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <EmptyState
        icon={hasActiveFilters ? 'search-x' : 'users'}
        title={t(hasActiveFilters ? 'empty.titleFiltered' : 'empty.titleEmpty')}
        description={t(hasActiveFilters ? 'empty.descFiltered' : 'empty.descEmpty')}
        action={
          hasActiveFilters ? (
            <Btn variant="primary" size="sm" onClick={handleReset}>
              <Icon name="rotate-ccw" size={13} />
              {t('empty.reset')}
            </Btn>
          ) : undefined
        }
      />
    </div>
  )
}
```

Note: Check `useEmployeesData` to confirm `setQuery` is exposed. Looking at `useEmployeesData.ts` line 76: `const [query, setQuery] = useState<EmployeeListQuery>({ ...DEFAULT_QUERY })` — so `data.setQuery` exists. Also confirm `DEFAULT_QUERY` is importable at the page level (it is, from `'./employeesHelpers'`).

Since `setSearch` and `setPage` are destructured from `data`, in the `handleReset` callback use them directly. Adjust the `data` object reference accordingly — look at line 79 of EmployeesPage:
```tsx
const { loading, error, sorted, query, search, setSearch, page, setPage, ... } = data
```
So `setSearch` and `setPage` are at the page level. The `handleReset` needs `data.setQuery` (or we can add `setQuery` to the destructure). Check if `setQuery` is exported from `useEmployeesData`:

Looking at `useEmployeesData.ts` line 76, `setQuery` is a local `useState` setter. It needs to be returned from the hook for `EmployeesPage` to access it. Check what the hook returns. If `setQuery` is not returned, we need `handleQueryChange` with a full-reset call instead.

Looking at `EmployeesPage.tsx` line 83: the destructured items include `handleQueryChange`. So the reset is:
```tsx
const handleReset = useCallback(() => {
  handleQueryChange({ ...DEFAULT_QUERY })
  setSearch('')
  setPage(1)
}, [handleQueryChange, setSearch, setPage])
```

But `handleQueryChange` is `(patch: Partial<typeof query>) => void` — a patch. We need to reset to DEFAULT_QUERY entirely. Passing `{ ...DEFAULT_QUERY }` as the patch will work if the handler does `prev => ({ ...prev, ...patch })` — which will overwrite all keys.

- [ ] **Step 2.2: Run the build to verify no TypeScript errors**

```
npm run build
```

Expected: exits 0 (no errors). If `EmptyState` `action` prop is typed as `ReactNode`, passing `undefined` should be fine — the prop is optional.

---

### Task 3: DevicesTab — replace inline filtered text with EmptyState + reset

**Files:**
- Modify: `src/components/features/parts/DevicesTab.tsx`

Currently at lines 183–186, when `filtered.length === 0`, it shows a plain `<div>` with text. Replace with `<EmptyState>` and add reset logic.

- [ ] **Step 3.1: Import Btn and Icon in DevicesTab (if not already imported)**

At top of file, `Btn` and `Icon` are likely not imported since the file currently only uses `EmptyState` and `SearchInput`. Add:

```tsx
import { EmptyState, SearchInput, Btn, Icon } from '@/components/ui'
```

- [ ] **Step 3.2: Add hasActiveFilters and reset handler in DevicesTab**

After the `const filtered = useMemo(...)` block (around line 102), add:

```tsx
const hasActiveFilters = family !== 'all' || search.trim() !== ''

const handleReset = useCallback(() => {
  setFamily('all')
  onSearchChange('')
}, [onSearchChange])
```

- [ ] **Step 3.3: Replace the filtered empty state div with EmptyState**

Find (lines 183–187):
```tsx
{filtered.length === 0 ? (
  <div className="px-3 py-6 text-14 text-text-subtle text-center">
    {t('devices.emptyFiltered')}
  </div>
) : (
```

Replace with:
```tsx
{filtered.length === 0 ? (
  <div className="flex-1 flex items-center justify-center min-h-0 py-4">
    <EmptyState
      icon="search-x"
      title={t('devices.emptyTitle')}
      description={t('devices.emptyDescFiltered')}
      action={
        <Btn variant="primary" size="sm" onClick={handleReset}>
          <Icon name="rotate-ccw" size={13} />
          {t('devices.emptyReset')}
        </Btn>
      }
    />
  </div>
) : (
```

Note: We always show `search-x` + reset here because `filtered.length === 0` in this branch can ONLY happen when `hasActiveFilters` is true — if there are no filters, `filtered === partsAssets`, but `partsAssets.length === 0` is already handled by the early return at line 123 (which renders the truly-empty EmptyState with `icon="monitor"`). So no conditional needed for the filtered branch.

- [ ] **Step 3.4: Run build and locale-sync test**

```
npm run build
npx vitest run src/locales/localesSync.test.ts
```

Expected: both pass. The old `devices.emptyFiltered` key has been removed from all 3 locale files (Task 1, Step 1.5), and the component no longer references it.

---

### Task 4: AuditPage — add filtered/empty split

**Files:**
- Modify: `src/pages/audit/AuditPage.tsx`

- [ ] **Step 4.1: Add imports for Btn and Icon (if not already imported)**

Current imports: `ListCard, ListPageShell, EmptyState, TableSkeleton, ErrorState, CardListSkeleton`. Add `Btn, Icon`:
```tsx
import {
  ListCard, ListPageShell,
  EmptyState, TableSkeleton, ErrorState, CardListSkeleton,
  Btn, Icon,
} from '@/components/ui'
```

Also import `useCallback` (already imported: line 1 has `useState, useCallback`). Good.

- [ ] **Step 4.2: Add hasActiveFilters and handleReset**

After `const [query, setQuery] = useState<AuditLogQuery>({ ...DEFAULT_QUERY })` (line 31), add:

```tsx
const hasActiveFilters =
  query.entityType !== 'all' ||
  query.action !== 'all' ||
  query.actorUid !== 'all' ||
  (query.fromDate ?? null) !== null ||
  (query.toDate ?? null) !== null ||
  (query.search ?? '').trim() !== ''

const handleReset = useCallback(() => {
  setQuery({ ...DEFAULT_QUERY })
}, [])
```

- [ ] **Step 4.3: Update renderBody() empty state**

Replace lines 47–55:
```tsx
// OLD:
if (rows.length === 0) {
  return (
    <EmptyState
      icon="history"
      title={t('empty.title')}
      description={t('empty.desc')}
    />
  )
}

// NEW:
if (rows.length === 0) {
  return (
    <EmptyState
      icon={hasActiveFilters ? 'search-x' : 'history'}
      title={t(hasActiveFilters ? 'empty.titleFiltered' : 'empty.titleEmpty')}
      description={t(hasActiveFilters ? 'empty.descFiltered' : 'empty.descEmpty')}
      action={
        hasActiveFilters ? (
          <Btn variant="primary" size="sm" onClick={handleReset}>
            <Icon name="rotate-ccw" size={13} />
            {t('empty.reset')}
          </Btn>
        ) : undefined
      }
    />
  )
}
```

- [ ] **Step 4.4: Run build**

```
npm run build
```

Expected: exits 0.

---

### Task 5: WindowsKeysSection — replace custom markup with shared EmptyState

**Files:**
- Modify: `src/components/features/licenses/WindowsKeysSection.tsx`

- [ ] **Step 5.1: Add EmptyState and Btn, Icon to imports**

Current import (line 12): `import { Chip, Icon, DataTable, TabStrip, MobileListPlaceholders } from '@/components/ui'`

Add `EmptyState` and `Btn`:
```tsx
import { Chip, Icon, DataTable, TabStrip, MobileListPlaceholders, EmptyState, Btn } from '@/components/ui'
```

- [ ] **Step 5.2: Add hasActiveSearch and resetSearch handler**

After `const [filter, setFilter] = useState<KeyStatus>('in_use')` (line 103), add:

```tsx
const hasActiveSearch = search.trim() !== ''

const handleResetSearch = useCallback(() => {
  // WindowsKeysSection receives `search` from parent but does NOT own it.
  // There is no `onSearchChange` prop — the parent LicensesPage owns the search input.
  // We can't reset search from here without a callback prop.
  // Strategy: add an optional `onSearchReset` prop to the component.
}, [])
```

**Wait** — the `search` prop comes from the parent (LicensesPage). The component doesn't have an `onSearchChange` or `onClear` callback. We need to check what LicensesPage passes.

Look at `WindowsKeysSectionProps` (line 84): `search?: string` — read-only from child's perspective. The child can't clear it.

**Solution:** Add an optional `onSearchReset?: () => void` prop to `WindowsKeysSectionProps`. The parent (LicensesPage) passes it as a callback to clear the search. If the prop is omitted, the reset button is hidden even when there's a search.

Check `src/pages/licenses/LicensesPage.tsx` to see how `search` is managed there.

- [ ] **Step 5.3: Check LicensesPage to understand the search state**

Read `src/pages/licenses/LicensesPage.tsx` to find the search state and its setter. Then wire `onSearchReset`.

If LicensesPage has `const [search, setSearch] = useState('')` and passes `search={search}` to `WindowsKeysSection`, we add `onSearchReset={() => setSearch('')}` to the JSX call.

- [ ] **Step 5.4: Add onSearchReset prop to WindowsKeysSectionProps**

In `src/components/features/licenses/WindowsKeysSection.tsx`, update the interface:

```tsx
export interface WindowsKeysSectionProps {
  // ...existing props...
  search?: string
  /** Called when the user clicks «Reset filters» in the filtered empty state */
  onSearchReset?: () => void
  onActivated?: () => void
}
```

Destructure it in the function:
```tsx
export function WindowsKeysSection({
  // ...existing destructures...
  search = '',
  onSearchReset,
  onActivated,
}: WindowsKeysSectionProps) {
```

- [ ] **Step 5.5: Replace the custom inline markup with EmptyState**

Find lines 327–335:
```tsx
{rows.length === 0 ? (
  /* flex-1 keeps the empty state vertically centered in the stretched card */
  <div className="flex flex-col items-center justify-center px-6 py-12 text-center flex-1">
    <span className="w-12 h-12 rounded-xl bg-surface-2 text-text-subtle inline-flex items-center justify-center mb-3">
      <Icon name="key-round" size={20} />
    </span>
    <p className="text-14.5 font-semibold text-text-primary mb-1">{t('keys.emptyTitle')}</p>
    <p className="text-13 text-text-tertiary">{t('keys.emptyDesc')}</p>
  </div>
) : (
```

Replace with:
```tsx
{rows.length === 0 ? (
  /* flex-1 keeps the empty state vertically centered in the stretched card */
  <div className="flex flex-1 items-center justify-center">
    <EmptyState
      icon={hasActiveSearch ? 'search-x' : 'key-round'}
      title={t(hasActiveSearch ? 'keys.emptyTitleFiltered' : 'keys.emptyTitle')}
      description={t(hasActiveSearch ? 'keys.emptyDescFiltered' : 'keys.emptyDesc')}
      action={
        hasActiveSearch && onSearchReset ? (
          <Btn variant="primary" size="sm" onClick={onSearchReset}>
            <Icon name="rotate-ccw" size={13} />
            {t('keys.emptyReset')}
          </Btn>
        ) : undefined
      }
    />
  </div>
) : (
```

Note: The `filter` tab (in_use/free) alone is NOT treated as a filter-active condition for the empty state. Switching between in_use/free tabs shows "truly empty" for that tab (no reset button). Only the `search` triggers "filtered" mode.

- [ ] **Step 5.6: Wire onSearchReset in LicensesPage**

Open `src/pages/licenses/LicensesPage.tsx`. Find the `<WindowsKeysSection>` JSX call and add:
```tsx
onSearchReset={() => setSearch('')}
```

(Confirm that `setSearch` exists in LicensesPage. If LicensesPage does not manage search state locally but receives it from a parent or a URL query, adjust accordingly.)

- [ ] **Step 5.7: Run build**

```
npm run build
```

Expected: exits 0.

---

### Task 6: RolesPage — add filtered/empty split + reset button

**Files:**
- Modify: `src/pages/catalogs/RolesPage.tsx`

- [ ] **Step 6.1: Add Btn to imports**

Current import (line 9): `import { Btn, Icon, EmptyState, TableSkeleton, ErrorState, Field, Select, Input, ... } from '@/components/ui'`

`Btn` and `Icon` are already imported. Good — no change needed.

- [ ] **Step 6.2: Add hasActiveFilters and handleReset**

After `const [page, setPage] = useState(1)` (around line 224), add:

```tsx
const hasActiveFilters = search.trim() !== '' || roleFilter !== 'all' || statusFilter !== 'all'

const handleReset = useCallback(() => {
  setSearch('')
  setRoleFilter('all')
  setStatusFilter('all')
  setPage(1)
}, [])
```

- [ ] **Step 6.3: Update renderBody() empty state**

Replace line 300:
```tsx
// OLD:
if (filtered.length === 0) return <EmptyState icon="shield-check" title={t('empty.title')} description={t('empty.desc')} />

// NEW:
if (filtered.length === 0) return (
  <EmptyState
    icon={hasActiveFilters ? 'search-x' : 'shield-check'}
    title={t(hasActiveFilters ? 'empty.titleFiltered' : 'empty.titleEmpty')}
    description={t(hasActiveFilters ? 'empty.descFiltered' : 'empty.descEmpty')}
    action={
      hasActiveFilters ? (
        <Btn variant="primary" size="sm" onClick={handleReset}>
          <Icon name="rotate-ccw" size={13} />
          {t('empty.reset')}
        </Btn>
      ) : undefined
    }
  />
)
```

Note: `Btn` must be imported. Check line 9 — it is already imported.

- [ ] **Step 6.4: Run build**

```
npm run build
```

Expected: exits 0.

---

### Task 7: Final verification

- [ ] **Step 7.1: Full build**

```
npm run build
```

Expected: exits 0 — clean TypeScript compilation. If errors appear, fix before proceeding.

- [ ] **Step 7.2: Run all relevant tests**

```
npx vitest run src/pages src/components/features src/locales
```

Expected: all tests PASS. Pay attention to:
- `localesSync.test.ts` — all key-parity tests across ru/en/hy
- `audit namespace — empty.title value differs across all three locales` — this asserts `empty.title` (kept intact) so still passes
- Any page tests that assert empty-state text

If a test asserts a specific empty state string that has now changed (e.g., it asserted `'empty.title'` text and the component now uses `'empty.titleEmpty'`), update the test to use the new key's resolved value (or update the test to target `'empty.titleFiltered'` / `'empty.titleEmpty'` as appropriate).

- [ ] **Step 7.3: Verify LicensesPage compiles with the new `onSearchReset` prop**

This is covered by the build step, but double-check that `WindowsKeysSection` is referenced in LicensesPage with `onSearchReset` wired.

---

## Self-Review Checklist

### Spec Coverage
- [x] EmployeesPage: filtered (search-x + reset) + truly-empty (users icon, no reset) ✓
- [x] DevicesTab: filtered (search-x + reset) + truly-empty already handled (early return with `monitor` icon) ✓
- [x] AuditPage: filtered (search-x + reset) + truly-empty (history icon, no reset) ✓
- [x] WindowsKeysSection: custom markup → shared EmptyState; search-filtered vs tab-truly-empty ✓
- [x] RolesPage: has search + filters → filtered (search-x + reset) + truly-empty ✓
- [x] SubscriptionsSection: already uses EmptyState + no filter state → leave as-is ✓
- [x] BranchesPage, DepartmentsPage, CategoriesPage: already use shared EmptyState → leave as-is ✓
- [x] WarehouseSkuList: specialized UI; noted and intentionally skipped per spec ✓
- [x] MyActsPage: already uses EmptyState → leave as-is ✓
- [x] All 3 locale files updated per namespace ✓
- [x] Old keys preserved (no key removal except `devices.emptyFiltered` → removed from all 3) ✓

### Potential issues
1. **`data.setQuery` in EmployeesPage**: Confirmed `handleQueryChange` is available and is a patch function. Reset patch = `{ ...DEFAULT_QUERY }` works.
2. **`exactOptionalPropertyTypes`**: `EmptyState`'s `action` prop must be typed as `ReactNode | undefined`. Using `action={undefined}` (via ternary) is correct and safe. If prop is typed `action?: ReactNode` (optional, not `action?: ReactNode | undefined`), the conditional spread idiom may be needed. Check `empty-state.tsx`: `action?: ReactNode` — this is fine, passing `undefined` explicitly matches.
3. **DevicesTab `onSearchChange` prop**: DevicesTab receives `onSearchChange` from parent (PartsPage). The reset calls `onSearchChange('')` which lifts the clear up correctly.
4. **WindowsKeysSection `onSearchReset`**: Optional prop; if parent doesn't pass it, no reset button appears. This is safe.
5. **localesSync test for parts**: `devices.emptyFiltered` removed from all 3 files simultaneously — test will pass since it only checks ru = en = hy parity.
