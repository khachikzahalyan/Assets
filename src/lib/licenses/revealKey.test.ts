import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock ./licenseSecrets so revealKey.ts delegates to its helpers without
// touching real Firestore. We test that revealKey.ts wires the helpers
// correctly; licenseSecrets.ts is covered by its own test file.
vi.mock('./licenseSecrets', () => ({
  getLicenseSecretKey: vi.fn(),
  setLicenseSecretKey: vi.fn(),
}))

// Mock firebase/firestore — revealKey.ts uses doc() + getDoc() directly
// to resolve the caller's role from /users/{uid}.
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  getDoc: vi.fn(),
}))

// Mock @/lib/firebase so db() and auth() never touch the real SDK.
vi.mock('@/lib/firebase', () => ({
  db: vi.fn(() => ({ type: 'stub-firestore' })),
  auth: vi.fn(() => ({ currentUser: { uid: 'u_super' } })),
}))

// Mock @/lib/audit — prevents withAudit from touching real Firestore in unit
// tests while letting us assert the correct spec reaches the audit path.
// sanitizeLicenseAuditPayload is kept as a real passthrough so masking
// behaviour is exercised; firestoreAuditContext returns a stub context object.
vi.mock('@/lib/audit', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/audit')>()
  return {
    ...real,
    // sanitizeLicenseAuditPayload — use the real implementation so the mask
    // is applied and we can assert the key is masked in the captured spec.
    firestoreAuditContext: vi.fn(() => ({ _stub: 'audit-ctx' })),
    withAudit: vi.fn().mockResolvedValue({ value: undefined, auditId: 'al_stub' }),
  }
})

import { getDoc } from 'firebase/firestore'
import { auth } from '@/lib/firebase'
import { withAudit } from '@/lib/audit'
import { getLicenseSecretKey, setLicenseSecretKey } from './licenseSecrets'
import { revealLicenseKey, setLicenseKey } from './revealKey'

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// revealLicenseKey
// ---------------------------------------------------------------------------

describe('revealLicenseKey', () => {
  it('throws license-key/unauthenticated when auth().currentUser is null', async () => {
    // Arrange — override auth mock to return no user
    vi.mocked(auth).mockReturnValueOnce({ currentUser: null } as ReturnType<typeof auth>)

    // Act & Assert
    await expect(revealLicenseKey('licenses', 'lic_abc')).rejects.toThrow(
      'license-key/unauthenticated',
    )
    // The secret must NOT be read if unauthenticated
    expect(getLicenseSecretKey).not.toHaveBeenCalled()
    // No audit written for unauthenticated callers
    expect(withAudit).not.toHaveBeenCalled()
  })

  it('returns the raw key when getLicenseSecretKey resolves a key', async () => {
    // Arrange — auth returns u_super; /users/u_super doc has role super_admin
    vi.mocked(getLicenseSecretKey).mockResolvedValue('RAW-KEY-123')
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ role: 'super_admin' }),
    } as ReturnType<typeof getDoc> extends Promise<infer S> ? S : never)

    // Act
    const result = await revealLicenseKey('licenses', 'lic_abc')

    // Assert — secret was fetched with correct args
    expect(getLicenseSecretKey).toHaveBeenCalledWith(
      expect.anything(),  // db() stub
      'licenses',
      'lic_abc',
    )
    expect(result).toBe('RAW-KEY-123')
  })

  it('writes a masked key_revealed audit entry on successful reveal', async () => {
    // Arrange
    vi.mocked(getLicenseSecretKey).mockResolvedValue('XCVF-7TR5-9HJK-5592')
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ role: 'super_admin' }),
    } as ReturnType<typeof getDoc> extends Promise<infer S> ? S : never)

    // Act
    await revealLicenseKey('licenses', 'lic_abc')

    // Assert — withAudit was called exactly once
    expect(withAudit).toHaveBeenCalledTimes(1)

    // Retrieve the spec passed to withAudit (second argument)
    const [_ctx, capturedSpec] = vi.mocked(withAudit).mock.calls[0]!

    // entityType + entityId + action
    expect(capturedSpec.entityType).toBe('license')
    expect(capturedSpec.entityId).toBe('lic_abc')
    expect(capturedSpec.action).toBe('key_revealed')
    expect(capturedSpec.actorUid).toBe('u_super')
    expect(capturedSpec.actorRole).toBe('super_admin')
    expect(capturedSpec.before).toBeNull()

    // The `key` in `after` must be MASKED — sanitizeLicenseAuditPayload applies
    // last-4 masking ('XCVF-7TR5-9HJK-5592' → '****-****-****-5592').
    expect(capturedSpec.after).toBeDefined()
    const afterKey = (capturedSpec.after as Record<string, unknown>)['key']
    expect(afterKey).toBe('****-****-****-5592')

    // The raw key must NEVER appear in the spec passed to withAudit.
    expect(JSON.stringify(capturedSpec)).not.toContain('XCVF-7TR5-9HJK-5592')
  })

  it('uses entityType server_license for server_licenses collection', async () => {
    // Arrange
    vi.mocked(getLicenseSecretKey).mockResolvedValue('SRV-KEY-XYZ00')
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ role: 'super_admin' }),
    } as ReturnType<typeof getDoc> extends Promise<infer S> ? S : never)

    // Act
    const result = await revealLicenseKey('server_licenses', 'srv_001')

    // Assert — correct collection forwarded to getLicenseSecretKey
    expect(getLicenseSecretKey).toHaveBeenCalledWith(
      expect.anything(),
      'server_licenses',
      'srv_001',
    )
    expect(result).toBe('SRV-KEY-XYZ00')

    // entityType should be server_license (not license)
    const [_ctx, capturedSpec] = vi.mocked(withAudit).mock.calls[0]!
    expect(capturedSpec.entityType).toBe('server_license')
  })

  it('throws license-key/not-found when the secret is null and writes NO audit entry', async () => {
    // Arrange — key was never set
    vi.mocked(getLicenseSecretKey).mockResolvedValue(null)

    // Act & Assert
    await expect(revealLicenseKey('licenses', 'lic_abc')).rejects.toThrow('license-key/not-found')

    // No audit written — there is nothing revealed when the key does not exist.
    expect(withAudit).not.toHaveBeenCalled()
  })

  it('propagates errors thrown by getLicenseSecretKey', async () => {
    // Arrange
    vi.mocked(getLicenseSecretKey).mockRejectedValue(new Error('permission-denied'))

    // Act & Assert
    await expect(revealLicenseKey('licenses', 'lic_abc')).rejects.toThrow('permission-denied')
  })

  it('falls back to empty string role when the user doc does not exist', async () => {
    // Arrange
    vi.mocked(getLicenseSecretKey).mockResolvedValue('ABCD-EFGH-12345')
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
      data: () => undefined,
    } as ReturnType<typeof getDoc> extends Promise<infer S> ? S : never)

    // Act
    await revealLicenseKey('licenses', 'lic_abc')

    // Assert — actorRole defaults to '' when user doc is missing
    const [_ctx, capturedSpec] = vi.mocked(withAudit).mock.calls[0]!
    expect(capturedSpec.actorRole).toBe('')
  })
})

