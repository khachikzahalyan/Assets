import { describe, it, expect } from 'vitest'
import type { LicenseType } from './WorkstationLicense'
import type { ServerLicenseType } from './ServerLicense'

describe('license type unions', () => {
  it('enumerates every workstation LicenseType member', () => {
    const all: LicenseType[] = ['Default', 'OEM', 'Retail', 'Volume', 'Subscription']
    expect(all).toHaveLength(5)
  })

  it('enumerates every ServerLicenseType member', () => {
    const all: ServerLicenseType[] = ['Server', 'Global', 'Infrastructure']
    expect(all).toHaveLength(3)
  })
})
