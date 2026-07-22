import { describe, it, expect, vi } from 'vitest'

// Prevent the Admin SDK from actually initializing when the module loads.
vi.mock('firebase-admin/app', () => ({
  getApps: () => [{}],
  initializeApp: vi.fn(),
}))
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(),
}))

import {
  isDomainAllowed,
  isSeedAdmin,
  decideSignIn,
  assertEmailAllowed,
  type SystemLookup,
} from './beforeCreate'

// ─── fake DB builder ──────────────────────────────────────────────────────────

interface FakeQueryResult { empty: boolean; docs: Array<{ data: () => Record<string, unknown> }> }

/**
 * Builds a fake Admin Firestore stub.
 *
 * `settingsSnap` controls the /settings/auth doc.
 * `collectionRows` maps collectionPath → list of { email, status? } objects stored there.
 *   A missing status field simulates legacy docs (treated as active).
 * `collectionError` if true, makes ALL collection queries throw.
 */
function fakeDb(
  settingsSnap: { exists: boolean; data?: () => Record<string, unknown> },
  collectionRows: Record<string, Array<{ email: string; status?: string }>> = {},
  collectionError = false,
) {
  return {
    doc: (path: string) => {
      expect(path).toBe('settings/auth')
      return { get: async () => settingsSnap }
    },
    collection: (col: string) => ({
      where: (_field: string, _op: string, value: string) => ({
        limit: (_n: number) => ({
          get: async (): Promise<FakeQueryResult> => {
            if (collectionError) throw new Error('Firestore read failed')
            const rows = collectionRows[col] ?? []
            const matched = rows.filter((r) => r.email === value)
            return {
              empty: matched.length === 0,
              docs: matched.map(r => ({ data: () => ({ email: r.email, ...(r.status !== undefined ? { status: r.status } : {}) }) })),
            }
          },
        }),
      }),
    }),
  } as unknown as import('firebase-admin/firestore').Firestore
}

// Helper for old-style string-only rows (backward compat with existing tests)
function fakeDbStrings(
  settingsSnap: { exists: boolean; data?: () => Record<string, unknown> },
  collectionRows: Record<string, string[]> = {},
  collectionError = false,
) {
  const objectRows = Object.fromEntries(
    Object.entries(collectionRows).map(([col, emails]) => [col, emails.map(email => ({ email }))]),
  )
  return fakeDb(settingsSnap, objectRows, collectionError)
}

// ─── isDomainAllowed ──────────────────────────────────────────────────────────

describe('isDomainAllowed (pure helper)', () => {
  it('returns true for a case-insensitive domain match', () => {
    expect(isDomainAllowed('Alice@OK.example', ['ok.example'])).toBe(true)
    expect(isDomainAllowed('bob@ok.example', ['OK.EXAMPLE'])).toBe(true)
  })

  it('returns false for a non-matching domain', () => {
    expect(isDomainAllowed('eve@evil.example', ['ok.example'])).toBe(false)
  })

  it('returns false for a missing email (fail closed)', () => {
    expect(isDomainAllowed(undefined, ['ok.example'])).toBe(false)
    expect(isDomainAllowed('', ['ok.example'])).toBe(false)
  })

  it('returns false for an empty domains list (fail closed)', () => {
    expect(isDomainAllowed('alice@ok.example', [])).toBe(false)
  })

  it('returns false for a malformed email', () => {
    expect(isDomainAllowed('no-at-sign', ['ok.example'])).toBe(false)
    expect(isDomainAllowed('trailing@', ['ok.example'])).toBe(false)
  })
})

// ─── isSeedAdmin ─────────────────────────────────────────────────────────────

describe('isSeedAdmin (pure helper)', () => {
  it('returns true for a case-insensitive exact email match', () => {
    expect(isSeedAdmin('Admin@Example.com', ['admin@example.com'])).toBe(true)
    expect(isSeedAdmin('admin@example.com', ['Admin@Example.COM'])).toBe(true)
  })

  it('trims whitespace from both sides before comparing', () => {
    expect(isSeedAdmin('  admin@example.com  ', ['admin@example.com'])).toBe(true)
    expect(isSeedAdmin('admin@example.com', ['  admin@example.com  '])).toBe(true)
  })

  it('returns false for a different email in the seed list', () => {
    expect(isSeedAdmin('other@example.com', ['admin@example.com'])).toBe(false)
  })

  it('returns false for a missing email (fail closed)', () => {
    expect(isSeedAdmin(undefined, ['admin@example.com'])).toBe(false)
    expect(isSeedAdmin('', ['admin@example.com'])).toBe(false)
  })

  it('returns false for an empty seed list (fail closed)', () => {
    expect(isSeedAdmin('admin@example.com', [])).toBe(false)
  })

  it('does NOT do a substring/domain match — full email must match', () => {
    expect(isSeedAdmin('admin@example.com', ['example.com'])).toBe(false)
  })
})

