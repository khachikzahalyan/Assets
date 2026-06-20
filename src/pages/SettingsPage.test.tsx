import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import '@/lib/i18n'
import { SettingsPage } from './SettingsPage'
import { InMemoryAuthSettingsRepository } from '@/infra/repositories'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u_super' }, role: 'super_admin' }),
}))

describe('SettingsPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the settings page with the auth panel and the seeded domain', async () => {
    const repo = new InMemoryAuthSettingsRepository({ allowedEmailDomains: ['acme.com'] })
    render(
      <MemoryRouter>
        <SettingsPage repository={repo} />
      </MemoryRouter>,
    )

    // The page header icon/title renders — i18n key 'title' resolves to the key
    // or the Russian translation once i18n-engineer wires the namespace.
    // We assert a heading element exists (PageHeader renders an <h1>).
    expect(document.querySelector('h1')).toBeInTheDocument()

    // The auth panel section card renders — SectionCard renders a <section>.
    expect(document.querySelector('section')).toBeInTheDocument()

    // The domain from the seeded repo appears after async load.
    expect(await screen.findByText('acme.com')).toBeInTheDocument()
  })
})
