/**
 * Server-side gate for /api/notify-access.
 *
 * 1. Verifies the caller's Firebase ID token (RS256) against Google's public
 *    x509 certs, with issuer/audience/expiry pinned to our project — proves the
 *    request comes from a signed-in AMS user. Uses only Node built-ins
 *    (node:crypto) so the serverless function has NO ESM-only deps to crash on.
 * 2. Reads the caller's own users/{uid}.role via the Firestore REST API using
 *    that same token (the rules allow a user to read their OWN user doc), so this
 *    needs no admin/service-account credentials.
 * 3. Allows only super_admin / tech_admin.
 *
 * Returns the caller info on success, or null on any failure (caller denied).
 */

import crypto from 'node:crypto'

const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
const ADMIN_ROLES = new Set(['super_admin', 'tech_admin'])

export interface CallerInfo {
  uid: string
  email: string | null
  role: string
}

function b64urlToBuffer(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function decodeSegment(seg: string): Record<string, unknown> {
  return JSON.parse(b64urlToBuffer(seg).toString('utf8')) as Record<string, unknown>
}

// Cache Google's certs for an hour across warm invocations.
let certsCache: { at: number; certs: Record<string, string> } | null = null
async function getCerts(): Promise<Record<string, string>> {
  const now = Date.now()
  if (certsCache && now - certsCache.at < 3_600_000) return certsCache.certs
  const res = await fetch(CERTS_URL)
  const certs = (await res.json()) as Record<string, string>
  certsCache = { at: now, certs }
  return certs
}

export async function verifyAdmin(idToken: string, projectId: string): Promise<CallerInfo | null> {
  if (!idToken || !projectId) return null

  const parts = idToken.split('.')
  if (parts.length !== 3) return null

  let uid = ''
  let email: string | null = null

  // 1) Verify header/claims + RS256 signature.
  try {
    const header = decodeSegment(parts[0]!)
    const payload = decodeSegment(parts[1]!)

    const kid = typeof header['kid'] === 'string' ? (header['kid'] as string) : ''
    if (header['alg'] !== 'RS256' || !kid) return null
    if (payload['aud'] !== projectId) return null
    if (payload['iss'] !== `https://securetoken.google.com/${projectId}`) return null

    const nowSec = Math.floor(Date.now() / 1000)
    const exp = payload['exp']
    const iat = payload['iat']
    if (typeof exp !== 'number' || exp < nowSec) return null
    if (typeof iat !== 'number' || iat > nowSec + 300) return null

    uid = String(payload['sub'] ?? payload['user_id'] ?? '')
    if (!uid) return null
    email = typeof payload['email'] === 'string' ? (payload['email'] as string) : null

    const certs = await getCerts()
    const certPem = certs[kid]
    if (!certPem) return null

    const publicKey = new crypto.X509Certificate(certPem).publicKey
    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(`${parts[0]}.${parts[1]}`)
    verifier.end()
    if (!verifier.verify(publicKey, b64urlToBuffer(parts[2]!))) return null
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
