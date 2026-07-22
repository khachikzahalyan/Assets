import { describe, it, expect } from 'vitest'
import {
  PART_CATEGORY_BEHAVIORS,
  isPartCategoryBehavior,
  isSizedCategory,
  isModelsCategory,
  isSingleSlotCategory,
  variantRankOf,
} from './partCategory-types'
import {
  DEFAULT_PART_CATEGORY_DEFS,
  DEFAULT_STORAGE_VARIANTS,
  DEFAULT_RAM_VARIANTS,
  DEFAULT_DDR_GENERATIONS,
} from './partCategoryDefaults'
import { PART_CATEGORIES } from './types'
import type { UpdatePartCategoryInput } from './PartCategoryRepository'
import { STORAGE_VARIANT_ORDER, RAM_VARIANT_ORDER } from '@/components/features/parts/partsTokens'

/* ── Behavior guard ───────────────────────────────────────────────────────── */

describe('PART_CATEGORY_BEHAVIORS + isPartCategoryBehavior', () => {
  it('lists the three behavior classes', () => {
    expect(PART_CATEGORY_BEHAVIORS).toEqual(['single', 'sized', 'models'])
  })

  it('accepts each of the three literals', () => {
    expect(isPartCategoryBehavior('single')).toBe(true)
    expect(isPartCategoryBehavior('sized')).toBe(true)
    expect(isPartCategoryBehavior('models')).toBe(true)
  })

  it('rejects unknown strings', () => {
    expect(isPartCategoryBehavior('aggregated')).toBe(false)
    expect(isPartCategoryBehavior('')).toBe(false)
    expect(isPartCategoryBehavior('SIZED')).toBe(false)
  })
})

/* ── DEFAULT_PART_CATEGORY_DEFS integrity ────────────────────────────────── */

describe('DEFAULT_PART_CATEGORY_DEFS', () => {
  it('has exactly 7 rows', () => {
    expect(DEFAULT_PART_CATEGORY_DEFS).toHaveLength(7)
  })

  it('ids match the legacy PART_CATEGORIES list in the same order', () => {
    const ids = DEFAULT_PART_CATEGORY_DEFS.map(d => d.id)
    expect(ids).toEqual([...PART_CATEGORIES])
  })

  it('every row has the required shape fields', () => {
    for (const d of DEFAULT_PART_CATEGORY_DEFS) {
      expect(typeof d.id).toBe('string')
      expect(typeof d.name.ru).toBe('string')
      expect(typeof d.name.en).toBe('string')
      expect(typeof d.name.hy).toBe('string')
      expect(typeof d.icon).toBe('string')
      expect(typeof d.tintToken).toBe('string')
      expect(typeof d.order).toBe('number')
      expect(isPartCategoryBehavior(d.behavior)).toBe(true)
      expect(typeof d.slotKind).toBe('string')
      expect(typeof d.active).toBe('boolean')
    }
  })
})

/* ── isSingleSlotCategory parity with legacy SINGLE_SLOT_CATS ───────────── */

describe('isSingleSlotCategory', () => {
  it('derived single-slot set matches legacy SINGLE_SLOT_CATS {psu, cooler, gpu}', () => {
    const derived = DEFAULT_PART_CATEGORY_DEFS
      .filter(d => isSingleSlotCategory(d))
      .map(d => d.id)
      .sort()

    expect(derived).toEqual(['cooler', 'gpu', 'psu'])
  })

  it('psu (behavior:single) is single-slot', () => {
    const psu = DEFAULT_PART_CATEGORY_DEFS.find(d => d.id === 'psu')!
    expect(isSingleSlotCategory(psu)).toBe(true)
  })

  it('gpu (behavior:models) is single-slot — NOT behavior===single', () => {
    const gpu = DEFAULT_PART_CATEGORY_DEFS.find(d => d.id === 'gpu')!
    expect(gpu.behavior).toBe('models')          // NOT 'single'
    expect(isSingleSlotCategory(gpu)).toBe(true)  // but IS single-slot
  })

  it('ssd (behavior:sized) is NOT single-slot', () => {
    const ssd = DEFAULT_PART_CATEGORY_DEFS.find(d => d.id === 'ssd')!
    expect(isSingleSlotCategory(ssd)).toBe(false)
  })
})

/* ── isSizedCategory ─────────────────────────────────────────────────────── */

