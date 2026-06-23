import { describe, it, expect } from 'vitest'
import {
  STATUS_SEED, BRANCH_SEED, DEPARTMENT_SEED,
  CORE_CATEGORY_SEED, ALL_CATEGORY_SOURCE, buildAllCategorySeed,
} from './referenceData'
import { buildSeedDocs } from './buildSeed'
import type { AssetStatus } from '../../src/domain/asset_status'
import type { Category } from '../../src/domain/category'
import { InMemoryCategoryRepository } from '../../src/infra/repositories/inMemoryCategoryRepository'
import { InMemoryAssetStatusRepository } from '../../src/infra/repositories/inMemoryAssetStatusRepository'

describe('reference data', () => {
  it('has the 4 canonical system statuses with correct ids/flags', () => {
    expect(STATUS_SEED.map(s => s.id)).toEqual(
      ['st_warehouse', 'st_assigned', 'st_repair', 'st_disposed'])
    expect(STATUS_SEED.every(s => s.isSystem)).toBe(true)
    const disposed = STATUS_SEED.find(s => s.id === 'st_disposed')!
    expect(disposed.isFinal).toBe(true)
    expect(STATUS_SEED.filter(s => s.isFinal)).toHaveLength(1)
    expect(STATUS_SEED.map(s => s.sortOrder)).toEqual([0, 1, 2, 3])
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

describe('buildSeedDocs', () => {
  it('emits statuses + branches + departments + core categories + settings by default', () => {
    const docs = buildSeedDocs({ nowIso: '2026-06-20T00:00:00.000Z' })
    const cols = docs.reduce<Record<string, number>>((m, d) => {
      m[d.collection] = (m[d.collection] ?? 0) + 1; return m }, {})
    expect(cols.asset_statuses).toBe(4)
    expect(cols.branches).toBe(5)
    expect(cols.departments).toBe(6)
    expect(cols.categories).toBe(CORE_CATEGORY_SEED.length) // core count
    // settings/auth always emitted
    expect(docs.some(d => d.collection === 'settings' && d.id === 'auth')).toBe(true)
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
    const cat = { id: c.id, ...(c.data as object) } as unknown as Category
    expect(cat.prefix).toBe('LAP')
    expect(cat.group).toBe('devices')
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
    expect(out.map(s => s.id)).toEqual(['st_warehouse', 'st_assigned', 'st_repair', 'st_disposed'])
  })
})
