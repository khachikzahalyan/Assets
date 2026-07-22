# Dynamic Parts Categories (Вариант 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded 7-value `PartCategory` union (+ its ~125 scattered literals) with a Firestore-backed `part_categories/{id}` catalog dispatched by a `behavior` class, with Super-Admin management UI, while preserving byte-for-byte the current runtime behavior for the 7 existing ids.

**Architecture:** Mirror the asset-category pattern (`CategoryGroup.behavior` + capability engine): a first-class `PartCategoryDef` record carries display metadata (multi-lang name, icon, tint token, order) and a `behavior: 'single' | 'sized' | 'models'` class that replaces the id-based special-casing (`AGG_CATS`, `SINGLE_SLOT_CATS`, GPU-paths, DDR lists). A single canonical `DEFAULT_PART_CATEGORY_DEFS` array in the domain is the source for BOTH the idempotent seeder AND the runtime graceful fallback (catalog empty/not yet seeded → identical legacy behavior). Install-flow semantics that dispatch on ASSET FAMILIES (slotIsSingle per family, isServiceOnly, factory-slot synthesis, psu→battery on laptops) stay in code and are NOT touched.

**Tech Stack:** TypeScript strict, React 19 + Vite, Firebase Firestore (modular SDK v9+), ports-and-adapters repositories, `withAudit()` transactions, i18next (ru/en/hy), Vitest.

---

## HARD CONSTRAINTS (apply to every task and every subagent)

1. **NO git operations** (no add/commit/push) and **NO deploys** (no `firebase deploy`, no seeding runs). Editing `firestore.rules` and seed source files is allowed; the operator deploys/seeds afterwards.
2. **NO file editing via PowerShell/Bash redirection** (corrupts UTF-8 without BOM on this machine). Use ONLY the Read/Write/Edit tools.
3. **Backwards compatibility of ids:** the 7 existing category ids `psu, cooler, ssd, hdd, nvme, ram, gpu` NEVER change. Existing `parts` docs, `part_movements`, and `UpgradeSlot.kind` values need zero migration.
4. **Install-flow family semantics stay code:** `slotIsSingle` (per asset family), `isServiceOnly`, factory-slot synthesis, and the psu→battery remap on laptops are dispatched by ASSET FAMILY today — do not move that logic into data. The `familyOverrides` field is seeded as forward-looking data but is NOT consumed by Phase-2 code.
5. **`battery` is not a part category.** It is an installed-row visual kind only (never receivable). Its icon/tint entries remain code-side extensions.
6. After each phase: `npm run build` must pass (tsc -b is stricter than --noEmit; use conditional-spread for optional props under `exactOptionalPropertyTypes`).

## Known semantic trap (do NOT blindly follow the shorthand)

`SINGLE_SLOT_CATS` today = `{psu, cooler, gpu}` — "asset holds at most one". That is **NOT** `behavior === 'single'` (gpu is `models`). The correct derivation is `behavior !== 'sized'` (equivalently `'single' || 'models'`). A parity test MUST assert the derived set equals the legacy set for the 7 seeded ids.

---

## Data model (locked)

### `part_categories/{id}` — Firestore doc / `PartCategoryDef` domain type

New file `src/domain/part/partCategory-types.ts`:

```ts
import type { MultiLangText } from '@/domain/category/types' // reuse if exists; else { ru: string; en: string; hy: string }

export const PART_CATEGORY_BEHAVIORS = ['single', 'sized', 'models'] as const
export type PartCategoryBehavior = (typeof PART_CATEGORY_BEHAVIORS)[number]

export function isPartCategoryBehavior(v: string): v is PartCategoryBehavior {
  return (PART_CATEGORY_BEHAVIORS as readonly string[]).includes(v)
}

export interface PartCategoryVariant {
  id: string       // '64gb' … '5tb' / '4gb' … '128gb'
  label: string    // '64 ГБ' (display; capacity labels are locale-independent enough for MVP)
  order: number
}

/** First-class parts-warehouse category. Mirrors Firestore part_categories/{id}. */
export interface PartCategoryDef {
  id: string
  name: { ru: string; en: string; hy: string }   // Tier-2 multi-lang
  icon: string                                    // lucide icon name
  tintToken: string                               // 'amber'|'cyan'|'sky'|'emerald'|'violet'|'rose'... → class map stays code
  order: number
  behavior: PartCategoryBehavior                  // IMMUTABLE after creation (data class)
  slotKind: string                                // UpgradeSlot.kind target: 'psu'|'cooler'|'storage'|'ram'|'gpu'
  storageType: 'SSD' | 'HDD' | 'M.2' | null      // sized storage cats only; null otherwise
  /** Forward-looking data mirror of the code-side family remaps (e.g. psu→battery on laptops). NOT consumed in Phase 2. */
  familyOverrides: Record<string, { slotKind: string }> | null
  variants: PartCategoryVariant[] | null          // sized only: capacity variants
  generations: PartCategoryVariant[] | null       // ram only: DDR3/DDR4/DDR5
  active: boolean
  createdAt: string
  updatedAt: string
}
```

