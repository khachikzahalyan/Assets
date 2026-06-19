import { describe, it, expect, vi, beforeEach } from 'vitest'

// Prevent the Admin SDK from actually initializing when the module loads.
vi.mock('firebase-admin/app', () => ({
  getApps: () => [{}],
  initializeApp: vi.fn(),
}))
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(),
  FieldValue: { serverTimestamp: () => '__SERVER_TIMESTAMP__' },
}))
vi.mock('firebase-functions/v2/https', () => ({
  onCall: (fn: unknown) => fn,
  HttpsError: class HttpsError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))

import { assertSuperAdmin, revealCore } from './revealLicenseKey'
import { HttpsError } from 'firebase-functions/v2/https'

// ---------------------------------------------------------------------------
// Fake Firestore builder
// ---------------------------------------------------------------------------

interface DocStub {
  exists: boolean
  data?: () => Record<string, unknown>
}

/**
 * Build a minimal mock Firestore.
 *
 * `docs` maps Firestore doc paths to their stub.
 * `auditAdds` captures every payload passed to audit_logs.add().
 */
function fakeDb(
  docs: Record<string, DocStub>,
  auditAdds: Record<string, unknown>[],
): import('firebase-admin/firestore').Firestore {
  return {
    doc: (path: string) => ({
      get: async () => {
        const stub = docs[path]
        return stub ?? { exists: false }
      },
    }),
    collection: (name: string) => {
      if (name === 'audit_logs') {
        return {
          add: async (payload: Record<string, unknown>) => {
            auditAdds.push(payload)
            return { id: 'fake-audit-id' }
          },
        }
      }
      throw new Error(`Unexpected collection access: ${name}`)
    },
  } as unknown as import('firebase-admin/firestore').Firestore
}

// ---------------------------------------------------------------------------
// assertSuperAdmin
// ---------------------------------------------------------------------------

describe('assertSuperAdmin', () => {
  it('returns the role for super_admin', async () => {
    const db = fakeDb(
      { 'users/uid-super': { exists: true, data: () => ({ role: 'super_admin' }) } },
      [],
    )
    const role = await assertSuperAdmin('uid-super', db)
    expect(role).toBe('super_admin')
  })

  it('throws permission-denied for tech_admin (role denied)', async () => {
    const db = fakeDb(
      { 'users/uid-tech': { exists: true, data: () => ({ role: 'tech_admin' }) } },
      [],
    )
    await expect(assertSuperAdmin('uid-tech', db)).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('throws permission-denied when user doc is missing (fail-closed)', async () => {
    const db = fakeDb({}, [])
    await expect(assertSuperAdmin('uid-nobody', db)).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('throws permission-denied for asset_admin', async () => {
    const db = fakeDb(
      { 'users/uid-asset': { exists: true, data: () => ({ role: 'asset_admin' }) } },
      [],
    )
    await expect(assertSuperAdmin('uid-asset', db)).rejects.toMatchObject({ code: 'permission-denied' })
  })
})

// ---------------------------------------------------------------------------
// revealCore
// ---------------------------------------------------------------------------

describe('revealCore', () => {
  const RAW_KEY = 'XCVF-7TR5-9HJK-5592'
  const MASKED_KEY = '****-****-****-5592'

  let auditAdds: Record<string, unknown>[]
  let db: import('firebase-admin/firestore').Firestore

  beforeEach(() => {
    auditAdds = []
    db = fakeDb(
      {
        'users/uid-super': { exists: true, data: () => ({ role: 'super_admin' }) },
        'users/uid-tech': { exists: true, data: () => ({ role: 'tech_admin' }) },
        'licenses/lic-1/secrets/current': { exists: true, data: () => ({ key: RAW_KEY }) },
        'server_licenses/srv-1/secrets/current': { exists: true, data: () => ({ key: RAW_KEY }) },
      },
      auditAdds,
    )
  })

  // ---- Happy path -----------------------------------------------------------

  it('super_admin can reveal a license key and returns the raw key', async () => {
    const result = await revealCore(
      { uid: 'uid-super', collection: 'licenses', licenseId: 'lic-1' },
      db,
    )
    expect(result.key).toBe(RAW_KEY)
  })

  it('super_admin can reveal a server_license key', async () => {
    const result = await revealCore(
      { uid: 'uid-super', collection: 'server_licenses', licenseId: 'srv-1' },
      db,
    )
    expect(result.key).toBe(RAW_KEY)
  })

  // ---- Audit log security assertions ----------------------------------------

  it('audit log entry contains the MASKED key, not the raw key (raw key must not appear in audit_logs)', async () => {
    await revealCore({ uid: 'uid-super', collection: 'licenses', licenseId: 'lic-1' }, db)
    expect(auditAdds).toHaveLength(1)
    const entry = auditAdds[0]!
    const serialized = JSON.stringify(entry)
    expect(serialized).toContain(MASKED_KEY)
    expect(serialized).not.toContain('9HJK') // raw middle segment must not appear
    expect(serialized).not.toContain(RAW_KEY)
  })

  it('audit log entry has correct shape (entityType, action, actorUid, actorRole)', async () => {
    await revealCore({ uid: 'uid-super', collection: 'licenses', licenseId: 'lic-1' }, db)
    const entry = auditAdds[0]!
    expect(entry).toMatchObject({
      entityType: 'license',
      entityId: 'lic-1',
      action: 'key_revealed',
      actorUid: 'uid-super',
      actorRole: 'super_admin',
    })
  })

  it('audit log for server_licenses uses entityType server_license', async () => {
    await revealCore({ uid: 'uid-super', collection: 'server_licenses', licenseId: 'srv-1' }, db)
    expect(auditAdds[0]).toMatchObject({ entityType: 'server_license' })
  })

  // ---- Role denial ----------------------------------------------------------

  it('tech_admin is denied — throws permission-denied and writes ZERO audit entries', async () => {
    await expect(
      revealCore({ uid: 'uid-tech', collection: 'licenses', licenseId: 'lic-1' }, db),
    ).rejects.toMatchObject({ code: 'permission-denied' })
    expect(auditAdds).toHaveLength(0) // no audit on denial
  })

  it('tech_admin denial returns no key', async () => {
    let result: { key: string } | undefined
    try {
      result = await revealCore({ uid: 'uid-tech', collection: 'licenses', licenseId: 'lic-1' }, db)
    } catch {
      // expected
    }
    expect(result).toBeUndefined()
  })

  // ---- Argument validation --------------------------------------------------

  it('throws invalid-argument for a bad collection name', async () => {
    await expect(
      revealCore({ uid: 'uid-super', collection: 'assets', licenseId: 'lic-1' }, db),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    expect(auditAdds).toHaveLength(0)
  })

  it('throws invalid-argument for an empty collection string', async () => {
    await expect(
      revealCore({ uid: 'uid-super', collection: '', licenseId: 'lic-1' }, db),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument for a licenseId containing "/" and writes NO audit', async () => {
    await expect(
      revealCore({ uid: 'uid-super', collection: 'licenses', licenseId: 'a/b/c' }, db),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    expect(auditAdds).toHaveLength(0)
  })

  it('throws invalid-argument for an empty licenseId and writes NO audit', async () => {
    await expect(
      revealCore({ uid: 'uid-super', collection: 'licenses', licenseId: '' }, db),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    expect(auditAdds).toHaveLength(0)
  })

  // ---- Missing secret -------------------------------------------------------

  it('throws not-found when the secret doc does not exist', async () => {
    const dbNoSecret = fakeDb(
      { 'users/uid-super': { exists: true, data: () => ({ role: 'super_admin' }) } },
      auditAdds,
    )
    await expect(
      revealCore({ uid: 'uid-super', collection: 'licenses', licenseId: 'missing' }, dbNoSecret),
    ).rejects.toMatchObject({ code: 'not-found' })
    expect(auditAdds).toHaveLength(0)
  })
})
