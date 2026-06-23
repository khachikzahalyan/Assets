import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { withAudit, firestoreAuditContext, sanitizeLicenseAuditPayload } from '@/lib/audit'
import { getLicenseSecretKey, setLicenseSecretKey } from './licenseSecrets'

/**
 * Reads the raw license key for the given license from its secrets
 * sub-collection (`{collection}/{licenseId}/secrets/current`).
 *
 * Gated by firestore.rules:
 *   - /licenses secrets: super_admin OR tech_admin
 *   - /server_licenses secrets: super_admin only
 *
 * Throws `Error('license-key/unauthenticated')` when no authenticated user is
 * present — mirrors setLicenseKey's guard ordering so we never reveal to an
 * unauthenticated caller.
 *
 * Throws `Error('license-key/not-found')` when no secret doc exists (the key
 * has never been set). All other errors propagate as-is; callers already
 * try/catch and show «Ключ появится после настройки» or copy-failed UI.
 *
 * Writes exactly ONE masked `key_revealed` audit_logs entry on every successful
 * reveal. The raw key never reaches audit_logs — sanitizeLicenseAuditPayload
 * masks it to last-4 alphanumeric characters before any write occurs.
 *
 * NOTE: the secret read (step 2) and the audit write (step 4) are NOT atomic.
 * If the audit write fails, the key has already been read locally. This matches
 * the non-atomic tradeoff documented in setLicenseSecretKey: the reveal is
 * recorded-or-fails, which is acceptable — a failed audit write surfaces to the
 * caller as a thrown error so the UI can flag it.
 */
export async function revealLicenseKey(
  collection: 'licenses' | 'server_licenses',
  licenseId: string,
): Promise<string> {
  // Step 1 — auth guard (must come before any secret read).
  const currentUser = auth().currentUser
  if (!currentUser) {
    throw new Error('license-key/unauthenticated')
  }
  const uid = currentUser.uid

  // Step 2 — read the raw key (gated by firestore.rules on the secrets path).
  const rawKey = await getLicenseSecretKey(db(), collection, licenseId)

  // Step 3 — if the key was never set, there is nothing to audit.
  if (rawKey === null) {
    throw new Error('license-key/not-found')
  }

  // Step 4 — resolve the caller's real role so the audit entry satisfies
  // `actorRole == role()` in the security rules.
  const userSnap = await getDoc(doc(db(), 'users', uid))
  const role: string = userSnap.exists()
    ? (userSnap.data()['role'] as string) ?? ''
    : ''

  // Step 5 — write a masked audit entry. The `key` field in `after` is masked
  // to its last-4 alphanumeric characters by sanitizeLicenseAuditPayload.
  const entityType = collection === 'server_licenses' ? 'server_license' as const : 'license' as const
  const safeSpec = sanitizeLicenseAuditPayload({
    entityType,
    entityId: licenseId,
    action: 'key_revealed' as const,
    actorUid: uid,
    actorRole: role as import('@/config/roles').Role,
    before: null,
    after: { id: licenseId, key: rawKey },
  })

  await withAudit(
    firestoreAuditContext(db()),
    safeSpec,
    async (_txn) => ({ value: undefined }),
  )

  // Step 6 — return the raw key to the caller.
  return rawKey
}

/**
 * Writes (or rotates) a raw license key into the secrets sub-collection.
 * Derives the current actor from `auth().currentUser`. Resolves `actorRole`
 * via a live read of the caller's `/users/{uid}` doc so the audit_logs entry
 * satisfies the `actorRole == role()` rule constraint.
 *
 * Gated by firestore.rules (same gates as revealLicenseKey above).
 *
 * Throws `Error('license-key/unauthenticated')` when no authenticated user
 * is present. All other errors (permission-denied, etc.) propagate to the
 * caller.
 *
 * The `key` value written to audit_logs is masked to its last-4 alphanumeric
 * characters by `sanitizeLicenseAuditPayload` inside `setLicenseSecretKey`.
 * The raw key never reaches audit_logs.
 */
export async function setLicenseKey(
  collection: 'licenses' | 'server_licenses',
  licenseId: string,
  rawKey: string,
): Promise<void> {
  const currentUser = auth().currentUser
  if (!currentUser) {
    throw new Error('license-key/unauthenticated')
  }
  const uid = currentUser.uid

  // Resolve the caller's real role from Firestore so the audit entry
  // satisfies `actorRole == role()` in the security rules.
  const userSnap = await getDoc(doc(db(), 'users', uid))
  const role: string = userSnap.exists()
    ? (userSnap.data()['role'] as string) ?? ''
    : ''

  await setLicenseSecretKey(db(), collection, licenseId, rawKey, { uid, role })
}
