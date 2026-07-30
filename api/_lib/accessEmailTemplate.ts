/**
 * Pure builder for the AMS access-notification email.
 *
 * No I/O, no env reads — everything comes in via `AccessEmailInput` so this is
 * trivially unit-testable and language/brand-agnostic. The HTML mirrors the
 * approved mockup (variant A): light theme, orange accent, table + inline-CSS
 * layout, bulletproof CTA button. Inline styles are mandatory — Gmail/Outlook
 * strip <style> blocks and modern CSS.
 *
 * Two kinds:
 *   - 'role'     → access granted, shows the role chip + «Войти в систему».
 *   - 'employee' → HR record created (no role yet), softer copy + «Открыть AMS».
 */

export type AccessEmailKind = 'role' | 'employee'

export interface AccessEmailInput {
  kind: AccessEmailKind
  /** Recipient display name (already resolved; falls back to email local-part upstream). */
  name: string
  /** Human-readable role label (RU), required for kind='role', ignored otherwise. */
  roleLabel?: string
  /** Absolute app URL for the CTA button + fallback link. */
  appUrl: string
  /** Brand shown in the header + sender ("AMS"). */
  brand: string
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

const ACCENT = '#F97316'

/** Minimal HTML escaping for interpolated user-controlled strings. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderAccessEmail(input: AccessEmailInput): RenderedEmail {
  const { kind, appUrl, brand } = input
  const name = escapeHtml(input.name.trim() || brand)
  const url = escapeHtml(appUrl)
  const brandSafe = escapeHtml(brand)
  const isRole = kind === 'role'

  const subject = isRole
    ? `Вам открыт доступ в ${brand}`
    : `Вас добавили в ${brand}`

  const lead = isRole
    ? `Вам открыт доступ в систему учёта активов <b style="color:#0f172a;">${brandSafe}</b>.`
    : `Вас добавили в систему учёта активов <b style="color:#0f172a;">${brandSafe}</b> как сотрудника.`

  const roleChip = isRole && input.roleLabel?.trim()
    ? `<div style="margin:18px 0 6px;">
         <span style="display:inline-block;background:#fff7ed;border:1px solid #fed7aa;color:#c2410c;font:700 13px/1 Arial,sans-serif;padding:9px 12px;border-radius:8px;">
           Ваша роль: ${escapeHtml(input.roleLabel.trim())}
         </span>
       </div>`
    : ''

  const tail = isRole
    ? `Войдите в систему с помощью вашего Google-аккаунта.`
    : `Как только администратор назначит вам доступ, вы сможете войти по кнопке ниже с помощью вашего Google-аккаунта.`

  const ctaLabel = isRole ? 'Войти в систему →' : 'Открыть AMS →'

  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#e9edf2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9edf2;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:22px 28px;border-bottom:1px solid #eef2f6;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:10px;"><span style="display:inline-block;background:${ACCENT};color:#ffffff;font:800 15px/1 Arial,sans-serif;padding:8px 10px;border-radius:9px;">${brandSafe}</span></td>
            <td style="font:600 13px/1.3 Arial,sans-serif;color:#64748b;">Asset Management System</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:30px 28px 8px;">
          <div style="font:700 20px/1.35 Arial,sans-serif;color:#0f172a;">Здравствуйте, ${name}!</div>
          <div style="font:400 15px/1.6 Arial,sans-serif;color:#475569;margin-top:12px;">${lead}</div>
          ${roleChip}
          <div style="font:400 15px/1.6 Arial,sans-serif;color:#475569;margin-top:16px;">${tail}</div>
        </td></tr>
        <tr><td style="padding:22px 28px 6px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="background:${ACCENT};border-radius:10px;">
              <a href="${url}" style="display:inline-block;padding:13px 26px;font:700 15px/1 Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:10px;">${ctaLabel}</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:12px 28px 26px;">
          <div style="font:400 12px/1.6 Arial,sans-serif;color:#94a3b8;">Если кнопка не работает, откройте ссылку:<br>
            <a href="${url}" style="color:${ACCENT};text-decoration:none;">${url}</a></div>
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #eef2f6;">
          <div style="font:400 11.5px/1.6 Arial,sans-serif;color:#94a3b8;">Это автоматическое письмо от системы ${brandSafe}. Отвечать на него не нужно.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  const text = [
    `Здравствуйте, ${input.name.trim() || brand}!`,
    '',
    isRole
      ? `Вам открыт доступ в систему ${brand}.`
      : `Вас добавили в систему ${brand} как сотрудника.`,
    ...(isRole && input.roleLabel?.trim() ? [`Ваша роль: ${input.roleLabel.trim()}`] : []),
    '',
    `${tail.replace(/<[^>]+>/g, '')}`,
    appUrl,
    '',
    `Это автоматическое письмо от системы ${brand}.`,
  ].join('\n')

  return { subject, html, text }
}
