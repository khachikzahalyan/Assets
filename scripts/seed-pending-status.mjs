// One-off: write the st_pending («Ожидание») status doc into the LIVE Firestore
// asset_statuses collection using a service-account key (the app seed only covers
// fresh installs; prod already had the original 4 statuses).
//
// Usage: node scripts/seed-pending-status.mjs "C:/path/to/serviceAccountKey.json"
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'

const saPath = process.argv[2]
if (!saPath) { console.error('Pass the service-account JSON path as arg 1'); process.exit(1) }
const sa = JSON.parse(readFileSync(saPath, 'utf8'))
const projectId = sa.project_id
if (!projectId || !sa.client_email || !sa.private_key) { console.error('Bad SA file'); process.exit(1) }

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000)
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const input = `${enc({ alg: 'RS256', typ: 'JWT' })}.` + enc({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })
  const signer = crypto.createSign('RSA-SHA256'); signer.update(input); signer.end()
  const jwt = `${input}.${signer.sign(sa.private_key).toString('base64url')}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  })
  if (!res.ok) throw new Error('token: ' + await res.text())
  return (await res.json()).access_token
}

const token = await getAccessToken()
const nowIso = new Date().toISOString()
const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/asset_statuses/st_pending`
  + '?updateMask.fieldPaths=name&updateMask.fieldPaths=color&updateMask.fieldPaths=isFinal'
  + '&updateMask.fieldPaths=isSystem&updateMask.fieldPaths=sortOrder&updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=createdAt'
const res = await fetch(url, {
  method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify({ fields: {
    name: { stringValue: 'Ожидание' },
    color: { stringValue: 'violet' },
    isFinal: { booleanValue: false },
    isSystem: { booleanValue: true },
    sortOrder: { integerValue: '1' },
    createdAt: { timestampValue: nowIso },
    updatedAt: { timestampValue: nowIso },
  } }),
})
if (!res.ok) { console.error('PATCH failed:', res.status, await res.text()); process.exit(1) }
console.log('✅ asset_statuses/st_pending written to project', projectId)