// ─── decideSignIn ─────────────────────────────────────────────────────────────

describe('decideSignIn (pure gate predicate)', () => {
  const settings = { allowedEmailDomains: ['ok.example'], seedSuperAdmins: ['seed@other.example'] }
  const noLookup: SystemLookup = { inUsers: false, inEmployees: false }

  it('allows a seed email even when its domain is not in allowedEmailDomains', () => {
    const r = decideSignIn('seed@other.example', settings, noLookup)
    expect(r.allow).toBe(true)
  })

  it('seed check is case-insensitive', () => {
    const r = decideSignIn('SEED@OTHER.EXAMPLE', settings, noLookup)
    expect(r.allow).toBe(true)
  })

  it('allows when email is found in /users (inUsers: true)', () => {
    const r = decideSignIn('registered@anywhere.example', settings, { inUsers: true, inEmployees: false })
    expect(r.allow).toBe(true)
  })

  it('allows when email is found in /employees (inEmployees: true)', () => {
    const r = decideSignIn('worker@company.example', settings, { inUsers: false, inEmployees: true })
    expect(r.allow).toBe(true)
  })

  it('allows when email is found in both /users and /employees', () => {
    const r = decideSignIn('dual@company.example', settings, { inUsers: true, inEmployees: true })
    expect(r.allow).toBe(true)
  })

  it('allows an email whose domain is in allowedEmailDomains (no lookup hit)', () => {
    const r = decideSignIn('anyone@ok.example', settings, noLookup)
    expect(r.allow).toBe(true)
  })

  it('denies an email that matches neither seed, system, nor domain list', () => {
    const r = decideSignIn('attacker@evil.example', settings, noLookup)
    expect(r.allow).toBe(false)
    if (!r.allow) expect(r.reason).toMatch(/not registered/i)
  })

  it('denies when all lists and lookup are empty/false (fail closed)', () => {
    const r = decideSignIn('anyone@ok.example', { allowedEmailDomains: [], seedSuperAdmins: [] }, noLookup)
    expect(r.allow).toBe(false)
  })

  it('denies for a missing email (fail closed)', () => {
    const r = decideSignIn(undefined, settings, noLookup)
    expect(r.allow).toBe(false)
  })

  it('lookup is checked before domain list — domain-list alone is not required', () => {
    // No allowedEmailDomains, but email is in /employees → allow
    const r = decideSignIn('emp@corp.example', { allowedEmailDomains: [], seedSuperAdmins: [] }, { inUsers: false, inEmployees: true })
    expect(r.allow).toBe(true)
  })

  it('defaults lookup to false when omitted (backward-compatible signature)', () => {
    const r = decideSignIn('anyone@ok.example', settings)
    // domain ok.example is allowed, so this still passes via domain gate
    expect(r.allow).toBe(true)
  })
})

// ─── assertEmailAllowed (mocked Firestore) ────────────────────────────────────

