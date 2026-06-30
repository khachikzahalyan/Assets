/**
 * Tests that changeStatus produces the correct audit before/after shape:
 *   - With assignment  → before/after carry { statusId, assignment }
 *   - Without assignment (repair, return, no-opts) → before/after carry ONLY { statusId }
 *     with the 'assignment' key ABSENT (exactOptionalPropertyTypes guard).
 */
import { describe, it, expect } from 'vitest'
import { InMemoryAssetRepository } from './inMemoryAssetRepository'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { AssetReferenceData } from '@/domain/asset'

const REF: AssetReferenceData = {
  statuses: [
    { id: 'st_warehouse', name: 'На складе', color: 'gray' },
    { id: 'st_assigned', name: 'Выдано', color: 'green' },
    { id: 'st_repair', name: 'В ремонте', color: 'orange' },
  ],
  branches: [{ id: 'br_gyumri', name: 'Филиал Гюмри' }],
  departments: [],
  categories: [{ id: 'cat_laptop', name: 'Laptop', group: 'devices', categoryGroupId: 'grp_devices', lucideIcon: 'laptop' }],
  employees: [],
  categoryGroups: [],
}

const ACTOR = { uid: 'u1', role: 'asset_admin' as const }

const BASE_INPUT = {
  categoryId: 'cat_laptop',
  brand: 'Dell',
  model: 'XPS',
  invCode: '450/audit-1',
  serial: 'SN-AUDIT-1',
  assignment: null,
  branchId: 'br_gyumri',
  deptId: null,
}

function makeRepo() {
  const store = createInMemoryAuditStore()
  const repo = new InMemoryAssetRepository([], REF, inMemoryAuditContext(store))
  return { repo, store }
}

describe('changeStatus audit shape — with assignment (transfer)', () => {
  it('audit after.statusId + after.assignment deep-equal the passed values', async () => {
    const { repo } = makeRepo()
    const { value } = await repo.createAsset(BASE_INPUT, ACTOR)

    await repo.changeStatus(
      value.id,
      'st_assigned',
      ACTOR,
      { assignment: { mode: 'branch', branchId: 'br_gyumri' } },
    )

    const logs = await repo.listAudit(value.id)
    const entry = logs.find(l => l.action === 'status_changed')
    expect(entry).toBeDefined()

    const after = entry!.after as Record<string, unknown>
    expect(after['statusId']).toBe('st_assigned')
    expect(after['assignment']).toEqual({ mode: 'branch', branchId: 'br_gyumri' })
  })

  it('audit before.assignment is null when asset started in warehouse (no prior assignment)', async () => {
    const { repo } = makeRepo()
    const { value } = await repo.createAsset(BASE_INPUT, ACTOR)

    await repo.changeStatus(
      value.id,
      'st_assigned',
      ACTOR,
      { assignment: { mode: 'branch', branchId: 'br_gyumri' } },
    )

    const logs = await repo.listAudit(value.id)
    const entry = logs.find(l => l.action === 'status_changed')!

    const before = entry.before as Record<string, unknown>
    // 'assignment' key must be present (we have an assignment in opts)
    expect('assignment' in before).toBe(true)
    // and its value must be null (asset had no prior assignment)
    expect(before['assignment']).toBeNull()
  })

  it('audit before.assignment carries the prior assignment when asset was previously assigned', async () => {
    const { repo } = makeRepo()
    const firstAssignment = { mode: 'employee' as const, employeeId: 'emp_prior' }
    const { value } = await repo.createAsset(
      { ...BASE_INPUT, invCode: '450/audit-2', serial: 'SN-AUDIT-2', assignment: firstAssignment },
      ACTOR,
    )

    const secondAssignment = { mode: 'branch' as const, branchId: 'br_gyumri' }
    await repo.changeStatus(value.id, 'st_assigned', ACTOR, { assignment: secondAssignment })

    const logs = await repo.listAudit(value.id)
    const entry = logs.find(l => l.action === 'status_changed')!

    const before = entry.before as Record<string, unknown>
    expect(before['assignment']).toEqual(firstAssignment)
    const after = entry.after as Record<string, unknown>
    expect(after['assignment']).toEqual(secondAssignment)
  })

  it('mirror (listAudit) after matches withAudit after — same object, not a diverged copy', async () => {
    const { repo } = makeRepo()
    const { value } = await repo.createAsset(BASE_INPUT, ACTOR)
    const assignment = { mode: 'branch' as const, branchId: 'br_gyumri' }

    await repo.changeStatus(value.id, 'st_assigned', ACTOR, { assignment })

    const logs = await repo.listAudit(value.id)
    const entry = logs.find(l => l.action === 'status_changed')!
    const after = entry.after as Record<string, unknown>
    expect(after['assignment']).toEqual(assignment)
  })
})

