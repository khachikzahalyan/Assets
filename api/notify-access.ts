/**
 * POST /api/notify-access — send the AMS access-notification email.
 *
 * Free ($0): Vercel Serverless Function + Brevo transactional API. Env vars:
 * BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME, APP_URL, FIREBASE_PROJECT_ID.
 *
 * SELF-CONTAINED ON PURPOSE: token verification and the email template are inlined
 * here rather than imported from ./_lib/*. Vercel would not bundle the underscore
 * `_lib` folder into the function ("Cannot find module" / FUNCTION_INVOCATION_FAILED),
 * so this file imports nothing but node:crypto + a type. The same logic also lives
 * in api/_lib/*.ts for the unit tests + scripts/send-access-email-test.ts; keep them
 * in sync if the template changes.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'node:crypto'

// ─────────────────────────── email template (inlined) ───────────────────────────

const ACCENT = '#F97316'
const SERIF = "Georgia,'Times New Roman',serif"
const SANS = 'Arial,sans-serif'
const KNOWN_ROLES = new Set(['super_admin', 'asset_admin', 'tech_admin', 'employee'])

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

type AccessEmailKind = 'role' | 'employee'

function renderAccessEmail(input: {
  kind: AccessEmailKind; name: string; roleLabel?: string; role?: string; appUrl: string; brand: string
}): { subject: string; html: string; text: string } {
  const { kind, appUrl, brand } = input
  const name = escapeHtml(input.name.trim() || brand)
  const url = escapeHtml(appUrl)
  const base = escapeHtml(appUrl.replace(/\/+$/, ''))
  const brandSafe = escapeHtml(brand)
  const isRole = kind === 'role'

  const subject = isRole ? `Вам открыт доступ в ${brand}` : `Вас добавили в ${brand}`

  const lead = isRole
    ? `Для вас открыт доступ в систему учёта активов <b style="color:#1A202C;">${brandSafe}</b>.<br>Ниже — назначенная роль и способ входа.`
    : `Вас добавили в систему учёта активов <b style="color:#1A202C;">${brandSafe}</b> как сотрудника.`

  const roleKey = input.role && KNOWN_ROLES.has(input.role) ? input.role : null
  const roleCard = isRole && input.roleLabel?.trim()
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 2px;">
         <tr><td style="background:#FBF4EA;border:1px solid #F0DFC8;border-radius:10px;padding:16px 20px 17px;">
           <div style="font:700 11px/1 ${SANS};letter-spacing:.14em;color:#B45309;">НАЗНАЧЕННАЯ РОЛЬ</div>
           <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:11px;"><tr>
             ${roleKey ? `<td style="padding-right:12px;" valign="middle"><img src="${base}/email/role-${roleKey}.png" width="34" height="34" alt="" style="display:block;border-radius:9px;"></td>` : ''}
             <td valign="middle" style="font:700 21px/1.2 ${SERIF};color:#1A202C;">${escapeHtml(input.roleLabel.trim())}</td>
           </tr></table>
         </td></tr>
       </table>`
    : ''

  const tail = isRole
    ? `Войдите в систему с помощью вашего Google-аккаунта — отдельный пароль не требуется.`
    : `Как только администратор назначит вам доступ, вы сможете войти по кнопке ниже с помощью вашего Google-аккаунта.`

  const ctaLabel = isRole ? 'Войти в систему →' : `Открыть ${brandSafe} →`

  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#e9edf2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9edf2;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="514" cellpadding="0" cellspacing="0" style="width:514px;max-width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
        <tr><td style="background:#12141C;" bgcolor="#12141C">
          <img src="${base}/email/header.png" width="514" alt="" style="display:block;width:100%;height:auto;border:0;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="padding:2px 26px 18px;"><tr>
            <td style="padding-right:11px;" valign="middle">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td width="40" height="40" align="center" valign="middle" style="background:${ACCENT};border-radius:20px;font:800 13px/1 ${SANS};color:#ffffff;letter-spacing:.02em;">${brandSafe}</td>
              </tr></table>
            </td>
            <td valign="middle">
              <div style="font:700 17px/1.2 ${SANS};color:#ffffff;">${brandSafe}</div>
              <div style="font:600 9.5px/1 ${SANS};letter-spacing:.24em;color:#8B93A3;margin-top:5px;">ASSET&nbsp;MANAGEMENT&nbsp;SYSTEM</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:34px 34px 6px;">
          <div style="font:400 25px/1.3 ${SERIF};color:#1A202C;">Здравствуйте, <b>${name}</b>.</div>
          <div style="font:400 15.5px/1.65 ${SANS};color:#475569;margin-top:14px;">${lead}</div>
          ${roleCard}
          <div style="font:400 15.5px/1.65 ${SANS};color:#475569;margin-top:20px;">${tail}</div>
        </td></tr>
        <tr><td style="padding:24px 34px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="background:${ACCENT};border-radius:9px;">
              <a href="${url}" style="display:inline-block;padding:14px 28px;font:700 15px/1 ${SANS};color:#ffffff;text-decoration:none;border-radius:9px;">${ctaLabel}</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:12px 34px 30px;">
          <div style="font:400 12px/1.6 ${SANS};color:#94a3b8;">Если кнопка не работает, откройте ссылку напрямую:<br>
            <a href="${url}" style="color:${ACCENT};text-decoration:none;">${url}</a></div>
        </td></tr>
        <tr><td style="padding:16px 34px;background:#F4F5F7;border-top:1px solid #eef2f6;">
          <div style="font:400 11.5px/1.6 ${SANS};color:#94a3b8;">Это автоматическое письмо от системы ${brandSafe}. Отвечать на него не нужно.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  const text = [
    `Здравствуйте, ${input.name.trim() || brand}!`, '',
    isRole ? `Вам открыт доступ в систему ${brand}.` : `Вас добавили в систему ${brand} как сотрудника.`,
    ...(isRole && input.roleLabel?.trim() ? [`Назначенная роль: ${input.roleLabel.trim()}`] : []),
    '', tail.replace(/<[^>]+>/g, ''), appUrl, '',
    `Это автоматическое письмо от системы ${brand}.`,
  ].join('\n')

  return { subject, html, text }
}

// ─────────────────────── Firebase ID-token admin verify (inlined) ───────────────────────

const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
const ADMIN_ROLES = new Set(['super_admin', 'tech_admin'])

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

async function verifyAdmin(idToken: string, projectId: string): Promise<{ uid: string; role: string } | null> {
  if (!idToken || !projectId) return null
  const parts = idToken.split('.')
  if (parts.length !== 3) return null

  let uid = ''
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
    uid = String(payload['sub'] ?? payload['user_id'] ?? '')
    if (!uid) return null

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

  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(uid)}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    )
    if (!res.ok) return null
    const body = (await res.json()) as { fields?: { role?: { stringValue?: string } } }
    const role = body.fields?.role?.stringValue
    if (!role || !ADMIN_ROLES.has(role)) return null
    return { uid, role }
  } catch {
    return null
  }
}

// ─────────────────────────────────── handler ───────────────────────────────────

interface NotifyBody { email?: unknown; name?: unknown; kind?: unknown; roleLabel?: unknown; role?: unknown }

function parseBody(raw: unknown): NotifyBody {
  if (raw && typeof raw === 'object') return raw as NotifyBody
  if (typeof raw === 'string') { try { return JSON.parse(raw) as NotifyBody } catch { return {} } }
  return {}
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return }

    const projectId = process.env['FIREBASE_PROJECT_ID']
    const apiKey = process.env['BREVO_API_KEY']
    const senderEmail = process.env['BREVO_SENDER_EMAIL']
    const senderName = process.env['BREVO_SENDER_NAME'] || 'AMS'
    const appUrl = process.env['APP_URL']
    if (!projectId || !apiKey || !senderEmail || !appUrl) {
      res.status(500).json({
        error: 'server_misconfigured',
        have: { FIREBASE_PROJECT_ID: !!projectId, BREVO_API_KEY: !!apiKey, BREVO_SENDER_EMAIL: !!senderEmail, APP_URL: !!appUrl },
      })
      return
    }

    const header = req.headers.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    const caller = await verifyAdmin(token, projectId)
    if (!caller) { res.status(403).json({ error: 'forbidden' }); return }

    const body = parseBody(req.body)
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const name = typeof body.name === 'string' ? body.name : ''
    const kind: AccessEmailKind = body.kind === 'employee' ? 'employee' : 'role'
    const roleLabel = typeof body.roleLabel === 'string' ? body.roleLabel : undefined
    const role = typeof body.role === 'string' ? body.role : undefined
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: 'invalid_email' }); return }

    const { subject, html, text } = renderAccessEmail({
      kind, name, appUrl, brand: senderName,
      ...(roleLabel ? { roleLabel } : {}),
      ...(role ? { role } : {}),
    })

    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email, ...(name ? { name } : {}) }],
        subject, htmlContent: html, textContent: text,
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