describe('assertEmailAllowed (mocked Firestore)', () => {
  // ── existing: settings-doc scenarios ──────────────────────────────────────

  it('throws when the settings doc is missing (fail closed)', async () => {
    const db = fakeDbStrings({ exists: false })
    await expect(assertEmailAllowed('alice@ok.example', db)).rejects.toThrow()
  })

  it('resolves for a seed admin email even when its domain is NOT in allowedEmailDomains', async () => {
    const db = fakeDbStrings(
      { exists: true, data: () => ({ allowedEmailDomains: ['corp.example'], seedSuperAdmins: ['seed@other.example'] }) },
      {},
    )
    await expect(assertEmailAllowed('seed@other.example', db)).resolves.toBeUndefined()
  })

  it('seed match is case-insensitive', async () => {
    const db = fakeDbStrings(
      { exists: true, data: () => ({ allowedEmailDomains: [], seedSuperAdmins: ['Seed@Other.Example'] }) },
      {},
    )
    await expect(assertEmailAllowed('seed@other.example', db)).resolves.toBeUndefined()
  })

  // ── new: system-registration lookup scenarios ──────────────────────────────

  it('resolves when email is found in /employees (active, employee email-link flow)', async () => {
    const db = fakeDbStrings(
      { exists: true, data: () => ({ allowedEmailDomains: [], seedSuperAdmins: [] }) },
      { employees: ['worker@company.example'] },
    )
    await expect(assertEmailAllowed('worker@company.example', db)).resolves.toBeUndefined()
  })

  it('resolves when email is found in /users (previously approved admin)', async () => {
    const db = fakeDbStrings(
      { exists: true, data: () => ({ allowedEmailDomains: [], seedSuperAdmins: [] }) },
      { users: ['admin@company.example'] },
    )
    await expect(assertEmailAllowed('admin@company.example', db)).resolves.toBeUndefined()
  })

  it('resolves when email is found in /employees with a different casing in storage', async () => {
    // Stored as lowercase; incoming email has mixed case → trimmed lowercase query finds it
    const db = fakeDbStrings(
      { exists: true, data: () => ({ allowedEmailDomains: [], seedSuperAdmins: [] }) },
      { employees: ['worker@company.example'] },
    )
    await expect(assertEmailAllowed('Worker@Company.Example', db)).resolves.toBeUndefined()
  })

  it('throws for a stranger with an unknown domain (no match anywhere)', async () => {
    const db = fakeDbStrings(
      { exists: true, data: () => ({ allowedEmailDomains: ['corp.example'], seedSuperAdmins: [] }) },
      {},   // no rows in users or employees
    )
    await expect(assertEmailAllowed('stranger@gmail.com', db)).rejects.toThrow()
  })

  it('throws for a stranger @gmail when allowedEmailDomains is empty (fail closed)', async () => {
    const db = fakeDbStrings(
      { exists: true, data: () => ({ allowedEmailDomains: [], seedSuperAdmins: [] }) },
      {},
    )
    await expect(assertEmailAllowed('nobody@gmail.com', db)).rejects.toThrow()
  })

  it('throws (fail closed) when /users query throws a Firestore error', async () => {
    const db = fakeDbStrings(
      { exists: true, data: () => ({ allowedEmailDomains: [], seedSuperAdmins: [] }) },
      {},
      true,   // collectionError
    )
    await expect(assertEmailAllowed('worker@company.example', db)).rejects.toThrow()
  })

  // ── existing: domain-list path (now gate 4) ─────────────────────────────────

  it('resolves for an email whose domain is in allowedEmailDomains (no system record needed)', async () => {
    const db = fakeDbStrings(
      { exists: true, data: () => ({ allowedEmailDomains: ['ok.example'], seedSuperAdmins: [] }) },
      {},
    )
    await expect(assertEmailAllowed('alice@ok.example', db)).resolves.toBeUndefined()
  })

  it('throws for an email whose domain is not allowed and is not in the system', async () => {
    const db = fakeDbStrings(
      { exists: true, data: () => ({ allowedEmailDomains: ['ok.example'], seedSuperAdmins: [] }) },
      {},
    )
    await expect(assertEmailAllowed('eve@evil.example', db)).rejects.toThrow()
  })

  it('tolerates a missing seedSuperAdmins field (treated as empty — no bypass)', async () => {
    const db = fakeDbStrings(
      { exists: true, data: () => ({ allowedEmailDomains: ['ok.example'] }) },
      {},
    )
    // Domain-allowed email still passes
    await expect(assertEmailAllowed('user@ok.example', db)).resolves.toBeUndefined()
    const db2 = fakeDbStrings(
      { exists: true, data: () => ({ allowedEmailDomains: ['ok.example'] }) },
      {},
    )
    // Non-domain, not in system — denied
    await expect(assertEmailAllowed('stranger@other.example', db2)).rejects.toThrow()
  })

  // ── terminated-employee status gate ──────────────────────────────────────────

  it('denies sign-in when the ONLY matching employee doc has status=terminated', async () => {
    const db = fakeDb(
      { exists: true, data: () => ({ allowedEmailDomains: [], seedSuperAdmins: [] }) },
      { employees: [{ email: 'fired@company.example', status: 'terminated' }] },
    )
    await expect(assertEmailAllowed('fired@company.example', db)).rejects.toThrow()
  })

  it('allows sign-in for an active employee (status field present and !== terminated)', async () => {
    const db = fakeDb(
      { exists: true, data: () => ({ allowedEmailDomains: [], seedSuperAdmins: [] }) },
      { employees: [{ email: 'active@company.example', status: 'active' }] },
    )
    await expect(assertEmailAllowed('active@company.example', db)).resolves.toBeUndefined()
  })

  it('allows sign-in for a legacy employee doc with no status field (missing = active)', async () => {
    const db = fakeDb(
      { exists: true, data: () => ({ allowedEmailDomains: [], seedSuperAdmins: [] }) },
      { employees: [{ email: 'legacy@company.example' }] }, // no status field
    )
    await expect(assertEmailAllowed('legacy@company.example', db)).resolves.toBeUndefined()
  })

  it('allows sign-in when at least one matching employee doc is active (mixed: one terminated + one active)', async () => {
    const db = fakeDb(
      { exists: true, data: () => ({ allowedEmailDomains: [], seedSuperAdmins: [] }) },
      {
        employees: [
          { email: 'mixed@company.example', status: 'terminated' },
          { email: 'mixed@company.example', status: 'active' },
        ],
      },
    )
    await expect(assertEmailAllowed('mixed@company.example', db)).resolves.toBeUndefined()
  })
})
