import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { maskKey } from './maskKey'

// Initialize the Admin SDK exactly once.
if (getApps().length === 0) {
  initializeApp()
}

const ALLOWED_COLLECTIONS = ['licenses', 'server_licenses'] as const
type AllowedCollection = (typeof ALLOWED_COLLECTIONS)[number]

function isAllowedCollection(c: unknown): c is AllowedCollection {
  return ALLOWED_COLLECTIONS.includes(c as AllowedCollection)
}

/**
 * Reads users/{uid} and returns the role string ONLY if role === 'super_admin'.
 * Throws HttpsError('permission-denied') otherwise — including when the doc or
 * role field is missing (fail-closed).
 */
export async function assertSuperAdmin(uid: string, db: Firestore): Promise<string> {
  const snap = await db.doc(`users/${uid}`).get()
  const role = snap.exists ? (snap.data()?.role as string | undefined) : undefined
  if (role !== 'super_admin') {
    throw new HttpsError('permission-denied', 'Only super_admin may reveal license keys')
  }
  return role
}

/**
 * Pure, unit-testable core for key reveal.
 * Checks collection validity, asserts super_admin role, reads the secret,
 * writes a MASKED audit entry, and returns the RAW key to the caller.
 * The raw key NEVER appears in audit_logs.
 */
export async function revealCore(
  args: { uid: string; collection: string; licenseId: string },
  db: Firestore,
): Promise<{ key: string }> {
  if (!isAllowedCollection(args.collection)) {
    throw new HttpsError(
      'invalid-argument',
      `collection must be one of ${ALLOWED_COLLECTIONS.join(', ')}`,
    )
  }

  // Validate licenseId: must be a non-empty string, no '/' chars, <= 200 chars.
  // This prevents an attacker-controlled id from redirecting db.doc() to an
  // unintended nested path (e.g. 'a/b/c' would silently traverse subcollections).
  if (
    !args.licenseId ||
    typeof args.licenseId !== 'string' ||
    args.licenseId.includes('/') ||
    args.licenseId.length > 200
  ) {
    throw new HttpsError('invalid-argument', 'Invalid licenseId')
  }

  const role = await assertSuperAdmin(args.uid, db)

  const secretRef = db.doc(`${args.collection}/${args.licenseId}/secrets/current`)
  const snap = await secretRef.get()
  if (!snap.exists) {
    throw new HttpsError('not-found', `Secret not found for ${args.collection}/${args.licenseId}`)
  }

  const raw = (snap.data() as { key: string }).key

  await db.collection('audit_logs').add({
    entityType: args.collection === 'licenses' ? 'license' : 'server_license',
    entityId: args.licenseId,
    action: 'key_revealed',
    actorUid: args.uid,
    actorRole: role,
    after: { key: maskKey(raw) },
    at: FieldValue.serverTimestamp(),
  })

  return { key: raw }
}

/**
 * Callable Cloud Function — reveal a license key.
 * Requires authentication; role check is done server-side inside revealCore.
 *
 * request.data: { collection: string; licenseId: string }
 * Returns: { key: string }  (raw key — transmitted over HTTPS to the super_admin client only)
 */
export const revealLicenseKey = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required')
  }
  return revealCore(
    {
      uid: request.auth.uid,
      collection: request.data?.collection,
      licenseId: request.data?.licenseId,
    },
    getFirestore(),
  )
})