`src/domain/part/types.ts` changes:
- `PART_CATEGORIES` const stays (legacy default ids) but `PartCategory` relaxes: `export type PartCategory = string`.
- `isPartCategory` becomes a check against the legacy list ONLY where legacy fallback needs it; general code must accept any string.
- `SINGLE_SLOT_CATS` stays temporarily as the legacy fallback constant; Phase 2 call sites switch to the derived helper.

### Canonical defaults (single source for seed + runtime fallback)

New file `src/domain/part/partCategoryDefaults.ts` — used by `scripts/seed/referenceData.ts` AND the runtime fallback (referenceData.ts already imports from `src/domain`, precedent: `deriveCategoryFlags`).

```ts
import type { PartCategoryDef, PartCategoryVariant } from './partCategory-types'

export const DEFAULT_STORAGE_VARIANTS: PartCategoryVariant[] = [
  { id: '64gb', label: '64 ГБ', order: 0 }, { id: '128gb', label: '128 ГБ', order: 1 },
  { id: '256gb', label: '256 ГБ', order: 2 }, { id: '512gb', label: '512 ГБ', order: 3 },
  { id: '1tb', label: '1 ТБ', order: 4 }, { id: '2tb', label: '2 ТБ', order: 5 },
  { id: '3tb', label: '3 ТБ', order: 6 }, { id: '4tb', label: '4 ТБ', order: 7 },
  { id: '5tb', label: '5 ТБ', order: 8 },
]
export const DEFAULT_RAM_VARIANTS: PartCategoryVariant[] = [
  { id: '4gb', label: '4 ГБ', order: 0 }, { id: '8gb', label: '8 ГБ', order: 1 },
  { id: '16gb', label: '16 ГБ', order: 2 }, { id: '20gb', label: '20 ГБ', order: 3 },
  { id: '32gb', label: '32 ГБ', order: 4 }, { id: '40gb', label: '40 ГБ', order: 5 },
  { id: '64gb', label: '64 ГБ', order: 6 }, { id: '128gb', label: '128 ГБ', order: 7 },
]
export const DEFAULT_DDR_GENERATIONS: PartCategoryVariant[] = [
  { id: 'ddr3', label: 'DDR3', order: 0 }, { id: 'ddr4', label: 'DDR4', order: 1 }, { id: 'ddr5', label: 'DDR5', order: 2 },
]

/** Omit<PartCategoryDef,'createdAt'|'updatedAt'> rows — timestamps added by writer. */
export const DEFAULT_PART_CATEGORY_DEFS = [
  { id: 'psu',    name: { ru: 'Блоки',      en: 'Power supplies', hy: 'Սնուցման բլոկներ' }, icon: 'plug',          tintToken: 'amber',   order: 0, behavior: 'single', slotKind: 'psu',     storageType: null,  familyOverrides: { laptop: { slotKind: 'battery' } }, variants: null, generations: null, active: true },
  { id: 'cooler', name: { ru: 'Кулеры',     en: 'Coolers',        hy: 'Հովացուցիչներ' },    icon: 'fan',           tintToken: 'cyan',    order: 1, behavior: 'single', slotKind: 'cooler',  storageType: null,  familyOverrides: null, variants: null, generations: null, active: true },
  { id: 'ssd',    name: { ru: 'SSD',        en: 'SSD',            hy: 'SSD' },              icon: 'hard-drive',    tintToken: 'sky',     order: 2, behavior: 'sized',  slotKind: 'storage', storageType: 'SSD', familyOverrides: null, variants: DEFAULT_STORAGE_VARIANTS, generations: null, active: true },
  { id: 'hdd',    name: { ru: 'HDD',        en: 'HDD',            hy: 'HDD' },              icon: 'hard-drive',    tintToken: 'sky',     order: 3, behavior: 'sized',  slotKind: 'storage', storageType: 'HDD', familyOverrides: null, variants: DEFAULT_STORAGE_VARIANTS, generations: null, active: true },
  { id: 'nvme',   name: { ru: 'M.2',        en: 'M.2',            hy: 'M.2' },              icon: 'hard-drive',    tintToken: 'sky',     order: 4, behavior: 'sized',  slotKind: 'storage', storageType: 'M.2', familyOverrides: null, variants: DEFAULT_STORAGE_VARIANTS, generations: null, active: true },
  { id: 'ram',    name: { ru: 'ОЗУ',        en: 'RAM',            hy: 'Օպերատիվ հիշողություն' }, icon: 'memory-stick', tintToken: 'emerald', order: 5, behavior: 'sized', slotKind: 'ram', storageType: null, familyOverrides: null, variants: DEFAULT_RAM_VARIANTS, generations: DEFAULT_DDR_GENERATIONS, active: true },
  { id: 'gpu',    name: { ru: 'Видеокарта', en: 'GPU',            hy: 'Վիդեոքարտ' },        icon: 'circuit-board', tintToken: 'violet',  order: 6, behavior: 'models', slotKind: 'gpu',     storageType: null,  familyOverrides: null, variants: null, generations: null, active: true },
] satisfies Omit<PartCategoryDef, 'createdAt' | 'updatedAt'>[]
```

