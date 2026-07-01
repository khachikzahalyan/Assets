# Asset Category Taxonomy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Each task is dispatched to the named AMS specialist subagent (which has full codebase access and follows TDD). Steps use checkbox (`- [ ]`) syntax for tracking. Run `npx tsc -b` + `npm test` + `npm run build` green before completing each task.

**Goal:** Make `/categories` the two-level control surface (Категория → Подкатегория) for the asset taxonomy used by `/assets/new`, with full CRUD on both levels and a new creatable top level (e.g. «Самокат»).

**Architecture:** Introduce a new `CategoryGroup` entity (the top level, UI «Категория») in a `categoryGroups` collection. Keep the existing `Category` entity (UI «Подкатегория») and repurpose its `group` field as the inherited capability **behavior class** while adding a `categoryGroupId` FK for display grouping. The capability engine (`categoryCapabilities.ts`) is untouched. Seed 3 groups with `id === behavior` so no asset migration is needed.

**Tech Stack:** React 19 + Vite + TS (strict, exactOptionalPropertyTypes), Tailwind + semantic tokens, Firebase/Firestore via repository pattern, i18next (ru/en/hy), Vitest. Reference spec: `docs/superpowers/specs/2026-06-30-asset-category-taxonomy-design.md`.

---

## File Structure

**Create:**
- `src/domain/category/categoryGroup-types.ts` — `CategoryGroup`, `CategoryGroupBehavior`.
- `src/domain/category/CategoryGroupRepository.ts` — port + input types.
- `src/infra/repositories/inMemoryCategoryGroupRepository.ts` — in-memory adapter.
- `src/infra/repositories/firestoreCategoryGroupRepository.ts` — Firestore adapter.
- `src/components/features/categories/CategoryGroupFormDialog.tsx` — top-level create/edit dialog.
- `src/components/features/categories/CategoryGroupChips.tsx` — chip filter row with per-chip edit/delete + add.
- `scripts/migrate-category-groups.ts` — seed groups + backfill `categoryGroupId`.
- Test files mirroring each (`*.test.ts(x)`).

**Modify:**
- `src/domain/category/types.ts` — add `categoryGroupId` to `Category`; export new types via index.
- `src/domain/category/index.ts` (barrel) — re-export new entity + port.
- `src/domain/category/CategoryRepository.ts` — add `categoryGroupId` to create/update inputs; add `categoryGroupId` filter to `CategoryListQuery`.
- `src/infra/repositories/firestoreCategoryRepository.ts` + `inMemoryCategoryRepository.ts` — persist/read/filter `categoryGroupId`; set inherited `group` from parent behavior on create.
- `src/infra/repositories/index.ts` (barrel) — export new adapters.
- `src/pages/catalogs/CategoriesPage.tsx` — chips + subcategory table; two add flows; group-scoped state.
- `src/components/features/categories/CategoryFormDialog.tsx` — drop the group `Select`; take `categoryGroupId` from selected chip.
- `src/components/features/assets/create/GroupTabs.tsx` (+ `AssetCreateForm.tsx` wiring) — render `CategoryGroup` rows; pass selected `categoryGroupId` to `CategoryPicker`.
- `src/components/features/assets/create/CategoryPicker.tsx` — filter by `categoryGroupId` instead of behavior `group`.
- `src/pages/assets/AssetCreatePage.tsx` — load `categoryGroups` ref data.
- i18n: `src/locales/{ru,en,hy}/categories.json` (+ new keys / `categoryGroups`).
- `scripts/seed/referenceData.ts` — seed `categoryGroups`; tag seed categories with `categoryGroupId`.

---

## Task 1 — Domain: `CategoryGroup` entity + port  (subagent: **domain-modeler**)

**Files:**
- Create: `src/domain/category/categoryGroup-types.ts`, `src/domain/category/CategoryGroupRepository.ts`
- Modify: `src/domain/category/types.ts`, `src/domain/category/CategoryRepository.ts`, `src/domain/category/index.ts`
- Test: `src/domain/category/categoryGroup-types.test.ts`

- [ ] **Step 1 — Write failing test** for the new types/contract:

