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
 * Reads users/{uid}.role from Firestore and checks it against the required
 * roles for the given collection. Returns the resolved role string.
 *
 * Permission matrix:
 *   server_licenses  → super_admin only
 *   licenses         → super_admin OR tech_admin
 *
 * Fails closed: missing user doc / missing role field → permission-denied.
 */
async function assertWriteRole(
  uid: string,
  collection: AllowedCollection,
  db: Firestore,
): Promise<string> {
  const snap = await db.doc(`users/${uid}`).get()
  const role = snap.exists ? (snap.data()?.role as string | undefined) : undefined

  if (!role) {
    throw new HttpsError('permission-denied', 'User has no role assigned')
  }

  if (collection === 'server_licenses') {
    if (role !== 'super_admin') {
      throw new HttpsError('permission-denied', 'Only super_admin may set server_license keys')
    }
  } else {
    // 'licenses'
    if (role !== 'super_admin' && role !== 'tech_admin') {
      throw new HttpsError('permission-denied', 'Only super_admin or tech_admin may set license keys')
    }
  }

  return role
}

/**
 * Pure, unit-testable core for secret key write.
 * Validates inputs, checks role, asserts parent doc existence, writes the
 * raw key to the secrets sub-document, and writes a MASKED audit entry.
 * The raw key NEVER appears in audit_logs.
 * The return value NEVER contains the key.
 */
export async function setKeyCore(
  args: { uid: string; collection: string; licenseId: string; rawKey: string },
  db: Firestore,
): Promise<{ ok: true }> {
  // 1. Validate collection.
  if (!isAllowedCollection(args.collection)) {
    throw new HttpsError(
      'invalid-argument',
      `collection must be one of ${ALLOWED_COLLECTIONS.join(', ')}`,
    )
  }

  // 2. Validate rawKey.
  if (!args.rawKey || typeof args.rawKey !== 'string') {
    throw new HttpsError('invalid-argument', 'rawKey must be a non-empty string')
  }

  // 3. Role gate (server-trusted — reads Firestore, not client claims).
  const role = await assertWriteRole(args.uid, args.collection, db)

  // 4. Assert parent document exists.
  const parentSnap = await db.doc(`${args.collection}/${args.licenseId}`).get()
  if (!parentSnap.exists) {
    throw new HttpsError('not-found', `${args.collection}/${args.licenseId} does not exist`)
  }

  // 5. Write raw key to secrets sub-document.
  await db.doc(`${args.collection}/${args.licenseId}/secrets/current`).set({
    key: args.rawKey,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: args.uid,
  })

  // 6. Write MASKED audit entry — raw key must never appear here.
  await db.collection('audit_logs').add({
    entityType: args.collection === 'licenses' ? 'license' : 'server_license',
    entityId: args.licenseId,
    action: 'key_rotated',
    actorUid: args.uid,
    actorRole: role,
    after: { id: args.licenseId, key: maskKey(args.rawKey) },
    at: FieldValue.serverTimestamp(),
  })

  return { ok: true }
}

/**
 * Callable Cloud Function — set (rotate) a license key.
 * Requires authentication; role check is done server-side inside setKeyCore.
 *
 * request.data: { collection: string; licenseId: string; rawKey: string }
 * Returns: { ok: true }  — the raw key is NEVER echoed back.
 */
export const setLicenseKey = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required')
  }
  return setKeyCore(
    {
      uid: request.auth.uid,
      collection: request.data?.collection,
      licenseId: request.data?.licenseId,
      rawKey: request.data?.rawKey,
    },
    getFirestore(),
  )
})
