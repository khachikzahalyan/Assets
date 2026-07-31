/**
 * POST /api/confirm-receipt-app — in-app receipt confirmation (logged-in employee).
 *
 * The companion to the email magic-link (api/confirm-receipt.ts). Here the caller is
 * authenticated in the app: they send their Firebase ID token, we verify it, confirm
 * they are the asset's assignee, then flip st_pending → st_assigned via the
 * service-account (Firestore REST) — so no employee write access to /assets is needed
 * and firestore.rules stay untouched.
 *
 * SELF-CONTAINED (node:crypto + fetch only) — Vercel does not bundle ./_lib.
 *
 * Env (Vercel, Production):
 *   FIREBASE_PROJECT_ID      — e.g. asset-ams
 *   FIREBASE_SERVICE_ACCOUNT — the full service-account JSON (one env var)
 *
 * Body: { assetId: string }.  Auth: Authorization: Bearer <Firebase ID token>.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'node:crypto'

// ───────────────────────── Firebase ID-token verify (inlined) ─────────────────────────

const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'

function b64urlToBuffer(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}
function decodeSegment(seg: string): Record<string, unknown> {
  return JSON.parse(b64urlToBuffer(seg).toString('utf8')) as Record<string, unknown>
}

let certsCache: { at: number; certs: Record<string, string> } | null = null
async function getCerts(): Promise<Record<string, string>> {
  const now = Date.now()
  if (certsCache && now - certsCache.at < 3_600_000) return certsCache.certs
  const res = await fetch(CERTS_URL)
  const certs = (await res.json()) as Record<string, string>
  certsCache = { at: now, certs }
  return certs
}

/** Verify a Firebase ID token's signature + claims. Returns the caller uid, or null. */
async function verifyIdToken(idToken: string, projectId: string): Promise<{ uid: string } | null> {
  if (!idToken || !projectId) return null
  const parts = idToken.split('.')
  if (parts.length !== 3) return null
  try {
    const header = decodeSegment(parts[0]!)
    const payload = decodeSegment(parts[1]!)
    const kid = typeof header['kid'] === 'string' ? (header['kid'] as string) : ''
    if (header['alg'] !== 'RS256' || !kid) return null
    if (payload['aud'] !== projectId) return null
    if (payload['iss'] !== `https://securetoken.google.com/${projectId}`) return null
    const nowSec = Math.floor(Date.now() / 1000)
    const exp = payload['exp']; const iat = payload['iat']
    if (typeof exp !== 'number' || exp < nowSec) return null
    if (typeof iat !== 'number' || iat > nowSec + 300) return null
    const uid = String(payload['sub'] ?? payload['user_id'] ?? '')
    if (!uid) return null

    const certs = await getCerts()
    const certPem = certs[kid]
    if (!certPem) return null
    const publicKey = new crypto.X509Certificate(certPem).publicKey
    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(`${parts[0]}.${parts[1]}`)
    verifier.end()
    if (!verifier.verify(publicKey, b64urlToBuffer(parts[2]!))) return null
    return { uid }
  } catch {
    return null
  }
}

// ─────────────────────── service-account → Google access token ───────────────────────

interface ServiceAccount { client_email: string; private_key: string }

