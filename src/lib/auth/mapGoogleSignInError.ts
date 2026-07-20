export type GoogleSignInErrorKind =
  | 'unauthorized-domain'
  | 'popup-closed'
  | 'popup-blocked'
  | 'operation-not-allowed'
  | 'domain-not-allowed'
  | 'network'
  | 'unknown'

/**
 * Maps an unknown error thrown by signInWithPopup (Firebase Google OAuth) to a
 * stable kind enum. Reads `code` and `message` defensively — no FirebaseError
 * import needed, keeping this module pure and unit-testable without the SDK.
 */
export function mapGoogleSignInError(err: unknown): GoogleSignInErrorKind {
  if (err === null || typeof err !== 'object') return 'unknown'

  const e = err as { code?: unknown; message?: unknown }
  const code = typeof e.code === 'string' ? e.code : ''
  const message = typeof e.message === 'string' ? e.message.toLowerCase() : ''

  switch (code) {
    case 'auth/unauthorized-domain':
      return 'unauthorized-domain'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'popup-closed'
    case 'auth/popup-blocked':
      return 'popup-blocked'
    case 'auth/operation-not-allowed':
      return 'operation-not-allowed'
    case 'auth/network-request-failed':
      return 'network'
    case 'auth/internal-error':
      if (message.includes('blocking_function_error_response')) return 'domain-not-allowed'
      return 'unknown'
    default:
      return 'unknown'
  }
}
