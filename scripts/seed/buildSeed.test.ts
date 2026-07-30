import { describe, it, expect } from 'vitest'
import {
  STATUS_SEED, BRANCH_SEED, DEPARTMENT_SEED,
  CORE_CATEGORY_SEED, ALL_CATEGORY_SOURCE, buildAllCategorySeed,
  PART_CATEGORY_SEED, PART_SEED,
} from './referenceData'
import type { Part } from '../../src/domain/part/types'
import { buildSeedDocs } from './buildSeed'
import type { AssetStatus } from '../../src/domain/asset_status'
import type { Category } from '../../src/domain/category'
import { InMemoryCategoryRepository } from '../../src/infra/repositories/inMemoryCategoryRepository'
import { InMemoryAssetStatusRepository } from '../../src/infra/repositories/inMemoryAssetStatusRepository'
import {
  DEFAULT_STORAGE_VARIANTS,
  DEFAULT_RAM_VARIANTS,
  DEFAULT_DDR_GENERATIONS,
} from '../../src/domain/part/partCategoryDefaults'

describe('reference data', () => {
  it('has the 4 canonical system statuses with correct ids/flags', () => {
    expect(STATUS_SEED.map(s => s.id)).toEqual(
      ['st_warehouse', 'st_pending', 'st_assigned', 'st_repair', 'st_disposed'])
    expect(STATUS_SEED.every(s => s.isSystem)).toBe(true)
    const disposed = STATUS_SEED.find(s => s.id === 'st_disposed')!
    expect(disposed.isFinal).toBe(true)
    expect(STATUS_SEED.filter(s => s.isFinal)).toHaveLength(1)
    expect(STATUS_SEED.map(s => s.sortOrder)).toEqual([0, 1, 2, 3, 4])
  })
  it('has 5 branches with br_main as the warehouse type', () => {
    expect(BRANCH_SEED).toHaveLength(5)
    expect(BRANCH_SEED.find(b => b.id === 'br_main')!.type).toBe('warehouse')
    expect(BRANCH_SEED.filter(b => b.id !== 'br_main').every(b => b.type === 'branch')).toBe(true)
  })
  it('has 6 departments', () => {
    expect(DEPARTMENT_SEED.map(d => d.id)).toEqual(
      ['dep_it', 'dep_hr', 'dep_sales', 'dep_finance', 'dep_legal', 'dep_ops'])
  })
})

