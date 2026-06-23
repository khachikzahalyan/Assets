import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock firebase/firestore — all Firestore calls go through these stubs.
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({
    path: segments.join('/'),
    _segments: segments,
  })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
}))

// Mock @/lib/audit — we want to verify withAudit is called once with the
// expected shape; we do NOT need firestoreAuditContext to run real transactions.
vi.mock('@/lib/audit', () => ({
  withAudit: vi.fn(async (_ctx: unknown, _spec: unknown, mutate: (txn: unknown) => Promise<unknown>) => {
    // Execute the mutate callback so the real code path is exercised.
    const result = await mutate({})
    return { value: (result as { value: unknown }).value, auditId: 'audit_stub' }
  }),
  firestoreAuditContext: vi.fn((_db: unknown) => ({ type: 'stub-audit-ctx' })),
  sanitizeLicenseAuditPayload: vi.fn((payload: unknown) => payload),
}))

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { withAudit, firestoreAuditContext, sanitizeLicenseAuditPayload } from '@/lib/audit'
import { getLicenseSecretKey, setLicenseSecretKey } from './licenseSecrets'

// Minimal stub Firestore instance — production code receives this from db()
const stubDb = { type: 'stub-firestore' } as unknown as import('firebase/firestore').Firestore

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// getLicenseSecretKey
// ---------------------------------------------------------------------------

describe('getLicenseSecretKey', () => {
  it('returns the raw key when the secret doc exists', async () => {
    // Arrange
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ key: 'XCVF-7TR5-9HJK-5592', updatedBy: 'u1', updatedAt: null }),
    } as ReturnType<typeof getDoc> extends Promise<infer S> ? S : never)

    // Act
    const result = await getLicenseSecretKey(stubDb, 'licenses', 'lic_abc')

    // Assert
    expect(doc).toHaveBeenCalledWith(stubDb, 'licenses', 'lic_abc', 'secrets', 'current')
    expect(result).toBe('XCVF-7TR5-9HJK-5592')
  })

  it('returns null when the secret doc does not exist', async () => {
    // Arrange
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
      data: () => undefined,
    } as ReturnType<typeof getDoc> extends Promise<infer S> ? S : never)

    // Act
    const result = await getLicenseSecretKey(stubDb, 'licenses', 'lic_missing')

    // Assert
    expect(result).toBeNull()
  })

  it('returns null when the key field is an empty string', async () => {
    // Arrange — doc exists but key was wiped / set to empty
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ key: '' }),
    } as ReturnType<typeof getDoc> extends Promise<infer S> ? S : never)

    // Act
    const result = await getLicenseSecretKey(stubDb, 'licenses', 'lic_empty')

    // Assert
    expect(result).toBeNull()
  })

  it('returns null when the key field is undefined', async () => {
    // Arrange
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ updatedBy: 'u1' }), // no 'key' field at all
    } as ReturnType<typeof getDoc> extends Promise<infer S> ? S : never)

    // Act
    const result = await getLicenseSecretKey(stubDb, 'licenses', 'lic_nokey')

    // Assert
    expect(result).toBeNull()
  })

  it('works for the server_licenses collection', async () => {
    // Arrange
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ key: 'SRV-KEY-XYZ' }),
    } as ReturnType<typeof getDoc> extends Promise<infer S> ? S : never)

    // Act
    const result = await getLicenseSecretKey(stubDb, 'server_licenses', 'srv_001')

    // Assert
    expect(doc).toHaveBeenCalledWith(stubDb, 'server_licenses', 'srv_001', 'secrets', 'current')
    expect(result).toBe('SRV-KEY-XYZ')
  })
})

// ---------------------------------------------------------------------------
// setLicenseSecretKey
// ---------------------------------------------------------------------------