Derivation helpers (same file or `partCategory-types.ts`):

```ts
export const isSizedCategory  = (d: Pick<PartCategoryDef, 'behavior'>) => d.behavior === 'sized'
export const isModelsCategory = (d: Pick<PartCategoryDef, 'behavior'>) => d.behavior === 'models'
/** Asset holds at most one — legacy SINGLE_SLOT_CATS = {psu, cooler, gpu}. NOT behavior==='single'! */
export const isSingleSlotCategory = (d: Pick<PartCategoryDef, 'behavior'>) => d.behavior !== 'sized'
export function variantRankOf(def: PartCategoryDef | undefined, variantId: string | null | undefined): number {
  const order = def?.variants
  if (!order || !variantId) return 999
  const hit = order.find(v => v.id === variantId)
  return hit ? hit.order : 999
}
```

### Port + adapters

New `src/domain/part/PartCategoryRepository.ts` (mirror `CategoryGroupRepository` shape + `withAudit` contract from `PartRepository`):

```ts
export interface CreatePartCategoryInput {
  id?: string                       // slug; generated from en name when absent
  name: { ru: string; en: string; hy: string }
  icon: string
  tintToken: string
  order: number
  behavior: PartCategoryBehavior    // set once at creation
  slotKind: string
  storageType?: 'SSD' | 'HDD' | 'M.2' | null
  variants?: PartCategoryVariant[] | null
  generations?: PartCategoryVariant[] | null
}
/** behavior deliberately absent — immutable data class. */
export interface UpdatePartCategoryInput {
  name?: { ru: string; en: string; hy: string }
  icon?: string
  tintToken?: string
  order?: number
  active?: boolean
  variants?: PartCategoryVariant[] | null
  generations?: PartCategoryVariant[] | null
}
export interface PartCategoryRepository {
  listAll(): Promise<PartCategoryDef[]>   // includes inactive (management UI filters)
  create(input: CreatePartCategoryInput, actor: Actor): Promise<AuditedResult<PartCategoryDef>>
  update(id: string, patch: UpdatePartCategoryInput, actor: Actor): Promise<AuditedResult<PartCategoryDef>>
  // NO delete — deletion is forbidden (rules: allow delete: if false). Deactivation via update({active:false}).
}
```

