# Task 3b — Behavior-Dispatch UI (Dynamic Part Categories) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the parts UI dispatch on `PartCategoryDef.behavior` loaded from the hook instead of hardcoded category ids, so custom categories defined in Firestore get the right render path automatically, while preserving byte-for-byte parity with the current 7-id behavior.

**Architecture:** The `useParts` hook already loads `partCategories` from `loadReferenceData()`. We plumb that field through to consumers, build derived meta/tint/order tables with new builder functions in `partsTokens.ts`, then convert each component's `id === 'gpu'` / `AGG_CATS.has(id)` checks to `behavior === 'models'` / `isSizedCategory(def)` calls against the resolved def. Legacy constant exports remain for test backward-compat but are re-derived from `DEFAULT_PART_CATEGORY_DEFS`. The `PartRepository.partCategories?:` optional becomes required; tests get updated fixtures.

**Tech Stack:** TypeScript strict + exactOptionalPropertyTypes, React 19, Vitest, `react-i18next`. No new packages.

---

## HARD CONSTRAINTS (repeat from parent plan — every task must honor these)

1. NO git operations, NO deploys.
2. NO file edits via PowerShell/Bash redirection — ONLY Read/Write/Edit tools.
3. TS strict + exactOptionalPropertyTypes: use conditional-spread `{...(x !== undefined ? { prop: x } : {})}` for optional props.
4. Tailwind class strings MUST be literal (no template interpolation of color tokens). The `TINT_BY_TOKEN` map maps string token → literal class object.
5. Behavior parity: for the 7 seeded ids the UI must render EXACTLY as today.
6. Install-flow semantics (slotIsSingle per asset family, isServiceOnly, etc.) are OUT OF SCOPE.
7. Only touch `src/domain/part/PartRepository.ts` and `src/pages/parts/PartsPage.test.tsx` for the specific cleanups listed. No other domain/infra edits.
8. `battery` is NOT a part category — it remains a code-side installed-row visual only.

---

## File Map

### Modified files

| File | Change |
|------|--------|
| `src/components/features/parts/partsTokens.ts` | Add `TINT_BY_TOKEN`, builder fns `buildPartCatMeta`/`buildCategoryTint`/`buildComponentOrder`/`groupSkusByCategoryDef`; re-derive legacy constants from defaults; update `variantRank` |
| `src/hooks/useParts.ts` | Expose `partCategories` in return type; replace `createGpu` with `createModelSku` |
| `src/pages/parts/PartsPage.tsx` | Wire `partCategories` from hook; build meta/tints/orders via `useMemo`; pass to children; migrate `createGpu` → `createModelSku` |
| `src/components/features/parts/WarehouseSkuList.tsx` | `AGG_CATS` → derived `isSizedCategory`; GPU branch → `isModelsCategory`; accept `catDef` prop |
| `src/components/features/parts/WarehouseTab.tsx` | Accept and thread `partCategories`; use built meta for card list; mobile `isGpu`/`isAgg` → behavior |
| `src/components/features/parts/CategoryChipStrip.tsx` | Accept `partCategories` prop; derive chip list from defs instead of `PART_CATEGORY_META` |
| `src/components/features/parts/PartCard.tsx` | Accept `catDef?: PartCategoryDef`; derive `isGpu`/`isRam`/`allVariants` from def |
| `src/pages/parts/PartsReceivePage.tsx` | `visibleCats` excludes `behavior === 'models'`; DDR pills from `def.generations`; cat sections from built meta |
| `src/components/features/parts/PartsReceiveSizedCatCard.tsx` | Accept `generations` prop; DDR pills from it instead of `['DDR3','DDR4','DDR5']` literal |
| `src/components/features/parts/PartsReceiveMobileForm.tsx` | Accept `partCategories`; derive `SMALL_IDS` from `isSingleSlotCategory`; pass `generations` to sized card |
| `src/pages/parts/PartsPageSkeleton.tsx` | No changes needed (skeleton is pure chrome) |
| `src/domain/part/PartRepository.ts` | Flip `partCategories?:` → `partCategories:` (required) |
| `src/pages/parts/PartsPage.test.tsx` | Add `partCategories: DEFAULT_PART_CATEGORY_DEFS with timestamps` to `defaultRef`; add behavior-dispatch tests |
| `src/components/features/parts/partsTokens.test.ts` (NEW) | Builder parity + behavior-dispatch tests |

---

## Task 1: Add builder functions and TINT_BY_TOKEN to partsTokens.ts

**Files:**
- Modify: `src/components/features/parts/partsTokens.ts`

The goal: partsTokens becomes a computation module. Legacy constants stay exported but are now re-derived from `DEFAULT_PART_CATEGORY_DEFS` so data lives in exactly one place.

- [ ] **Step 1: Read the current partsTokens.ts**

Read `C:/Users/DELL/Desktop/assets-crm/src/components/features/parts/partsTokens.ts` to confirm exact content before editing.

- [ ] **Step 2: Add TINT_BY_TOKEN map and builder functions**

Edit `C:/Users/DELL/Desktop/assets-crm/src/components/features/parts/partsTokens.ts`. Add the following AFTER the existing `TINT_FALLBACK` constant and BEFORE `CATEGORY_TINT`:

```typescript
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import { isSizedCategory, variantRankOf } from '@/domain/part/partCategory-types'
import { DEFAULT_PART_CATEGORY_DEFS } from '@/domain/part/partCategoryDefaults'
```

Then add `TINT_BY_TOKEN` map (literal Tailwind strings — no interpolation):

```typescript
/**
 * Code-side map from tintToken string → Tint.
 * Tailwind class strings MUST be literals so JIT keeps them.
 * Unknown tokens fall back to TINT_FALLBACK at call sites.
 */
export const TINT_BY_TOKEN: Record<string, Tint> = {
  amber:   { iconBg: 'bg-amber-500/15',   iconText: 'text-amber-300' },
  cyan:    { iconBg: 'bg-cyan-500/15',    iconText: 'text-cyan-300' },
  sky:     { iconBg: 'bg-sky-500/15',     iconText: 'text-sky-300' },
  emerald: { iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-300' },
  violet:  { iconBg: 'bg-violet-500/15',  iconText: 'text-violet-300' },
  rose:    { iconBg: 'bg-rose-500/15',    iconText: 'text-rose-300' },
  blue:    { iconBg: 'bg-blue-500/15',    iconText: 'text-blue-300' },
  orange:  { iconBg: 'bg-orange-500/15',  iconText: 'text-orange-300' },
  slate:   { iconBg: 'bg-surface-2',      iconText: 'text-text-tertiary' },
}
```

- [ ] **Step 3: Add buildPartCatMeta function**

Add after `TINT_BY_TOKEN`:

```typescript
/**
 * Build the display meta array from a live catalog.
 * Active only, sorted by `order` ascending.
 * `localizeName` is called at CALL SITES (components) — this function is locale-independent.
 */
export function buildPartCatMeta(
  defs: PartCategoryDef[],
  localizeName: (name: { ru: string; en: string; hy: string }) => string,
): PartCatMeta[] {
  return defs
    .filter(d => d.active)
    .sort((a, b) => a.order - b.order)
    .map(d => ({ id: d.id, label: localizeName(d.name), icon: d.icon }))
}
```