describe('categories', () => {
  it('core set has unique ids and unique prefixes across all groups', () => {
    const ids = CORE_CATEGORY_SEED.map(c => c.id)
    const prefixes = CORE_CATEGORY_SEED.map(c => c.prefix)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(prefixes).size).toBe(prefixes.length)
    expect(CORE_CATEGORY_SEED.some(c => c.group === 'devices')).toBe(true)
    expect(CORE_CATEGORY_SEED.some(c => c.group === 'network')).toBe(true)
    expect(CORE_CATEGORY_SEED.some(c => c.group === 'furniture')).toBe(true)
  })
  it('core set has unique names (production enforces isNameTaken)', () => {
    const names = CORE_CATEGORY_SEED.map(c => c.name.trim().toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })
  it('core set includes the prefixes the mock inventory codes use', () => {
    const prefixes = new Set(CORE_CATEGORY_SEED.map(c => c.prefix))
    for (const p of ['LAP', 'MON', 'DSK', 'PHN', 'SRV']) expect(prefixes.has(p)).toBe(true)
  })
  it('ALL_CATEGORY_SOURCE contains all 131 mock categories with unique ids', () => {
    expect(ALL_CATEGORY_SOURCE.length).toBe(131)
    const ids = ALL_CATEGORY_SOURCE.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('buildAllCategorySeed produces unique prefixes for every source category', () => {
    const all = buildAllCategorySeed()
    expect(all.length).toBe(ALL_CATEGORY_SOURCE.length)
    const prefixes = all.map(c => c.prefix)
    expect(new Set(prefixes).size).toBe(prefixes.length)
    expect(all.every(c => /^[A-Z0-9]{2,6}$/.test(c.prefix))).toBe(true)
  })
  it('surfaces the known duplicate names in the full source (operator awareness)', () => {
    // mock-data.js intentionally has duplicate NAMES (e.g. "Компьютер" for
    // cat_computer + cat_desktop, "Точка доступа" variants, "Кресло" duplicates).
    // The full set would violate the app's unique-name rule on seed — this test
    // documents that reality so the operator is not surprised.
    const counts = new Map<string, number>()
    for (const c of ALL_CATEGORY_SOURCE) {
      const key = c.name.trim().toLowerCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const dupes = [...counts.entries()].filter(([, n]) => n > 1).map(([name]) => name)
    expect(dupes.length).toBeGreaterThan(0)
    expect(dupes).toContain('компьютер')
  })
})

describe('parts catalog (PART_SEED)', () => {
  it('has exactly 53 SKUs (2 + 27 storage + 24 ram), gpu excluded', () => {
    expect(PART_SEED).toHaveLength(53)
    expect(PART_SEED.filter(p => p.category === 'psu')).toHaveLength(1)
    expect(PART_SEED.filter(p => p.category === 'cooler')).toHaveLength(1)
    expect(PART_SEED.filter(p => p.category === 'ssd')).toHaveLength(9)
    expect(PART_SEED.filter(p => p.category === 'hdd')).toHaveLength(9)
    expect(PART_SEED.filter(p => p.category === 'nvme')).toHaveLength(9)
    expect(PART_SEED.filter(p => p.category === 'ram')).toHaveLength(24)
    // gpu is created dynamically in the app, never seeded
    expect(PART_SEED.some(p => (p.category as string) === 'gpu')).toBe(false)
  })
  it('all SKUs have unique ids and start at onHand=0 broken=0 unit="шт"', () => {
    const ids = PART_SEED.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(PART_SEED.every(p => p.onHand === 0 && p.broken === 0 && p.unit === 'шт')).toBe(true)
  })
  it('psu/cooler carry no variant/ddr and lowStockThreshold 5', () => {
    const psu = PART_SEED.find(p => p.id === 'sku_psu')!
    const cooler = PART_SEED.find(p => p.id === 'sku_cooler')!
    expect(psu).toMatchObject({ name: 'Блок питания', category: 'psu', lowStockThreshold: 5 })
    expect(cooler).toMatchObject({ name: 'Кулер', category: 'cooler', lowStockThreshold: 5 })
    for (const p of [psu, cooler]) {
      expect(p.variantId).toBeUndefined()
      expect(p.variantLabel).toBeUndefined()
      expect(p.ddr).toBeUndefined()
    }
  })
  it('storage SKUs use sku_{cat}_{variantId} ids, correct names, lowStockThreshold 3, no ddr', () => {
    const expectName: Record<string, string> = { ssd: 'SSD', hdd: 'HDD', nvme: 'M.2 / NVMe' }
    for (const cat of ['ssd', 'hdd', 'nvme'] as const) {
      const rows = PART_SEED.filter(p => p.category === cat)
      expect(rows.map(p => p.variantId)).toEqual(
        ['64gb', '128gb', '256gb', '512gb', '1tb', '2tb', '3tb', '4tb', '5tb'])
      expect(rows.find(p => p.variantId === '1tb')!.variantLabel).toBe('1 ТБ')
      expect(rows.every(p => p.id === `sku_${cat}_${p.variantId}`)).toBe(true)
      expect(rows.every(p => p.name === expectName[cat])).toBe(true)
      expect(rows.every(p => p.lowStockThreshold === 3)).toBe(true)
      expect(rows.every(p => p.ddr === undefined)).toBe(true)
    }
  })
  it('ram SKUs: 8 variants × 3 DDR, id sku_ram_{variantId}_{ddr}, ddr present, name ОЗУ', () => {
    const ram = PART_SEED.filter(p => p.category === 'ram')
    expect(ram).toHaveLength(24)
    expect(ram.every(p => p.name === 'ОЗУ' && p.lowStockThreshold === 3)).toBe(true)
    expect(ram.every(p => p.ddr === 'DDR3' || p.ddr === 'DDR4' || p.ddr === 'DDR5')).toBe(true)
    expect(ram.find(p => p.id === 'sku_ram_16gb_ddr4')).toMatchObject({
      variantId: '16gb', variantLabel: '16 ГБ', ddr: 'DDR4',
    })
    expect(ram.every(p => p.id === `sku_ram_${p.variantId}_${p.ddr!.toLowerCase()}`)).toBe(true)
  })
  it('ddr field is present ONLY on ram SKUs', () => {
    expect(PART_SEED.filter(p => p.ddr !== undefined).every(p => p.category === 'ram')).toBe(true)
  })
})

describe('buildSeedDocs', () => {
  it('emits statuses + branches + departments + core categories + settings by default', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const cols = docs.reduce<Record<string, number>>((m, d) => {
      m[d.collection] = (m[d.collection] ?? 0) + 1; return m }, {})
    expect(cols.asset_statuses).toBe(5)
    expect(cols.branches).toBe(5)
    expect(cols.departments).toBe(6)
    expect(cols.categories).toBe(CORE_CATEGORY_SEED.length) // core count
    // settings/auth always emitted
    expect(docs.some(d => d.collection === 'settings' && d.id === 'auth')).toBe(true)
  })
  it('emits 53 parts docs whose keys obey the firestore.rules whitelist', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const parts = docs.filter(d => d.collection === 'parts')
    expect(parts).toHaveLength(53)
    // firestore.rules parts/{id} keys().hasOnly([...]) — no key outside this set.
    const allowed = new Set([
      'name', 'category', 'unit', 'onHand', 'broken', 'lowStockThreshold',
      'variantId', 'variantLabel', 'ddr',
      'createdAt', 'updatedAt', 'createdBy', 'updatedBy',
    ])
    for (const p of parts) {
      for (const k of Object.keys(p.data)) expect(allowed.has(k)).toBe(true)
      // required-by-rules fields present and well-typed
      const d = p.data as Record<string, unknown>
      expect(typeof d.name).toBe('string')
      expect((d.name as string).length).toBeGreaterThan(0)
      expect(['psu', 'cooler', 'ssd', 'hdd', 'nvme', 'ram']).toContain(d.category)
      expect(typeof d.onHand).toBe('number')
      expect(typeof d.broken).toBe('number')
      expect(typeof d.lowStockThreshold).toBe('number')
      expect(d.createdBy).toBe('system')
      expect(d.updatedBy).toBe('system')
    }
  })
  it('parts/sku_ram_16gb_ddr4 round-trips into the Part domain shape', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const doc = docs.find(d => d.collection === 'parts' && d.id === 'sku_ram_16gb_ddr4')!
    const part = { id: doc.id, ...(doc.data as object) } as unknown as Part
    expect(part.category).toBe('ram')
    expect(part.variantId).toBe('16gb')
    expect(part.ddr).toBe('DDR4')
    expect(part.onHand).toBe(0)
  })
  it('psu/cooler parts docs omit variantId/variantLabel/ddr keys entirely', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    for (const id of ['sku_psu', 'sku_cooler']) {
      const doc = docs.find(d => d.collection === 'parts' && d.id === id)!
      const keys = Object.keys(doc.data)
      expect(keys).not.toContain('variantId')
      expect(keys).not.toContain('variantLabel')
      expect(keys).not.toContain('ddr')
    }
  })
  it('settings/auth carries the provided allowed domains', () => {
    const docs = buildSeedDocs({ nowIso: 'x', allowedEmailDomains: ['acme.example'] })
    const auth = docs.find(d => d.collection === 'settings' && d.id === 'auth')!
    expect((auth.data as { allowedEmailDomains: string[] }).allowedEmailDomains).toEqual(['acme.example'])
  })
  it('settings/auth defaults to [] when no domains provided', () => {
    const docs = buildSeedDocs({ nowIso: 'x' })
    const auth = docs.find(d => d.collection === 'settings' && d.id === 'auth')!
    expect((auth.data as { allowedEmailDomains: string[] }).allowedEmailDomains).toEqual([])
  })
  it('emits settings/defaults with mainBranchId br_main', () => {
    const docs = buildSeedDocs({ nowIso: 'x' })
    const def = docs.find(d => d.collection === 'settings' && d.id === 'defaults')!
    expect((def.data as { mainBranchId: string }).mainBranchId).toBe('br_main')
  })
  it('settings/defaults honors an explicit mainBranchId (--main-branch flag)', () => {
    const docs = buildSeedDocs({ nowIso: 'x', mainBranchId: 'br_yerevan_2' })
    const def = docs.find(d => d.collection === 'settings' && d.id === 'defaults')!
    expect((def.data as { mainBranchId: string }).mainBranchId).toBe('br_yerevan_2')
  })
  it('allCategories option emits the full set', () => {
    const docs = buildSeedDocs({ nowIso: 'x', allCategories: true })
    const n = docs.filter(d => d.collection === 'categories').length
    expect(n).toBe(ALL_CATEGORY_SOURCE.length)
    expect(n).toBeGreaterThan(100)
  })
  it('status docs satisfy the AssetStatus shape (server-written provenance present)', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const s = docs.find(d => d.collection === 'asset_statuses' && d.id === 'st_disposed')!
    const status = { id: s.id, ...(s.data as object) } as unknown as AssetStatus
    expect(status.isFinal).toBe(true)
    expect(status.isSystem).toBe(true)
    expect((s.data as { createdBy: string }).createdBy).toBe('system')
  })
  it('demo option adds sample assets + employees', () => {
    const base = buildSeedDocs({ nowIso: 'x' }).length
    const demo = buildSeedDocs({ nowIso: 'x', demo: true })
    expect(demo.some(d => d.collection === 'assets')).toBe(true)
    expect(demo.some(d => d.collection === 'employees')).toBe(true)
    expect(demo.length).toBeGreaterThan(base)
  })
  it('category docs satisfy the Category shape', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const c = docs.find(d => d.collection === 'categories' && d.id === 'cat_laptop')!
    const data = c.data as Record<string, unknown>
    expect(data.prefix).toBe('LAP')
    expect(data.group).toBe('devices')
  })
  it('cat_computer doc carries all four capability flags (hasOemLicense/requiresSerial/hasTypeField)', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const c = docs.find(d => d.collection === 'categories' && d.id === 'cat_computer')!
    const data = c.data as Record<string, unknown>
    expect(data.hasSpecs).toBe(true)
    expect(data.hasOemLicense).toBe(true)
    expect(data.requiresSerial).toBe(true)
    expect(data.hasTypeField).toBe(false)
  })
  it('cat_monitor doc has hasOemLicense:false and requiresSerial:true', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const c = docs.find(d => d.collection === 'categories' && d.id === 'cat_monitor')!
    const data = c.data as Record<string, unknown>
    expect(data.hasSpecs).toBe(false)
    expect(data.hasOemLicense).toBe(false)
    expect(data.requiresSerial).toBe(true)
    expect(data.hasTypeField).toBe(false)
  })
  it('furniture doc (cat_desk) has hasTypeField:true and requiresSerial:false', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const c = docs.find(d => d.collection === 'categories' && d.id === 'cat_desk')!
    const data = c.data as Record<string, unknown>
    expect(data.hasSpecs).toBe(false)
    expect(data.hasOemLicense).toBe(false)
    expect(data.requiresSerial).toBe(false)
    expect(data.hasTypeField).toBe(true)
  })
  it('cat_laptop has hasSpecs:true hasOemLicense:true (non-Apple laptop)', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const c = docs.find(d => d.collection === 'categories' && d.id === 'cat_laptop')!
    const data = c.data as Record<string, unknown>
    expect(data.hasSpecs).toBe(true)
    expect(data.hasOemLicense).toBe(true)
    expect(data.requiresSerial).toBe(true)
    expect(data.hasTypeField).toBe(false)
  })
  it('all categories emitted under allCategories have all four flags as booleans', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z', allCategories: true })
    const catDocs = docs.filter(d => d.collection === 'categories')
    expect(catDocs.length).toBeGreaterThan(100)
    for (const d of catDocs) {
      const data = d.data as Record<string, unknown>
      expect(typeof data.hasSpecs).toBe('boolean')
      expect(typeof data.hasOemLicense).toBe('boolean')
      expect(typeof data.requiresSerial).toBe('boolean')
      expect(typeof data.hasTypeField).toBe('boolean')
    }
  })
})

