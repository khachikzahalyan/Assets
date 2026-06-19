import { describe, it, expect } from 'vitest'
import { deriveCreateStatus } from './deriveStatus'
describe('deriveCreateStatus', () => {
  it('null assignment -> warehouse', () => { expect(deriveCreateStatus(null)).toBe('st_warehouse') })
  it('employee assignment -> assigned', () => { expect(deriveCreateStatus({ mode: 'employee', employeeId: 'e1' })).toBe('st_assigned') })
  it('branch assignment -> assigned', () => { expect(deriveCreateStatus({ mode: 'branch', branchId: 'b1' })).toBe('st_assigned') })
  it('department assignment -> assigned', () => { expect(deriveCreateStatus({ mode: 'department', departmentId: 'd1' })).toBe('st_assigned') })
})
