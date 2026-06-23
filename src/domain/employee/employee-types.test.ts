import { describe, it, expect } from 'vitest'
import { isEmployeeStatus, type Employee, type EmployeeStatus } from './index'

describe('employee domain types', () => {
  it('isEmployeeStatus accepts active/terminated, rejects others', () => {
    expect(isEmployeeStatus('active')).toBe(true)
    expect(isEmployeeStatus('terminated')).toBe(true)
    expect(isEmployeeStatus('x')).toBe(false)
  })
  it('Employee shape compiles', () => {
    const e: Employee = {
      id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', phone: null,
      position: 'Инженер', branchId: 'br_1', departmentId: 'dep_1',
      status: 'active', terminatedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const s: EmployeeStatus = e.status
    expect(s).toBe('active')
  })
})