describe('category groups (two-level taxonomy)', () => {
  it('emits 3 categoryGroups docs with id === behavior literal', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const groups = docs.filter(d => d.collection === 'categoryGroups')
    expect(groups.map(g => g.id)).toEqual(['devices', 'network', 'furniture'])
    for (const g of groups) {
      const data = g.data as Record<string, unknown>
      // id === behavior so categories link via group value with no asset migration
      expect(data.behavior).toBe(g.id)
      expect(typeof data.name).toBe('string')
      expect((data.name as string).length).toBeGreaterThan(0)
      expect(typeof data.lucideIcon).toBe('string')
      expect(['blue', 'green', 'amber']).toContain(data.color)
      expect(typeof data.order).toBe('number')
      expect(data.createdBy).toBe('system')
    }
  })
  it('seeded groups use blue/green/amber to match the page GROUP_CHIP', () => {
    const docs = buildSeedDocs({ nowIso: 'x' })
    const byId = (id: string) =>
      docs.find(d => d.collection === 'categoryGroups' && d.id === id)!.data as Record<string, unknown>
    expect(byId('devices').color).toBe('blue')
    expect(byId('network').color).toBe('green')
    expect(byId('furniture').color).toBe('amber')
  })
  it('every category doc carries categoryGroupId === its group (no asset migration)', () => {
    const docs = buildSeedDocs({ nowIso: 'x', allCategories: true })
    const cats = docs.filter(d => d.collection === 'categories')
    expect(cats.length).toBeGreaterThan(100)
    for (const c of cats) {
      const data = c.data as Record<string, unknown>
      expect(data.categoryGroupId).toBe(data.group)
    }
  })
})

