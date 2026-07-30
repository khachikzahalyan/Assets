// Generates the static PNG assets for the access-notification email:
//   public/email/header.png                  — dark decorative header art (2x)
//   public/email/role-<role>.png             — orange badge role icons (2x)
// Run: node scripts/gen-email-assets.mjs   (playwright from the npx cache)
import { mkdirSync } from 'node:fs'

const PW = process.env.PW_PATH ?? 'C:/Users/DELL/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs'
const { chromium } = await import(new URL('file:///' + PW).href)

mkdirSync('public/email', { recursive: true })

/* Lucide path data (24×24 viewBox, stroke-based) */
const GLYPHS = {
  crown: ['M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z', 'M5 21h14'],
  shield: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'],
  layers: ['M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z', 'M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12', 'M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17'],
}
const EXTRAS = {
  'circuit-board': `<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M11 9h4a2 2 0 0 0 2-2V3"/><circle cx="9" cy="9" r="2"/><path d="M7 21v-4a2 2 0 0 1 2-2h4"/><circle cx="15" cy="15" r="2"/><path d="M16 17h5"/>`,
  'user-check': `<path d="m16 11 2 2 4-4"/><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>`,
}
const glyphSvg = (key, sizePx, stroke = '#ffffff', width = 2) => {
  const inner = EXTRAS[key] ?? GLYPHS[key].map(d => `<path d="${d}"/>`).join('')
  return `<svg width="${sizePx}" height="${sizePx}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
}

/* ── Header art: 480×92 CSS-px @2x = 960×184. Dark field + thin orange
     network art (echoes the login decor). No centered app badge — the AMS
     logo row is rendered as HTML in the email body just below this strip. ── */
const headerHtml = `<!doctype html><html><body style="margin:0">
<div id="art" style="position:relative;width:480px;height:92px;background:#12141C;overflow:hidden;font-family:Arial">
  <svg width="480" height="92" style="position:absolute;inset:0">
    <circle cx="452" cy="10" r="52" fill="none" stroke="rgba(249,115,22,0.28)" stroke-width="1"/>
    <circle cx="452" cy="10" r="30" fill="none" stroke="rgba(249,115,22,0.20)" stroke-width="1"/>
    <circle cx="60" cy="84" r="40" fill="none" stroke="rgba(249,115,22,0.16)" stroke-width="1"/>
    <circle cx="150" cy="-8" r="26" fill="none" stroke="rgba(249,115,22,0.22)" stroke-width="1"/>
    <line x1="0" y1="70" x2="150" y2="12" stroke="rgba(249,115,22,0.14)" stroke-width="1"/>
    <line x1="330" y1="92" x2="480" y2="30" stroke="rgba(249,115,22,0.14)" stroke-width="1"/>
    <line x1="180" y1="0" x2="260" y2="92" stroke="rgba(56,189,248,0.08)" stroke-width="1"/>
    <circle cx="150" cy="12" r="2.5" fill="rgba(249,115,22,0.55)"/>
    <circle cx="330" cy="92" r="2.5" fill="rgba(249,115,22,0.45)"/>
    <circle cx="404" cy="46" r="2" fill="rgba(249,115,22,0.4)"/>
    <circle cx="36" cy="26" r="2" fill="rgba(249,115,22,0.35)"/>
  </svg>
</div></body></html>`

/* ── Role badge: 34×34 CSS-px @2x = 68×68, transparent corners ── */
const badgeHtml = (key) => `<!doctype html><html><body style="margin:0;background:transparent">
<div id="art" style="width:34px;height:34px;background:linear-gradient(180deg,#FB923C,#EA580C);border-radius:9px;display:flex;align-items:center;justify-content:center">
  ${glyphSvg(key, 19, '#ffffff', 2.2)}
</div></body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 2 })

await page.setContent(headerHtml)
// Versioned filename: Gmail's image proxy caches by URL, so reusing header.png
// kept showing the OLD (with-icon) art in inbox. Bump the name to force a refetch.
await page.locator('#art').screenshot({ path: 'public/email/header-2.png' })

const ROLE_GLYPH = { super_admin: 'crown', asset_admin: 'shield', tech_admin: 'circuit-board', employee: 'user-check' }
for (const [role, key] of Object.entries(ROLE_GLYPH)) {
  await page.setContent(badgeHtml(key))
  await page.locator('#art').screenshot({ path: `public/email/role-${role}.png`, omitBackground: true })
}

await browser.close()
console.log('assets done')
