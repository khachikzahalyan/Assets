import { describe, it, expect } from 'vitest'
import { InMemoryAssetRepository } from './inMemoryAssetRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { AssetReferenceData, Asset } from '@/domain/asset'

const REF: AssetReferenceData = {
  statuses: [], branches: [{ id: 'b_main', name: 'HQ' }], departments: [],
  categories: [{ id: 'cat_laptop', name: 'Laptop', group: 'devices', lucideIcon: 'laptop' }],
  employees: [{ id: 'e1', firstName: 'A', lastName: 'B', email: null }],
}
const ACTOR = { uid: 'u1', role: 'asset_admin' as const }

function makeRepo() {
  const store = createInMemoryAuditStore()
  const repo = new InMemoryAssetRepository([], REF, inMemoryAuditContext(store))
  return { repo, store }
}
const baseInput = {
  categoryId: 'cat_laptop', brand: 'Dell', model: 'XPS', invCode: '450/1', serial: 'SN1',
  assignment: null, branchId: 'b_main', deptId: null,
}

describe('InMemory write methods', () => {
  it('createAsset derives warehouse status for null assignment + writes one audit', async () => {
    const { repo, store } = makeRepo()
    const { value } = await repo.createAsset(baseInput, ACTOR)
    expect(value.statusId).toBe('st_warehouse')
    expect(store.logs).toHaveLength(1)
    expect(store.logs[0]!.action).toBe('created')
  })
  it('createAsset with employee assignment derives assigned status', async () => {
    const { repo } = makeRepo()
    const { value } = await repo.createAsset({ ...baseInput, invCode: '450/2', serial: 'SN2', assignment: { mode: 'employee', employeeId: 'e1' } }, ACTOR)
    expect(value.statusId).toBe('st_assigned')
  })
  it('createAsset blocks duplicate invCode (no audit written)', async () => {
    const { repo, store } = makeRepo()
    await repo.createAsset(baseInput, ACTOR)
    await expect(repo.createAsset({ ...baseInput, serial: 'SN-other' }, ACTOR)).rejects.toThrow(/inv/i)
    expect(store.logs).toHaveLength(1)
  })
  it('createAsset blocks duplicate serial', async () => {
    const { repo } = makeRepo()
    await repo.createAsset(baseInput, ACTOR)
    await expect(repo.createAsset({ ...baseInput, invCode: '450/9' }, ACTOR)).rejects.toThrow(/serial/i)
  })
  it('changeStatus to repair writes one audit + flips status', async () => {
    const { repo, store } = makeRepo()
    const { value } = await repo.createAsset(baseInput, ACTOR)
    await repo.changeStatus(value.id, 'st_repair', { uid: 'u1', role: 'tech_admin' })
    const after = await repo.getAsset(value.id)
    expect(after?.statusId).toBe('st_repair')
    expect(store.logs).toHaveLength(2)
    expect(store.logs[1]!.action).toBe('status_changed')
  })
  it('updateAsset writes one audit and applies the patch', async () => {
    const { repo, store } = makeRepo()
    const { value } = await repo.createAsset(baseInput, ACTOR)
    await repo.updateAsset(value.id, { model: 'XPS 15' }, ACTOR)
    const after = await repo.getAsset(value.id)
    expect(after?.model).toBe('XPS 15')
    expect(store.logs[1]!.action).toBe('updated')
  })
  it('addUpgrade auto-derives before from currentSpecs for SPEC_TRACKED + updates currentSpecs', async () => {
    const { repo } = makeRepo()
    const { value } = await repo.createAsset({ ...baseInput, currentSpecs: { ram: '8 ГБ' } }, ACTOR)
    const { value: ev } = await repo.addUpgrade(value.id, { component: 'RAM', after: '16 ГБ' }, { uid: 'u1', role: 'tech_admin' })
    expect(ev.before).toBe('8 ГБ')
    expect(ev.after).toBe('16 ГБ')
    const refreshed = await repo.getAsset(value.id)
    expect(refreshed?.currentSpecs?.ram).toBe('16 ГБ')
    const list = await repo.listUpgrades(value.id)
    expect(list).toHaveLength(1)
  })
  it('addUpgrade for non-tracked component (PSU) leaves before null and does not touch specs', async () => {
    const { repo } = makeRepo()
    const { value } = await repo.createAsset({ ...baseInput, invCode: '450/77', serial: 'SN77' }, ACTOR)
    const { value: ev } = await repo.addUpgrade(value.id, { component: 'PSU', after: '750W' }, { uid: 'u1', role: 'tech_admin' })
    expect(ev.before).toBeNull()
  })
  it('listAudit returns entries for the given entity only', async () => {
    const { repo } = makeRepo()
    const a = await repo.createAsset(baseInput, ACTOR)
    await repo.createAsset({ ...baseInput, invCode: '450/x', serial: 'SNx' }, ACTOR)
    const logs = await repo.listAudit(a.value.id)
    expect(logs.length).toBe(1)
    expect(logs[0]!.entityId).toBe(a.value.id)
  })
})