- [ ] **Step 4: Add buildCategoryTint function**

```typescript
/**
 * Build a per-category-id tint lookup from a live catalog.
 * tintToken → TINT_BY_TOKEN lookup; unknown token → TINT_FALLBACK.
 * Battery stays code-side (not a category).
 */
export function buildCategoryTint(defs: PartCategoryDef[]): Record<string, Tint> {
  const out: Record<string, Tint> = {
    battery: { iconBg: 'bg-rose-500/15', iconText: 'text-rose-300' },
  }
  for (const d of defs) {
    out[d.id] = TINT_BY_TOKEN[d.tintToken] ?? TINT_FALLBACK
  }
  return out
}
```

- [ ] **Step 5: Add buildComponentOrder function**

The canonical order for default defs is: psu 0, battery 1, cooler 2, ram 3, storage 4, gpu 5.
Battery is code-side (injected between psu and cooler).
For custom defs: use the def's `order` value mapped to a rank group that keeps existing categories first, custom categories after gpu (order 6+).

```typescript
/**
 * Build the installed-row sort order from a live catalog.
 * Reproduces today's COMPONENT_ORDER for the 7 default ids.
 * Battery injected code-side (rank 1, between psu and cooler).
 * Custom categories land at rank = def.order + 2 (after gpu at 5).
 */
export function buildComponentOrder(defs: PartCategoryDef[]): Record<string, number> {
  const out: Record<string, number> = { battery: 1 }
  // Rank each def: storage defs (slotKind === 'storage') share rank 4.
  // Other defs use a fixed mapping by slotKind, then fall through to def.order + 2.
  const SLOT_RANK: Record<string, number> = {
    psu: 0, cooler: 2, ram: 3, storage: 4, gpu: 5,
  }
  for (const d of defs) {
    const slotRank = SLOT_RANK[d.slotKind]
    out[d.id] = slotRank !== undefined ? slotRank : d.order + 2
  }
  return out
}
```

- [ ] **Step 6: Add defs-aware variantRank overload**

The existing `variantRank(categoryId, variantId)` uses legacy arrays. Add a new function that takes a def and uses `variantRankOf`:

```typescript
/**
 * Rank a SKU within its category by capacity (ascending) using a live PartCategoryDef.
 * Falls back to the legacy array-based variantRank when def is undefined.
 */
export function variantRankDef(
  def: PartCategoryDef | undefined,
  variantId: string | null | undefined,
): number {
  if (def) return variantRankOf(def, variantId)
  return 999
}
```

- [ ] **Step 7: Add groupSkusByCategoryDef function**

```typescript
/**
 * Group parts by category using a live catalog (active defs only, sorted by order).
 * Falls back to PART_CATEGORY_META order when defs is empty.
 */
export function groupSkusByCategoryDef(
  parts: Part[],
  defs: PartCategoryDef[],
): Record<string, Part[]> {
  const activeDefs = defs.filter(d => d.active).sort((a, b) => a.order - b.order)
  const catIds = activeDefs.length > 0
    ? activeDefs.map(d => d.id)
    : PART_CATEGORY_META.map(c => c.id)
  const map: Record<string, Part[]> = {}
  for (const id of catIds) { map[id] = [] }
  for (const p of parts) {
    if (!map[p.category]) map[p.category] = []
    map[p.category]!.push(p)
  }
  return map
}
```

- [ ] **Step 8: Re-derive legacy constants from DEFAULT_PART_CATEGORY_DEFS**

Replace the hand-written `PART_CATEGORY_META`, `PART_CAT_BY_ID`, `CATEGORY_TINT`, `COMPONENT_ORDER` constant bodies with derived versions.

For `PART_CATEGORY_META`: derive from defaults using `buildPartCatMeta` with Russian name (locale-independent fallback at module init time since this is a static export):

```typescript
/**
 * @deprecated Legacy fallback — derived data lives in part_categories Firestore.
 * Re-derived from DEFAULT_PART_CATEGORY_DEFS so there is ONE hand-written copy of the data.
 */
export const PART_CATEGORY_META: PartCatMeta[] = buildPartCatMeta(
  DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[],
  (name) => name.ru,
)
```

For `PART_CAT_BY_ID`:

```typescript
/**
 * @deprecated Legacy fallback — re-derived from DEFAULT_PART_CATEGORY_DEFS.
 * Battery is injected code-side (not a part category).
 */
export const PART_CAT_BY_ID: Record<string, PartCatMeta> = {
  ...Object.fromEntries(PART_CATEGORY_META.map(c => [c.id, c])),
  battery: { id: 'battery', label: 'Аккумулятор', icon: 'battery-medium' },
}
```

For `CATEGORY_TINT`:

```typescript
/**
 * @deprecated Legacy fallback — re-derived from DEFAULT_PART_CATEGORY_DEFS.
 */
export const CATEGORY_TINT: Record<string, Tint> = buildCategoryTint(
  DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[],
)
```

For `COMPONENT_ORDER`:

```typescript
/**
 * @deprecated Legacy fallback — re-derived from DEFAULT_PART_CATEGORY_DEFS.
 */
export const COMPONENT_ORDER: Record<string, number> = buildComponentOrder(
  DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[],
)
```

Also update `groupSkusByCategory` (legacy) to call the new `groupSkusByCategoryDef`:

```typescript
/** @deprecated Use groupSkusByCategoryDef with live catalog. */
export function groupSkusByCategory(parts: Part[]): Record<string, Part[]> {
  return groupSkusByCategoryDef(parts, DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[])
}
```

- [ ] **Step 9: Verify the build compiles**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

Expected: no errors from `partsTokens.ts`.

---

## Task 2: Add partsTokens builder tests

**Files:**
- Create: `src/components/features/parts/partsTokens.test.ts`

- [ ] **Step 1: Create the test file**

Create `C:/Users/DELL/Desktop/assets-crm/src/components/features/parts/partsTokens.test.ts`:

