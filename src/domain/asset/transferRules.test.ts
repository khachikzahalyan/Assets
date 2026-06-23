import { describe, it, expect } from 'vitest'
import { buildTransferPatch, HEAD_OFFICE_BRANCH_ID, type TransferTarget } from './transferRules'

describe('buildTransferPatch', () => {
  it('warehouse → unassigned on shelf at HQ', () => {
    const patch = buildTransferPatch({ mode: 'warehouse' })
    expect(patch).toEqual({
      toStatusId: 'st_warehouse',
      assignment: null,
      branchId: HEAD_OFFICE_BRANCH_ID,
      deptId: null,
    })
  })

  it('employee with employeeDeptId → dept carried, branch HQ', () => {
    const target: TransferTarget = { mode: 'employee', employeeId: 'e_1' }
    const patch = buildTransferPatch(target, 'd_it')
    expect(patch.toStatusId).toBe('st_assigned')
    expect(patch.branchId).toBe(HEAD_OFFICE_BRANCH_ID)
    expect(patch.deptId).toBe('d_it')
    expect(patch.assignment).toEqual({ mode: 'employee', employeeId: 'e_1' })
  })

  it('employee with workMode remote → assignment carries workMode', () => {
    const patch = buildTransferPatch({ mode: 'employee', employeeId: 'e_2', workMode: 'remote' }, 'd_it')
    expect(patch.assignment).toEqual({ mode: 'employee', employeeId: 'e_2', workMode: 'remote' })
  })

  it('branch → relocates: branchId is the chosen branch (NOT HQ), dept null', () => {
    const patch = buildTransferPatch({ mode: 'branch', branchId: 'br_kazan' })
    expect(patch.toStatusId).toBe('st_assigned')
    expect(patch.branchId).toBe('br_kazan')
    expect(patch.branchId).not.toBe(HEAD_OFFICE_BRANCH_ID)
    expect(patch.deptId).toBeNull()
    expect(patch.assignment).toEqual({ mode: 'branch', branchId: 'br_kazan' })
  })

  it('department → branch HQ, dept = departmentId', () => {
    const patch = buildTransferPatch({ mode: 'department', departmentId: 'd_sales' })
    expect(patch.toStatusId).toBe('st_assigned')
    expect(patch.branchId).toBe(HEAD_OFFICE_BRANCH_ID)
    expect(patch.deptId).toBe('d_sales')
    expect(patch.assignment).toEqual({ mode: 'department', departmentId: 'd_sales' })
  })

  it('temporary → kind-based hold, isTemporary + expiresAt, branch HQ, dept null', () => {
    const patch = buildTransferPatch({
      mode: 'temporary',
      tempKind: 'audit',
      expiresAt: '2026-12-31T00:00:00.000Z',
    })
    expect(patch.toStatusId).toBe('st_assigned')
    expect(patch.branchId).toBe(HEAD_OFFICE_BRANCH_ID)
    expect(patch.deptId).toBeNull()
    expect(patch.assignment).toEqual({
      mode: 'temporary',
      tempKind: 'audit',
      expiresAt: '2026-12-31T00:00:00.000Z',
      isTemporary: true,
    })
  })
})
