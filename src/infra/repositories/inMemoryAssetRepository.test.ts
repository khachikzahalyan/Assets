import { describe, it, expect } from 'vitest'
import { InMemoryAssetRepository } from './inMemoryAssetRepository'
import type { Asset, CategoryRow, StatusRow, RefRow } from '@/domain/asset'

const cats: CategoryRow[] = [
  { id: 'cat_laptop', name: 'Ноутбук', group: 'devices', lucideIcon: 'laptop' },
  { id: 'cat_server', name: 'Сервер', group: 'network', lucideIcon: 'server' },
  { id: 'cat_desk', name: 'Стол', group: 'furniture', lucideIcon: 'table-2' },
]
const statuses: StatusRow[] = [
  { id: 'st_warehouse', name: 'На складе', color: 'gray' },
  { id: 'st_assigned', name: 'Выдано', color: 'green' },
]
const branches: RefRow[] = [{ id: 'br_main', name: 'Головной офис' }, { id: 'br_g', name: 'Гюмри' }]
const a = (id: string, p: Partial<Asset>): Asset => ({
  id, categoryId: 'cat_laptop', brand: 'Dell', model: 'X', invCode: 'LAP/1', serial: 's',
  statusId: 'st_assigned', assignment: null, branchId: 'br_main', deptId: null,
  updatedAt: '2026-01-01T00:00:00.000Z', ...p,
})
const assets: Asset[] = [
  a('a1', { invCode: 'LAP/00002', updatedAt: '2026-01-02T00:00:00.000Z', categoryId: 'cat_laptop', branchId: 'br_main', statusId: 'st_assigned', brand: 'Dell' }),
  a('a2', { invCode: 'SRV/00001', updatedAt: '2026-01-03T00:00:00.000Z', categoryId: 'cat_server', branchId: 'br_g', statusId: 'st_warehouse', brand: 'HPE' }),
  a('a3', { invCode: 'FRN/00001', updatedAt: '2026-01-01T00:00:00.000Z', categoryId: 'cat_desk', branchId: 'br_main', statusId: 'st_assigned', brand: null, model: null }),
]

function repo() {
  return new InMemoryAssetRepository(assets, { statuses, branches, departments: [], categories: cats, employees: [] })
}

describe('InMemoryAssetRepository.listAssets', () => {
  it('returns all with default sort updated_desc', async () => {
    const r = await repo().listAssets({})
    expect(r.map(x => x.id)).toEqual(['a2', 'a1', 'a3'])
  })
  it('filters by group via category lookup', async () => {
    const r = await repo().listAssets({ group: 'network' })
    expect(r.map(x => x.id)).toEqual(['a2'])
  })
  it('filters by status and branch', async () => {
    const r = await repo().listAssets({ statusId: 'st_assigned', branchId: 'br_main' })
    expect(r.map(x => x.id).sort()).toEqual(['a1', 'a3'])
  })
  it('searches invCode and brand/model case-insensitively', async () => {
    expect((await repo().listAssets({ search: 'srv' })).map(x => x.id)).toEqual(['a2'])
    expect((await repo().listAssets({ search: 'dell' })).map(x => x.id)).toEqual(['a1'])
  })
  it('sorts by inv_asc', async () => {
    const r = await repo().listAssets({ sort: 'inv_asc' })
    expect(r.map(x => x.invCode)).toEqual(['FRN/00001', 'LAP/00002', 'SRV/00001'])
  })
})

describe('InMemoryAssetRepository.loadReferenceData', () => {
  it('returns the seeded reference rows', async () => {
    const ref = await repo().loadReferenceData()
    expect(ref.categories.length).toBe(3)
    expect(ref.statuses.map(s => s.id)).toContain('st_warehouse')
  })
})

describe('InMemoryAssetRepository.findByInvCode', () => {
  it('found: returns the asset with the matching invCode', async () => {
    const result = await repo().findByInvCode('SRV/00001')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('a2')
    expect(result!.invCode).toBe('SRV/00001')
  })

  it('not-found: returns null for an unknown invCode', async () => {
    const result = await repo().findByInvCode('UNKNOWN/99999')
    expect(result).toBeNull()
  })

  it('case-and-format exactness: differently-cased or partial code does not match', async () => {
    // Lower-case variant of a known code must not match
    expect(await repo().findByInvCode('srv/00001')).toBeNull()
    // Partial prefix must not match
    expect(await repo().findByInvCode('SRV')).toBeNull()
    // Partial suffix must not match
    expect(await repo().findByInvCode('00001')).toBeNull()
  })
})

describe('InMemoryAssetRepository — barcode', () => {
  const actor = { uid: 'u1', role: 'asset_admin' as const }
  const baseInput = {
    categoryId: 'cat_lap', brand: 'Dell', model: 'X', type: null,
    serial: null, assignment: null, branchId: 'br_main', deptId: null,
  }
  it('createAsset assigns a unique 9-digit barcode', async () => {
    const r = await repo().createAsset({ ...baseInput, invCode: 'LAP/90001' }, actor)
    expect(r.value.barcode).toMatch(/^[1-9]\d{8}$/)
  })
  it('createAssetsBatch assigns distinct barcodes', async () => {
    const created = await repo().createAssetsBatch([
      { ...baseInput, invCode: 'LAP/90010' },
      { ...baseInput, invCode: 'LAP/90011' },
      { ...baseInput, invCode: 'LAP/90012' },
    ], actor)
    const codes = created.map(a => a.barcode)
    expect(new Set(codes).size).toBe(3)
    codes.forEach(c => expect(c).toMatch(/^[1-9]\d{8}$/))
  })
  it('findByBarcode + isBarcodeTaken resolve a created barcode', async () => {
    const r = repo()
    const { value } = await r.createAsset({ ...baseInput, invCode: 'LAP/90020' }, actor)
    const code = value.barcode!
    expect((await r.findByBarcode(code))?.id).toBe(value.id)
    expect(await r.isBarcodeTaken(code)).toBe(true)
    expect(await r.isBarcodeTaken('000000000')).toBe(false)
    expect(await r.findByBarcode('000000000')).toBeNull()
  })
})
