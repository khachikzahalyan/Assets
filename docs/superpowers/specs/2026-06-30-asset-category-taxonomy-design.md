# Asset Category Taxonomy — two-level, fully CRUD-able

**Date:** 2026-06-30
**Status:** Approved (design); ready for implementation plan
**Scope:** `/categories` page becomes the single control surface for the asset
taxonomy used by `/assets/new`. Two levels — **Категория** (top) and
**Подкатегория** (bottom) — both fully CRUD-able.

## Problem

Today `/categories` is a flat list of 25 "categories" (Компьютер, Ноутбук, …),
each tagged with a hard-coded `group` ∈ `{devices, network, furniture}` shown as a
table column ("Группа"). The owner wants `/categories` to be the place to control
**everything that `/assets/new` offers**: add a whole new top category (e.g.
«Самокат»), and add items under it (e.g. «2-колёсная», «4-колёсная»), or add a new
item under an existing one (e.g. «GoogleStreamer» under «Устройства»). The current
top level (`group`) is a fixed enum and cannot be extended.

## Terminology mapping (UI ⇄ code)

| UI term (owner)            | Code today                          | Code after                       |
| -------------------------- | ----------------------------------- | -------------------------------- |
| **Категория** (top chips)  | `group` enum (devices/network/furn) | new entity `CategoryGroup`       |
| **Подкатегория** (rows)    | existing `Category` entity          | `Category` (unchanged name)      |

We deliberately **do not** rename the existing `Category` entity to `Subcategory`:
it is referenced across the domain, repos, capability engine, `/assets`,
`/assets/new`, and ~hundreds of tests. Renaming is high-churn and regression-prone.
Instead the top level is introduced as a new `CategoryGroup` entity. The UI labels
the existing `Category` as «Подкатегория» and `CategoryGroup` as «Категория».

## Key constraint: the capability engine stays untouched

`src/domain/asset/categoryCapabilities.ts` derives every form behavior (serial
required? specs panel? OEM license? furniture "Тип" field? network/server flags?
GPU?) from the **`group` behavior class** plus per-id sets
(`COMPUTER_CATEGORY_IDS`, `LAPTOP_CATEGORY_IDS`, `SERVER_CATEGORY_IDS`). This engine
**must not change**. Therefore `group` is repurposed as the **behavior class** of a
top category, not its display identity.

## Data model

### New entity: `CategoryGroup` (top level, UI «Категория»)

Firestore collection: `categoryGroups`.

```
interface CategoryGroup {
  id: string
  name: string                                  // display, e.g. "Устройства", "Самокат"
  behavior: 'devices' | 'network' | 'furniture' // capability class; default 'devices' for new
  lucideIcon: string
  color: string                                 // chip accent token name; default neutral
  order: number                                 // chip ordering
  createdAt: string
  updatedAt: string
}
```

Seed 3 rows with **id === behavior literal** so existing data needs no value change:

| id          | name                  | behavior    |
| ----------- | --------------------- | ----------- |
| `devices`   | Устройства            | `devices`   |
| `network`   | Сетевые устройства    | `network`   |
| `furniture` | Мебель                | `furniture` |

New top categories (e.g. «Самокат») get a generated id and `behavior: 'devices'`
by default (device-like = serial yes, specs no). Behavior is **not** exposed in the
v1 create form (YAGNI); all owner examples are device-like. The per-subcategory
`hasSpecs` checkbox already lets specs be turned on where needed.

### Changed entity: `Category` (bottom level, UI «Подкатегория»)

Firestore collection: `categories` (unchanged). Changes:

- **Add** `categoryGroupId: string` — FK to the parent `CategoryGroup`.
- **Keep** `group: 'devices' | 'network' | 'furniture'` — now interpreted as the
  **behavior class**, inherited from the parent on create. Drives capabilities
  exactly as today; for the 3 seeded groups the value is unchanged.
- All other fields (`name`, `hasSpecs`, `lucideIcon`, timestamps) unchanged.

On create, a subcategory inherits `group = parent.behavior`. If a subcategory is
moved to another parent, `group` is updated to the new parent's behavior.

### Assets

Asset documents are **not migrated**. An asset still references a subcategory via
`categoryId`. The asset's `CategoryRow.group` keeps feeding the capability engine
exactly as before.

## Migration (one-off script)

`scripts/` migration, dry-run + `--confirm`, `--expect-project asset-ams`:

1. Create the 3 `categoryGroups` docs (ids `devices`/`network`/`furniture`).
2. For every existing `categories` doc, set `categoryGroupId = group`.
3. No deletion of the `group` field (it remains as the behavior class).

