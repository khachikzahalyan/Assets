import { describe, it, expect, vi } from 'vitest'

// Prevent the Admin SDK from actually initializing when the module loads.
vi.mock('firebase-admin/app', () => ({
  getApps: () => [{}],
  initializeApp: vi.fn(),
}))
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(),
}))

import { isDomainAllowed, assertEmailAllowed } from './beforeCreate'

/** Build a fake Admin Firestore whose settings/auth doc returns `data`. */
function fakeDb(snap: { exists: boolean; data?: () => Record<string, unknown> }) {
  return {
    doc: (path: string) => {
      expect(path).toBe('settings/auth')
      return { get: async () => snap }
    },
  } as unknown as import('firebase-admin/firestore').Firestore
}

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

describe('assertEmailAllowed (mocked Firestore)', () => {
  it('resolves for an allowed email', async () => {
    const db = fakeDb({ exists: true, data: () => ({ allowedEmailDomains: ['ok.example'] }) })
    await expect(assertEmailAllowed('alice@ok.example', db)).resolves.toBeUndefined()
  })

  it('throws for a disallowed email', async () => {
    const db = fakeDb({ exists: true, data: () => ({ allowedEmailDomains: ['ok.example'] }) })
    await expect(assertEmailAllowed('eve@evil.example', db)).rejects.toThrow(/domain not allowed/i)
  })

  it('throws when the settings doc is missing (fail closed)', async () => {
    const db = fakeDb({ exists: false })
    await expect(assertEmailAllowed('alice@ok.example', db)).rejects.toThrow(/domain not allowed/i)
  })

  it('throws when allowedEmailDomains is empty (fail closed)', async () => {
    const db = fakeDb({ exists: true, data: () => ({ allowedEmailDomains: [] }) })
    await expect(assertEmailAllowed('alice@ok.example', db)).rejects.toThrow(/domain not allowed/i)
  })
})
