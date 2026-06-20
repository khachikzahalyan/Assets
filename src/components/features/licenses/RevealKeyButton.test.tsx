/**
 * RevealKeyButton component tests.
 *
 * Exercises role-gating (super_admin only), the happy-path reveal flow,
 * and the error path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { RevealKeyButton } from './RevealKeyButton'
import type { Role } from '@/config/roles'

vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

// Prevent real Cloud Function wrapper from being imported
vi.mock('@/lib/licenses/revealKey', () => ({
  revealLicenseKey: vi.fn(),
  setLicenseKey: vi.fn(),
}))

function authCtx(role: Role) {
  return {
    user: { id: 'u_001', name: 'Test User', email: 'u@example.test', role, initials: 'TU', avatarColor: '' },
    role,
    status: 'ready' as const,
    setRole: () => {},
    signOut: () => {},
  }
}

function renderButton(
  role: Role,
  revealFn: (collection: 'licenses' | 'server_licenses', licenseId: string) => Promise<string>,
) {
  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={authCtx(role)}>
        <RevealKeyButton
          collection="licenses"
          licenseId="lic_test"
          revealFn={revealFn}
        />
      </AuthContext.Provider>
    </I18nextProvider>,
  )
}

describe('RevealKeyButton', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
    // Reset confirm mock before each test
    vi.restoreAllMocks()
  })

  // ── Role gating ────────────────────────────────────────────────────────────

  it('renders nothing for tech_admin', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <AuthContext.Provider value={authCtx('tech_admin')}>
          <RevealKeyButton
            collection="licenses"
            licenseId="lic_test"
            revealFn={vi.fn()}
          />
        </AuthContext.Provider>
      </I18nextProvider>,
    )
    // Component returns null for non-super_admin
    expect(container.firstChild).toBeNull()
  })

  it('renders the reveal button for super_admin', () => {
    renderButton('super_admin', vi.fn())
    // The button should be visible
    expect(screen.getByRole('button', { name: /Показать ключ/i })).toBeInTheDocument()
  })

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('calls revealFn with correct args and shows the raw key after confirm', async () => {
    // Arrange
    const RAW_KEY = 'ABCD-EFGH-IJKL-9999'
    const revealFn = vi.fn().mockResolvedValue(RAW_KEY)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    // Act
    renderButton('super_admin', revealFn)
    fireEvent.click(screen.getByRole('button', { name: /Показать ключ/i }))

    // Assert — revealFn called with correct args
    await waitFor(() => {
      expect(revealFn).toHaveBeenCalledWith('licenses', 'lic_test')
    })

    // Assert — raw key text appears in DOM
    expect(await screen.findByText(RAW_KEY)).toBeInTheDocument()
  })

  it('does NOT call revealFn when user cancels confirm', () => {
    // Arrange
    const revealFn = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    // Act
    renderButton('super_admin', revealFn)
    fireEvent.click(screen.getByRole('button', { name: /Показать ключ/i }))

    // Assert — revealFn never called
    expect(revealFn).not.toHaveBeenCalled()
    // The reveal button should still be visible
    expect(screen.getByRole('button', { name: /Показать ключ/i })).toBeInTheDocument()
  })

  // ── Error path ─────────────────────────────────────────────────────────────

  it('shows role="alert" element and no key text when revealFn rejects', async () => {
    // Arrange
    const RAW_KEY = 'SECRET-KEY-1234'
    const revealFn = vi.fn().mockRejectedValue(new Error('forbidden'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    // Act
    renderButton('super_admin', revealFn)
    fireEvent.click(screen.getByRole('button', { name: /Показать ключ/i }))

    // Assert — alert element rendered
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    // Assert — raw key must NOT appear anywhere
    expect(screen.queryByText(RAW_KEY)).toBeNull()
  })
})
