import { describe, it, expect } from 'vitest'
import { mapGoogleSignInError } from './mapGoogleSignInError'

describe('mapGoogleSignInError', () => {
  it('maps auth/unauthorized-domain → unauthorized-domain', () => {
    expect(mapGoogleSignInError({ code: 'auth/unauthorized-domain' })).toBe('unauthorized-domain')
  })

  it('maps auth/popup-closed-by-user → popup-closed', () => {
    expect(mapGoogleSignInError({ code: 'auth/popup-closed-by-user' })).toBe('popup-closed')
  })

  it('maps auth/cancelled-popup-request → popup-closed', () => {
    expect(mapGoogleSignInError({ code: 'auth/cancelled-popup-request' })).toBe('popup-closed')
  })

  it('maps auth/popup-blocked → popup-blocked', () => {
    expect(mapGoogleSignInError({ code: 'auth/popup-blocked' })).toBe('popup-blocked')
  })

  it('maps auth/operation-not-allowed → operation-not-allowed', () => {
    expect(mapGoogleSignInError({ code: 'auth/operation-not-allowed' })).toBe('operation-not-allowed')
  })

  it('maps auth/network-request-failed → network', () => {
    expect(mapGoogleSignInError({ code: 'auth/network-request-failed' })).toBe('network')
  })

  it('maps auth/internal-error + BLOCKING_FUNCTION_ERROR_RESPONSE (upper) → domain-not-allowed', () => {
    expect(
      mapGoogleSignInError({
        code: 'auth/internal-error',
        message: 'Error: BLOCKING_FUNCTION_ERROR_RESPONSE : ...',
      }),
    ).toBe('domain-not-allowed')
  })

  it('maps auth/internal-error + blocking_function_error_response (lower) → domain-not-allowed', () => {
    expect(
      mapGoogleSignInError({
        code: 'auth/internal-error',
        message: 'blocking_function_error_response',
      }),
    ).toBe('domain-not-allowed')
  })

  it('maps auth/internal-error WITHOUT blocking_function keyword → unknown', () => {
    expect(
      mapGoogleSignInError({ code: 'auth/internal-error', message: 'some other internal error' }),
    ).toBe('unknown')
  })

  it('maps an unrecognised code → unknown', () => {
    expect(mapGoogleSignInError({ code: 'auth/something-new' })).toBe('unknown')
  })

  it('handles a plain Error instance (no code) → unknown', () => {
    expect(mapGoogleSignInError(new Error('popup closed'))).toBe('unknown')
  })

  it('handles a non-object primitive (string) → unknown', () => {
    expect(mapGoogleSignInError('auth/popup-closed-by-user')).toBe('unknown')
  })

  it('handles null → unknown', () => {
    expect(mapGoogleSignInError(null)).toBe('unknown')
  })

  it('handles undefined → unknown', () => {
    expect(mapGoogleSignInError(undefined)).toBe('unknown')
  })

  it('handles an object with no code → unknown', () => {
    expect(mapGoogleSignInError({ message: 'something went wrong' })).toBe('unknown')
  })
})
