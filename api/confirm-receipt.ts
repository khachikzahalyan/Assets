/**
 * GET /api/confirm-receipt?token=… — magic-link receipt confirmation.
 *
 * The recipient clicks the button in their notification email. We verify the
 * signed (HMAC) token, then flip the asset st_pending → st_assigned and stamp
 * assignmentAcceptedAt/acceptedBy. No login required — the token is the proof.
 *
 * SELF-CONTAINED (node:crypto + fetch only). Writes to Firestore via the REST API
 * using a Google access token minted from a service-account key — this bypasses
 * security rules (admin), which is why the magic link works without a user session.
 *
 * Env (Vercel):
 *   CONFIRM_SECRET           — HMAC secret shared with /api/notify-access (token signing)
 *   FIREBASE_PROJECT_ID      — e.g. asset-ams
 *   FIREBASE_SERVICE_ACCOUNT — the full service-account JSON (one env var)
 *   APP_URL                  — for the "open app" link on the result page
 */

import crypto from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function b64urlToBuf(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function verifyToken(token: string, secret: string): { assetId: string } | null {
  const dot = token.indexOf('.')
  if (dot < 1) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(b64urlToBuf(body).toString('utf8')) as { a?: string; exp?: number }
    if (!payload.a) return null
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null
    return { assetId: payload.a }
  } catch {
    return null
  }
}

interface ServiceAccount { client_email: string; private_key: string }

// Mint a Google OAuth access token (datastore scope) from the service-account key.
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

