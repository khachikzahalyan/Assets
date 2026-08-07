export type PasswordSignInErrorKind =
  | 'invalid-credentials'
  | 'too-many-requests'
  | 'user-disabled'
  | 'operation-not-allowed'
  | 'network'
  | 'unknown'

/**
 * Maps an unknown error thrown by signInWithEmailAndPassword (Firebase
 * email/password auth) to a stable kind enum. Reads `code` defensively — no
 * FirebaseError import needed, keeping this module pure and unit-testable
 * without the SDK. Wrong-password / user-not-found / invalid-credential are all
 * collapsed to a single 'invalid-credentials' kind so the UI never reveals which
 * half of the pair was wrong.
 */
export function mapPasswordSignInError(err: unknown): PasswordSignInErrorKind {
  if (err === null || typeof err !== 'object') return 'unknown'

  const e = err as { code?: unknown }
  const code = typeof e.code === 'string' ? e.code : ''

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'invalid-credentials'
    case 'auth/too-many-requests':
      return 'too-many-requests'
    case 'auth/user-disabled':
      return 'user-disabled'
    case 'auth/operation-not-allowed':
      return 'operation-not-allowed'
    case 'auth/network-request-failed':
      return 'network'
    default:
      return 'unknown'
  }
}
