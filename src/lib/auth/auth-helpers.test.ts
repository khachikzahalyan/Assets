import { describe, it, expect, vi, beforeEach } from 'vitest'

const signInWithPopup = vi.fn()
const sendSignInLinkToEmail = vi.fn()
const signInWithEmailLink = vi.fn()
const isSignInWithEmailLink = vi.fn()
const onAuthStateChanged = vi.fn()
const getDoc = vi.fn()

const AUTH_SINGLETON = {}

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class { setCustomParameters() {} },
  signInWithPopup: (...a: unknown[]) => signInWithPopup(...a),
  sendSignInLinkToEmail: (...a: unknown[]) => sendSignInLinkToEmail(...a),
  signInWithEmailLink: (...a: unknown[]) => signInWithEmailLink(...a),
  isSignInWithEmailLink: (...a: unknown[]) => isSignInWithEmailLink(...a),
  onAuthStateChanged: (...a: unknown[]) => onAuthStateChanged(...a),
  signOut: vi.fn(),
}))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  getDoc: (...a: unknown[]) => getDoc(...a),
}))
vi.mock('@/lib/firebase', () => ({ auth: () => AUTH_SINGLETON, db: () => ({}) }))

import { fetchUserRole, sendEmployeeLink, completeEmailLinkIfPresent, subscribeToAuthState } from './index'

beforeEach(() => { vi.clearAllMocks() })

describe('auth helpers', () => {
  it('fetchUserRole returns role from users/{uid} doc', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ role: 'asset_admin' }) })
    expect(await fetchUserRole('uid1')).toBe('asset_admin')
  })
  it('fetchUserRole returns null when no doc', async () => {
    getDoc.mockResolvedValue({ exists: () => false })
    expect(await fetchUserRole('uid1')).toBeNull()
  })
  it('sendEmployeeLink stores email and calls SDK', async () => {
    sendSignInLinkToEmail.mockResolvedValue(undefined)
    await sendEmployeeLink('s@example.com')
    expect(sendSignInLinkToEmail).toHaveBeenCalled()
    expect(window.localStorage.getItem('ams:emailForSignIn')).toBe('s@example.com')
  })
  it('completeEmailLinkIfPresent is a no-op when not an email link', async () => {
    isSignInWithEmailLink.mockReturnValue(false)
    const r = await completeEmailLinkIfPresent()
    expect(r).toBe(false)
    expect(signInWithEmailLink).not.toHaveBeenCalled()
  })
  it('subscribeToAuthState calls onAuthStateChanged with auth() and the callback, returning its unsub', () => {
    const unsub = vi.fn()
    onAuthStateChanged.mockReturnValue(unsub)
    const cb = vi.fn()
    const returned = subscribeToAuthState(cb)
    expect(onAuthStateChanged).toHaveBeenCalledWith(AUTH_SINGLETON, cb)
    expect(returned).toBe(unsub)
  })
})