```ts
// categoryGroup-types.test.ts
import { describe, it, expect } from 'vitest'
import { CATEGORY_GROUP_BEHAVIORS, isCategoryGroupBehavior } from './categoryGroup-types'

describe('CategoryGroupBehavior', () => {
  it('lists the three behavior classes', () => {
    expect(CATEGORY_GROUP_BEHAVIORS).toEqual(['devices', 'network', 'furniture'])
  })
  it('guards behavior strings', () => {
    expect(isCategoryGroupBehavior('devices')).toBe(true)
    expect(isCategoryGroupBehavior('samokat')).toBe(false)
  })
})
```

- [ ] **Step 2 — Run:** `npx vitest run src/domain/category/categoryGroup-types.test.ts` → FAIL (module missing).

- [ ] **Step 3 — Implement** `categoryGroup-types.ts`:

```ts
export const CATEGORY_GROUP_BEHAVIORS = ['devices', 'network', 'furniture'] as const
export type CategoryGroupBehavior = (typeof CATEGORY_GROUP_BEHAVIORS)[number]

export function isCategoryGroupBehavior(v: string): v is CategoryGroupBehavior {
  return (CATEGORY_GROUP_BEHAVIORS as readonly string[]).includes(v)
}

export interface CategoryGroup {
  id: string
  name: string
  behavior: CategoryGroupBehavior   // capability class; default 'devices' for new groups
  lucideIcon: string
  color: string                     // token name, e.g. 'blue' | 'green' | 'amber' | 'gray'
  order: number
  createdAt: string
  updatedAt: string
}
```

  And `CategoryGroupRepository.ts`:

```ts
import type { CategoryGroup, CategoryGroupBehavior } from './categoryGroup-types'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'

export interface CreateCategoryGroupInput {
  name: string
  behavior?: CategoryGroupBehavior  // defaults to 'devices'
  lucideIcon?: string
  color?: string
  order?: number
}
export interface UpdateCategoryGroupInput {
  name?: string
  behavior?: CategoryGroupBehavior
  lucideIcon?: string
  color?: string
  order?: number
}

export interface CategoryGroupRepository {
  listCategoryGroups(): Promise<CategoryGroup[]>            // sorted by order, then name
  getCategoryGroup(id: string): Promise<CategoryGroup | null>
  isNameTaken(name: string, exceptId?: string): Promise<boolean>
  /** Count of subcategories (categories) whose categoryGroupId === id. Gates delete. */
  countReferences(id: string): Promise<number>
  createCategoryGroup(input: CreateCategoryGroupInput, actor: Actor): Promise<AuditedResult<CategoryGroup>>
  updateCategoryGroup(id: string, patch: UpdateCategoryGroupInput, actor: Actor): Promise<AuditedResult<CategoryGroup>>
  deleteCategoryGroup(id: string, actor: Actor): Promise<AuditedResult<{ id: string }>>
}
```

- [ ] **Step 4 — Modify `Category` + `CategoryRepository`:** add `categoryGroupId: string` to `Category` (in `types.ts`), add optional `categoryGroupId?: string` to `CreateCategoryInput`/`UpdateCategoryInput`, and add `categoryGroupId?: string` to `CategoryListQuery`. Keep `group` field as-is. Re-export `CategoryGroup`, `CategoryGroupRepository`, and the new input types from `src/domain/category/index.ts`.

- [ ] **Step 5 — Run:** `npx vitest run src/domain/category/categoryGroup-types.test.ts` → PASS; `npx tsc -b` → clean. **Commit** `feat(domain): add CategoryGroup entity + port; Category.categoryGroupId`.

**Acceptance:** new types compile; `Category` carries `categoryGroupId`; capability engine and `Category.group` untouched.

---

## Task 2 — Infra: CategoryGroup adapters + Category wiring  (subagent: **firebase-engineer**)

**Files:**
- Create: `src/infra/repositories/inMemoryCategoryGroupRepository.ts`, `src/infra/repositories/firestoreCategoryGroupRepository.ts`
- Modify: `src/infra/repositories/inMemoryCategoryRepository.ts`, `firestoreCategoryRepository.ts`, `src/infra/repositories/index.ts`
- Test: `src/infra/repositories/inMemoryCategoryGroupRepository.test.ts`, `firestoreCategoryGroupRepository.test.ts`, and extend `inMemoryCategoryRepository.test.ts`

