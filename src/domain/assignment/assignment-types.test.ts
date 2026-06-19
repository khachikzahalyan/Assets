import { describe, it, expect } from 'vitest'
import { isAssignmentMode, type Assignment, type AssignmentMode } from './index'

describe('assignment domain types', () => {
  it('isAssignmentMode accepts employee and branch, rejects others', () => {
    expect(isAssignmentMode('employee')).toBe(true)
    expect(isAssignmentMode('branch')).toBe(true)
    expect(isAssignmentMode('department')).toBe(false)
    expect(isAssignmentMode('x')).toBe(false)
  })

  it('Assignment shape compiles with employee mode', () => {
    const a: Assignment = {
      id: 'as_1', assetId: 'a_1', mode: 'employee',
      assignedToEmployeeId: 'e_1', assignedToBranchId: null,
      startedAt: '2026-01-01T00:00:00.000Z', endedAt: null,
      actStoragePath: null, transferComment: null,
      createdBy: 'u_1', createdAt: '2026-01-01T00:00:00.000Z',
    }
    const m: AssignmentMode = a.mode
    expect(m).toBe('employee')
  })
})
