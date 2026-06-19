import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { beforeUserCreated, HttpsError } from 'firebase-functions/v2/identity'
import { logger } from 'firebase-functions/v2'

/**
 * AMS — beforeCreate auth blocking trigger.
 *
 * Account creation is gated by the OAuth allowed-domain list stored in
 * /settings/auth.allowedEmailDomains. The list is read from Firestore at
 * runtime — there is NO hardcoded domain anywhere in this file. If the
 * settings doc or the field is missing, we FAIL CLOSED (reject everyone).
 */

// Initialize the Admin SDK exactly once.
if (getApps().length === 0) {
  initializeApp()
}

/**
 * Pure, unit-testable domain check. Returns true iff `email` has a domain that
 * appears (case-insensitive) in `domains`. Fails closed: a missing/empty email
 * or an empty domains list yields false.
 */
export function isDomainAllowed(email: string | undefined, domains: string[]): boolean {
  if (!email || domains.length === 0) return false
  const at = email.lastIndexOf('@')
  if (at < 0 || at === email.length - 1) return false
  const domain = email.slice(at + 1).toLowerCase()
  return domains.some((d) => d.toLowerCase() === domain)
}

/**
 * Reads the allowed-domain list from /settings/auth and throws an HttpsError
 * if the email's domain is not allowed. Delegated to so it can be unit-tested
 * with a mocked Firestore, without the full Functions runtime.
 */
export async function assertEmailAllowed(
  email: string | undefined,
  db: Firestore,
): Promise<void> {
  const snap = await db.doc('settings/auth').get()
  const data = snap.exists ? snap.data() : undefined
  const raw = data?.allowedEmailDomains
  const domains: string[] = Array.isArray(raw) ? raw.filter((d): d is string => typeof d === 'string') : []

  if (domains.length === 0) {
    logger.warn(
      'beforeCreate: /settings/auth.allowedEmailDomains is missing or empty — rejecting all sign-ups (fail closed).',
    )
  }

  if (!isDomainAllowed(email, domains)) {
    throw new HttpsError('permission-denied', 'Email domain not allowed')
  }
}

/** Auth blocking trigger fired before a new user account is created. */
export const beforecreated = beforeUserCreated(async (event) => {
  await assertEmailAllowed(event.data?.email, getFirestore())
})
