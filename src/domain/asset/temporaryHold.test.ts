import { describe, it, expect } from 'vitest'
import { temporaryHoldStatus } from './temporaryHold'
import type { AssetAssignment } from './types'

const temp = (expiresAt: string | null): AssetAssignment => ({
  mode: 'temporary', tempKind: 'intern', expiresAt, isTemporary: true,
})

describe('temporaryHoldStatus', () => {
  const now = new Date('2026-06-23T12:00:00Z')

  it('returns null when assignment is not temporary', () => {
    expect(temporaryHoldStatus({ mode: 'employee', employeeId: 'e1' }, now)).toBeNull()
    expect(temporaryHoldStatus(null, now)).toBeNull()
  })

  it('returns null when temporary but no expiresAt', () => {
    expect(temporaryHoldStatus(temp(null), now)).toBeNull()
  })

  it('returns active when expiry is more than dueWithinDays away', () => {
    expect(temporaryHoldStatus(temp('2026-07-01'), now)).toBe('active')
  })

  it('returns dueSoon when expiry is within dueWithinDays (default 1)', () => {
    expect(temporaryHoldStatus(temp('2026-06-24'), now)).toBe('dueSoon')
    expect(temporaryHoldStatus(temp('2026-06-23'), now)).toBe('dueSoon')
  })

  it('returns overdue when expiry date is before today', () => {
    expect(temporaryHoldStatus(temp('2026-06-22'), now)).toBe('overdue')
  })
})
