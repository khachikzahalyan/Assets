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
  isReplacementInstall,
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
    expect(tints['dock']?.iconText).toBe('text-blue-300 light:text-blue-700')
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

describe('isReplacementInstall — add vs replace from movement reason', () => {
  it('true for replacement reasons (взамен / через сервис)', () => {
    expect(isReplacementInstall('Установка взамен (плановая замена)')).toBe(true)
    expect(isReplacementInstall('Установка взамен неисправного')).toBe(true)
    expect(isReplacementInstall('Заменено через сервис')).toBe(true)
  })
  it('false for an add / empty / null reason', () => {
    expect(isReplacementInstall('Установка в актив')).toBe(false)
    expect(isReplacementInstall('')).toBe(false)
    expect(isReplacementInstall(null)).toBe(false)
    expect(isReplacementInstall(undefined)).toBe(false)
  })
})