- [ ] **Step 1 — Write failing in-memory repo test** covering: list sorted by order; create defaults `behavior:'devices'`; `isNameTaken`; `countReferences` counts subcategories with matching `categoryGroupId`; delete blocked (`EntityInUseError`) when subcategories exist; audited via `withAudit` (`entityType: 'categoryGroup'`).

```ts
// inMemoryCategoryGroupRepository.test.ts (key cases)
const actor = { uid: 'u1', role: 'super_admin' as const }
it('blocks delete when subcategories reference the group', async () => {
  const repo = new InMemoryCategoryGroupRepository(
    [{ id: 'devices', name: 'Устройства', behavior: 'devices', lucideIcon: 'cpu', color: 'blue', order: 0, createdAt: 'x', updatedAt: 'x' }],
    { categories: [{ categoryGroupId: 'devices' }] },
  )
  await expect(repo.deleteCategoryGroup('devices', actor)).rejects.toBeInstanceOf(EntityInUseError)
})
it('defaults new group behavior to devices', async () => {
  const repo = new InMemoryCategoryGroupRepository([], {})
  const { value } = await repo.createCategoryGroup({ name: 'Самокат' }, actor)
  expect(value.behavior).toBe('devices')
})
```

- [ ] **Step 2 — Run** the new test → FAIL.

- [ ] **Step 3 — Implement `InMemoryCategoryGroupRepository`** mirroring `InMemoryCategoryRepository` (constructor takes `(groups, refs, audit)` where `refs.categories: { categoryGroupId?: string }[]`; `countReferences` filters those). `createCategoryGroup` fills `behavior ?? 'devices'`, `lucideIcon ?? 'package'`, `color ?? 'gray'`, `order ?? groups.length`, id `grp_<rand>`. Audit `entityType: 'categoryGroup'`.

- [ ] **Step 4 — Implement `FirestoreCategoryGroupRepository`** mirroring `FirestoreCategoryRepository` against collection `categoryGroups`; `countReferences` = `anyWhere('categories', 'categoryGroupId', id)` (return real count via `getCountFromServer` if used elsewhere, else the existing `limit(1)` 0/1 pattern is acceptable for the delete guard). Audit `entityType: 'categoryGroup'`.

- [ ] **Step 5 — Wire `Category` adapters:** persist + read `categoryGroupId` in `toCategory`/create/update (in-memory + firestore). On `createCategory`, if `categoryGroupId` is provided, set `group` = the parent group's behavior (the page passes both; repo stores what it's given — keep repos dumb: the **page/caller** computes `group` from the selected chip's behavior and passes both `categoryGroupId` and `group`). Add `categoryGroupId` filtering to `listCategories`.

- [ ] **Step 6 — Run** all repo tests + `npx tsc -b` → clean. **Commit** `feat(infra): CategoryGroup adapters + Category.categoryGroupId persistence`.

**Acceptance:** both adapters pass parity tests; delete guard works; `categoryGroupId` round-trips; export from barrel.

---

## Task 3 — Seed + migration  (subagent: **data-migration-engineer**)

**Files:**
- Modify: `scripts/seed/referenceData.ts`
- Create: `scripts/migrate-category-groups.ts`, test `scripts/migrate-category-groups.test.ts` (if scripts are tested; else a dry-run guard)

