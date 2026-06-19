import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryAssignmentRepository, type MailEntry } from './inMemoryAssignmentRepository'
import type { Asset } from '@/domain/asset'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

const ACTOR = { uid: 'u_1', role: 'asset_admin' as const }

function asset(over: Partial<Asset> = {}): Asset {
  return {
    id: 'a_1', categoryId: 'cat_laptop', brand: 'Dell', model: 'XPS', invCode: '450/1',
    serial: 'SN1', statusId: 'st_warehouse', assignment: null, branchId: 'br_main',
    deptId: null, updatedAt: '2026-01-01T00:00:00.000Z', currentSpecs: null, ...over,
  }
}

describe('InMemoryAssignmentRepository', () => {
  let assets: Asset[]; let mail: MailEntry[]; let store: ReturnType<typeof createInMemoryAuditStore>
  let repo: InMemoryAssignmentRepository

  beforeEach(() => {
    assets = [asset()]; mail = []; store = createInMemoryAuditStore()
    repo = new InMemoryAssignmentRepository(assets, mail, inMemoryAuditContext(store))
  })

  it('assign(employee) moves asset to assigned, caches assignment, enqueues mail, writes 1 audit', async () => {
    const r = await repo.assign(
      { assetId: 'a_1', mode: 'employee', employeeId: 'e_1', employeeEmail: 'e@x.com', employeeName: 'Emp One', invCode: '450/1' },
      ACTOR,
    )
    expect(r.value.mode).toBe('employee')
    expect(r.value.endedAt).toBeNull()
    expect(assets[0]!.statusId).toBe('st_assigned')
    expect(assets[0]!.assignment).toEqual({ mode: 'employee', employeeId: 'e_1' })
    expect(mail).toHaveLength(1)
    expect(mail[0]!.to).toEqual(['e@x.com'])
    expect(store.logs.filter(l => l.action === 'assigned')).toHaveLength(1)
  })

  it('assign(branch) does NOT enqueue mail', async () => {
    await repo.assign({ assetId: 'a_1', mode: 'branch', branchId: 'br_2' }, ACTOR)
    expect(assets[0]!.statusId).toBe('st_assigned')
    expect(assets[0]!.assignment).toEqual({ mode: 'branch', branchId: 'br_2' })
    expect(mail).toHaveLength(0)
  })

  it('assign rejects an asset not in warehouse', async () => {
    assets[0]!.statusId = 'st_assigned'
    await expect(repo.assign({ assetId: 'a_1', mode: 'branch', branchId: 'br_2' }, ACTOR)).rejects.toThrow()
  })

  it('returnAsset ends the active assignment and clears the asset cache, writes 1 audit', async () => {
    await repo.assign({ assetId: 'a_1', mode: 'branch', branchId: 'br_2' }, ACTOR)
    const r = await repo.returnAsset('a_1', ACTOR)
    expect(r.value.endedAt).not.toBeNull()
    expect(assets[0]!.statusId).toBe('st_warehouse')
    expect(assets[0]!.assignment).toBeNull()
    expect(store.logs.filter(l => l.action === 'returned')).toHaveLength(1)
    expect(await repo.getActiveAssignment('a_1')).toBeNull()
  })

  it('returnAsset rejects when no active assignment', async () => {
    await expect(repo.returnAsset('a_1', ACTOR)).rejects.toThrow()
  })

  it('listAssignments returns history newest first', async () => {
    await repo.assign({ assetId: 'a_1', mode: 'branch', branchId: 'br_2' }, ACTOR)
    await repo.returnAsset('a_1', ACTOR)
    await repo.assign({ assetId: 'a_1', mode: 'branch', branchId: 'br_3' }, ACTOR)
    const list = await repo.listAssignments('a_1')
    expect(list).toHaveLength(2)
    expect(list[0]!.assignedToBranchId).toBe('br_3')
  })

  it('listAssignmentsForEmployee returns only that employee, newest first', async () => {
    await repo.assign({ assetId: 'a_1', mode: 'employee', employeeId: 'uid_1' }, ACTOR)
    const list = await repo.listAssignmentsForEmployee('uid_1')
    expect(list).toHaveLength(1)
    expect(list[0]!.assignedToEmployeeId).toBe('uid_1')
    expect(await repo.listAssignmentsForEmployee('uid_2')).toHaveLength(0)
  })
})