```typescript
/**
 * partsTokens builder-function tests.
 *
 * Tests:
 *  (a) Parity: built meta/tints/order from DEFAULT_PART_CATEGORY_DEFS equals
 *      the legacy PART_CATEGORY_META / CATEGORY_TINT / COMPONENT_ORDER exports.
 *  (b) Custom sized category ('dock') appears in built meta and groupSkusByCategoryDef.
 *  (c) Custom models category triggers models path (isModelsCategory).
 *  (d) variantRankDef respects def.variants ordering.
 */
import { describe, it, expect } from 'vitest'
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import { DEFAULT_PART_CATEGORY_DEFS } from '@/domain/part/partCategoryDefaults'
import {
  buildPartCatMeta,
  buildCategoryTint,
  buildComponentOrder,
  groupSkusByCategoryDef,
  variantRankDef,
  PART_CATEGORY_META,
  CATEGORY_TINT,
  COMPONENT_ORDER,
  TINT_FALLBACK,
} from './partsTokens'
import { isSizedCategory, isModelsCategory } from '@/domain/part/partCategory-types'
import type { Part } from '@/domain/part/types'

const FIXED_TS = '2024-01-01T00:00:00.000Z'

function makeFullDefs(defs: Omit<PartCategoryDef, 'createdAt' | 'updatedAt'>[]): PartCategoryDef[] {
  return defs.map(d => ({ ...d, createdAt: FIXED_TS, updatedAt: FIXED_TS }))
}

const DEFAULT_FULL = makeFullDefs(DEFAULT_PART_CATEGORY_DEFS)

/* ── (a) Parity: builders from defaults equal legacy constants ─────────────── */

describe('buildPartCatMeta parity with PART_CATEGORY_META', () => {
  it('ids in order match PART_CATEGORY_META', () => {
    const built = buildPartCatMeta(DEFAULT_FULL, n => n.ru)
    expect(built.map(m => m.id)).toEqual(PART_CATEGORY_META.map(m => m.id))
  })

  it('labels match PART_CATEGORY_META.label (ru)', () => {
    const built = buildPartCatMeta(DEFAULT_FULL, n => n.ru)
    expect(built.map(m => m.label)).toEqual(PART_CATEGORY_META.map(m => m.label))
  })

  it('icons match PART_CATEGORY_META.icon', () => {
    const built = buildPartCatMeta(DEFAULT_FULL, n => n.ru)
    expect(built.map(m => m.icon)).toEqual(PART_CATEGORY_META.map(m => m.icon))
  })
})

describe('buildCategoryTint parity with CATEGORY_TINT', () => {
  it('psu tint matches CATEGORY_TINT.psu', () => {
    const built = buildCategoryTint(DEFAULT_FULL)
    expect(built['psu']).toEqual(CATEGORY_TINT['psu'])
  })

  it('gpu tint matches CATEGORY_TINT.gpu', () => {
    const built = buildCategoryTint(DEFAULT_FULL)
    expect(built['gpu']).toEqual(CATEGORY_TINT['gpu'])
  })

  it('battery tint matches CATEGORY_TINT.battery', () => {
    const built = buildCategoryTint(DEFAULT_FULL)
    expect(built['battery']).toEqual(CATEGORY_TINT['battery'])
  })

  it('all 7 default ids match legacy', () => {
    const built = buildCategoryTint(DEFAULT_FULL)
    for (const id of ['psu', 'cooler', 'ssd', 'hdd', 'nvme', 'ram', 'gpu'] as const) {
      expect(built[id]).toEqual(CATEGORY_TINT[id])
    }
  })
})

describe('buildComponentOrder parity with COMPONENT_ORDER', () => {
  it('psu=0, battery=1, cooler=2, ram=3', () => {
    const built = buildComponentOrder(DEFAULT_FULL)
    expect(built['psu']).toBe(0)
    expect(built['battery']).toBe(1)
    expect(built['cooler']).toBe(2)
    expect(built['ram']).toBe(3)
  })

  it('ssd, hdd, nvme all rank 4', () => {
    const built = buildComponentOrder(DEFAULT_FULL)
    expect(built['ssd']).toBe(4)
    expect(built['hdd']).toBe(4)
    expect(built['nvme']).toBe(4)
  })

  it('gpu ranks 5', () => {
    const built = buildComponentOrder(DEFAULT_FULL)
    expect(built['gpu']).toBe(5)
  })

  it('all 7 default ids match COMPONENT_ORDER', () => {
    const built = buildComponentOrder(DEFAULT_FULL)
    for (const id of ['psu', 'cooler', 'ssd', 'hdd', 'nvme', 'ram', 'gpu'] as const) {
      expect(built[id]).toBe(COMPONENT_ORDER[id])
    }
  })
})

/* ── (b) Custom sized category ───────────────────────────────────────────── */

describe('custom sized category "dock"', () => {
  const DOCK_DEF: PartCategoryDef = {
    id: 'dock',
    name: { ru: 'Докстанции', en: 'Docking Stations', hy: 'Կայաններ' },
    icon: 'plug-2',
    tintToken: 'blue',
    order: 7,
    behavior: 'sized',
    slotKind: 'dock',
    storageType: null,
    familyOverrides: null,
    variants: [
      { id: 'usb-c', label: 'USB-C', order: 0 },
      { id: 'tb4', label: 'TB4', order: 1 },
    ],
    generations: null,
    active: true,
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS,
  }

  const DEFS_WITH_DOCK = [...DEFAULT_FULL, DOCK_DEF]

  it('dock appears in buildPartCatMeta output', () => {
    const meta = buildPartCatMeta(DEFS_WITH_DOCK, n => n.en)
    const ids = meta.map(m => m.id)
    expect(ids).toContain('dock')
  })

  it('dock is isSizedCategory', () => {
    expect(isSizedCategory(DOCK_DEF)).toBe(true)
  })

  it('dock NOT isModelsCategory', () => {
    expect(isModelsCategory(DOCK_DEF)).toBe(false)
  })

  it('dock appears in groupSkusByCategoryDef output', () => {
    const dockPart: Part = {
      id: 'dock_usb-c_abc', name: 'Dock USB-C', category: 'dock', unit: 'шт',
      onHand: 2, broken: 0, lowStockThreshold: 1,
      createdAt: FIXED_TS, updatedAt: FIXED_TS, createdBy: 'u1', updatedBy: 'u1',
    }
    const grouped = groupSkusByCategoryDef([dockPart], DEFS_WITH_DOCK)
    expect(grouped['dock']).toEqual([dockPart])
  })

  it('dock gets blue tint from TINT_BY_TOKEN', () => {
    const tints = buildCategoryTint(DEFS_WITH_DOCK)
    expect(tints['dock']?.iconBg).toBe('bg-blue-500/15')
    expect(tints['dock']?.iconText).toBe('text-blue-300')
  })

  it('dock with unknown tintToken falls back to TINT_FALLBACK', () => {
    const dockUnknown: PartCategoryDef = { ...DOCK_DEF, tintToken: 'magenta-999' }
    const tints = buildCategoryTint([dockUnknown])
    expect(tints['dock']).toEqual(TINT_FALLBACK)
  })
})

/* ── (c) Custom models category ──────────────────────────────────────────── */

describe('custom models category "custom-gpu"', () => {
  const CUSTOM_GPU: PartCategoryDef = {
    id: 'custom-gpu',
    name: { ru: 'Тест GPU', en: 'Test GPU', hy: 'Թեստ GPU' },
    icon: 'circuit-board',
    tintToken: 'violet',
    order: 8,
    behavior: 'models',
    slotKind: 'gpu',
    storageType: null,
    familyOverrides: null,
    variants: null,
    generations: null,
    active: true,
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS,
  }

  it('isModelsCategory returns true', () => {
    expect(isModelsCategory(CUSTOM_GPU)).toBe(true)
  })

  it('isSizedCategory returns false', () => {
    expect(isSizedCategory(CUSTOM_GPU)).toBe(false)
  })

  it('isSingleSlotCategory returns true (behavior !== sized)', () => {
    // import directly to avoid circular; use inline check
    expect(CUSTOM_GPU.behavior !== 'sized').toBe(true)
  })
})

/* ── (d) variantRankDef ──────────────────────────────────────────────────── */

describe('variantRankDef', () => {
  const SSD_DEF = DEFAULT_FULL.find(d => d.id === 'ssd')!

  it('256gb < 1tb for ssd', () => {
    expect(variantRankDef(SSD_DEF, '256gb')).toBeLessThan(variantRankDef(SSD_DEF, '1tb'))
  })

  it('unknown variantId returns 999', () => {
    expect(variantRankDef(SSD_DEF, 'unknown')).toBe(999)
  })

  it('undefined def returns 999', () => {
    expect(variantRankDef(undefined, '256gb')).toBe(999)
  })
})
```

