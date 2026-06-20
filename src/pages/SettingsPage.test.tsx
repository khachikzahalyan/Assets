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

    // The page header renders — PageHeader renders an <h1> with the translated title.
    // We assert by element role rather than translated string to stay locale-agnostic.
    expect(document.querySelector('h1')).toBeInTheDocument()

    // The auth panel section card renders — SectionCard renders a <section>.
    expect(document.querySelector('section')).toBeInTheDocument()

    // The domain from the seeded repo appears after async load.
    expect(await screen.findByText('acme.com')).toBeInTheDocument()
  })
})
