# Category Groups (Phase 2) — managed groups — Design Spec

**Date:** 2026-06-29
**Status:** Design only (no code yet). Builds on Phase 1 (categories page grouped into sections, prefix removed).
**Owner terminology:** "Категория" = **group** (top level), "Подкатегория" = **category** (the current item).

> ⚠️ Implementation note: this touches the **Assets list group tabs** and other actively-edited files
> (`AssetsPage`, `AssetDetailPage`). DO NOT implement while a parallel session is editing those areas —
> wait until the tree is stable, then implement via a plan with strict per-task audit.

---

## 1. Goal

Today the 3 asset groups (`devices` / `network` / `furniture`) are a **hardcoded TypeScript union**. The owner
wants groups to be **managed in the UI** — add / rename / re-order them, choose an icon — and have everything that
currently keys off the 3 fixed groups (the `/categories` page sections, the **Assets list group tabs**) become
**data-driven**.

So: groups become a Firestore collection; sub-categories reference a `groupId`; the asset-list tabs are built from
the groups collection; the existing 3 groups are migrated into data.

## 2. Decisions (locked)

| Decision | Choice |
|---|---|
| Group entity fields | **name + icon (lucide) + order** |
| Icon selection | an **icon picker** (curated lucide set) in the group form — see §6 |
| Delete a group that has sub-categories | **Blocked** (same guard as deleting a category that has assets) |
| Asset-list group tabs | **Dynamic** — built from the groups collection (ordered), plus the «Все» tab |
| Sub-category → group link | sub-category stores `groupId: string` (replaces the `group` enum) |
| Capability flags | become **explicit per-sub-category fields** (no longer derived from the group) — see §7 |
| Group name language | **single language** (plain `name`, like sub-category names today) — not MultiLangInput (consistent with current category names; revisit later if needed) |

## 3. Data model

### 3.1 New collection `category_groups`
```
category_groups/{groupId}
  name:      string            // e.g. "Устройства"
  icon:      string            // lucide icon name, e.g. "monitor"
  order:     number            // sort order for sections + tabs (0,1,2,…)
  createdAt, updatedAt, createdBy, updatedBy
```
- `groupId` is an auto doc id. The 3 seeded groups keep stable ids `grp_devices` / `grp_network` / `grp_furniture`
  (so the migration is deterministic and assets/categories map cleanly).

### 3.2 `Category` (sub-category) change
- `group: 'devices'|'network'|'furniture'` → **`groupId: string`** (FK to `category_groups`).
- The `CategoryGroup` union type is **removed**. `AssetListQuery.group` becomes `groupId?: string` (or keep the name
  `group` but typed `string`; pick one and use consistently).

