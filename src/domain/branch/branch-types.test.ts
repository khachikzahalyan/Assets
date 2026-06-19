import { describe, it, expect } from 'vitest'
import { isBranchType, BRANCH_TYPES } from './types'

describe('branch types', () => {
  it('BRANCH_TYPES is branch + warehouse', () => {
    expect([...BRANCH_TYPES]).toEqual(['branch', 'warehouse'])
  })
  it('isBranchType guards correctly', () => {
    expect(isBranchType('branch')).toBe(true)
    expect(isBranchType('warehouse')).toBe(true)
    expect(isBranchType('office')).toBe(false)
  })
})