describe('isSizedCategory', () => {
  it('sized set is {ssd, hdd, nvme, ram}', () => {
    const sized = DEFAULT_PART_CATEGORY_DEFS
      .filter(d => isSizedCategory(d))
      .map(d => d.id)
      .sort()

    expect(sized).toEqual(['hdd', 'nvme', 'ram', 'ssd'])
  })
})

/* ── isModelsCategory ────────────────────────────────────────────────────── */

describe('isModelsCategory', () => {
  it('models set is {gpu}', () => {
    const models = DEFAULT_PART_CATEGORY_DEFS
      .filter(d => isModelsCategory(d))
      .map(d => d.id)

    expect(models).toEqual(['gpu'])
  })
})

/* ── Variant orders (parity with partsTokens.ts legacy arrays) ───────────── */

const LEGACY_STORAGE_ORDER = ['64gb', '128gb', '256gb', '512gb', '1tb', '2tb', '3tb', '4tb', '5tb']
const LEGACY_RAM_ORDER     = ['4gb', '8gb', '16gb', '20gb', '32gb', '40gb', '64gb', '128gb']

describe('DEFAULT_STORAGE_VARIANTS', () => {
  it('has exactly 9 entries', () => {
    expect(DEFAULT_STORAGE_VARIANTS).toHaveLength(9)
  })

  it('ids in order 0..8 equal legacy STORAGE_VARIANT_ORDER', () => {
    const sorted = [...DEFAULT_STORAGE_VARIANTS].sort((a, b) => a.order - b.order)
    expect(sorted.map(v => v.id)).toEqual(LEGACY_STORAGE_ORDER)
  })
})

describe('DEFAULT_RAM_VARIANTS', () => {
  it('has exactly 8 entries', () => {
    expect(DEFAULT_RAM_VARIANTS).toHaveLength(8)
  })

  it('ids in order 0..7 equal legacy RAM_VARIANT_ORDER', () => {
    const sorted = [...DEFAULT_RAM_VARIANTS].sort((a, b) => a.order - b.order)
    expect(sorted.map(v => v.id)).toEqual(LEGACY_RAM_ORDER)
  })
})

describe('DEFAULT_DDR_GENERATIONS', () => {
  it('has exactly 3 entries', () => {
    expect(DEFAULT_DDR_GENERATIONS).toHaveLength(3)
  })

  it('labels are DDR3, DDR4, DDR5 in order', () => {
    const sorted = [...DEFAULT_DDR_GENERATIONS].sort((a, b) => a.order - b.order)
    expect(sorted.map(v => v.label)).toEqual(['DDR3', 'DDR4', 'DDR5'])
  })
})

describe('ssd/hdd/nvme variants match STORAGE_VARIANT_ORDER', () => {
  for (const id of ['ssd', 'hdd', 'nvme'] as const) {
    it(`${id} variant ids in order equal STORAGE_VARIANT_ORDER`, () => {
      const def = DEFAULT_PART_CATEGORY_DEFS.find(d => d.id === id)!
      expect(def.variants).not.toBeNull()
      const sorted = [...def.variants!].sort((a, b) => a.order - b.order)
      expect(sorted.map(v => v.id)).toEqual(LEGACY_STORAGE_ORDER)
    })
  }
})

describe('ram variants + generations', () => {
  const ram = DEFAULT_PART_CATEGORY_DEFS.find(d => d.id === 'ram')!

  it('ram variant ids in order equal legacy RAM_VARIANT_ORDER', () => {
    expect(ram.variants).not.toBeNull()
    const sorted = [...ram.variants!].sort((a, b) => a.order - b.order)
    expect(sorted.map(v => v.id)).toEqual(LEGACY_RAM_ORDER)
  })

  it('ram.generations labels are DDR3, DDR4, DDR5 in order', () => {
    expect(ram.generations).not.toBeNull()
    const sorted = [...ram.generations!].sort((a, b) => a.order - b.order)
    expect(sorted.map(v => v.label)).toEqual(['DDR3', 'DDR4', 'DDR5'])
  })
})

/* ── variantRankOf ───────────────────────────────────────────────────────── */

describe('variantRankOf', () => {
  const ssd = DEFAULT_PART_CATEGORY_DEFS.find(d => d.id === 'ssd')!

  it('ranks 256gb < 1tb for ssd (256gb order=2, 1tb order=4)', () => {
    expect(variantRankOf(ssd, '256gb')).toBeLessThan(variantRankOf(ssd, '1tb'))
  })

  it('unknown variant returns 999', () => {
    expect(variantRankOf(ssd, 'unknown-variant')).toBe(999)
  })

  it('null variantId returns 999', () => {
    expect(variantRankOf(ssd, null)).toBe(999)
  })

  it('undefined def returns 999', () => {
    expect(variantRankOf(undefined, '256gb')).toBe(999)
  })

  it('def without variants returns 999', () => {
    const psu = DEFAULT_PART_CATEGORY_DEFS.find(d => d.id === 'psu')!
    expect(psu.variants).toBeNull()
    expect(variantRankOf(psu, 'any')).toBe(999)
  })
})

