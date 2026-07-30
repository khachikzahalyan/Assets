/**
 * POST /api/notify-access — send the AMS access-notification email.
 *
 * Free ($0) path: Vercel Serverless Function + Brevo transactional API. Tunables
 * come from Vercel env vars (BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME,
 * APP_URL, FIREBASE_PROJECT_ID).
 *
 * IMPORTANT: imports of ./_lib/* are STATIC (top-level) on purpose — Vercel's
 * file tracer (@vercel/nft) only bundles statically-imported files into the
 * function. A dynamic import() left _lib out of the bundle → "Cannot find module"
 * at runtime. The try/catch stays to surface any remaining runtime error as JSON.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAdmin } from './_lib/verifyAdmin'
import { renderAccessEmail, type AccessEmailKind } from './_lib/accessEmailTemplate'

interface NotifyBody {
  email?: unknown
  name?: unknown
  kind?: unknown
  roleLabel?: unknown
  role?: unknown
}

function parseBody(raw: unknown): NotifyBody {
  if (raw && typeof raw === 'object') return raw as NotifyBody
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as NotifyBody } catch { return {} }
  }
  return {}
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method_not_allowed' })
      return
    }

    const projectId = process.env['FIREBASE_PROJECT_ID']
    const apiKey = process.env['BREVO_API_KEY']
    const senderEmail = process.env['BREVO_SENDER_EMAIL']
    const senderName = process.env['BREVO_SENDER_NAME'] || 'AMS'
    const appUrl = process.env['APP_URL']
    if (!projectId || !apiKey || !senderEmail || !appUrl) {
      res.status(500).json({
        error: 'server_misconfigured',
        have: {
          FIREBASE_PROJECT_ID: !!projectId,
          BREVO_API_KEY: !!apiKey,
          BREVO_SENDER_EMAIL: !!senderEmail,
          APP_URL: !!appUrl,
        },
      })
      return
    }

    // ── Auth: valid admin Firebase ID token required ──
    const header = req.headers.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    const caller = await verifyAdmin(token, projectId)
    if (!caller) {
      res.status(403).json({ error: 'forbidden' })
      return
    }

    // ── Validate payload ──
    const body = parseBody(req.body)
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const name = typeof body.name === 'string' ? body.name : ''
    const kind: AccessEmailKind = body.kind === 'employee' ? 'employee' : 'role'
    const roleLabel = typeof body.roleLabel === 'string' ? body.roleLabel : undefined
    const role = typeof body.role === 'string' ? body.role : undefined
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      res.status(400).json({ error: 'invalid_email' })
      return
    }

    const { subject, html, text } = renderAccessEmail({
      kind, name, appUrl, brand: senderName,
      ...(roleLabel ? { roleLabel } : {}),
      ...(role ? { role } : {}),
    })

    // ── Send via Brevo ──
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email, ...(name ? { name } : {}) }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    })
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '')
      res.status(502).json({ error: 'send_failed', detail: detail.slice(0, 300) })
      return
    }
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'handler_crash', message: e instanceof Error ? e.message : String(e) })
  }
}