describe('emitted docs round-trip through InMemory repositories', () => {
  it('categories list cleanly', async () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const cats = docs.filter(d => d.collection === 'categories')
      .map(d => ({ id: d.id, ...(d.data as object) })) as unknown as Category[]
    const repo = new InMemoryCategoryRepository(cats)
    expect((await repo.listCategories()).length).toBe(cats.length)
  })
  it('statuses list cleanly and sort by sortOrder', async () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const statuses = docs.filter(d => d.collection === 'asset_statuses')
      .map(d => ({ id: d.id, ...(d.data as object) })) as unknown as AssetStatus[]
    const repo = new InMemoryAssetStatusRepository(statuses)
    const out = await repo.listAssetStatuses()
    expect(out.map(s => s.id)).toEqual(['st_warehouse', 'st_pending', 'st_assigned', 'st_repair', 'st_disposed'])
  })
})

// === part_categories seed ====================================================

describe('PART_CATEGORY_SEED (referenceData)', () => {
  it('has exactly 7 rows matching the 7 legacy PartCategory ids', () => {
    expect(PART_CATEGORY_SEED).toHaveLength(7)
    expect(PART_CATEGORY_SEED.map(c => c.id)).toEqual(
      ['psu', 'cooler', 'ssd', 'hdd', 'nvme', 'ram', 'gpu'],
    )
  })

  it('gpu has behavior "models"', () => {
    expect(PART_CATEGORY_SEED.find(c => c.id === 'gpu')!.behavior).toBe('models')
  })

  it('psu has behavior "single" and familyOverrides.laptop.slotKind === "battery"', () => {
    const psu = PART_CATEGORY_SEED.find(c => c.id === 'psu')!
    expect(psu.behavior).toBe('single')
    expect(psu.familyOverrides?.laptop?.slotKind).toBe('battery')
  })

  it('sized cats (ssd/hdd/nvme) carry 9 storage variants with correct orders', () => {
    for (const id of ['ssd', 'hdd', 'nvme'] as const) {
      const def = PART_CATEGORY_SEED.find(c => c.id === id)!
      expect(def.behavior).toBe('sized')
      expect(def.variants).toHaveLength(DEFAULT_STORAGE_VARIANTS.length)
      expect(def.variants!.map(v => v.order)).toEqual(DEFAULT_STORAGE_VARIANTS.map(v => v.order))
      expect(def.variants!.map(v => v.id)).toEqual(DEFAULT_STORAGE_VARIANTS.map(v => v.id))
    }
  })

  it('ram carries 8 capacity variants with correct orders', () => {
    const ram = PART_CATEGORY_SEED.find(c => c.id === 'ram')!
    expect(ram.variants).toHaveLength(DEFAULT_RAM_VARIANTS.length)
    expect(ram.variants!.map(v => v.id)).toEqual(DEFAULT_RAM_VARIANTS.map(v => v.id))
  })

  it('ram carries 3 DDR generations', () => {
    const ram = PART_CATEGORY_SEED.find(c => c.id === 'ram')!
    expect(ram.generations).toHaveLength(3)
    expect(ram.generations!.map(g => g.id)).toEqual(
      DEFAULT_DDR_GENERATIONS.map(g => g.id),
    )
  })

  it('every row is active: true', () => {
    expect(PART_CATEGORY_SEED.every(c => c.active)).toBe(true)
  })

  it('every row has ru/en/hy name strings', () => {
    for (const c of PART_CATEGORY_SEED) {
      expect(typeof c.name.ru).toBe('string')
      expect(c.name.ru.length).toBeGreaterThan(0)
      expect(typeof c.name.en).toBe('string')
      expect(typeof c.name.hy).toBe('string')
    }
  })
})