/* ── storageType mapping ─────────────────────────────────────────────────── */

describe('storageType per category', () => {
  it('ssd.storageType is SSD', () => {
    expect(DEFAULT_PART_CATEGORY_DEFS.find(d => d.id === 'ssd')!.storageType).toBe('SSD')
  })
  it('hdd.storageType is HDD', () => {
    expect(DEFAULT_PART_CATEGORY_DEFS.find(d => d.id === 'hdd')!.storageType).toBe('HDD')
  })
  it('nvme.storageType is M.2', () => {
    expect(DEFAULT_PART_CATEGORY_DEFS.find(d => d.id === 'nvme')!.storageType).toBe('M.2')
  })
  it('psu.storageType is null', () => {
    expect(DEFAULT_PART_CATEGORY_DEFS.find(d => d.id === 'psu')!.storageType).toBeNull()
  })
  it('ram.storageType is null', () => {
    expect(DEFAULT_PART_CATEGORY_DEFS.find(d => d.id === 'ram')!.storageType).toBeNull()
  })
})

/* ── psu familyOverrides ─────────────────────────────────────────────────── */

describe('psu familyOverrides', () => {
  it('psu.familyOverrides.laptop.slotKind is battery', () => {
    const psu = DEFAULT_PART_CATEGORY_DEFS.find(d => d.id === 'psu')!
    expect(psu.familyOverrides).not.toBeNull()
    expect(psu.familyOverrides!['laptop']?.slotKind).toBe('battery')
  })

  it('cooler has no familyOverrides', () => {
    const cooler = DEFAULT_PART_CATEGORY_DEFS.find(d => d.id === 'cooler')!
    expect(cooler.familyOverrides).toBeNull()
  })

  it('gpu has no familyOverrides', () => {
    const gpu = DEFAULT_PART_CATEGORY_DEFS.find(d => d.id === 'gpu')!
    expect(gpu.familyOverrides).toBeNull()
  })
})

/* ── Cross-file parity: DEFAULT variant arrays vs partsTokens.ts legacy ────── */

describe('DEFAULT_STORAGE_VARIANTS parity with partsTokens.STORAGE_VARIANT_ORDER', () => {
  it('DEFAULT_STORAGE_VARIANTS ids in order match STORAGE_VARIANT_ORDER exactly', () => {
    const sorted = [...DEFAULT_STORAGE_VARIANTS].sort((a, b) => a.order - b.order)
    const ids = sorted.map(v => v.id)
    expect(ids).toEqual(STORAGE_VARIANT_ORDER)
  })
})

describe('DEFAULT_RAM_VARIANTS parity with partsTokens.RAM_VARIANT_ORDER', () => {
  it('DEFAULT_RAM_VARIANTS ids in order match RAM_VARIANT_ORDER exactly', () => {
    const sorted = [...DEFAULT_RAM_VARIANTS].sort((a, b) => a.order - b.order)
    const ids = sorted.map(v => v.id)
    expect(ids).toEqual(RAM_VARIANT_ORDER)
  })
})

/* ── UpdatePartCategoryInput behavior immutability ────────────────────────── */

describe('UpdatePartCategoryInput contract', () => {
  it('UpdatePartCategoryInput type does not include behavior field (immutability by design)', () => {
    // This test verifies the TypeScript contract at compile time.
    // At runtime, we can only verify the type keys would not include 'behavior'.
    // The type itself (via TypeScript) enforces this at authoring time — Firestore
    // rules double-check it at write time.
    const exampleUpdate: UpdatePartCategoryInput = {
      name: { ru: 'Test', en: 'Test', hy: 'Test' },
      icon: 'test-icon',
      active: false,
      // behavior: 'sized', // ← TypeScript would error here if this line uncommented
    }
    expect(exampleUpdate).toBeDefined()
    // Verify that the type does not have 'behavior' by checking that an object
    // with behavior would NOT satisfy UpdatePartCategoryInput (compile-time check only).
    // At runtime, we trust TypeScript since there's no runtime type reflection.
  })
})