describe('setLicenseSecretKey', () => {
  const actor = { uid: 'u_super', role: 'super_admin' }

  it('writes the secret doc to {collection}/{id}/secrets/current with correct shape', async () => {
    // Arrange
    vi.mocked(setDoc).mockResolvedValue(undefined)

    // Act
    await setLicenseSecretKey(stubDb, 'licenses', 'lic_abc', 'RAW-KEY-XXXX', actor)

    // Assert — setDoc was called with the correct path and payload
    expect(doc).toHaveBeenCalledWith(stubDb, 'licenses', 'lic_abc', 'secrets', 'current')
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'licenses/lic_abc/secrets/current' }),
      {
        key: 'RAW-KEY-XXXX',
        updatedBy: 'u_super',
        updatedAt: { __serverTimestamp: true },
      },
    )
    expect(serverTimestamp).toHaveBeenCalled()
  })

  it('calls withAudit exactly once with action key_rotated', async () => {
    // Arrange
    vi.mocked(setDoc).mockResolvedValue(undefined)

    // Act
    await setLicenseSecretKey(stubDb, 'licenses', 'lic_abc', 'RAW-KEY-XXXX', actor)

    // Assert — exactly one audit entry per write
    expect(withAudit).toHaveBeenCalledTimes(1)
    expect(withAudit).toHaveBeenCalledWith(
      expect.anything(),        // firestoreAuditContext stub
      expect.objectContaining({
        entityType: 'license',
        entityId: 'lic_abc',
        action: 'key_rotated',
        actorUid: 'u_super',
        actorRole: 'super_admin',
      }),
      expect.any(Function),     // the mutate callback
    )
  })

  it('calls sanitizeLicenseAuditPayload so the raw key is masked before withAudit', async () => {
    // Arrange
    vi.mocked(setDoc).mockResolvedValue(undefined)

    // Act
    await setLicenseSecretKey(stubDb, 'licenses', 'lic_abc', 'MY-SECRET-KEY', actor)

    // Assert — sanitize was called (it masks the key inside the audit spec)
    expect(sanitizeLicenseAuditPayload).toHaveBeenCalledTimes(1)
    // The payload passed to sanitize must include the raw key in after.key
    expect(sanitizeLicenseAuditPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({ key: 'MY-SECRET-KEY' }),
      }),
    )
  })

  it('passes firestoreAuditContext(db) as the audit context to withAudit', async () => {
    // Arrange
    vi.mocked(setDoc).mockResolvedValue(undefined)

    // Act
    await setLicenseSecretKey(stubDb, 'licenses', 'lic_abc', 'RAW-KEY', actor)

    // Assert — firestoreAuditContext was called with our stubDb
    expect(firestoreAuditContext).toHaveBeenCalledWith(stubDb)
    expect(withAudit).toHaveBeenCalledWith(
      { type: 'stub-audit-ctx' },
      expect.anything(),
      expect.any(Function),
    )
  })

  it('round-trips: setLicenseSecretKey writes; getLicenseSecretKey returns the same key', async () => {
    // Arrange — simulate Firestore storing what setDoc receives
    let stored: Record<string, unknown> = {}
    vi.mocked(setDoc).mockImplementation(async (_ref, data) => {
      stored = data as Record<string, unknown>
    })
    vi.mocked(getDoc).mockImplementation(async () => ({
      exists: () => Object.keys(stored).length > 0,
      data: () => stored,
    } as ReturnType<typeof getDoc> extends Promise<infer S> ? S : never))

    // Act — write
    await setLicenseSecretKey(stubDb, 'licenses', 'lic_rt', 'ROUND-TRIP-KEY', actor)
    // Read back
    const key = await getLicenseSecretKey(stubDb, 'licenses', 'lic_rt')

    // Assert
    expect(key).toBe('ROUND-TRIP-KEY')
  })

  it('works for the server_licenses collection', async () => {
    // Arrange
    vi.mocked(setDoc).mockResolvedValue(undefined)

    // Act
    await setLicenseSecretKey(stubDb, 'server_licenses', 'srv_001', 'SRV-RAW-KEY', actor)

    // Assert
    expect(doc).toHaveBeenCalledWith(stubDb, 'server_licenses', 'srv_001', 'secrets', 'current')
    expect(withAudit).toHaveBeenCalledTimes(1)
  })
})
