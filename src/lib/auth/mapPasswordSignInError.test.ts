import { describe, it, expect } from 'vitest'
import { mapPasswordSignInError } from './mapPasswordSignInError'

describe('mapPasswordSignInError', () => {
  it('maps auth/invalid-credential → invalid-credentials', () => {
    expect(mapPasswordSignInError({ code: 'auth/invalid-credential' })).toBe('invalid-credentials')
  })

  it('maps auth/wrong-password → invalid-credentials', () => {
    expect(mapPasswordSignInError({ code: 'auth/wrong-password' })).toBe('invalid-credentials')
  })

  it('maps auth/user-not-found → invalid-credentials (no user-existence leak)', () => {
    expect(mapPasswordSignInError({ code: 'auth/user-not-found' })).toBe('invalid-credentials')
  })

  it('maps auth/invalid-email → invalid-credentials', () => {
    expect(mapPasswordSignInError({ code: 'auth/invalid-email' })).toBe('invalid-credentials')
  })

  it('maps auth/too-many-requests → too-many-requests', () => {
    expect(mapPasswordSignInError({ code: 'auth/too-many-requests' })).toBe('too-many-requests')
  })

  it('maps auth/user-disabled → user-disabled', () => {
    expect(mapPasswordSignInError({ code: 'auth/user-disabled' })).toBe('user-disabled')
  })

  it('maps auth/operation-not-allowed → operation-not-allowed (provider off)', () => {
    expect(mapPasswordSignInError({ code: 'auth/operation-not-allowed' })).toBe('operation-not-allowed')
  })

  it('maps auth/network-request-failed → network', () => {
    expect(mapPasswordSignInError({ code: 'auth/network-request-failed' })).toBe('network')
  })

  it('maps an unrecognised code → unknown', () => {
    expect(mapPasswordSignInError({ code: 'auth/something-new' })).toBe('unknown')
  })

  it('handles a plain Error instance (no code) → unknown', () => {
    expect(mapPasswordSignInError(new Error('boom'))).toBe('unknown')
  })

  it('handles a non-object primitive → unknown', () => {
    expect(mapPasswordSignInError('auth/wrong-password')).toBe('unknown')
  })

  it('handles null → unknown', () => {
    expect(mapPasswordSignInError(null)).toBe('unknown')
  })

  it('handles undefined → unknown', () => {
    expect(mapPasswordSignInError(undefined)).toBe('unknown')
  })
})