Adapters: `src/infra/repositories/firestorePartCategoryRepository.ts` + `inMemoryPartCategoryRepository.ts` (mirror the CategoryGroup pair, including timestamp handling in `firestoreUtils`/`inMemoryUtils`). Factories: add `getSharedPartCategoryRepository()` to `src/infra/repositories/factories.ts` following the `shared()` cache pattern.

Audit: add `'part_category'` to `AuditEntityType` in `src/domain/audit/types.ts` (VERIFIED: the `audit_logs` create rule checks only `entityType is string` — no rules change needed for audit). Actions: reuse `'created'` / `'updated'`; for deactivation use `'updated'` with before/after capturing the `active` flip (mirror however CategoryRepository audits deactivation — check and match it).

### firestore.rules (edits, no deploy)

1. New block next to `/parts` (~line 320):

```
    // ---- /part_categories — dynamic parts-warehouse category catalog ----
    // Read: any signed-in admin-capable principal (same audience as /parts).
    // Write: super_admin only. behavior is part of the doc but immutability is
    // enforced app-side (update rule still whitelists keys + type-guards).
    match /part_categories/{id} {
      allow read: if isSignedIn();

      allow create: if isSuperAdmin()
        && request.resource.data.name.ru is string && request.resource.data.name.ru.size() > 0
        && request.resource.data.name.en is string
        && request.resource.data.name.hy is string
        && request.resource.data.behavior in ['single', 'sized', 'models']
        && request.resource.data.slotKind is string
        && request.resource.data.order is number
        && request.resource.data.active is bool
        && request.resource.data.keys().hasOnly([
             'name', 'icon', 'tintToken', 'order', 'behavior', 'slotKind',
             'storageType', 'familyOverrides', 'variants', 'generations',
             'active', 'createdAt', 'updatedAt']);

      allow update: if isSuperAdmin()
        && request.resource.data.behavior == resource.data.behavior   // immutable class
        && request.resource.data.name.ru is string && request.resource.data.name.ru.size() > 0
        && request.resource.data.active is bool
        && request.resource.data.keys().hasOnly([
             'name', 'icon', 'tintToken', 'order', 'behavior', 'slotKind',
             'storageType', 'familyOverrides', 'variants', 'generations',
             'active', 'createdAt', 'updatedAt']);

      allow delete: if false;
    }
```

2. In `match /parts/{id}` create AND update rules, replace
`request.resource.data.category in ['psu', 'cooler', 'ssd', 'hdd', 'nvme', 'ram', 'gpu']`
with
`exists(/databases/$(database)/documents/part_categories/$(request.resource.data.category))`
and update the stale comment at line ~326. NOTE for operator report: this makes SEEDING part_categories a hard prerequisite before any new SKU write passes rules (existing docs unaffected).

3. Rules unit tests: if a rules test suite exists for /parts, extend it (part_categories readable by signed-in, writable by super_admin only, delete always denied, behavior immutable on update, parts.category must exist in part_categories).

### Seed (`scripts/seed/referenceData.ts` + writer)

- Add `export interface PartCategorySeed` (= `Omit<PartCategoryDef, 'createdAt' | 'updatedAt'>`) and `export const PART_CATEGORY_SEED: PartCategorySeed[] = DEFAULT_PART_CATEGORY_DEFS` (import from `src/domain/part/partCategoryDefaults`, precedent: `deriveCategoryFlags` import).
- Wire into `buildSeed.ts` / the writer with the existing create-if-absent idempotent path (existing docs skipped). Order part_categories BEFORE parts in the seed sequence (rules `exists()` dependency).
- Extend `buildSeed.test.ts`: 7 rows, ids match legacy `PART_CATEGORIES`, sized cats carry the exact 9/8 variants with orders reproducing `STORAGE_VARIANT_ORDER`/`RAM_VARIANT_ORDER`, ram carries 3 generations, gpu has `behavior: 'models'`, psu carries the laptop familyOverride.

---

## Phase 2 — behavior dispatch (call-site inventory)