describe('changeStatus — all 5 transfer modes persist assignment verbatim, one audit each', () => {
  it('employee mode: persists assignment.mode + employeeId, one status_changed audit', async () => {
    const { repo, store } = makeRepo()
    const { value } = await repo.createAsset(baseInput, ACTOR)
    const assignment = { mode: 'employee' as const, employeeId: 'e1', workMode: 'remote' as const }
    await repo.changeStatus(value.id, 'st_assigned', ACTOR, { assignment, comment: 'new hire' })
    const after = await repo.getAsset(value.id)
    expect(after?.statusId).toBe('st_assigned')
    expect(after?.assignment).toEqual(assignment)
    const statusLogs = store.logs.filter(l => l.action === 'status_changed')
    expect(statusLogs).toHaveLength(1)
  })

  it('department mode: persists assignment.mode + departmentId, one status_changed audit', async () => {
    const { repo, store } = makeRepo()
    const { value } = await repo.createAsset(baseInput, ACTOR)
    const assignment = { mode: 'department' as const, departmentId: 'd_it' }
    await repo.changeStatus(value.id, 'st_assigned', ACTOR, { assignment })
    const after = await repo.getAsset(value.id)
    expect(after?.statusId).toBe('st_assigned')
    expect(after?.assignment).toEqual(assignment)
    const statusLogs = store.logs.filter(l => l.action === 'status_changed')
    expect(statusLogs).toHaveLength(1)
  })

  it('branch mode: persists assignment.mode + branchId, one status_changed audit', async () => {
    const { repo, store } = makeRepo()
    const { value } = await repo.createAsset(baseInput, ACTOR)
    const assignment = { mode: 'branch' as const, branchId: 'b_gym' }
    await repo.changeStatus(value.id, 'st_assigned', ACTOR, { assignment })
    const after = await repo.getAsset(value.id)
    expect(after?.assignment).toEqual(assignment)
    const statusLogs = store.logs.filter(l => l.action === 'status_changed')
    expect(statusLogs).toHaveLength(1)
  })

  it('warehouse mode: persists assignment null (unassigned), one status_changed audit', async () => {
    const { repo, store } = makeRepo()
    const { value } = await repo.createAsset(
      { ...baseInput, invCode: '450/w', serial: 'SNW', assignment: { mode: 'employee', employeeId: 'e1' } },
      ACTOR,
    )
    await repo.changeStatus(value.id, 'st_warehouse', ACTOR, { assignment: null })
    const after = await repo.getAsset(value.id)
    expect(after?.statusId).toBe('st_warehouse')
    expect(after?.assignment).toBeNull()
    const statusLogs = store.logs.filter(l => l.action === 'status_changed')
    expect(statusLogs).toHaveLength(1)
  })

  it('temporary mode: persists all temporary fields verbatim, one status_changed audit', async () => {
    const { repo, store } = makeRepo()
    const { value } = await repo.createAsset(baseInput, ACTOR)
    const assignment = {
      mode: 'temporary' as const,
      tempKind: 'audit' as const,
      expiresAt: '2026-12-31T00:00:00.000Z',
      isTemporary: true,
      workMode: 'office' as const,
    }
    await repo.changeStatus(value.id, 'st_assigned', ACTOR, { assignment, comment: 'audit team' })
    const after = await repo.getAsset(value.id)
    expect(after?.statusId).toBe('st_assigned')
    expect(after?.assignment).toEqual(assignment)
    const statusLogs = store.logs.filter(l => l.action === 'status_changed')
    expect(statusLogs).toHaveLength(1)
  })
})