### 3.3 Capability flags move onto the sub-category (explicit)
- `hasSpecs`, `hasOemLicense`, `requiresSerial`, `hasTypeField` become **stored fields on the category doc**,
  set in the sub-category form (they're already stored after a prior backfill). The helper
  `deriveCategoryFlags(id, group)` (which derived them from the fixed group) is **removed** — flags are no longer
  derivable once groups are arbitrary. The sub-category form gets toggles for these (with sensible defaults).

## 4. Repositories (ports)

### 4.1 New `CategoryGroupRepository`
```
listGroups(): Promise<CategoryGroup[]>            // ordered by `order`, then name
getGroup(id): Promise<CategoryGroup | null>
createGroup(input, actor): Promise<CategoryGroup>  // name + icon + order; name unique
updateGroup(id, patch, actor): Promise<CategoryGroup>
deleteGroup(id, actor): Promise<void>              // throws EntityInUseError if any category has this groupId
isGroupNameTaken(name, exceptId?): Promise<boolean>
countCategories(groupId): Promise<number>          // gates delete
```
- Firestore + InMemory implementations, audited via `withAudit` (entityType: 'category_group').
- `CategoryRepository`: `createCategory`/`updateCategory` now take `groupId`; `listCategories` filter by `groupId`.

## 5. Migration (one-time backfill script)

`scripts/backfill-category-groups.ts` (mirror existing backfill scripts; admin SDK; `--dry-run`):
1. **Seed** the 3 groups into `category_groups` with fixed ids + names + icons + order:
   - `grp_devices` → { name: "Устройства", icon: "monitor", order: 0 }
   - `grp_network` → { name: "Сетевые устройства", icon: "network", order: 1 }
   - `grp_furniture` → { name: "Мебель", icon: "armchair", order: 2 }
   (idempotent: skip if already present)
2. **Migrate categories**: for each `categories/*` with the old `group` enum, set `groupId = grp_<group>` and remove
   the legacy `group` field (or leave it; reading code switches to `groupId`).
3. Capability flags already exist on category docs (prior backfill) — no change needed.
- Run once per environment before/with deploy. Existing assets reference `categoryId` (unchanged), so no asset migration.

## 6. UI — `/categories` page (the manager)

The page becomes a **2-level manager**:
- **Top level — Groups (Категории):** a list/section of the groups, each row shows its **icon + name + sub-category
  count**, with **edit / delete** (delete blocked when it has sub-categories) and a **«+ Категория»** button to add a group.
- **Under each group — its Sub-categories (Подкатегории):** the current category rows (name + capability chips) with
  edit/delete + a **«+ Подкатегория»** button scoped to that group.
- **Group form dialog** (`CategoryGroupFormDialog`): fields **name** + **icon picker** + (order auto or a simple
  up/down). The **icon picker** answers "как вставить иконку": a button showing the current icon that opens a small
  **grid/popover of curated lucide icons** (a fixed allow-list, e.g. monitor/laptop/network/router/armchair/box/printer/
  cpu/keyboard/… — reuse the icon registry in `src/components/ui/icon.tsx`). User clicks an icon to select it. (If the
  sub-category form already has a lucide icon field, reuse the SAME picker component for both.)
- **Sub-category form dialog**: name + **group selector** (dropdown of groups) + **icon** + the capability **toggles**
  (hasSpecs / hasOemLicense / requiresSerial / hasTypeField).
- Mobile: dialogs are bottom-sheets (per the app convention).

## 7. Assets list — dynamic group tabs

- The group tabs (currently «Все / Устройства / Сетевые / Мебель`) are rebuilt from `listGroups()` (ordered):
  `[Все, …groups by order]`. Each tab filters `AssetListQuery.groupId`.
- `groupCounts` becomes a map keyed by `groupId` (count assets whose category's `groupId` matches), computed over the
  loaded reference data (categories carry `groupId`; map category → group).
- The asset's group is resolved as `category(asset.categoryId).groupId`.
- Reference data (`loadReferenceData`) must now also load `category_groups` so the tabs + grouping resolve.

## 8. Firestore rules

```
match /category_groups/{id} {
  allow read:   if isSignedIn();           // any signed-in user (categories taxonomy is non-sensitive)
  allow write:  if isSuperAdmin();         // same as /categories (super_admin manages taxonomy)
}
```
(Match the existing `/categories` rule posture — currently super_admin-only writes.)

## 9. Error handling
- Delete a group with sub-categories → `EntityInUseError` → blocked dialog (reuse the category delete-guard pattern).
- Duplicate group name → name-taken error.
- A category whose `groupId` points to a deleted/missing group (shouldn't happen due to the delete-guard, but
  defensive): render under an «Без группы» fallback section; don't crash.

## 10. Testing
- `inMemoryCategoryGroupRepository` tests: create/list(order)/update/delete-blocked-when-in-use/name-unique.
- Category repo: create/update with `groupId`; list filter by `groupId`.
- Migration script: typecheck (`typecheck:scripts`); dry-run logic.
- Assets list: dynamic tabs render from groups; counts per group; filter by groupId.
- Rules test for `/category_groups` (if a rules harness exists).
- i18n: any new static labels (e.g. «Категория»/«Подкатегория»/«Все») in ru/en/hy.

## 11. Out of scope (later)
- Multi-language group/category names (MultiLangInput) — single-language for now.
- Re-ordering groups by drag-and-drop (start with a simple order field / up-down arrows).
- Per-group color theming of asset rows.

## 12. Risk / sequencing
- This touches `AssetsPage` (group tabs, counts) and reference-data loading — areas under active parallel editing.
  Implement only when the tree is stable. Suggested task order: (1) group domain+repo+rules, (2) migration script,
  (3) category `groupId` switch + repo, (4) `/categories` manager UI + icon picker, (5) dynamic asset tabs, (6) tests.
- Each step is independently testable; the dynamic-tabs step (5) is the riskiest (asset list) — do it last, audited.