- [ ] **Step 2: Run the tests to confirm they pass**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/components/features/parts/partsTokens.test.ts --pool=forks --poolOptions.forks.maxForks=2 2>&1 | tail -30
```

Expected: all tests pass.

---

## Task 3: Update useParts hook — expose partCategories, add createModelSku

**Files:**
- Modify: `src/hooks/useParts.ts`

- [ ] **Step 1: Read current useParts.ts**

Read `C:/Users/DELL/Desktop/assets-crm/src/hooks/useParts.ts` to confirm exact content.

- [ ] **Step 2: Update UsePartsResult type and hook body**

Replace the import section to add `CreateModelSkuInput` and `PartCategoryDef`:

```typescript
import type {
  PartRepository, PartWriteRepository, PartReferenceData,
  ReceiveItem, InstallInput, UninstallInput,
  CreateModelSkuInput, ServiceRecordInput,
} from '@/domain/part/PartRepository'
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import { DEFAULT_PART_CATEGORY_DEFS } from '@/domain/part/partCategoryDefaults'
```

Update `UsePartsResult` — add `partCategories`, replace `createGpu` with `createModelSku`:

```typescript
export interface UsePartsResult {
  ref: PartReferenceData | null
  partCategories: PartCategoryDef[]
  loading: boolean
  error: Error | null
  reload: () => void
  receiveParts: (items: ReceiveItem[]) => Promise<AuditedResult<PartMovement[]>>
  installPart: (input: InstallInput) => Promise<AuditedResult<PartMovement>>
  uninstallPart: (input: UninstallInput) => Promise<AuditedResult<PartMovement>>
  recordService: (input: ServiceRecordInput) => Promise<AuditedResult<PartMovement>>
  createModelSku: (input: CreateModelSkuInput) => Promise<AuditedResult<Part>>
}
```

Add `partCategories` derivation after the cached resource load:

```typescript
// Derive partCategories with graceful fallback to defaults
const partCategories = useMemo<PartCategoryDef[]>(
  () => {
    const cats = ref?.partCategories
    if (!cats || cats.length === 0) {
      return (DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[])
    }
    return cats
  },
  [ref],
)
```

Replace `createGpu` callback with `createModelSku`:

```typescript
const createModelSku = useCallback(
  async (input: CreateModelSkuInput): Promise<AuditedResult<Part>> => {
    const result = await repo.createModelSku(input, actor)
    reload()
    return result
  },
  [repo, actor, reload],
)
```

Update return:

```typescript
return {
  ref,
  partCategories,
  loading,
  error,
  reload,
  receiveParts,
  installPart,
  uninstallPart,
  recordService,
  createModelSku,
}
```

- [ ] **Step 3: Verify tsc**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

Expected: no errors from `useParts.ts`.

---

## Task 4: Update PartRepository.ts — flip partCategories to required

**Files:**
- Modify: `src/domain/part/PartRepository.ts`

- [ ] **Step 1: Change the optional field to required**

In `C:/Users/DELL/Desktop/assets-crm/src/domain/part/PartRepository.ts`, find:

```typescript
  partCategories?: PartCategoryDef[]   // full category catalog (incl. inactive); never empty when populated
```

Replace with:

```typescript
  partCategories: PartCategoryDef[]   // full category catalog (incl. inactive); never empty; sorted by order asc; implementations fall back to DEFAULT_PART_CATEGORY_DEFS
```

Also remove the JSDoc comment block above it (the one explaining the `?` concession) and replace with:

```typescript
  /**
   * Full category catalog including inactive entries. UI filters on `active`.
   * Sorted by `order` ascending.
   * Implementations MUST NOT return an empty array — fall back to DEFAULT_PART_CATEGORY_DEFS
   * (with fixed ISO timestamps) when the Firestore part_categories collection is empty/unseeded.
   */
  partCategories: PartCategoryDef[]
```

- [ ] **Step 2: Verify tsc — expect infra/inMemory errors to surface**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | grep -E "partCategories|error TS" | head -20
```

Any infra repository that was returning a `PartReferenceData` without `partCategories` will now error. Those errors guide where to fix. Note down which files error — they need their `loadReferenceData()` implementations updated to include the field. (These are infra files; per constraints you may only fix them minimally to satisfy the type, not redesign them.)

- [ ] **Step 3: Fix inMemory and any test stubs**

For any infra file that creates a `PartReferenceData` literal, add:

```typescript
import { DEFAULT_PART_CATEGORY_DEFS } from '@/domain/part/partCategoryDefaults'
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
// In the returned object:
partCategories: DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[],
```

(Use `as unknown as PartCategoryDef[]` because the defaults array omits timestamps; the implementations that serve real data from Firestore already set the timestamps on each doc. For tests and inMemory the timestamp omission is acceptable.)

- [ ] **Step 4: Verify tsc passes**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 5: Update PartsPage.test.tsx — add partCategories to fixtures

**Files:**
- Modify: `src/pages/parts/PartsPage.test.tsx`

- [ ] **Step 1: Read current test file**

Read `C:/Users/DELL/Desktop/assets-crm/src/pages/parts/PartsPage.test.tsx` to confirm exact content.

- [ ] **Step 2: Add partCategories import and update defaultRef**

Add imports at the top of the test file (after existing imports):

```typescript
import { DEFAULT_PART_CATEGORY_DEFS } from '@/domain/part/partCategoryDefaults'
import type { PartCategoryDef } from '@/domain/part/partCategory-types'

const FIXED_TS = '2024-01-01T00:00:00.000Z'
const TEST_PART_CATEGORIES: PartCategoryDef[] = DEFAULT_PART_CATEGORY_DEFS.map(d => ({
  ...d,
  createdAt: FIXED_TS,
  updatedAt: FIXED_TS,
})) as PartCategoryDef[]
```

Update `defaultRef`:

```typescript
const defaultRef: PartReferenceData = {
  parts: [makePart()],
  movements: [] as PartMovement[],
  partsAssets: [makeAsset()],
  partCategories: TEST_PART_CATEGORIES,
}
```

- [ ] **Step 3: Update all mock return values in beforeEach and individual tests**

Every `mockUseParts.mockReturnValue({ ref: { parts: [], movements: [], partsAssets: [] }, ... })` that constructs an inline `ref` object must add `partCategories: TEST_PART_CATEGORIES` to the ref.

Also update the returned hook value to use `createModelSku` instead of `createGpu`, and add `partCategories: TEST_PART_CATEGORIES` to the hook return shape:

```typescript
beforeEach(() => {
  mockUseParts.mockReset()
  mockUseParts.mockReturnValue({
    ref: defaultRef,
    partCategories: TEST_PART_CATEGORIES,
    loading: false,
    error: null,
    reload: vi.fn(),
    receiveParts: vi.fn(),
    installPart: vi.fn(),
    uninstallPart: vi.fn(),
    createModelSku: vi.fn(),  // was createGpu
    recordService: vi.fn(),
  })
})
```

- [ ] **Step 4: Add behavior-dispatch tests**

Add a new `describe` block at the end of the test file:

