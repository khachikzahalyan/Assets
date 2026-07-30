/**
 * Server-side gate for /api/notify-access.
 *
 * 1. Verifies the caller's Firebase ID token against Google's public keys
 *    (issuer/audience pinned to our project) — proves the request comes from a
 *    signed-in AMS user. No service account needed.
 * 2. Reads the caller's own users/{uid}.role via the Firestore REST API using
 *    that same token. The security rules allow a user to read their OWN user doc
 *    (`request.auth.uid == uid`), so this needs no admin credentials.
 * 3. Allows only super_admin / tech_admin.
 *
 * Returns the caller info on success, or null on any failure (caller denied).
 */

import { createRemoteJWKSet, jwtVerify } from 'jose'

// Google's JWKS for Firebase ID tokens (securetoken). Cached across invocations by jose.
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwks/securetoken@system.gserviceaccount.com'),
)

const ADMIN_ROLES = new Set(['super_admin', 'tech_admin'])

export interface CallerInfo {
  uid: string
  email: string | null
  role: string
}

export async function verifyAdmin(idToken: string, projectId: string): Promise<CallerInfo | null> {
  if (!idToken || !projectId) return null

  // 1) Verify signature + claims.
  let uid = ''
  let email: string | null = null
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    })
    uid = String(payload.sub ?? (payload as Record<string, unknown>)['user_id'] ?? '')
    const e = (payload as Record<string, unknown>)['email']
    email = typeof e === 'string' ? e : null
    if (!uid) return null
  } catch {
    return null
  }

  // 2) Read the caller's own role (self-read permitted by the /users rule).
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(uid)}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    )
    if (!res.ok) return null
    const body = (await res.json()) as { fields?: { role?: { stringValue?: string } } }
    const role = body.fields?.role?.stringValue
    if (!role || !ADMIN_ROLES.has(role)) return null
    return { uid, email, role }
  } catch {
    return null
  }
}
