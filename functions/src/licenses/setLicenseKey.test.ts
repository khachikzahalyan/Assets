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

import { setKeyCore } from './setLicenseKey'

// ---------------------------------------------------------------------------
// Fake Firestore builder
// ---------------------------------------------------------------------------

interface DocStub {
  exists: boolean
  data?: () => Record<string, unknown>
}

interface FakeDbState {
  docs: Record<string, DocStub>
  secretSets: Array<{ path: string; payload: Record<string, unknown> }>
  auditAdds: Array<Record<string, unknown>>
}

/**
 * Build a minimal mock Firestore that records secret doc .set() calls and
 * audit_logs .add() calls separately for assertion.
 */
function fakeDb(
  docs: Record<string, DocStub>,
  state: FakeDbState,
): import('firebase-admin/firestore').Firestore {
  return {
    doc: (path: string) => ({
      get: async () => {
        const stub = docs[path]
        return stub ?? { exists: false }
      },
      set: async (payload: Record<string, unknown>) => {
        state.secretSets.push({ path, payload })
      },
    }),
    collection: (name: string) => {
      if (name === 'audit_logs') {
        return {
          add: async (payload: Record<string, unknown>) => {
            state.auditAdds.push(payload)
            return { id: 'fake-audit-id' }
          },
        }
      }
      throw new Error(`Unexpected collection access: ${name}`)
    },
  } as unknown as import('firebase-admin/firestore').Firestore
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const RAW_KEY = 'XCVF-7TR5-9HJK-5592'
const MASKED_KEY = '****-****-****-5592'

let state: FakeDbState
let db: import('firebase-admin/firestore').Firestore

beforeEach(() => {
  state = { docs: {}, secretSets: [], auditAdds: [] }
  db = fakeDb(
    {
      'users/uid-super': { exists: true, data: () => ({ role: 'super_admin' }) },
      'users/uid-tech': { exists: true, data: () => ({ role: 'tech_admin' }) },
      'users/uid-asset': { exists: true, data: () => ({ role: 'asset_admin' }) },
      'users/uid-emp': { exists: true, data: () => ({ role: 'employee' }) },
      'licenses/lic-1': { exists: true, data: () => ({ name: 'Office Suite' }) },
      'server_licenses/srv-1': { exists: true, data: () => ({ name: 'Windows Server' }) },
    },
    state,
  )
})

// ---- Happy paths -----------------------------------------------------------

describe('setKeyCore — happy paths', () => {
  it('super_admin can set a key on licenses', async () => {
    const result = await setKeyCore(
      { uid: 'uid-super', collection: 'licenses', licenseId: 'lic-1', rawKey: RAW_KEY },
      db,
    )
    expect(result).toEqual({ ok: true })
  })

  it('super_admin can set a key on server_licenses', async () => {
    const result = await setKeyCore(
      { uid: 'uid-super', collection: 'server_licenses', licenseId: 'srv-1', rawKey: RAW_KEY },
      db,
    )
    expect(result).toEqual({ ok: true })
  })

  it('tech_admin can set a key on licenses', async () => {
    const result = await setKeyCore(
      { uid: 'uid-tech', collection: 'licenses', licenseId: 'lic-1', rawKey: RAW_KEY },
      db,
    )
    expect(result).toEqual({ ok: true })
  })
})

// ---- Role denial -----------------------------------------------------------

describe('setKeyCore — role denial (no secret write, no audit on denial)', () => {
  it('asset_admin is denied and writes NO secret, NO audit', async () => {
    await expect(
      setKeyCore({ uid: 'uid-asset', collection: 'licenses', licenseId: 'lic-1', rawKey: RAW_KEY }, db),
    ).rejects.toMatchObject({ code: 'permission-denied' })
    expect(state.secretSets).toHaveLength(0)
    expect(state.auditAdds).toHaveLength(0)
  })

  it('employee is denied and writes NO secret, NO audit', async () => {
    await expect(
      setKeyCore({ uid: 'uid-emp', collection: 'licenses', licenseId: 'lic-1', rawKey: RAW_KEY }, db),
    ).rejects.toMatchObject({ code: 'permission-denied' })
    expect(state.secretSets).toHaveLength(0)
    expect(state.auditAdds).toHaveLength(0)
  })

  it('tech_admin CANNOT set server_license keys — permission-denied', async () => {
    await expect(
      setKeyCore({ uid: 'uid-tech', collection: 'server_licenses', licenseId: 'srv-1', rawKey: RAW_KEY }, db),
    ).rejects.toMatchObject({ code: 'permission-denied' })
    expect(state.secretSets).toHaveLength(0)
    expect(state.auditAdds).toHaveLength(0)
  })

  it('missing user doc is denied (fail-closed) — no secret write, no audit', async () => {
    await expect(
      setKeyCore({ uid: 'uid-ghost', collection: 'licenses', licenseId: 'lic-1', rawKey: RAW_KEY }, db),
    ).rejects.toMatchObject({ code: 'permission-denied' })
    expect(state.secretSets).toHaveLength(0)
    expect(state.auditAdds).toHaveLength(0)
  })
})

// ---- Argument validation ---------------------------------------------------

describe('setKeyCore — argument validation', () => {
  it('throws invalid-argument for a bad collection name', async () => {
    await expect(
      setKeyCore({ uid: 'uid-super', collection: 'assets', licenseId: 'lic-1', rawKey: RAW_KEY }, db),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    expect(state.secretSets).toHaveLength(0)
    expect(state.auditAdds).toHaveLength(0)
  })

  it('throws invalid-argument for an empty rawKey', async () => {
    await expect(
      setKeyCore({ uid: 'uid-super', collection: 'licenses', licenseId: 'lic-1', rawKey: '' }, db),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    expect(state.secretSets).toHaveLength(0)
    expect(state.auditAdds).toHaveLength(0)
  })

  it('throws invalid-argument for missing rawKey (undefined cast)', async () => {
    await expect(
      setKeyCore(
        { uid: 'uid-super', collection: 'licenses', licenseId: 'lic-1', rawKey: undefined as unknown as string },
        db,
      ),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('throws invalid-argument for a licenseId containing "/" and writes NO secret, NO audit', async () => {
    await expect(
      setKeyCore({ uid: 'uid-super', collection: 'licenses', licenseId: 'a/b/c', rawKey: RAW_KEY }, db),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    expect(state.secretSets).toHaveLength(0)
    expect(state.auditAdds).toHaveLength(0)
  })

  it('throws invalid-argument for an empty licenseId and writes NO secret, NO audit', async () => {
    await expect(
      setKeyCore({ uid: 'uid-super', collection: 'licenses', licenseId: '', rawKey: RAW_KEY }, db),
    ).rejects.toMatchObject({ code: 'invalid-argument' })
    expect(state.secretSets).toHaveLength(0)
    expect(state.auditAdds).toHaveLength(0)
  })
})

// ---- Missing parent --------------------------------------------------------

describe('setKeyCore — missing parent', () => {
  it('throws not-found when parent license doc does not exist', async () => {
    await expect(
      setKeyCore({ uid: 'uid-super', collection: 'licenses', licenseId: 'no-such', rawKey: RAW_KEY }, db),
    ).rejects.toMatchObject({ code: 'not-found' })
    expect(state.secretSets).toHaveLength(0)
    expect(state.auditAdds).toHaveLength(0)
  })

  it('throws not-found when parent server_license doc does not exist', async () => {
    await expect(
      setKeyCore({ uid: 'uid-super', collection: 'server_licenses', licenseId: 'no-such', rawKey: RAW_KEY }, db),
    ).rejects.toMatchObject({ code: 'not-found' })
    expect(state.secretSets).toHaveLength(0)
    expect(state.auditAdds).toHaveLength(0)
  })
})

// ---- Secret store and audit security assertions ----------------------------

describe('setKeyCore — secret store correctness and audit security', () => {
  it('secret doc receives the RAW key (it is the secret store)', async () => {
    await setKeyCore(
      { uid: 'uid-super', collection: 'licenses', licenseId: 'lic-1', rawKey: RAW_KEY },
      db,
    )
    expect(state.secretSets).toHaveLength(1)
    const secretWrite = state.secretSets[0]!
    expect(secretWrite.path).toBe('licenses/lic-1/secrets/current')
    expect(secretWrite.payload.key).toBe(RAW_KEY)
  })

  it('audit doc contains the MASKED key — raw key MUST NOT appear in audit_logs', async () => {
    await setKeyCore(
      { uid: 'uid-super', collection: 'licenses', licenseId: 'lic-1', rawKey: RAW_KEY },
      db,
    )
    expect(state.auditAdds).toHaveLength(1)
    const auditEntry = state.auditAdds[0]!
    const serialized = JSON.stringify(auditEntry)
    expect(serialized).toContain(MASKED_KEY)
    expect(serialized).not.toContain('9HJK') // raw middle segment must not appear
    expect(serialized).not.toContain(RAW_KEY)
  })

  it('audit doc has action key_rotated and correct shape', async () => {
    await setKeyCore(
      { uid: 'uid-super', collection: 'licenses', licenseId: 'lic-1', rawKey: RAW_KEY },
      db,
    )
    expect(state.auditAdds[0]).toMatchObject({
      entityType: 'license',
      entityId: 'lic-1',
      action: 'key_rotated',
      actorUid: 'uid-super',
      actorRole: 'super_admin',
    })
  })

  it('audit for server_licenses uses entityType server_license', async () => {
    await setKeyCore(
      { uid: 'uid-super', collection: 'server_licenses', licenseId: 'srv-1', rawKey: RAW_KEY },
      db,
    )
    expect(state.auditAdds[0]).toMatchObject({ entityType: 'server_license' })
  })

  it('return value has no key property (raw key is never returned)', async () => {
    const result = await setKeyCore(
      { uid: 'uid-super', collection: 'licenses', licenseId: 'lic-1', rawKey: RAW_KEY },
      db,
    )
    expect(result).not.toHaveProperty('key')
    expect(result).toEqual({ ok: true })
  })

  it('tech_admin success: audit doc shows actorRole tech_admin with masked key', async () => {
    await setKeyCore(
      { uid: 'uid-tech', collection: 'licenses', licenseId: 'lic-1', rawKey: RAW_KEY },
      db,
    )
    expect(state.auditAdds[0]).toMatchObject({
      actorRole: 'tech_admin',
      action: 'key_rotated',
    })
    const serialized = JSON.stringify(state.auditAdds[0])
    expect(serialized).not.toContain(RAW_KEY)
  })
})
