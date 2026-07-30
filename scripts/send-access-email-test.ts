/**
 * One-off local sender to PROVE the access-email works end-to-end without waiting
 * for a Vercel deploy. Uses the SAME template the serverless function uses, so what
 * lands in the inbox is exactly the production email.
 *
 * Usage (PowerShell):
 *   $env:BREVO_API_KEY="xkeysib-..."; npx tsx scripts/send-access-email-test.ts
 *
 * Optional overrides (env vars):
 *   TEST_TO          recipient          (default zahalyan.khachik@gmail.com)
 *   TEST_NAME        recipient name     (default "Погос")
 *   TEST_KIND        role | employee    (default role)
 *   TEST_ROLE_LABEL  role chip text     (default "Админ активов")
 *   BREVO_SENDER_EMAIL (default zahalyanxcho@gmail.com)
 *   BREVO_SENDER_NAME  (default AMS)
 *   APP_URL            (default https://telcell-ams.vercel.app/)
 */
import { renderAccessEmail, type AccessEmailKind } from '../api/_lib/accessEmailTemplate'

async function main() {
  const apiKey = process.env['BREVO_API_KEY']
  if (!apiKey) {
    console.error('❌ BREVO_API_KEY is not set. Get it from Brevo → SMTP & API → API Keys.')
    process.exit(1)
  }

  const senderEmail = process.env['BREVO_SENDER_EMAIL'] || 'zahalyanxcho@gmail.com'
  const senderName = process.env['BREVO_SENDER_NAME'] || 'AMS'
  const appUrl = process.env['APP_URL'] || 'https://telcell-ams.vercel.app/'
  const to = process.env['TEST_TO'] || 'zahalyan.khachik@gmail.com'
  const name = process.env['TEST_NAME'] || 'Погос'
  const kindEnv = process.env['TEST_KIND']
  const kind: AccessEmailKind = kindEnv === 'employee' ? 'employee' : kindEnv === 'asset' ? 'asset' : 'role'
  const roleLabel = process.env['TEST_ROLE_LABEL'] || 'Админ активов'
  const assetLabel = process.env['TEST_ASSET_LABEL'] || 'Dell XPS 15'
  const assetCode = process.env['TEST_ASSET_CODE'] || '450/293919'

  const { subject, html, text } = renderAccessEmail({
    kind, name, appUrl, brand: senderName,
    ...(kind === 'role' ? { roleLabel } : {}),
    ...(kind === 'asset' ? { assetLabel, assetCode } : {}),
  })

  console.log(`→ Sending "${subject}" to ${to} (from ${senderName} <${senderEmail}>)…`)

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to, name }],
      subject, htmlContent: html, textContent: text,
    }),
  })

  const body = await res.text()
  if (!res.ok) {
    console.error(`❌ Brevo returned ${res.status}: ${body}`)
    process.exit(1)
  }
  console.log(`✅ Sent. Brevo response: ${body}`)
  console.log(`   Check ${to} — Inbox and Spam/Promotions.`)
}

main().catch((e) => { console.error('❌ Failed:', e); process.exit(1) })
