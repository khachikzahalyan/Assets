import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock firebase/functions before importing the module under test
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}))

// Mock @/lib/firebase so functions() is a stable stub
vi.mock('@/lib/firebase', () => ({
  functions: vi.fn(() => ({ /* stub Functions instance */ })),
}))

import { httpsCallable, type HttpsCallable } from 'firebase/functions'
import { revealLicenseKey, setLicenseKey } from './revealKey'

const mockCallable = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  // The production code only ever invokes the callable as a function; the rest of
  // the HttpsCallable surface (e.g. `.stream`) is irrelevant to these tests.
  vi.mocked(httpsCallable).mockReturnValue(mockCallable as unknown as HttpsCallable)
})

describe('revealLicenseKey', () => {
  it('calls the revealLicenseKey callable with the correct name and args', async () => {
    mockCallable.mockResolvedValue({ data: { key: 'RAW-KEY-123' } })

    const result = await revealLicenseKey('licenses', 'lic_abc')

    // httpsCallable should have been called with the functions instance and the
    // exact Cloud Function name
    expect(httpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      'revealLicenseKey',
    )

    // The callable itself should have been invoked with the right payload
    expect(mockCallable).toHaveBeenCalledWith({
      collection: 'licenses',
      licenseId: 'lic_abc',
    })

    // Returns the raw key from res.data.key
    expect(result).toBe('RAW-KEY-123')
  })

  it('works for server_licenses collection', async () => {
    mockCallable.mockResolvedValue({ data: { key: 'SRV-KEY-XYZ' } })

    const result = await revealLicenseKey('server_licenses', 'srv_001')

    expect(mockCallable).toHaveBeenCalledWith({
      collection: 'server_licenses',
      licenseId: 'srv_001',
    })
    expect(result).toBe('SRV-KEY-XYZ')
  })

  it('propagates callable errors', async () => {
    mockCallable.mockRejectedValue(new Error('permission-denied'))
    await expect(revealLicenseKey('licenses', 'lic_abc')).rejects.toThrow('permission-denied')
  })
})

describe('setLicenseKey', () => {
  it('calls the setLicenseKey callable with the correct name and args', async () => {
    mockCallable.mockResolvedValue({ data: undefined })

    await setLicenseKey('licenses', 'lic_abc', 'MY-RAW-KEY')

    expect(httpsCallable).toHaveBeenCalledWith(
      expect.anything(),
      'setLicenseKey',
    )
    expect(mockCallable).toHaveBeenCalledWith({
      collection: 'licenses',
      licenseId: 'lic_abc',
      rawKey: 'MY-RAW-KEY',
    })
  })

  it('works for server_licenses collection', async () => {
    mockCallable.mockResolvedValue({ data: undefined })

    await setLicenseKey('server_licenses', 'srv_001', 'SRV-KEY')

    expect(mockCallable).toHaveBeenCalledWith({
      collection: 'server_licenses',
      licenseId: 'srv_001',
      rawKey: 'SRV-KEY',
    })
  })

  it('propagates callable errors', async () => {
    mockCallable.mockRejectedValue(new Error('unauthenticated'))
    await expect(setLicenseKey('licenses', 'lic_abc', 'key')).rejects.toThrow('unauthenticated')
  })
})