describe('changeStatus branchId/deptId persistence — transfer invariants', () => {
  it('branch transfer: asset.branchId updated to target branch, no mismatch', async () => {
    const { repo } = makeRepo()
    const { value: asset } = await repo.createAsset(
      { ...BASE_INPUT, invCode: '450/branch-1', serial: 'SN-B1', branchId: 'br_gyumri' },
      ACTOR,
    )
    expect(asset.branchId).toBe('br_gyumri')

    await repo.changeStatus(asset.id, 'st_assigned', ACTOR, {
      assignment: { mode: 'branch', branchId: 'br_main' },
      branchId: 'br_main',
      deptId: null,
    })

    const updated = await repo.getAsset(asset.id)
    expect(updated).not.toBeNull()
    // assignment and branchId must agree — the bug was these diverging
    expect(updated!.assignment).toEqual({ mode: 'branch', branchId: 'br_main' })
    expect(updated!.branchId).toBe('br_main')
    expect(updated!.deptId).toBeNull()
  })

  it('employee transfer: branchId set to HQ (br_main), assignment.employeeId preserved', async () => {
    const { repo } = makeRepo()
    const { value: asset } = await repo.createAsset(
      { ...BASE_INPUT, invCode: '450/emp-1', serial: 'SN-E1', branchId: 'br_gyumri' },
      ACTOR,
    )

    await repo.changeStatus(asset.id, 'st_assigned', ACTOR, {
      assignment: { mode: 'employee', employeeId: 'emp_42' },
      branchId: 'br_main',
      deptId: 'dept_it',
    })

    const updated = await repo.getAsset(asset.id)
    expect(updated!.branchId).toBe('br_main')
    expect(updated!.deptId).toBe('dept_it')
    expect(updated!.assignment).toEqual({ mode: 'employee', employeeId: 'emp_42' })
  })

  it('department transfer: branchId set to HQ, deptId set to departmentId', async () => {
    const { repo } = makeRepo()
    const { value: asset } = await repo.createAsset(
      { ...BASE_INPUT, invCode: '450/dept-1', serial: 'SN-D1', branchId: 'br_gyumri' },
      ACTOR,
    )

    await repo.changeStatus(asset.id, 'st_assigned', ACTOR, {
      assignment: { mode: 'department', departmentId: 'dept_finance' },
      branchId: 'br_main',
      deptId: 'dept_finance',
    })

    const updated = await repo.getAsset(asset.id)
    expect(updated!.branchId).toBe('br_main')
    expect(updated!.deptId).toBe('dept_finance')
  })

  it('branchId/deptId left unchanged when opts do not include them (repair path)', async () => {
    const { repo } = makeRepo()
    const { value: asset } = await repo.createAsset(
      { ...BASE_INPUT, invCode: '450/repair-1', serial: 'SN-R1', branchId: 'br_gyumri', deptId: 'dept_sales' },
      ACTOR,
    )

    await repo.changeStatus(asset.id, 'st_repair', ACTOR, { comment: 'broken' })

    const updated = await repo.getAsset(asset.id)
    // repair does not relocate — original branch/dept must be preserved
    expect(updated!.branchId).toBe('br_gyumri')
    expect(updated!.deptId).toBe('dept_sales')
  })

  it('bulkChangeAssignment branch mode: all assets get updated branchId', async () => {
    const { repo } = makeRepo()
    const { value: a1 } = await repo.createAsset(
      { ...BASE_INPUT, invCode: '450/bulk-1', serial: 'SN-BK1', branchId: 'br_gyumri' },
      ACTOR,
    )
    const { value: a2 } = await repo.createAsset(
      { ...BASE_INPUT, invCode: '450/bulk-2', serial: 'SN-BK2', branchId: 'br_gyumri' },
      ACTOR,
    )

    await repo.bulkChangeAssignment(
      [a1.id, a2.id],
      { mode: 'branch', branchId: 'br_main' },
      ACTOR,
    )

    const u1 = await repo.getAsset(a1.id)
    const u2 = await repo.getAsset(a2.id)
    expect(u1!.branchId).toBe('br_main')
    expect(u1!.assignment).toEqual({ mode: 'branch', branchId: 'br_main' })
    expect(u2!.branchId).toBe('br_main')
  })
})

describe('changeStatus audit shape — WITHOUT assignment (repair / return / no-opts)', () => {
  it('repair: after is exactly { statusId } — NO assignment key present', async () => {
    const { repo } = makeRepo()
    const { value } = await repo.createAsset(BASE_INPUT, ACTOR)

    await repo.changeStatus(value.id, 'st_repair', { uid: 'u1', role: 'tech_admin' }, { comment: 'x' })

    const logs = await repo.listAudit(value.id)
    const entry = logs.find(l => l.action === 'status_changed')!

    const after = entry.after as Record<string, unknown>
    expect(after['statusId']).toBe('st_repair')
    expect('assignment' in after).toBe(false)
  })

  it('repair: before is exactly { statusId } — NO assignment key present', async () => {
    const { repo } = makeRepo()
    const { value } = await repo.createAsset(BASE_INPUT, ACTOR)

    await repo.changeStatus(value.id, 'st_repair', { uid: 'u1', role: 'tech_admin' }, { comment: 'x' })

    const logs = await repo.listAudit(value.id)
    const entry = logs.find(l => l.action === 'status_changed')!

    const before = entry.before as Record<string, unknown>
    expect(before['statusId']).toBe('st_warehouse')
    expect('assignment' in before).toBe(false)
  })

  it('return (no opts): after has NO assignment key', async () => {
    const { repo } = makeRepo()
    // Create as assigned, then call changeStatus with no opts (bare return to warehouse by caller)
    const { value } = await repo.createAsset(
      { ...BASE_INPUT, invCode: '450/audit-3', serial: 'SN-AUDIT-3',
        assignment: { mode: 'employee', employeeId: 'emp_x' } },
      ACTOR,
    )

    // Call changeStatus with NO opts at all
    await repo.changeStatus(value.id, 'st_assigned', ACTOR)

    const logs = await repo.listAudit(value.id)
    const entry = logs.find(l => l.action === 'status_changed')!

    const after = entry.after as Record<string, unknown>
    expect('assignment' in after).toBe(false)
  })
})
