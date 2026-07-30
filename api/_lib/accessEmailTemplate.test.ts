import { describe, it, expect } from 'vitest'
import { renderAccessEmail, escapeHtml } from './accessEmailTemplate'

const BASE = { name: 'Погос', appUrl: 'https://telcell-ams.vercel.app/', brand: 'AMS' } as const

describe('renderAccessEmail', () => {
  it('role variant: subject + role chip + login CTA + app url', () => {
    const { subject, html, text } = renderAccessEmail({ ...BASE, kind: 'role', roleLabel: 'Админ активов' })
    expect(subject).toBe('Вам открыт доступ в AMS')
    expect(html).toContain('Ваша роль: Админ активов')
    expect(html).toContain('Войти в систему')
    expect(html).toContain('https://telcell-ams.vercel.app/')
    expect(html).toContain('Здравствуйте, Погос!')
    expect(text).toContain('Ваша роль: Админ активов')
  })

  it('employee variant: softer subject, NO role chip, "Открыть AMS" CTA', () => {
    const { subject, html } = renderAccessEmail({ ...BASE, kind: 'employee' })
    expect(subject).toBe('Вас добавили в AMS')
    expect(html).not.toContain('Ваша роль:')
    expect(html).toContain('Открыть AMS')
    expect(html).toContain('как сотрудника')
  })

  it('role variant without a roleLabel omits the chip', () => {
    const { html } = renderAccessEmail({ ...BASE, kind: 'role' })
    expect(html).not.toContain('Ваша роль:')
  })

  it('falls back to brand when name is blank', () => {
    const { html } = renderAccessEmail({ ...BASE, name: '   ', kind: 'employee' })
    expect(html).toContain('Здравствуйте, AMS!')
  })

  it('escapes HTML in name and roleLabel (no injection)', () => {
    const { html } = renderAccessEmail({
      ...BASE, name: '<script>x</script>', kind: 'role', roleLabel: '<b>role</b>',
    })
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;b&gt;role&lt;/b&gt;')
  })
})

describe('escapeHtml', () => {
  it('escapes the five sensitive characters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;')
  })
})