Load path: `PartReferenceData` (in `src/domain/part/PartRepository.ts`) gains `partCategories: PartCategoryDef[]`; `FirestorePartRepository.loadReferenceData` (see `firestorePartRepository.reads.ts`) fetches `part_categories` inside the same load (consistent with its existing TTL/SWR cache); `inMemoryPartRepository` serves `DEFAULT_PART_CATEGORY_DEFS` with timestamps. **Fallback rule:** if the fetched catalog is EMPTY, substitute `DEFAULT_PART_CATEGORY_DEFS` (graceful — nothing changes for an unseeded project). Only `active: true` categories flow to receive/warehouse UI; the full list flows to management UI (Phase 3).

Call sites to convert (verified inventory):
1. `src/components/features/parts/partsTokens.ts` — `PART_CATEGORY_META`, `PART_CAT_BY_ID`, `CATEGORY_TINT`, `categoryTint/categoryIcon`, `STORAGE_VARIANT_ORDER`/`RAM_VARIANT_ORDER`/`variantRank`, `COMPONENT_ORDER`/`componentRank`, `groupSkusByCategory` — all become builder functions over `PartCategoryDef[]` (e.g. `buildPartCatMeta(defs, localize)`), with the legacy constants re-derived from `DEFAULT_PART_CATEGORY_DEFS` as fallback so untouched imports keep working. `tintToken → Tint` class map (`TINT_BY_TOKEN`) is CODE (Tailwind JIT literal strings). `battery` visual entries stay code. `COMPONENT_ORDER` derives from category `order` + slotKind mapping (battery slots keep rank between psu and cooler exactly as today: psu 0, battery 1, cooler 2, ram 3, storage 4, gpu 5).
2. `src/pages/parts/WarehouseSkuList.tsx:60` — `AGG_CATS` → `defs.filter(isSizedCategory)`; GPU empty-state (~97-115) → `behavior === 'models'`.
3. `src/domain/part/types.ts:12` — `SINGLE_SLOT_CATS` call sites → `isSingleSlotCategory` (`behavior !== 'sized'`; see trap note). Parity test mandatory.
4. `src/domain/part/PartRepository.ts` + `firestorePartRepository*.ts` + `inMemoryPartRepository.ts` — `createGpu/deleteGpu` generalize to `createModelSku(categoryId, input)` / `deleteModelSku(skuId)`; keep `createGpu/deleteGpu` as thin deprecated aliases delegating with `categoryId: 'gpu'` OR update all call sites (`PartsPage.tsx`, `useParts.ts`, tests) — implementer picks ONE approach and applies it consistently.
5. `src/pages/parts/PartsReceivePage.tsx` — DDR list (~line 154) → `ramDef.generations`; GPU exclusion from receive (~line 242) → `behavior === 'models'`; category cards/labels → localized `name`.
6. `src/components/features/parts/PartsReceiveSizedCatCard.tsx:41` — DDR list → `generations` prop from def.
7. Labels: use the existing `localize()` helper with the current locale; ru remains default.
8. Tests across the ~10 test files referencing literals: update to build fixtures from `DEFAULT_PART_CATEGORY_DEFS`; add behavior-dispatch tests (custom category with `behavior:'sized'` gets variant grid; `'models'` gets create-SKU flow; `'single'` gets one-SKU card).

**Explicit non-goals for Phase 2:** no changes to install/uninstall family dispatch (`firestorePartRepository.install.ts` / `.uninstall.ts` semantics), no consumption of `familyOverrides`, no changes to movement journal shape, no UI redesign.

## Phase 3 — management UI on /categories

- New section/tab «Запчасти» on the existing categories page (find it: `src/pages` categories page + `src/components/features/settings` or similar group-management components — REUSE the existing group-management patterns/components, per the reuse-first rule).
- Access: super_admin only (`<RoleGate>` pattern used by the page already).
- List: all part categories incl. inactive (inactive greyed + chip), ordered by `order`.
- Create: MultiLangInput (search `src/components` — it exists) for name ru/en/hy; icon picker from the existing icon registry used by asset-category management; order; behavior select ONLY at creation (single/sized/models with short descriptions); for sized — optional variants editor may be deferred: creating a sized category seeds `variants: []` and the receive UI simply shows no variant rows until filled (KEEP SIMPLE; a full variants editor is allowed if an equivalent editor pattern already exists to reuse, otherwise variants/generations editable as a later iteration — document what was chosen).
- Edit: rename (3 langs), icon, tintToken, order. Behavior immutable (not rendered as editable).
- Deactivate/activate: toggle `active`. Deletion NOT offered (rules forbid). Deactivation hides the category from /parts warehouse grouping and receive; existing SKUs/history remain readable (verify warehouse list renders SKUs of deactivated categories under their meta anyway or hides the group — match asset-categories deactivation UX).
- All mutations through the repository (which runs `withAudit` with entityType `'part_category'`).
- i18n: all new chrome strings in ru/en/hy simultaneously (the global i18n test enforces key parity).