describe('buildSeedDocs — part_categories collection', () => {
  const RULES_WHITELIST = new Set([
    'name', 'icon', 'tintToken', 'order', 'behavior', 'slotKind',
    'storageType', 'familyOverrides', 'variants', 'generations',
    'active', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy',
  ])

  it('emits 7 part_categories docs', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    expect(docs.filter(d => d.collection === 'part_categories')).toHaveLength(7)
  })

  it('part_categories ids match the 7 legacy PartCategory ids', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const ids = docs.filter(d => d.collection === 'part_categories').map(d => d.id)
    expect(ids).toEqual(['psu', 'cooler', 'ssd', 'hdd', 'nvme', 'ram', 'gpu'])
  })

  it('part_categories docs carry only whitelisted keys', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const catDocs = docs.filter(d => d.collection === 'part_categories')
    for (const d of catDocs) {
      for (const k of Object.keys(d.data)) {
        expect(RULES_WHITELIST.has(k)).toBe(true)
      }
    }
  })

  it('part_categories docs appear BEFORE parts docs in the seed sequence', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const firstCatIdx = docs.findIndex(d => d.collection === 'part_categories')
    const firstPartIdx = docs.findIndex(d => d.collection === 'parts')
    expect(firstCatIdx).toBeGreaterThanOrEqual(0)
    expect(firstPartIdx).toBeGreaterThan(firstCatIdx)
  })

  it('ssd doc has storageType "SSD" and 9 variants', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const ssd = docs.find(d => d.collection === 'part_categories' && d.id === 'ssd')!
    expect((ssd.data as Record<string, unknown>).storageType).toBe('SSD')
    expect((ssd.data as Record<string, unknown>).variants).toHaveLength(9)
  })

  it('ram doc has 3 generations', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const ram = docs.find(d => d.collection === 'part_categories' && d.id === 'ram')!
    expect((ram.data as Record<string, unknown>).generations).toHaveLength(3)
  })

  it('gpu doc has behavior "models"', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const gpu = docs.find(d => d.collection === 'part_categories' && d.id === 'gpu')!
    expect((gpu.data as Record<string, unknown>).behavior).toBe('models')
  })

  it('psu doc has familyOverrides with laptop.slotKind = "battery"', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const psu = docs.find(d => d.collection === 'part_categories' && d.id === 'psu')!
    const fo = (psu.data as Record<string, unknown>).familyOverrides as Record<string, { slotKind: string }> | null
    expect(fo?.laptop?.slotKind).toBe('battery')
  })

  it('psu/cooler/gpu docs have variants: null and generations: null', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    for (const id of ['psu', 'cooler', 'gpu']) {
      const d = docs.find(doc => doc.collection === 'part_categories' && doc.id === id)!
      expect((d.data as Record<string, unknown>).variants).toBeNull()
      expect((d.data as Record<string, unknown>).generations).toBeNull()
    }
  })

  it('all part_categories docs carry active: true and createdBy: "system"', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const catDocs = docs.filter(d => d.collection === 'part_categories')
    for (const d of catDocs) {
      expect((d.data as Record<string, unknown>).active).toBe(true)
      expect((d.data as Record<string, unknown>).createdBy).toBe('system')
    }
  })
})