async function getAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000)
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const signingInput =
    `${enc({ alg: 'RS256', typ: 'JWT' })}.` +
    enc({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(signingInput)
  signer.end()
  const jwt = `${signingInput}.${signer.sign(sa.private_key).toString('base64url')}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  })
  if (!res.ok) return null
  const j = (await res.json()) as { access_token?: string }
  return j.access_token ?? null
}

// ─────────────────────────────────── handler ───────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return }

    const projectId = process.env['FIREBASE_PROJECT_ID']
    const saRaw = process.env['FIREBASE_SERVICE_ACCOUNT']
    if (!projectId || !saRaw) {
      res.status(500).json({ error: 'server_misconfigured', have: { FIREBASE_PROJECT_ID: !!projectId, FIREBASE_SERVICE_ACCOUNT: !!saRaw } })
      return
    }

    const header = req.headers.authorization ?? ''
    const idToken = header.startsWith('Bearer ') ? header.slice(7) : ''
    const caller = await verifyIdToken(idToken, projectId)
    if (!caller) { res.status(403).json({ error: 'forbidden' }); return }

    const body = (req.body && typeof req.body === 'object')
      ? (req.body as { assetId?: unknown })
      : (typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body) as { assetId?: unknown } } catch { return {} } })() : {})
    const assetId = typeof body.assetId === 'string' ? body.assetId.trim() : ''
    if (!assetId) { res.status(400).json({ error: 'invalid_asset' }); return }

    const sa = JSON.parse(saRaw) as ServiceAccount
    const accessToken = await getAccessToken(sa)
    if (!accessToken) { res.status(500).json({ error: 'auth_failed' }); return }

    const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
    const authH = { Authorization: `Bearer ${accessToken}` }

    // Load the asset.
    const getRes = await fetch(`${base}/assets/${encodeURIComponent(assetId)}`, { headers: authH })
    if (!getRes.ok) { res.status(404).json({ error: 'asset_not_found' }); return }
    const doc = (await getRes.json()) as {
      fields?: {
        statusId?: { stringValue?: string }
        assignment?: { mapValue?: { fields?: { employeeId?: { stringValue?: string } } } }
      }
    }
    const status = doc.fields?.statusId?.stringValue
    const assignedEmployeeId = doc.fields?.assignment?.mapValue?.fields?.employeeId?.stringValue ?? ''

    // Authorize: caller must be the assignee. Invited employees have an HR doc id
    // distinct from their uid — resolve users/{uid}.employeeId and accept either
    // (mirrors the isSelfEmployee() firestore rule: uid OR userDoc.employeeId).
    let callerEmployeeId = caller.uid
    try {
      const uRes = await fetch(`${base}/users/${encodeURIComponent(caller.uid)}`, { headers: authH })
      if (uRes.ok) {
        const uDoc = (await uRes.json()) as { fields?: { employeeId?: { stringValue?: string } } }
        const eid = uDoc.fields?.employeeId?.stringValue
        if (eid) callerEmployeeId = eid
      }
    } catch { /* fall back to uid-only match */ }

    if (!assignedEmployeeId || (assignedEmployeeId !== caller.uid && assignedEmployeeId !== callerEmployeeId)) {
      res.status(403).json({ error: 'not_your_asset' }); return
    }

    // Idempotent: only flip while pending; anything else is treated as done.
    if (status !== 'st_pending') { res.status(200).json({ ok: true, already: true }); return }

    const nowIso = new Date().toISOString()
    const patchUrl =
      `${base}/assets/${encodeURIComponent(assetId)}` +
      `?updateMask.fieldPaths=statusId&updateMask.fieldPaths=assignmentAcceptedAt&updateMask.fieldPaths=acceptedBy`
    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { ...authH, 'content-type': 'application/json' },
      body: JSON.stringify({
        fields: {
          statusId: { stringValue: 'st_assigned' },
          assignmentAcceptedAt: { timestampValue: nowIso },
          acceptedBy: { stringValue: caller.uid },
        },
      }),
    })
    if (!patchRes.ok) { res.status(500).json({ error: 'save_failed' }); return }

    // Best-effort audit (never blocks the confirmation result).
    try {
      await fetch(`${base}/audit_logs`, {
        method: 'POST',
        headers: { ...authH, 'content-type': 'application/json' },
        body: JSON.stringify({
          fields: {
            entityType: { stringValue: 'asset' },
            entityId: { stringValue: assetId },
            action: { stringValue: 'receipt_confirmed' },
            actorUid: { stringValue: caller.uid },
            at: { timestampValue: nowIso },
          },
        }),
      })
    } catch { /* audit is best-effort */ }

    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'handler_crash', message: e instanceof Error ? e.message : String(e) })
  }
}