## Verification (final)

- `npm run build` — clean.
- `npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4` — full suite green.

## Operator handoff (after implementation)

1. Deploy rules: `npx firebase deploy --only firestore:rules`.
2. Seed `part_categories` BEFORE anyone creates a new SKU (rules `exists()` guard). Provide: how the seed script authenticates (check `scripts/seed/adminApp.ts`) + a REST fallback (7 ready-to-POST Firestore REST document bodies) if ADC/service-account creds are not available.

---

### Task 1 (Phase 1 — domain): types, defaults, port — dispatch `domain-modeler`

**Files:**
- Create: `src/domain/part/partCategory-types.ts`
- Create: `src/domain/part/partCategoryDefaults.ts`
- Create: `src/domain/part/PartCategoryRepository.ts`
- Modify: `src/domain/part/types.ts` (relax `PartCategory` to `string`; keep legacy consts documented as fallback)
- Modify: `src/domain/audit/types.ts` (add `'part_category'` to `AuditEntityType`)
- Test: `src/domain/part/partCategory-types.test.ts` (behavior guards, `isSingleSlotCategory` parity with legacy `SINGLE_SLOT_CATS`, defaults integrity: 7 rows, variant orders match legacy arrays)

- [ ] Write failing tests → run `npx vitest run src/domain/part` → implement → green → `npm run build`.

### Task 2 (Phase 1 — infra): adapters, factories, rules, seed — dispatch `firebase-engineer`

**Files:**
- Create: `src/infra/repositories/firestorePartCategoryRepository.ts`
- Create: `src/infra/repositories/inMemoryPartCategoryRepository.ts` (+ `.test.ts`)
- Modify: `src/infra/repositories/factories.ts`, `src/infra/repositories/index.ts`
- Modify: `firestore.rules` (new `/part_categories` block + `exists()` swap in `/parts` create+update, per diff above)
- Modify: `scripts/seed/referenceData.ts` (+ writer wiring in `scripts/seed/buildSeed.ts` / seed entrypoint), `scripts/seed/buildSeed.test.ts`

- [ ] Tests first (in-memory adapter + seed builder) → implement → green → `npm run build`.

### Task 3 (Phase 2 — dispatch by behavior): load path + call-site conversion — dispatch `react-ui-engineer` (with `firebase-engineer` follow-up if reads change)

**Files:** per call-site inventory above (partsTokens.ts, WarehouseSkuList.tsx, PartsReceivePage.tsx, PartsReceiveSizedCatCard.tsx, PartRepository.ts + both adapters, useParts.ts, PartsPage.tsx, affected tests).

- [ ] `PartReferenceData.partCategories` + fallback → tokens builders → AGG/SINGLE/GPU/DDR call sites → `createModelSku`/`deleteModelSku` → tests updated/added → `npm run build` + parts test files green.

### Task 4 (Phase 3 — management UI): «Запчасти» section on /categories — dispatch `react-ui-engineer`, then `i18n-engineer`

**Files:** categories page + new `src/components/features/settings/PartCategoriesPanel.tsx` (or co-located with existing category-group management — reuse-first), locales `src/locales/{ru,en,hy}/*`.

- [ ] List/create/edit/deactivate wired to `getSharedPartCategoryRepository()` → audit via repo → i18n keys ru/en/hy → tests → `npm run build`.

### Task 5 — reviews + full verification

- [ ] spec-reviewer → code-quality-reviewer → security-reviewer (rules diff!) → fix loops → `npm run build` + FULL `npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4`.