- [ ] **Step 1 — Seed source:** in `referenceData.ts` add a `CATEGORY_GROUP_SEED` of 3 docs with **id === behavior**: `devices`→«Устройства», `network`→«Сетевые устройства», `furniture`→«Мебель» (icons/colors matching current `GROUP_CHIP`: devices=blue, network=green, furniture=amber; order 0/1/2). Tag every seeded category with `categoryGroupId = <its group>` (the seed already knows each category's group via `ALL_CATEGORY_SOURCE`).

- [ ] **Step 2 — Migration script** `migrate-category-groups.ts` (model on existing `scripts/` migrations: `--expect-project asset-ams`, dry-run default, `--confirm` to write, idempotent):
  1. For each of the 3 behaviors, upsert `categoryGroups/<behavior>` if missing.
  2. For each doc in `categories` lacking `categoryGroupId`, set `categoryGroupId = group`.
  3. Print a summary (created groups, updated categories, skipped).

- [ ] **Step 3 — Verify** dry-run prints intended changes; re-running after `--confirm` reports 0 changes (idempotent). Add npm script `"migrate:category-groups"`.

- [ ] **Step 4 — Commit** `feat(scripts): seed categoryGroups + backfill categoryGroupId migration`.

**Acceptance:** seed produces 3 groups + tagged categories; migration idempotent; no asset docs touched.

---

## Task 4 — `/categories` page redesign  (subagent: **react-ui-engineer**)

**Files:**
- Create: `src/components/features/categories/CategoryGroupFormDialog.tsx`, `CategoryGroupChips.tsx`
- Modify: `src/pages/catalogs/CategoriesPage.tsx`, `src/components/features/categories/CategoryFormDialog.tsx`, `src/components/features/categories/index.ts`
- Test: `src/pages/catalogs/CategoriesPage.test.tsx` (extend), `CategoryGroupFormDialog.test.tsx`

- [ ] **Step 1 — `CategoryGroupChips`:** horizontal chip row, one per `CategoryGroup` (icon + name + subcategory count), uniform **accent** for the selected chip (per `feedback_uniform_accent_selection` — NO per-chip rainbow), hover reveals ✎/🗑, trailing «+ Добавить категорию». Props: `groups`, `counts: Record<id, number>`, `selectedId`, `onSelect`, `onEdit`, `onDelete`, `onAdd`, `canMutate`. Matches the Image #26 visual.

- [ ] **Step 2 — `CategoryGroupFormDialog`:** create/edit top category. Fields: name (required, red-border-on-empty per app convention, NOT a hint string), icon. Behavior is NOT shown (defaults devices). Mobile = bottom-sheet (`DIALOG_BACKDROP` + `MODAL_SHEET`, `max-md:items-end`) per `feedback_mobile_modals_bottom_sheet`. Mirror existing `CategoryFormDialog` structure.

- [ ] **Step 3 — `CategoryFormDialog` edit:** remove the group `Select` block; the dialog no longer owns group. It receives the active `categoryGroupId` (+ that group's `behavior`) from the page and returns it in `CategoryFormValues` so the page can pass both `categoryGroupId` and `group=behavior` to the repo.

- [ ] **Step 4 — `CategoriesPage` rewire:** load both `categoryGroups` and `categories`; state `selectedGroupId` (default first group); chips on top; table = categories filtered by `selectedGroupId` (drop the «Группа» column; keep «Подкатегория» + «Характеристики»); table «+ Добавить подкатегорию» creates under `selectedGroupId`. Delete guards: subcategory via `CategoryRepository.countReferences`; group via `CategoryGroupRepository.countReferences` (blocked message «есть подкатегории»). Keep `ListPageShell`+`ListCard`, `PAGE_SIZE = 10`, skeletons, mobile bottom-sheets. Accept optional `categoryGroupRepository` prop for tests (default `FirestoreCategoryGroupRepository`).

- [ ] **Step 5 — Tests:** render with in-memory repos; assert chips render with counts; selecting a chip filters the table; add-category opens group dialog and creates; add-subcategory creates under the selected group; deleting a non-empty group is blocked with the in-use message; deleting an in-use subcategory is blocked. Mobile (`matchMedia` 767) shows bottom-sheet.

- [ ] **Step 6 — Run** page tests + `npx tsc -b` + `npm run build` → green. **Commit** `feat(categories): two-level Категория→Подкатегория control page`.

**Acceptance:** page matches the approved mock; both CRUD flows + both delete guards work; desktop + mobile; uniform accent selection.

---

## Task 5 — `/assets/new` dynamic groups  (subagent: **react-ui-engineer**)

**Files:**
- Modify: `src/components/features/assets/create/GroupTabs.tsx`, `CategoryPicker.tsx`, `AssetCreateForm.tsx`, `src/pages/assets/AssetCreatePage.tsx`
- Test: `src/components/features/assets/create/AssetCreateForm.caps.test.tsx` (extend), new `AssetCreateForm.dynamicGroups.test.tsx`

- [ ] **Step 1 — Load groups:** `AssetCreatePage` loads `CategoryGroup[]` (via `FirestoreCategoryGroupRepository`) alongside categories; pass to the form. Provide a test seam (prop/loader) like the existing `loadRefData`.

- [ ] **Step 2 — `GroupTabs`:** render from the loaded `CategoryGroup[]` (id/name/icon) instead of the hard-coded 3; selecting a tab sets `categoryGroupId`. Keep uniform accent for the active tab.

- [ ] **Step 3 — `CategoryPicker`:** change the `group` prop to accept the selected `categoryGroupId` and filter `categories` by `c.categoryGroupId === categoryGroupId` (instead of `c.group === group`). Capability resolution stays on the **picked subcategory's** `group` (behavior) — unchanged.

- [ ] **Step 4 — Tests:** with a seeded custom group «Самокат» (behavior devices) + subcategory «2-колёсная», the «Самокат» tab appears, the picker lists «2-колёсная», and the resolved capabilities are device-like (serial required, no specs panel). Existing caps tests for Компьютер/Ноутбук/Мебель stay green.

- [ ] **Step 5 — Run** asset-create tests + `npx tsc -b` + `npm run build` → green. **Commit** `feat(assets): /assets/new reads dynamic category groups`.

**Acceptance:** new top categories + subcategories created on `/categories` appear in `/assets/new`; capabilities unchanged for seeded categories.

---

## Task 6 — i18n + final review  (subagents: **i18n-engineer**, then **spec-reviewer** → **code-quality-reviewer** → **security-reviewer**)

**Files:**
- Modify: `src/locales/{ru,en,hy}/categories.json`
- Test: locale parity test (existing)

- [ ] **Step 1 — i18n keys** for: «Категория»/«Подкатегория» titles, «+ Добавить категорию», «+ Добавить подкатегорию», group dialog labels, delete-in-use messages (group has subcategories). Add to ru/en/hy; keep the 3 seed group display names matching current `group.*` values.

- [ ] **Step 2 — Run** locale parity test + full suite `npm test` + `npx tsc -b` + `npm run build` → all green.

- [ ] **Step 3 — Reviews:** dispatch **spec-reviewer** (matches this spec, no scope creep — `/assets` list untouched, no `Category`→`Subcategory` rename), then **code-quality-reviewer** (≤300 lines/file, no `any`, repository pattern, tokens, uniform accent, audit-helper invocation), then **security-reviewer** (new `categoryGroups` collection → firestore.rules: super_admin write, authenticated read like `categories`; audit immutability).

- [ ] **Step 4 — Firestore rules:** add `categoryGroups` rules mirroring `categories`. Deploy note for the owner (rules deploy is a separate `firebase deploy` step the owner runs or authorizes).

- [ ] **Step 5 — Commit** `feat(i18n): category taxonomy strings` + `chore(rules): categoryGroups security rules`.

**Acceptance:** all reviews pass; full suite + build green; rules cover the new collection.

---

## Self-Review (author)

- **Spec coverage:** data model (T1/T2), migration (T3), `/categories` page incl. both delete guards (T4), `/assets/new` rewiring (T5), capability engine untouched (T1/T5), i18n + rules + reviews (T6), `/assets` list explicitly out of scope. ✓
- **Type consistency:** `CategoryGroup`, `CategoryGroupBehavior`, `categoryGroupId`, `CategoryGroupRepository.countReferences`, `entityType:'categoryGroup'` used consistently across tasks. ✓
- **Behavior/group invariant:** subcategory `group` (behavior) is set by the caller from the parent chip's `behavior`; capability engine keeps reading `group`. Seed ids === behavior so existing data is correct without value changes. ✓
- **Risks:** firestore.rules for the new collection (T6 S4); GroupTabs/CategoryPicker prop rename ripple (T5 — covered by tests); ensure `/assets` list filter still compiles unchanged (behavior-based). ✓