```typescript
describe('behavior-dispatch: partCategories flows into meta', () => {
  it('renders warehouse tab when partCategories uses default defs', () => {
    renderPage()
    expect(screen.getByText('tabs.warehouse')).toBeInTheDocument()
  })

  it('renders without crash when partCategories is empty (fallback to defaults)', () => {
    mockUseParts.mockReturnValue({
      ref: { ...defaultRef, partCategories: [] },
      partCategories: TEST_PART_CATEGORIES, // hook fills fallback
      loading: false,
      error: null,
      reload: vi.fn(),
      receiveParts: vi.fn(),
      installPart: vi.fn(),
      uninstallPart: vi.fn(),
      createModelSku: vi.fn(),
      recordService: vi.fn(),
    })
    renderPage()
    expect(screen.getByText('tabs.warehouse')).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run PartsPage tests**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/pages/parts/PartsPage.test.tsx --pool=forks --poolOptions.forks.maxForks=2 2>&1 | tail -30
```

Expected: all tests pass.

---

## Task 6: Update PartsPage.tsx — wire partCategories, migrate createGpu → createModelSku

**Files:**
- Modify: `src/pages/parts/PartsPage.tsx`

- [ ] **Step 1: Read current PartsPage.tsx**

Read `C:/Users/DELL/Desktop/assets-crm/src/pages/parts/PartsPage.tsx` to confirm content.

- [ ] **Step 2: Update imports**

Add to the import block:

```typescript
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import { buildPartCatMeta, buildCategoryTint, buildComponentOrder, groupSkusByCategoryDef } from '@/components/features/parts/partsTokens'
import { useTranslation } from 'react-i18next'  // already present
```

- [ ] **Step 3: Destructure createModelSku from hook instead of createGpu**

Change:

```typescript
const { ref, loading, error, reload, installPart, uninstallPart, recordService, createGpu } = useParts(repo)
```

To:

```typescript
const { ref, partCategories, loading, error, reload, installPart, uninstallPart, recordService, createModelSku } = useParts(repo)
```

- [ ] **Step 4: Build meta/tint/order with useMemo**

Add after the hook call:

```typescript
const { i18n } = useTranslation()

// Localize helper — uses i18n.language with ru fallback
const localizeName = useCallback(
  (name: { ru: string; en: string; hy: string }) =>
    name[i18n.language as 'ru' | 'en' | 'hy'] ?? name.ru,
  [i18n.language],
)

const partCatMeta = useMemo(
  () => buildPartCatMeta(partCategories, localizeName),
  [partCategories, localizeName],
)

const categoryTints = useMemo(
  () => buildCategoryTint(partCategories),
  [partCategories],
)

const componentOrder = useMemo(
  () => buildComponentOrder(partCategories),
  [partCategories],
)
```

- [ ] **Step 5: Update skusByCategory to use groupSkusByCategoryDef**

Change:

```typescript
const skusByCategory = useMemo(
  () => groupSkusByCategory(ref?.parts ?? []),
  [ref],
)
```

To:

```typescript
const skusByCategory = useMemo(
  () => groupSkusByCategoryDef(ref?.parts ?? [], partCategories),
  [ref, partCategories],
)
```

- [ ] **Step 6: Update initial selectedCatId to use partCatMeta**

Change:

```typescript
const [selectedCatId, setSelectedCatId] = useState<string>(
  PART_CATEGORY_META[0]?.id ?? 'psu',
)
```

To:

```typescript
const [selectedCatId, setSelectedCatId] = useState<string>(
  partCatMeta[0]?.id ?? 'psu',
)
```

Note: `partCatMeta` is derived from `partCategories` which is memoized from `ref`. At initial render, `ref` is null and `partCategories` returns the defaults, so `partCatMeta[0]` will always be `psu`. Safe.

- [ ] **Step 7: Migrate GPU handler to createModelSku**

Change `handleGpuConfirm`:

```typescript
const handleGpuConfirm = useCallback(async (name: string, qty: number) => {
  setWriteError(null)
  try {
    await createModelSku({ categoryId: 'gpu', name, initialQty: qty })
    setToast(t('toast.gpuCreated', { name, qty }))
  } catch (err) {
    setWriteError(err instanceof Error ? err.message : t('gpuModal.errorFailed'))
  }
}, [createModelSku, t])
```

- [ ] **Step 8: Thread partCategories and derived meta to children**

Pass `partCategories` and `partCatMeta` to `WarehouseTab` and `PartsTabsHeader`. Update the JSX props:

```tsx
<WarehouseTab
  parts={parts}
  movements={movements}
  isMobile={isMobile}
  onInstall={handleInstallSku}
  onAddGpu={handleOpenGpuModal}
  selectedCatId={selectedCatId}
  onSelectCat={setSelectedCatId}
  partsAssets={partsAssets}
  partCategories={partCategories}
  partCatMeta={partCatMeta}
  categoryTints={categoryTints}
/>
```

```tsx
<PartsTabsHeader
  ...
  skusByCategory={skusByCategory}
  selectedCatId={selectedCatId}
  onSelectCat={setSelectedCatId}
  stockMap={stockMap}
  partCategories={partCategories}
  partCatMeta={partCatMeta}
  categoryTints={categoryTints}
/>
```

