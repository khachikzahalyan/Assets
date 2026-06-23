import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore'
import { withAudit, firestoreAuditContext, sanitizeLicenseAuditPayload } from '@/lib/audit'

/**
 * Reads the raw license key from the secrets sub-collection.
 *
 * Path: `{collection}/{licenseId}/secrets/current`
 *
 * Returns the raw key string if the doc exists and has a non-empty `key`
 * field, otherwise returns null. Errors propagate to the caller.
 */
export async function getLicenseSecretKey(
  db: Firestore,
  col: 'licenses' | 'server_licenses',
  licenseId: string,
): Promise<string | null> {
  const snap = await getDoc(doc(db, col, licenseId, 'secrets', 'current'))
  if (!snap.exists()) return null
  const raw = snap.data()['key']
  return (raw !== undefined && raw !== null) ? String(raw) || null : null
}

/**
 * Writes (or rotates) a raw license key into the secrets sub-collection and
 * emits exactly one masked `key_rotated` audit_logs entry in the same logical
 * operation.
 *
 * Execution order:
 *   1. `setDoc` writes the secret doc directly (gated by firestore.rules).
 *   2. `withAudit` runs a Firestore transaction writing a masked audit entry.
 *      If the audit write fails it throws; the secret doc has already been
 *      written — callers are expected to handle this edge case gracefully
 *      (the key is set; only the audit trail is missing).
 *
 * The `key` value in audit_logs is masked to its last-4 alphanumeric
 * characters by `sanitizeLicenseAuditPayload` before any write occurs.
 *
 * NOTE: `actor.role` must be the caller's REAL Firestore role (read from
 * `/users/{uid}` by the caller) — it is validated by the audit_logs create
 * rule (`actorRole == role()`).
 */
export async function setLicenseSecretKey(
  db: Firestore,
  col: 'licenses' | 'server_licenses',
  licenseId: string,
  rawKey: string,
  actor: { uid: string; role: string },
): Promise<void> {
  // Step 1 — write the secret doc (direct, not inside a transaction so the
  // secrets write and the audit_logs write use separate round-trips; this
  // preserves the secrets path gating independently of the audit transaction).
  await setDoc(doc(db, col, licenseId, 'secrets', 'current'), {
    key: rawKey,
    updatedBy: actor.uid,
    updatedAt: serverTimestamp(),
  })

  // Step 2 — write a masked audit entry via the single audit chokepoint.
  const safeSpec = sanitizeLicenseAuditPayload({
    entityType: 'license' as const,
    entityId: licenseId,
    action: 'key_rotated' as const,
    actorUid: actor.uid,
    actorRole: actor.role as import('@/config/roles').Role,
    before: null,
    after: { id: licenseId, key: rawKey },
  })

  await withAudit(
    firestoreAuditContext(db),
    safeSpec,
    async (_txn) => ({ value: undefined }),
  )
}