function page(title: string, message: string, appUrl: string): string {
  const url = appUrl.replace(/"/g, '')
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#e9edf2;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" style="padding:48px 16px;"><tr><td align="center">
    <table role="presentation" width="440" style="width:440px;max-width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
      <tr><td style="background:#12141C;padding:20px 28px;"><div style="font:800 17px/1 Arial;color:#F97316;">AMS</div></td></tr>
      <tr><td style="padding:30px 28px;">
        <div style="font:700 20px/1.3 Arial;color:#1A202C;">${title}</div>
        <div style="font:400 15px/1.6 Arial;color:#475569;margin-top:12px;">${message}</div>
        <div style="margin-top:22px;"><a href="${url}" style="display:inline-block;background:#F97316;color:#fff;text-decoration:none;font:700 14px/1 Arial;padding:12px 22px;border-radius:9px;">Открыть AMS →</a></div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const projectId = process.env['FIREBASE_PROJECT_ID']
  const secret = process.env['CONFIRM_SECRET']
  const saRaw = process.env['FIREBASE_SERVICE_ACCOUNT']
  const appUrl = process.env['APP_URL'] || '/'

  const send = (code: number, title: string, msg: string) => {
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.status(code).send(page(title, msg, appUrl))
  }

  try {
    if (!projectId || !secret || !saRaw) {
      send(500, 'Пока недоступно', 'Подтверждение по ссылке ещё не настроено. Обратитесь к администратору.')
      return
    }
    const token = typeof req.query['token'] === 'string' ? (req.query['token'] as string) : ''
    const claim = verifyToken(token, secret)
    if (!claim) {
      send(400, 'Ссылка недействительна', 'Ссылка подтверждения устарела или неверна. Попросите администратора выдать актив повторно.')
      return
    }

    const sa = JSON.parse(saRaw) as ServiceAccount
    const accessToken = await getAccessToken(sa)
    if (!accessToken) { send(500, 'Ошибка', 'Не удалось авторизоваться на сервере. Попробуйте позже.'); return }

    const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
    const authH = { Authorization: `Bearer ${accessToken}` }

    const getRes = await fetch(`${base}/assets/${encodeURIComponent(claim.assetId)}`, { headers: authH })
    if (!getRes.ok) { send(404, 'Актив не найден', 'Актив не найден в системе.'); return }
    const doc = (await getRes.json()) as {
      name?: string
      updateTime?: string
      fields?: Record<string, { stringValue?: string; mapValue?: { fields?: Record<string, { stringValue?: string }> } }>
    }
    const status = doc.fields?.['statusId']?.stringValue

    if (status !== 'st_pending') {
      send(200, 'Уже подтверждено', 'Получение этого актива уже подтверждено. Спасибо!')
      return
    }

    // TOCTOU fix: атомарная проверка-и-запись через Firestore commit с precondition updateTime.
    // Если второй запрос прочитал тот же статус st_pending, его commit упадёт с 409
    // (FAILED_PRECONDITION), т.к. updateTime документа уже изменился первым запросом.
    const assetDocName = doc.name ?? `projects/${projectId}/databases/(default)/documents/assets/${encodeURIComponent(claim.assetId)}`
    const updateTime = doc.updateTime
    const nowIso = new Date().toISOString()
    const commitBody: Record<string, unknown> = {
      writes: [
        {
          update: {
            name: assetDocName,
            fields: {
              statusId: { stringValue: 'st_assigned' },
              assignmentAcceptedAt: { timestampValue: nowIso },
              acceptedBy: { stringValue: 'email-link' },
            },
          },
          updateMask: { fieldPaths: ['statusId', 'assignmentAcceptedAt', 'acceptedBy'] },
          ...(updateTime != null ? { currentDocument: { updateTime } } : {}),
        },
      ],
    }
    const commitUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`
    const patchRes = await fetch(commitUrl, {
      method: 'POST',
      headers: { ...authH, 'content-type': 'application/json' },
      body: JSON.stringify(commitBody),
    })
    if (!patchRes.ok) {
      // 409 = FAILED_PRECONDITION — параллельный запрос уже подтвердил получение.
      if (patchRes.status === 409) {
        send(200, 'Уже подтверждено', 'Получение этого актива уже подтверждено. Спасибо!')
        return
      }
      send(500, 'Ошибка', 'Не удалось сохранить подтверждение. Попробуйте позже.')
      return
    }

    // Best-effort audit (never blocks the confirmation result).
    try {
      await fetch(`${base}/audit_logs`, {
        method: 'POST',
        headers: { ...authH, 'content-type': 'application/json' },
        body: JSON.stringify({
          fields: {
            entityType: { stringValue: 'asset' },
            entityId: { stringValue: claim.assetId },
            action: { stringValue: 'receipt_confirmed' },
            actorUid: { stringValue: 'email-link' },
            at: { timestampValue: nowIso },
          },
        }),
      })
    } catch { /* audit is best-effort */ }

    // Best-effort bell notification for ALL admins (audience 'admins').
    try {
      const f = doc.fields ?? {}
      const sv = (k: string): string => f[k]?.stringValue ?? ''
      const asn = f['assignment']?.mapValue?.fields ?? {}
      const invCode = sv('invCode')
      const assetTitle = [sv('brand'), sv('model')].filter(Boolean).join(' ').trim() || invCode
      let employeeName = asn['employeeName']?.stringValue ?? ''
      const employeeId = asn['employeeId']?.stringValue ?? ''
      if (!employeeName && employeeId) {
        const eRes = await fetch(`${base}/employees/${encodeURIComponent(employeeId)}`, { headers: authH })
        if (eRes.ok) {
          const eDoc = (await eRes.json()) as { fields?: Record<string, { stringValue?: string }> }
          employeeName = [eDoc.fields?.['firstName']?.stringValue, eDoc.fields?.['lastName']?.stringValue]
            .filter(Boolean).join(' ').trim()
        }
      }
      await fetch(`${base}/notifications`, {
        method: 'POST',
        headers: { ...authH, 'content-type': 'application/json' },
        body: JSON.stringify({
          fields: {
            type: { stringValue: 'receipt_confirmed' },
            audience: { stringValue: 'admins' },
            assetId: { stringValue: claim.assetId },
            assetTitle: { stringValue: assetTitle },
            invCode: { stringValue: invCode },
            employeeName: { stringValue: employeeName },
            createdAt: { timestampValue: nowIso },
            readBy: { arrayValue: {} },
          },
        }),
      })
    } catch { /* notification is best-effort */ }

    send(200, 'Получение подтверждено ✓', 'Спасибо! Вы подтвердили, что получили актив. Статус в системе обновлён на «Выдано».')
  } catch (e) {
    send(500, 'Ошибка', `Что-то пошло не так: ${e instanceof Error ? e.message : String(e)}`)
  }
}