// ---------------------------------------------------------------------------
// setLicenseKey
// ---------------------------------------------------------------------------

describe('setLicenseKey', () => {
  it('resolves caller uid+role and calls setLicenseSecretKey with the raw key', async () => {
    // Arrange — auth returns u_super; /users/u_super doc has role super_admin
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ role: 'super_admin' }),
    } as ReturnType<typeof getDoc> extends Promise<infer S> ? S : never)
    vi.mocked(setLicenseSecretKey).mockResolvedValue(undefined)

    // Act
    await setLicenseKey('licenses', 'lic_abc', 'MY-RAW-KEY')

    // Assert — the actor object passed to setLicenseSecretKey carries the right uid + role
    expect(setLicenseSecretKey).toHaveBeenCalledWith(
      expect.anything(),      // db() stub
      'licenses',
      'lic_abc',
      'MY-RAW-KEY',
      { uid: 'u_super', role: 'super_admin' },
    )
  })

  it('throws license-key/unauthenticated when auth().currentUser is null', async () => {
    // Arrange — override the auth mock to return no user for this test only
    vi.mocked(auth).mockReturnValueOnce({ currentUser: null } as ReturnType<typeof auth>)

    // Act & Assert
    await expect(setLicenseKey('licenses', 'lic_abc', 'MY-RAW-KEY')).rejects.toThrow(
      'license-key/unauthenticated',
    )
    expect(setLicenseSecretKey).not.toHaveBeenCalled()
  })

  it('falls back to empty string role when the user doc does not exist', async () => {
    // Arrange — user doc is missing from Firestore (fresh user, no role assigned yet)
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
      data: () => undefined,
    } as ReturnType<typeof getDoc> extends Promise<infer S> ? S : never)
    vi.mocked(setLicenseSecretKey).mockResolvedValue(undefined)

    // Act
    await setLicenseKey('licenses', 'lic_abc', 'MY-RAW-KEY')

    // Assert — role defaults to '' when doc missing
    expect(setLicenseSecretKey).toHaveBeenCalledWith(
      expect.anything(),
      'licenses',
      'lic_abc',
      'MY-RAW-KEY',
      { uid: 'u_super', role: '' },
    )
  })

  it('propagates errors thrown by setLicenseSecretKey', async () => {
    // Arrange
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ role: 'super_admin' }),
    } as ReturnType<typeof getDoc> extends Promise<infer S> ? S : never)
    vi.mocked(setLicenseSecretKey).mockRejectedValue(new Error('permission-denied'))

    // Act & Assert
    await expect(setLicenseKey('licenses', 'lic_abc', 'KEY')).rejects.toThrow('permission-denied')
  })
})
