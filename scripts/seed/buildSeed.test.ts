import { describe, it, expect } from 'vitest'
import {
  STATUS_SEED, BRANCH_SEED, DEPARTMENT_SEED,
  CORE_CATEGORY_SEED, ALL_CATEGORY_SOURCE, buildAllCategorySeed,
} from './referenceData'

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