describe('listAssetsForEmployee', () => {
  it('returns only assets whose assignment.employeeId matches', async () => {
    const ref: AssetReferenceData = { statuses: [], branches: [], departments: [], categories: [], employees: [] }
    const assets: Asset[] = [
      { id: 'a_1', categoryId: 'c', brand: null, model: null, invCode: '1', serial: null,
        statusId: 'st_assigned', assignment: { mode: 'employee', employeeId: 'uid_1' }, branchId: 'b', deptId: null,
        updatedAt: '2026-01-01T00:00:00.000Z', currentSpecs: null },
      { id: 'a_2', categoryId: 'c', brand: null, model: null, invCode: '2', serial: null,
        statusId: 'st_warehouse', assignment: null, branchId: 'b', deptId: null,
        updatedAt: '2026-01-01T00:00:00.000Z', currentSpecs: null },
    ]
    const repo = new InMemoryAssetRepository(assets, ref)
    const mine = await repo.listAssetsForEmployee('uid_1')
    expect(mine).toHaveLength(1)
    expect(mine[0]!.id).toBe('a_1')
  })
})

describe('createAssetsBatch (group registration, dual uniqueness)', () => {
  it('creates N assets sharing fields, each with its own audit entry', async () => {
    const { repo, store } = makeRepo()
    const rows = [
      { ...baseInput, invCode: '450/10', serial: 'SN10' },
      { ...baseInput, invCode: '450/11', serial: 'SN11' },
      { ...baseInput, invCode: '450/12', serial: 'SN12' },
    ]
    const created = await repo.createAssetsBatch(rows, ACTOR)
    expect(created).toHaveLength(3)
    expect(created.map(a => a.invCode)).toEqual(['450/10', '450/11', '450/12'])
    expect(created.every(a => a.brand === 'Dell' && a.statusId === 'st_warehouse')).toBe(true)
    // 3 created audit entries
    expect(store.logs.filter(l => l.action === 'created')).toHaveLength(3)
  })

  it('rejects a within-batch duplicate inventory code before any write', async () => {
    const { repo, store } = makeRepo()
    const rows = [
      { ...baseInput, invCode: '450/20', serial: 'SN20' },
      { ...baseInput, invCode: '450/20', serial: 'SN21' }, // dup code
    ]
    await expect(repo.createAssetsBatch(rows, ACTOR)).rejects.toThrow(/inv/i)
    expect(store.logs).toHaveLength(0)
  })

  it('rejects a within-batch duplicate serial before any write', async () => {
    const { repo, store } = makeRepo()
    const rows = [
      { ...baseInput, invCode: '450/30', serial: 'DUP' },
      { ...baseInput, invCode: '450/31', serial: 'DUP' }, // dup serial
    ]
    await expect(repo.createAssetsBatch(rows, ACTOR)).rejects.toThrow(/serial/i)
    expect(store.logs).toHaveLength(0)
  })

  it('rejects when a row collides with an existing asset', async () => {
    const { repo } = makeRepo()
    await repo.createAsset({ ...baseInput, invCode: '450/40', serial: 'SN40' }, ACTOR)
    const rows = [{ ...baseInput, invCode: '450/40', serial: 'SN41' }]
    await expect(repo.createAssetsBatch(rows, ACTOR)).rejects.toThrow(/inv/i)
  })

  it('persists condition + warranty fields for new assets', async () => {
    const { repo } = makeRepo()
    const created = await repo.createAssetsBatch(
      [{ ...baseInput, invCode: '450/50', serial: 'SN50', condition: 'new', purchaseDate: '2026-06-21', warrantyEndsAt: '2027-06-21' }],
      ACTOR,
    )
    expect(created[0]!.condition).toBe('new')
    expect(created[0]!.purchaseDate).toBe('2026-06-21')
    expect(created[0]!.warrantyEndsAt).toBe('2027-06-21')
  })
})
