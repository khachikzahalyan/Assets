import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock firebase/firestore — maskedKey.ts only passes db through to licenseSecrets.
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  getDoc: vi.fn(),
}))

// Mock licenseSecrets — we control what getLicenseSecretKey returns.
vi.mock('./licenseSecrets', () => ({
  getLicenseSecretKey: vi.fn(),
}))

// Mock @/lib/audit — we spy on maskLicenseKey but let it run so we can test
// the masking logic end-to-end via the actual implementation.
vi.mock('@/lib/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit')>()
  return {
    ...actual,
    maskLicenseKey: vi.fn(actual.maskLicenseKey),
  }
})

import { getLicenseSecretKey } from './licenseSecrets'
import { maskLicenseKey } from '@/lib/audit'
import { getMaskedLicenseKey } from './maskedKey'

const stubDb = {} as unknown as import('firebase/firestore').Firestore

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getMaskedLicenseKey', () => {
  it('returns "—" when no secret doc exists (getLicenseSecretKey returns null)', async () => {
    vi.mocked(getLicenseSecretKey).mockResolvedValue(null)
    const result = await getMaskedLicenseKey(stubDb, 'licenses', 'lic1')
    expect(result).toBe('—')
  })

  it('returns the masked key when a key exists', async () => {
    vi.mocked(getLicenseSecretKey).mockResolvedValue('XCVF-7TR5-9HJK-5592')
    const result = await getMaskedLicenseKey(stubDb, 'licenses', 'lic1')
    expect(result).toBe('****-****-****-5592')
  })

  it('delegates to maskLicenseKey with the raw value', async () => {
    vi.mocked(getLicenseSecretKey).mockResolvedValue('AAAA-BBBB-CCCC-1234')
    await getMaskedLicenseKey(stubDb, 'licenses', 'lic2')
    expect(maskLicenseKey).toHaveBeenCalledWith('AAAA-BBBB-CCCC-1234')
  })

  it('never returns the raw key fragment', async () => {
    vi.mocked(getLicenseSecretKey).mockResolvedValue('XCVF-7TR5-9HJK-5592')
    const result = await getMaskedLicenseKey(stubDb, 'licenses', 'lic3')
    expect(result).not.toContain('XCVF')
    expect(result).not.toContain('7TR5')
    expect(result).not.toContain('9HJK')
  })

  it('works for server_licenses collection', async () => {
    vi.mocked(getLicenseSecretKey).mockResolvedValue('SRV-KEY-ABCD-5678')
    const result = await getMaskedLicenseKey(stubDb, 'server_licenses', 'srv1')
    expect(result).toBe('***-***-****-5678')
    expect(getLicenseSecretKey).toHaveBeenCalledWith(stubDb, 'server_licenses', 'srv1')
  })

  it('returns "—" for a key that is null (edge: key was deleted)', async () => {
    vi.mocked(getLicenseSecretKey).mockResolvedValue(null)
    const result = await getMaskedLicenseKey(stubDb, 'server_licenses', 'srv_none')
    expect(result).toBe('—')
    expect(maskLicenseKey).not.toHaveBeenCalled()
  })

  it('short key with 4 or fewer alnum chars is fully masked', async () => {
    vi.mocked(getLicenseSecretKey).mockResolvedValue('AB-CD')
    const result = await getMaskedLicenseKey(stubDb, 'licenses', 'lic_short')
    expect(result).toBe('**-**')
  })
})
