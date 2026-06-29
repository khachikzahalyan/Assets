// src/domain/part/partStock.test.ts
//
// Pure unit tests for the stock-derivation and slot-resolution helpers.
// No Firebase, no React — these are plain Vitest tests over pure functions.

import { describe, it, expect } from 'vitest'
import {
  deriveStock,
  workingStock,
  slotKindForSku,
  storageTypeForSku,
  slotIsSingle,
  currentPartsForSkuCategory,
  isServiceOnly,
  assetFamilyOf,
  synthesizeInstalledSlots,
  resolveUpgradeCurrent,
} from './partStock'
import type { UpgradeSlot } from './types'

// ---------------------------------------------------------------------------
// assetFamilyOf
// ---------------------------------------------------------------------------
describe('assetFamilyOf', () => {
  it('cat_laptop → laptop', () => {
    expect(assetFamilyOf('cat_laptop')).toBe('laptop')
  })

  it('cat_macbook_pro → laptop', () => {
    expect(assetFamilyOf('cat_macbook_pro')).toBe('laptop')
  })

  it('cat_thinkpad → laptop', () => {
    expect(assetFamilyOf('cat_thinkpad')).toBe('laptop')
  })

  it('cat_server → server', () => {
    expect(assetFamilyOf('cat_server')).toBe('server')
  })

  it('cat_rack_server → server', () => {
    expect(assetFamilyOf('cat_rack_server')).toBe('server')
  })

  it('cat_desktop → desktop', () => {
    expect(assetFamilyOf('cat_desktop')).toBe('desktop')
  })

  it('cat_computer → desktop', () => {
    expect(assetFamilyOf('cat_computer')).toBe('desktop')
  })

  it('cat_aio → desktop', () => {
    expect(assetFamilyOf('cat_aio')).toBe('desktop')
  })

  it('unknown category → null', () => {
    expect(assetFamilyOf('cat_monitor')).toBeNull()
  })

  it('empty string → null', () => {
    expect(assetFamilyOf('')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// isServiceOnly
// ---------------------------------------------------------------------------
describe('isServiceOnly', () => {
  it('cat_laptop → true (laptop family)', () => {
    expect(isServiceOnly('cat_laptop')).toBe(true)
  })

  it('cat_macbook_air → true (laptop family)', () => {
    expect(isServiceOnly('cat_macbook_air')).toBe(true)
  })

  it('cat_thinkpad → true (laptop family)', () => {
    expect(isServiceOnly('cat_thinkpad')).toBe(true)
  })

  it('cat_aio → true (explicit AIO override)', () => {
    expect(isServiceOnly('cat_aio')).toBe(true)
  })

  it('cat_desktop → false (in-house upgradeable)', () => {
    expect(isServiceOnly('cat_desktop')).toBe(false)
  })

  it('cat_computer → false (desktop family)', () => {
    expect(isServiceOnly('cat_computer')).toBe(false)
  })

  it('cat_server → false (server family)', () => {
    expect(isServiceOnly('cat_server')).toBe(false)
  })

  it('cat_workstation → false (desktop family)', () => {
    expect(isServiceOnly('cat_workstation')).toBe(false)
  })

  it('unknown non-upgradeable category → false', () => {
    expect(isServiceOnly('cat_monitor')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// deriveStock
// ---------------------------------------------------------------------------
describe('deriveStock', () => {
  it('empty movement list returns empty map', () => {
    expect(deriveStock([])).toEqual({})
  })

  it('single receive creates onHand with zero broken', () => {
    const result = deriveStock([{ type: 'receive', skuId: 'sku_ram_8gb', qty: 10 }])
    expect(result['sku_ram_8gb']).toEqual({ onHand: 10, broken: 0 })
  })

  it('receive then install reduces onHand', () => {
    const result = deriveStock([
      { type: 'receive', skuId: 'sku_ssd_256', qty: 5 },
      { type: 'install', skuId: 'sku_ssd_256', qty: 2 },
    ])
    expect(result['sku_ssd_256']).toEqual({ onHand: 3, broken: 0 })
  })

  it('uninstall with broken=false returns to onHand', () => {
    const result = deriveStock([
      { type: 'receive', skuId: 'sku_cooler_a', qty: 3 },
      { type: 'install', skuId: 'sku_cooler_a', qty: 1 },
      { type: 'uninstall', skuId: 'sku_cooler_a', qty: 1, broken: false },
    ])
    expect(result['sku_cooler_a']).toEqual({ onHand: 3, broken: 0 })
  })

  it('uninstall with broken=true increments broken, not onHand', () => {
    const result = deriveStock([
      { type: 'receive', skuId: 'sku_psu_500w', qty: 4 },
      { type: 'install', skuId: 'sku_psu_500w', qty: 2 },
      { type: 'uninstall', skuId: 'sku_psu_500w', qty: 1, broken: true },
    ])
    expect(result['sku_psu_500w']).toEqual({ onHand: 2, broken: 1 })
  })

  it('sequence of receive / install / uninstall(broken) / uninstall(!broken)', () => {
    const result = deriveStock([
      { type: 'receive',   skuId: 'sku_ram_16gb', qty: 10 },
      { type: 'install',   skuId: 'sku_ram_16gb', qty: 4  },
      { type: 'uninstall', skuId: 'sku_ram_16gb', qty: 1, broken: true  },
      { type: 'uninstall', skuId: 'sku_ram_16gb', qty: 2, broken: false },
    ])
    // onHand: 10 - 4 + 2 = 8; broken: 1
    expect(result['sku_ram_16gb']).toEqual({ onHand: 8, broken: 1 })
  })

  it('serviceReplace movement is ignored entirely — does not affect onHand or broken', () => {
    const result = deriveStock([
      { type: 'receive', skuId: 'sku_hdd_1tb', qty: 5 },
      // This install via service centre should be skipped
      { type: 'install', skuId: 'sku_hdd_1tb', qty: 3, serviceReplace: true },
    ])
    expect(result['sku_hdd_1tb']).toEqual({ onHand: 5, broken: 0 })
  })

  it('serviceReplace uninstall is also ignored', () => {
    const result = deriveStock([
      { type: 'receive',   skuId: 'sku_nvme_512', qty: 6 },
      { type: 'install',   skuId: 'sku_nvme_512', qty: 2 },
      { type: 'uninstall', skuId: 'sku_nvme_512', qty: 1, broken: true, serviceReplace: true },
    ])
    // The serviceReplace uninstall must not increment broken
    expect(result['sku_nvme_512']).toEqual({ onHand: 4, broken: 0 })
  })

  it('negative onHand is clamped to 0', () => {
    // Install more than ever received (data anomaly)
    const result = deriveStock([
      { type: 'receive', skuId: 'sku_ram_4gb', qty: 1 },
      { type: 'install', skuId: 'sku_ram_4gb', qty: 5 },
    ])
    expect(result['sku_ram_4gb']!.onHand).toBe(0)
  })

  it('multiple SKUs are tracked independently', () => {
    const result = deriveStock([
      { type: 'receive', skuId: 'sku_ram_8gb',  qty: 10 },
      { type: 'receive', skuId: 'sku_ssd_256',  qty: 5  },
      { type: 'install', skuId: 'sku_ram_8gb',  qty: 3  },
      { type: 'install', skuId: 'sku_ssd_256',  qty: 2  },
      { type: 'uninstall', skuId: 'sku_ram_8gb', qty: 1, broken: false },
    ])
    expect(result['sku_ram_8gb']).toEqual({ onHand: 8, broken: 0 })
    expect(result['sku_ssd_256']).toEqual({ onHand: 3, broken: 0 })
  })

  it('skuId missing (empty string) is skipped', () => {
    const result = deriveStock([
      { type: 'receive', skuId: '', qty: 5 },
    ])
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('qty defaults to 1 when absent', () => {
    const result = deriveStock([
      { type: 'receive', skuId: 'sku_gpu_rtx' },
    ])
    expect(result['sku_gpu_rtx']).toEqual({ onHand: 1, broken: 0 })
  })
})

// ---------------------------------------------------------------------------
// workingStock
// ---------------------------------------------------------------------------
describe('workingStock', () => {
  it('onHand > broken → onHand minus broken', () => {
    expect(workingStock({ onHand: 10, broken: 3 })).toBe(7)
  })

  it('onHand === broken → 0', () => {
    expect(workingStock({ onHand: 5, broken: 5 })).toBe(0)
  })

  it('onHand < broken → 0 (clamped)', () => {
    // Defensive: broken anomalously exceeds onHand
    expect(workingStock({ onHand: 2, broken: 4 })).toBe(0)
  })

  it('no broken → equal to onHand', () => {
    expect(workingStock({ onHand: 8, broken: 0 })).toBe(8)
  })

  it('both zero → 0', () => {
    expect(workingStock({ onHand: 0, broken: 0 })).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// slotKindForSku
// ---------------------------------------------------------------------------
describe('slotKindForSku', () => {
  it('psu on laptop family → battery', () => {
    expect(slotKindForSku('psu', 'laptop')).toBe('battery')
  })

  it('psu on desktop family → psu', () => {
    expect(slotKindForSku('psu', 'desktop')).toBe('psu')
  })

  it('psu on server family → psu', () => {
    expect(slotKindForSku('psu', 'server')).toBe('psu')
  })

  it('psu on null family → psu', () => {
    expect(slotKindForSku('psu', null)).toBe('psu')
  })

  it('ram → ram (family-independent)', () => {
    expect(slotKindForSku('ram', 'laptop')).toBe('ram')
    expect(slotKindForSku('ram', 'server')).toBe('ram')
    expect(slotKindForSku('ram', 'desktop')).toBe('ram')
  })

  it('ssd → storage', () => {
    expect(slotKindForSku('ssd', 'desktop')).toBe('storage')
  })

  it('hdd → storage', () => {
    expect(slotKindForSku('hdd', 'server')).toBe('storage')
  })

  it('nvme → storage', () => {
    expect(slotKindForSku('nvme', 'laptop')).toBe('storage')
  })

  it('cooler → cooler (family-independent)', () => {
    expect(slotKindForSku('cooler', 'desktop')).toBe('cooler')
    expect(slotKindForSku('cooler', 'server')).toBe('cooler')
  })

  it('gpu → null (no slot mapping for gpu)', () => {
    expect(slotKindForSku('gpu', 'desktop')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// storageTypeForSku
// ---------------------------------------------------------------------------
describe('storageTypeForSku', () => {
  it('ssd → SSD', () => {
    expect(storageTypeForSku('ssd')).toBe('SSD')
  })

  it('hdd → HDD', () => {
    expect(storageTypeForSku('hdd')).toBe('HDD')
  })

  it('nvme → M.2', () => {
    expect(storageTypeForSku('nvme')).toBe('M.2')
  })

  it('ram → null (not a storage category)', () => {
    expect(storageTypeForSku('ram')).toBeNull()
  })

  it('psu → null', () => {
    expect(storageTypeForSku('psu')).toBeNull()
  })

  it('cooler → null', () => {
    expect(storageTypeForSku('cooler')).toBeNull()
  })

  it('gpu → null', () => {
    expect(storageTypeForSku('gpu')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// slotIsSingle
// ---------------------------------------------------------------------------
describe('slotIsSingle', () => {
  it('battery → always single regardless of family', () => {
    expect(slotIsSingle('battery', 'laptop')).toBe(true)
    expect(slotIsSingle('battery', 'desktop')).toBe(true)
    expect(slotIsSingle('battery', 'server')).toBe(true)
    expect(slotIsSingle('battery', null)).toBe(true)
  })

  it('cooler on non-server → single', () => {
    expect(slotIsSingle('cooler', 'laptop')).toBe(true)
    expect(slotIsSingle('cooler', 'desktop')).toBe(true)
  })

  it('cooler on server → multiple (not single)', () => {
    expect(slotIsSingle('cooler', 'server')).toBe(false)
  })

  it('psu on non-server → single', () => {
    expect(slotIsSingle('psu', 'desktop')).toBe(true)
    expect(slotIsSingle('psu', 'laptop')).toBe(true)
  })

  it('psu on server → multiple (not single)', () => {
    expect(slotIsSingle('psu', 'server')).toBe(false)
  })

  it('ram → always multiple (not single)', () => {
    expect(slotIsSingle('ram', 'laptop')).toBe(false)
    expect(slotIsSingle('ram', 'desktop')).toBe(false)
    expect(slotIsSingle('ram', 'server')).toBe(false)
  })

  it('storage → always multiple (not single)', () => {
    expect(slotIsSingle('storage', 'laptop')).toBe(false)
    expect(slotIsSingle('storage', 'desktop')).toBe(false)
    expect(slotIsSingle('storage', 'server')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// currentPartsForSkuCategory
// ---------------------------------------------------------------------------
describe('currentPartsForSkuCategory', () => {
  it('null upgradeCurrent returns empty array', () => {
    expect(currentPartsForSkuCategory(null, 'ram', 'desktop')).toEqual([])
  })

  it('undefined upgradeCurrent returns empty array', () => {
    expect(currentPartsForSkuCategory(undefined, 'ssd', 'laptop')).toEqual([])
  })

  it('empty upgradeCurrent returns empty array', () => {
    expect(currentPartsForSkuCategory([], 'ram', 'desktop')).toEqual([])
  })

  it('skuCat with no slot mapping (gpu) returns empty array', () => {
    const slots: UpgradeSlot[] = [{ kind: 'ram', spec: '8GB DDR4' }]
    expect(currentPartsForSkuCategory(slots, 'gpu', 'desktop')).toEqual([])
  })

  it('ram skuCat returns only ram slots', () => {
    const slots: UpgradeSlot[] = [
      { kind: 'ram',     spec: '8GB DDR4' },
      { kind: 'storage', spec: '256GB SSD' },
      { kind: 'ram',     spec: '16GB DDR4' },
    ]
    const result = currentPartsForSkuCategory(slots, 'ram', 'desktop')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ idx: 0, slot: slots[0], isEmpty: false })
    expect(result[1]).toEqual({ idx: 2, slot: slots[2], isEmpty: false })
  })

  it('ssd skuCat matches storage slots (shared bay pool with hdd and nvme)', () => {
    const slots: UpgradeSlot[] = [
      { kind: 'storage', spec: '512GB M.2', storageType: 'M.2' },
      { kind: 'ram',     spec: '16GB DDR4' },
      { kind: 'storage', spec: '1TB HDD',   storageType: 'HDD' },
    ]
    // SSD maps to 'storage' slotKind; all storage slots are returned regardless of storageType
    const result = currentPartsForSkuCategory(slots, 'ssd', 'desktop')
    expect(result).toHaveLength(2)
    expect(result[0]!.idx).toBe(0)
    expect(result[1]!.idx).toBe(2)
  })

  it('nvme skuCat also matches existing HDD and SSD storage entries (shared bay pool)', () => {
    const slots: UpgradeSlot[] = [
      { kind: 'storage', spec: '2TB HDD', storageType: 'HDD' },
    ]
    const result = currentPartsForSkuCategory(slots, 'nvme', 'laptop')
    expect(result).toHaveLength(1)
    expect(result[0]!.idx).toBe(0)
  })

  it('empty-spec factory slot still counts as a candidate (isEmpty=true)', () => {
    const slots: UpgradeSlot[] = [
      { kind: 'ram', spec: '' },
    ]
    const result = currentPartsForSkuCategory(slots, 'ram', 'laptop')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ idx: 0, slot: slots[0], isEmpty: true })
  })

  it('psu on laptop resolves to battery slotKind — only battery slots returned', () => {
    const slots: UpgradeSlot[] = [
      { kind: 'battery', spec: '60Wh' },
      { kind: 'psu',     spec: '500W' }, // desktop-style slot, should NOT match on a laptop
    ]
    const result = currentPartsForSkuCategory(slots, 'psu', 'laptop')
    expect(result).toHaveLength(1)
    expect(result[0]!.slot.kind).toBe('battery')
  })

  it('psu on desktop resolves to psu slotKind — only psu slots returned', () => {
    const slots: UpgradeSlot[] = [
      { kind: 'psu',     spec: '500W' },
      { kind: 'battery', spec: '60Wh' },
    ]
    const result = currentPartsForSkuCategory(slots, 'psu', 'desktop')
    expect(result).toHaveLength(1)
    expect(result[0]!.slot.kind).toBe('psu')
  })

  it('category with no matching slot kind in upgradeCurrent returns empty array', () => {
    const slots: UpgradeSlot[] = [
      { kind: 'ram', spec: '8GB' },
    ]
    expect(currentPartsForSkuCategory(slots, 'cooler', 'desktop')).toEqual([])
  })

  it('idx is the correct zero-based index into upgradeCurrent', () => {
    const slots: UpgradeSlot[] = [
      { kind: 'cooler',  spec: 'Stock cooler' },
      { kind: 'ram',     spec: '8GB' },
      { kind: 'cooler',  spec: '' },
    ]
    const result = currentPartsForSkuCategory(slots, 'cooler', 'desktop')
    expect(result[0]!.idx).toBe(0)
    expect(result[1]!.idx).toBe(2)
  })

  it('isEmpty is false when spec is a non-empty string', () => {
    const slots: UpgradeSlot[] = [
      { kind: 'storage', spec: '500GB SSD' },
    ]
    const result = currentPartsForSkuCategory(slots, 'ssd', 'desktop')
    expect(result[0]!.isEmpty).toBe(false)
  })

  it('isEmpty is true when spec is an empty string', () => {
    const slots: UpgradeSlot[] = [
      { kind: 'storage', spec: '' },
    ]
    const result = currentPartsForSkuCategory(slots, 'hdd', 'server')
    expect(result[0]!.isEmpty).toBe(true)
  })
})

describe('synthesizeInstalledSlots', () => {
  it('returns [] for a non-upgradeable category', () => {
    expect(synthesizeInstalledSlots('cat_monitor', { ram: '8 ГБ' })).toEqual([])
  })

  it('desktop: psu + ram + storage(SSD) + gpu + cooler from currentSpecs', () => {
    const slots = synthesizeInstalledSlots('cat_desktop', {
      cpu: 'Intel Core i3 8 Gen',
      ram: '12 ГБ DDR4',
      ssd: '512 ГБ',
      gpu: 'Встроенная',
    })
    const kinds = slots.map(s => s.kind)
    expect(kinds).toContain('psu')
    expect(kinds).toContain('cooler')
    expect(slots.find(s => s.kind === 'ram')?.spec).toBe('12 ГБ DDR4')
    const storage = slots.find(s => s.kind === 'storage')
    expect(storage?.spec).toBe('512 ГБ')
    expect(storage?.storageType).toBe('SSD')
    expect(slots.find(s => s.kind === 'gpu')?.spec).toBe('Встроенная')
    // desktop has no battery
    expect(kinds).not.toContain('battery')
  })

  it('laptop: battery + cooler, no psu', () => {
    const kinds = synthesizeInstalledSlots('cat_laptop', { ram: '8 ГБ' }).map(s => s.kind)
    expect(kinds).toContain('battery')
    expect(kinds).toContain('cooler')
    expect(kinds).not.toContain('psu')
  })

  it('omits spec slots when currentSpecs is empty (factory cooler/psu still present)', () => {
    const slots = synthesizeInstalledSlots('cat_desktop', null)
    const kinds = slots.map(s => s.kind)
    expect(kinds).toEqual(expect.arrayContaining(['psu', 'cooler']))
    expect(kinds).not.toContain('ram')
    expect(kinds).not.toContain('storage')
    expect(kinds).not.toContain('gpu')
  })
})

describe('resolveUpgradeCurrent', () => {
  const specs = { ram: '16 ГБ DDR5', ssd: '1 ТБ' }

  it('no explicit → full synthesized set (fresh asset)', () => {
    const slots = resolveUpgradeCurrent('cat_laptop', specs, null)
    expect(slots.map(s => s.kind)).toEqual(['ram', 'storage', 'cooler', 'battery'])
    // factory slots carry no replaced flag
    expect(slots.every(s => !s.replaced)).toBe(true)
  })

  it('heals a collapsed asset: a 1-slot explicit re-expands to the full set', () => {
    // Simulates an asset broken by the old behaviour: only the replaced battery
    // was persisted. The list must NOT collapse — it re-expands and the battery
    // shows as replaced.
    const collapsed: UpgradeSlot[] = [
      { kind: 'battery', spec: 'Дополнительный АКБ', replaced: true },
    ]
    const slots = resolveUpgradeCurrent('cat_laptop', specs, collapsed)
    expect(slots.map(s => s.kind)).toEqual(['ram', 'storage', 'cooler', 'battery'])
    const battery = slots.find(s => s.kind === 'battery')
    expect(battery?.replaced).toBe(true)
    expect(battery?.spec).toBe('Дополнительный АКБ')
    // untouched slots stay factory
    expect(slots.find(s => s.kind === 'cooler')?.replaced).toBeFalsy()
  })

  it('appends extra parts beyond the factory count (2nd RAM stick)', () => {
    const explicit: UpgradeSlot[] = [
      { kind: 'ram', spec: '16 ГБ DDR5', replaced: false },
      { kind: 'ram', spec: '32 ГБ DDR5', replaced: true },
    ]
    const rams = resolveUpgradeCurrent('cat_laptop', specs, explicit).filter(s => s.kind === 'ram')
    expect(rams).toHaveLength(2)
    expect(rams[1]?.spec).toBe('32 ГБ DDR5')
  })
})