Idempotent: re-running detects existing group docs / `categoryGroupId` and skips.

## `/categories` page redesign

- **Chip row (top) = Категории.** One chip per `CategoryGroup`: icon + name +
  subcategory count, matching the existing group-chip visual. Selecting a chip
  filters the table. Per-chip edit/delete (✎/🗑). A **«+ Добавить категорию»**
  button creates a new top category.
- **Table = Подкатегории** of the selected chip: columns «Подкатегория» (icon +
  name) and «Характеристики» (Да/Нет from `hasSpecs`), per-row ✎/🗑. The «Группа»
  column is **removed** (it is now the chip filter). A **«+ Добавить
  подкатегорию»** button creates a row under the selected chip.
- Pagination, skeletons, empty/error states reuse the existing list contract
  (`ListPageShell` + `ListCard`, `PAGE_SIZE = 10`). Mobile uses bottom-sheet forms
  per the app convention.
- **Delete guards:** deleting a subcategory is blocked when assets reference it
  (existing `countReferences`). Deleting a top category is blocked when it still has
  subcategories (new `countReferences` on `CategoryGroupRepository`).

### Two form dialogs

- `CategoryGroupFormDialog` — name + icon (+ color). Bottom-sheet on mobile.
- `CategoryFormDialog` (existing) — **drop the group `Select`**; `categoryGroupId`
  comes from the currently selected chip. Keep name, `hasSpecs`, icon.

## `/assets/new` rewiring (in scope)

- `GroupTabs` (the top group chooser) reads `CategoryGroup` rows from the repo
  instead of the hard-coded 3-value enum, so a new «Самокат» tab appears.
- `CategoryPicker` filters subcategories by the selected **`categoryGroupId`** (not
  by behavior), so «Самокат → 2-колёсная» appears under the «Самокат» tab.
- Capability resolution path is **unchanged** — it still reads the picked
  subcategory's `group` (behavior class), which is inherited from the parent.

## `/assets` list filter — OUT OF SCOPE (v1)

The owner scoped this to `/assets/new`. The `/assets` list group-filter chips
(`AssetsToolbar`, `AssetListQuery.group`, `AssetGroupFilter`) stay behavior-based
for now. A Самокат asset (behavior `devices`) is created and listed normally; it
just falls under the «Устройства» list filter until a follow-up makes that filter
group-driven. No change to the asset list in this effort.

## Repositories (ports + adapters)

- New `CategoryGroupRepository` port: `listCategoryGroups`, `getCategoryGroup`,
  `isNameTaken`, `countReferences` (subcategories with this `categoryGroupId`),
  `createCategoryGroup`, `updateCategoryGroup`, `deleteCategoryGroup`. Firestore +
  in-memory adapters, both audited via the existing audit helper.
- `CategoryRepository`: add `categoryGroupId` to create/update inputs; allow
  listing filtered by `categoryGroupId`; set `group` from the parent's behavior on
  create/move.

## i18n

- New `categoryGroups` namespace (or extend `categories`) for the new dialog +
  chip labels, in `ru` / `en` / `hy` with locale parity.
- Seeded group display names are data (Russian), not i18n keys, but the 3 seed
  names should match the current `group.*` translations for continuity.

## Testing

- `CategoryGroupRepository` in-memory + firestore-mock: CRUD, name-uniqueness,
  `countReferences` delete guard.
- `Category` repo: `categoryGroupId` wiring, behavior inheritance on create/move.
- `/categories` page: chip filter, two add flows, edit/delete, delete-guard
  messaging, mobile bottom-sheet.
- `/assets/new`: dynamic groups drive `GroupTabs` + `CategoryPicker`; capability
  flags still resolve correctly for seeded and brand-new categories.
- Migration script: dry-run output + idempotency.
- Locale parity test stays green.

## Out of scope (v1)

- Exposing the behavior class in the create-category form (new groups default to
  device-like). Add later only if a furniture-like or network-like custom group is
  needed.
- Renaming the `Category` entity to `Subcategory` in code.
- Third taxonomy level.
- Managing departments/positions/branches/parts from this page (separate effort).
- Making the `/assets` list group-filter chips data-driven (stays behavior-based).

## Rollout

Phased, tests green after each phase:

1. Domain: `CategoryGroup` entity + port; `Category` input changes.
2. Infra: in-memory + firestore adapters; seed source update.
3. Migration script (dry-run verified before `--confirm`).
4. `/categories` page redesign + two dialogs.
5. `/assets/new` + `/assets` dynamic-group rewiring.
6. i18n + full test pass + spec/quality/security review.