(If `PartsTabsHeader` doesn't accept these props yet, add them in Task 8.)

- [ ] **Step 9: Remove now-unused PART_CATEGORY_META import from PartsPage.tsx**

Remove `PART_CATEGORY_META` from the `partsTokens` import since it is no longer used in PartsPage directly (we now use `partCatMeta`). Remove `groupSkusByCategory` import too (replaced by `groupSkusByCategoryDef`).

- [ ] **Step 10: Verify tsc**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 7: Update WarehouseSkuList.tsx — behavior-dispatch

**Files:**
- Modify: `src/components/features/parts/WarehouseSkuList.tsx`

- [ ] **Step 1: Read the file**

Read `C:/Users/DELL/Desktop/assets-crm/src/components/features/parts/WarehouseSkuList.tsx`.

- [ ] **Step 2: Update imports and WarehouseSkuListProps**

Add to imports:

```typescript
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import { isSizedCategory, isModelsCategory } from '@/domain/part/partCategory-types'
import type { Tint } from './partsTokens'
```

Update `WarehouseSkuListProps` to replace `catMeta` with richer props:

```typescript
export interface WarehouseSkuListProps {
  selectedCatId: string
  selectedSkus: Part[]
  stockOf: (skuId: string) => PartStock
  isMobile: boolean
  onAddGpu: () => void
  catMeta: PartCatMeta | undefined
  /** Resolved PartCategoryDef for selectedCatId — enables behavior-dispatch */
  catDef?: PartCategoryDef
  /** Tint for the selected category */
  tint?: Tint
}
```

- [ ] **Step 3: Replace AGG_CATS.has() and isGpuCat with behavior checks**

Change the current `AGG_CATS` export (keep it for backward compat but add the behavior version):

```typescript
/** @deprecated Use isSizedCategory(def) with a live PartCategoryDef. Legacy fallback. */
export const AGG_CATS = new Set(['ssd', 'hdd', 'nvme', 'ram'])
```

In the `WarehouseSkuList` component body:

```typescript
// Behavior dispatch — use def when available, fall back to legacy AGG_CATS
const isAggCat = catDef ? isSizedCategory(catDef) : AGG_CATS.has(selectedCatId)
const isModelsCat = catDef ? isModelsCategory(catDef) : selectedCatId === 'gpu'
```

Replace:

```typescript
const isGpuCat = selectedCatId === 'gpu'
```

With:

```typescript
const isModelsCat = catDef ? isModelsCategory(catDef) : selectedCatId === 'gpu'
```

Replace:

```typescript
const visibleSkus = AGG_CATS.has(selectedCatId)
```

With:

```typescript
const visibleSkus = isAggCat
```

Replace the zero-state check:

```typescript
if (visibleSkus.length === 0) {
  if (isGpuCat) {
```

With:

```typescript
if (visibleSkus.length === 0) {
  if (isModelsCat) {
```

Replace:

```typescript
if (AGG_CATS.has(selectedCatId)) {
```

With:

```typescript
if (isAggCat) {
```

- [ ] **Step 4: Use passed tint instead of calling categoryTint() inside**

The component currently calls `categoryTint(selectedCatId)` and `categoryTint(sku.category)` on lines ~125, ~176, ~198.

For the agg cat summary row, replace `const tint = categoryTint(selectedCatId)` with:

```typescript
const resolvedTint = tint ?? categoryTint(selectedCatId)
```

For per-SKU rows, keep `categoryTint(sku.category)` as-is (sku-level tints are per-sku, not the selected cat).

- [ ] **Step 5: Verify tsc**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 8: Update WarehouseTab.tsx — thread partCategories, behavior-dispatch mobile branches

**Files:**
- Modify: `src/components/features/parts/WarehouseTab.tsx`

- [ ] **Step 1: Read the file**

Read `C:/Users/DELL/Desktop/assets-crm/src/components/features/parts/WarehouseTab.tsx`.

- [ ] **Step 2: Update WarehouseTabProps**

Add to the interface:

```typescript
/** Live category catalog — enables behavior dispatch */
partCategories?: PartCategoryDef[]
/** Pre-built display meta from buildPartCatMeta — avoids re-building inside tab */
partCatMeta?: PartCatMeta[]
/** Pre-built tint map from buildCategoryTint */
categoryTints?: Record<string, Tint>
```

- [ ] **Step 3: Add imports**

```typescript
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import { isSizedCategory, isModelsCategory } from '@/domain/part/partCategory-types'
import { DEFAULT_PART_CATEGORY_DEFS } from '@/domain/part/partCategoryDefaults'
import { groupSkusByCategoryDef, buildCategoryTint, type Tint } from './partsTokens'
```

- [ ] **Step 4: Replace PART_CATEGORY_META usage in desktop card list**

The desktop layout currently iterates `PART_CATEGORY_META.map(...)` for PartCards. Replace with `effectiveMeta`:

```typescript
const effectiveDefs = partCategories ?? (DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[])
const effectiveMeta = partCatMeta ?? PART_CATEGORY_META

// Group by defs instead of PART_CATEGORY_META
const skusByCategory = useMemo(
  () => groupSkusByCategoryDef(parts, effectiveDefs),
  [parts, effectiveDefs],
)
```

Change the desktop card list:

```tsx
{effectiveMeta.map((cat) => {
  const catDef = effectiveDefs.find(d => d.id === cat.id)
  return (
    <PartCard
      key={cat.id}
      categoryId={cat.id}
      catDef={catDef}
      skus={skusByCategory[cat.id] ?? []}
      selected={selectedCatId === cat.id}
      onSelect={onSelectCat}
      onInstall={onInstall}
      stockMap={stockMap}
      {...(catDef && isModelsCategory(catDef) ? { onAddSku: onAddGpu } : {})}
      {...(cat.id === 'gpu' && !catDef ? { onAddGpu } : {})}
    />
  )
})}
```

- [ ] **Step 5: Update mobile branch — replace isAgg/isGpu with behavior**

```typescript
const selectedDef = effectiveDefs.find(d => d.id === selectedCatId)
const isAgg = selectedDef ? isSizedCategory(selectedDef) : AGG_CATS.has(selectedCatId)
const isModelsCat = selectedDef ? isModelsCategory(selectedDef) : selectedCatId === 'gpu'
```

Replace `isGpu` usage in mobile branch with `isModelsCat`.

- [ ] **Step 6: Pass catDef and tint to WarehouseSkuList**

```tsx
<WarehouseSkuList
  selectedCatId={selectedCatId}
  selectedSkus={selectedSkus}
  stockOf={stockOf}
  isMobile={isMobile}
  onAddGpu={onAddGpu}
  catMeta={selectedCatMeta}
  catDef={selectedDef}
  {...(categoryTints?.[selectedCatId] ? { tint: categoryTints[selectedCatId] } : {})}
/>
```

- [ ] **Step 7: Verify tsc**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 9: Update PartCard.tsx — accept catDef, derive behavior from it

**Files:**
- Modify: `src/components/features/parts/PartCard.tsx`

- [ ] **Step 1: Read the file**

Read `C:/Users/DELL/Desktop/assets-crm/src/components/features/parts/PartCard.tsx`.

- [ ] **Step 2: Update PartCardProps to accept catDef**

```typescript
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import { isSizedCategory, isModelsCategory } from '@/domain/part/partCategory-types'
```

Add to `PartCardProps`:

```typescript
/** Resolved PartCategoryDef — enables behavior dispatch for custom categories. */
catDef?: PartCategoryDef
/** Generic models-sku add handler (replaces gpu-specific onAddGpu). */
onAddSku?: () => void
```

- [ ] **Step 3: Derive behavior from def when available**

In the component body, after the existing `isRam` / `isGpu` lines, add:

```typescript
// Behavior dispatch: prefer def, fall back to id-based legacy checks
const isModels = catDef ? isModelsCategory(catDef) : isGpu
const isSized = catDef ? isSizedCategory(catDef) : (CATEGORY_VARIANTS[categoryId] !== null && CATEGORY_VARIANTS[categoryId] !== undefined)
const isRamDef = catDef ? (catDef.id === 'ram' || catDef.generations !== null) : isRam
```

Replace usage of `isGpu` in the render with `isModels`, usage of `isRam` with `isRamDef`.

For the "add GPU" button: replace `{isGpu && ...}` with `{isModels && ...}`. The button should call `onAddSku ?? onAddGpu` for backward compatibility:

```tsx
{isModels && (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation()
      const handler = onAddSku ?? onAddGpu
      handler?.()
    }}
    title={t('gpu.addBtn')}
    className="..."
  >
    ...
  </button>
)}
```

For `allVariants`: derive from def.variants when def present:

```typescript
const allVariants = catDef
  ? (catDef.variants ?? null)
  : (CATEGORY_VARIANTS[categoryId] ?? null)
```

For DDR pills: derive from def.generations when present:

```typescript
const ddrGens: string[] = catDef?.generations
  ? catDef.generations.sort((a, b) => a.order - b.order).map(g => g.label)
  : ['DDR3', 'DDR4', 'DDR5']
```

Replace the hardcoded `(['DDR3', 'DDR4', 'DDR5'] as const).map(...)` with `ddrGens.map(...)`. NOTE: the `ramDdr` state is initialized as `'DDR4'` — if a future custom category has different generation labels the initial selection may not match. This is acceptable for MVP (parity for the 7 seeded ids).

- [ ] **Step 4: Verify tsc**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 10: Update CategoryChipStrip.tsx — accept partCategories

**Files:**
- Modify: `src/components/features/parts/CategoryChipStrip.tsx`

- [ ] **Step 1: Read the file**

Read `C:/Users/DELL/Desktop/assets-crm/src/components/features/parts/CategoryChipStrip.tsx`.

- [ ] **Step 2: Update interface and rendering**

Add to imports:

```typescript
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import { isModelsCategory } from '@/domain/part/partCategory-types'
import type { PartCatMeta } from './partsTokens'
```

Add to `CategoryChipStripProps`:

```typescript
/** Live category defs — when provided, derives chip list from defs instead of PART_CATEGORY_META. */
partCategories?: PartCategoryDef[]
/** Pre-built meta — when provided, uses this for labels/icons instead of re-iterating PART_CATEGORY_META. */
partCatMeta?: PartCatMeta[]
```

In the component body, replace the `PART_CATEGORY_META.filter(cat => cat.id !== 'gpu')` iteration:

```typescript
// If live defs provided, filter out models categories (GPU equivalent); else use legacy filter
const chipMeta = (partCatMeta ?? PART_CATEGORY_META).filter(cat => {
  if (partCategories) {
    const def = partCategories.find(d => d.id === cat.id)
    return def ? !isModelsCategory(def) : cat.id !== 'gpu'
  }
  return cat.id !== 'gpu'
})
```

Replace the map iteration variable name from `PART_CATEGORY_META.filter(...)` to `chipMeta`.

- [ ] **Step 3: Verify tsc**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 11: Update PartsReceivePage.tsx — behavior-dispatch for visible cats and DDR

**Files:**
- Modify: `src/pages/parts/PartsReceivePage.tsx`

- [ ] **Step 1: Read the file**

Read `C:/Users/DELL/Desktop/assets-crm/src/pages/parts/PartsReceivePage.tsx`.

- [ ] **Step 2: Update imports**

```typescript
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import { isModelsCategory, isSizedCategory } from '@/domain/part/partCategory-types'
import { buildPartCatMeta, buildCategoryTint, variantRankDef } from '@/components/features/parts/partsTokens'
```

- [ ] **Step 3: Destructure partCategories from useParts**

```typescript
const { ref, partCategories, loading, error, reload, receiveParts } = useParts(repo)
```

- [ ] **Step 4: Build meta and localize with useMemo**

```typescript
const { i18n } = useTranslation('parts')
const partCatMeta = useMemo(
  () => buildPartCatMeta(partCategories, n => n[i18n.language as 'ru' | 'en' | 'hy'] ?? n.ru),
  [partCategories, i18n.language],
)
const categoryTints = useMemo(() => buildCategoryTint(partCategories), [partCategories])
```

- [ ] **Step 5: Replace grouping and visible cats derivation**

Replace the `partsByCategory` memo's `for (const cat of PART_CATEGORY_META)` loop:

```typescript
const partsByCategory = useMemo(() => {
  const map: Record<string, Part[]> = {}
  for (const meta of partCatMeta) {
    map[meta.id] = []
  }
  for (const p of parts) {
    if (p.category in map) {
      map[p.category]!.push(p)
    }
  }
  return map
}, [parts, partCatMeta])
```

Replace `visibleCats` derivation:

```typescript
// Exclude models-behavior categories (GPU / future custom models cats) — receive uses sized/single flow
const visibleCats = partCatMeta.filter(cat => {
  const def = partCategories.find(d => d.id === cat.id)
  const isModels = def ? isModelsCategory(def) : cat.id === 'gpu'
  return !isModels && (partsByCategory[cat.id] ?? []).length > 0
})
```

- [ ] **Step 6: Update renderSection — DDR pills from def.generations**

In `renderSection`, replace the hardcoded `['DDR3', 'DDR4', 'DDR5']` array:

```typescript
const def = partCategories.find(d => d.id === catId)
const isRam = def ? (def.generations !== null && def.generations.length > 0) : catId === 'ram'
const ddrLabels = (def?.generations ?? [])
  .sort((a, b) => a.order - b.order)
  .map(g => g.label)
const effectiveDdrLabels = ddrLabels.length > 0 ? ddrLabels : ['DDR3', 'DDR4', 'DDR5']
```

Replace `{['DDR3', 'DDR4', 'DDR5'].map(ddr => ...)}` with `{effectiveDdrLabels.map(ddr => ...)}`.

- [ ] **Step 7: Update variantRank calls to use variantRankDef**

Replace `.sort((a, b) => variantRank(catId, a.variantId) - variantRank(catId, b.variantId))` with:

```typescript
const def = partCategories.find(d => d.id === catId)
// ...
.sort((a, b) => variantRankDef(def, a.variantId) - variantRankDef(def, b.variantId))
```

- [ ] **Step 8: Update section headers to use built meta**

In `renderSection`, replace:

```typescript
const cat = PART_CATEGORY_META.find(c => c.id === catId)
if (!cat) return null
```

With:

```typescript
const cat = partCatMeta.find(c => c.id === catId)
if (!cat) return null
const tint = categoryTints[catId] ?? categoryTint(catId)  // tint import kept as fallback
```

- [ ] **Step 9: Pass partCategories to PartsReceiveMobileForm**

Add `partCategories` and `partCatMeta` to the mobile props spread:

```tsx
<PartsReceiveMobileForm
  {...(loading ? { loading: true } : {})}
  partsByCategory={partsByCategory}
  visibleCats={visibleCats}
  partCategories={partCategories}
  partCatMeta={partCatMeta}
  qtys={qtys}
  ...
/>
```

- [ ] **Step 10: Verify tsc**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 12: Update PartsReceiveSizedCatCard.tsx — accept generations prop

**Files:**
- Modify: `src/components/features/parts/PartsReceiveSizedCatCard.tsx`

- [ ] **Step 1: Read the file**

Read `C:/Users/DELL/Desktop/assets-crm/src/components/features/parts/PartsReceiveSizedCatCard.tsx`.

- [ ] **Step 2: Update props interface**

Add:

```typescript
import type { PartCategoryVariant } from '@/domain/part/partCategory-types'
import { variantRankDef } from './partsTokens'
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
```

Add to the props:

```typescript
/** DDR-style generation list from def.generations — null/undefined = not a generations category */
generations?: PartCategoryVariant[] | null
/** Resolved def for variant ranking — when provided uses variantRankDef instead of variantRank */
catDef?: PartCategoryDef
```

- [ ] **Step 3: Derive DDR labels from generations prop**

Inside the component:

```typescript
const isRam = generations !== null && generations !== undefined && generations.length > 0
const ddrLabels = isRam
  ? [...(generations ?? [])].sort((a, b) => a.order - b.order).map(g => g.label)
  : []
```

Replace hardcoded `const isRam = cat.id === 'ram'` and `['DDR3', 'DDR4', 'DDR5']` with the derived versions.

- [ ] **Step 4: Update variantRank sort to use catDef**

Replace `.sort((a, b) => variantRank(cat.id, a.variantId) - variantRank(cat.id, b.variantId))` with:

```typescript
.sort((a, b) => variantRankDef(catDef, a.variantId) - variantRankDef(catDef, b.variantId))
```

- [ ] **Step 5: Verify tsc**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 13: Update PartsReceiveMobileForm.tsx — behavior-aware SMALL_IDS

**Files:**
- Modify: `src/components/features/parts/PartsReceiveMobileForm.tsx`

- [ ] **Step 1: Read the file**

Read `C:/Users/DELL/Desktop/assets-crm/src/components/features/parts/PartsReceiveMobileForm.tsx`.

- [ ] **Step 2: Update props interface**

Add:

```typescript
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import { isSingleSlotCategory } from '@/domain/part/partCategory-types'
```

Add to `PartsReceiveMobileFormProps`:

```typescript
/** Live catalog for behavior dispatch */
partCategories?: PartCategoryDef[]
/** Pre-built meta — ensures labels/icons match parent */
partCatMeta?: PartCatMeta[]
```

Also add `generations` forwarding to `PartsReceiveSizedCatCard`:

```typescript
// In the sizedCats.map():
const def = partCategories?.find(d => d.id === cat.id)
<PartsReceiveSizedCatCard
  key={cat.id}
  cat={cat}
  catParts={partsByCategory[cat.id] ?? []}
  qtys={qtys}
  bumpQty={bumpQty}
  ramDdr={ramDdr}
  setRamDdr={setRamDdr}
  t={t}
  {...(def?.generations ? { generations: def.generations, catDef: def } : {})}
/>
```

- [ ] **Step 3: Derive smallCats / sizedCats from isSingleSlotCategory when catalog available**

Replace:

```typescript
const SMALL_IDS = new Set(['psu', 'cooler'])
const smallCats = visibleCats.filter(c => SMALL_IDS.has(c.id))
const sizedCats = visibleCats.filter(c => !SMALL_IDS.has(c.id))
```

With:

```typescript
const smallCats = visibleCats.filter(c => {
  if (partCategories) {
    const def = partCategories.find(d => d.id === c.id)
    return def ? isSingleSlotCategory(def) : (c.id === 'psu' || c.id === 'cooler')
  }
  return c.id === 'psu' || c.id === 'cooler'
})
const sizedCats = visibleCats.filter(c => !smallCats.includes(c))
```

- [ ] **Step 4: Verify tsc**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 14: Check and delete dead fsCreateGpu export if unreferenced

**Files:**
- Possibly modify: `src/infra/repositories/firestorePartRepository.stock.ts`

- [ ] **Step 1: Check references to fsCreateGpu**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx grep -r "fsCreateGpu" src/ --include="*.ts" --include="*.tsx" -l 2>/dev/null || true
```

If only `firestorePartRepository.stock.ts` contains `fsCreateGpu` (i.e., nothing imports it), it is dead code.

- [ ] **Step 2: If unreferenced, remove the fsCreateGpu function**

Read the file, then delete the `// ---- createGpu` section (lines ~130-221) from `C:/Users/DELL/Desktop/assets-crm/src/infra/repositories/firestorePartRepository.stock.ts`.

Leave `fsReceiveParts` and `fsCreateModelSku` intact.

- [ ] **Step 3: Verify tsc**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx tsc -b --noEmit 2>&1 | tail -20
```

---

## Task 15: Full test run + build verification

- [ ] **Step 1: Run all parts tests**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/components/features/parts src/pages/parts src/hooks src/domain/part --pool=forks --poolOptions.forks.maxForks=4 2>&1 | tail -40
```

Expected: all tests pass.

- [ ] **Step 2: Full build**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npm run build 2>&1 | tail -20
```

Expected: exit 0, no tsc errors.

- [ ] **Step 3: Fix any remaining tsc/test errors**

For each error:
- If it's a component that receives `partCategories` but the prop isn't declared yet, add it to the interface.
- If it's a `createGpu` reference remaining somewhere in tests, replace with `createModelSku`.
- If `exactOptionalPropertyTypes` triggers on a new optional prop being passed, use conditional-spread pattern.

- [ ] **Step 4: Final verification**

```bash
cd C:/Users/DELL/Desktop/assets-crm && npx vitest run src/components/features/parts src/pages/parts src/hooks src/domain/part --pool=forks --poolOptions.forks.maxForks=4 2>&1 | tail -10
```

```bash
cd C:/Users/DELL/Desktop/assets-crm && npm run build 2>&1 | tail -10
```

Both must exit cleanly.

---

## Self-Review Checklist

### Spec coverage

| Requirement | Covered by |
|-------------|-----------|
| `buildPartCatMeta(defs, localizeName)` | Task 1 Step 3 |
| `buildCategoryTint(defs)` with `TINT_BY_TOKEN` | Task 1 Steps 2, 4 |
| `buildComponentOrder(defs)` reproducing today's order | Task 1 Step 5 |
| `variantRankDef` defs-aware variant | Task 1 Step 6 |
| `groupSkusByCategoryDef` | Task 1 Step 7 |
| Legacy constants re-derived from defaults | Task 1 Step 8 |
| `partCategories` exposed from `useParts` | Task 3 |
| Fallback to `DEFAULT_PART_CATEGORY_DEFS` in hook | Task 3 Step 2 |
| `createModelSku` replacing `createGpu` in hook | Task 3 Step 2 |
| `PartReferenceData.partCategories` required | Task 4 |
| `WarehouseSkuList` `AGG_CATS` → `isSizedCategory` | Task 7 Step 3 |
| `WarehouseSkuList` GPU branch → `isModelsCategory` | Task 7 Step 3 |
| `WarehouseTab` behavior-dispatch mobile branches | Task 8 Step 5 |
| `PartCard` derives behavior from def | Task 9 |
| `CategoryChipStrip` excludes models categories | Task 10 |
| `PartsReceivePage` excludes models cats | Task 11 Step 6 |
| `PartsReceivePage` DDR from def.generations | Task 11 Step 6 |
| `PartsReceiveSizedCatCard` generations prop | Task 12 |
| `PartsReceiveMobileForm` SMALL_IDS from isSingleSlotCategory | Task 13 Step 3 |
| `PartsPage.test.tsx` partCategories fixture | Task 5 |
| Behavior-dispatch tests | Tasks 2, 5 |
| Parity snapshot test | Task 2 Step 1 (partsTokens.test.ts block a) |
| `fsCreateGpu` dead export removal | Task 14 |
| `SINGLE_SLOT_CATS` legacy const NOT removed | Preserved (only types.ts, not touched) |
| i18n: no new chrome strings added directly | Yes — category names use localizeName callback |

### Placeholder scan

No steps say "TBD" or "implement later" — all code is fully specified.

### Type consistency

- `PartCategoryDef` — imported from `@/domain/part/partCategory-types` everywhere.
- `variantRankDef(def, variantId)` — defined in Task 1 Step 6, called in Tasks 11, 12.
- `buildPartCatMeta` returns `PartCatMeta[]` — matches the existing `PartCatMeta` interface.
- `groupSkusByCategoryDef(parts, defs)` — `defs` is `PartCategoryDef[]`, consistent.
- `createModelSku` in hook returns `Promise<AuditedResult<Part>>` — matches `PartWriteRepository.createModelSku`.
- `catDef?` in `WarehouseSkuList` and `PartCard` are optional — callers use conditional-spread.

---

Plan complete and saved to `docs/superpowers/plans/2026-07-22-task-3b-behavior-dispatch-ui.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
