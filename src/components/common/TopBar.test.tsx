/**
 * TopBar — role-gate tests for the notification bell + hamburger-removal assertion.
 *
 * The hamburger button was replaced by the mobile BottomNav in the global nav refactor.
 * The bell (NotificationBell) is rendered only when role === 'super_admin' || role === 'asset_admin'.
 * This file asserts both that the burger is gone and that the gate works for all 4 AMS roles.
 *
 * NotificationBell is mocked so this test focuses purely on the TopBar gate logic,
 * not on the bell's internal Firestore behaviour (which is covered by NotificationBell.test.tsx).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthProvider } from '@/contexts/AuthContext'
import { TopBar } from './TopBar'
import type { Role } from '@/config/roles'

// Mock Firebase so the module can be imported in jsdom
vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

// Mock NotificationBell to isolate the TopBar role gate from the bell's own
// Firestore dependency. The accessible name matches the real bell's aria-label
// (notifications:bellTooltip → "Уведомления" in Russian).
vi.mock('./NotificationBell', () => ({
  NotificationBell: () => <button>Уведомления</button>,
}))

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

function renderTopBar(role: Role) {
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <AuthProvider initialRole={role}>
          {/* onOpenSidebar prop removed — TopBar no longer accepts it */}
          <TopBar breadcrumbs={['AMS', 'Активы']} />
        </AuthProvider>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('TopBar — hamburger removed', () => {
  it('does NOT render a hamburger / open-menu button', () => {
    renderTopBar('super_admin')
    expect(document.querySelector('.ams-hamburger')).toBeNull()
    expect(screen.queryByTitle('Открыть меню')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Открыть меню')).not.toBeInTheDocument()
  })
})

describe('TopBar — notification bell role gate', () => {
  it.each(['super_admin', 'asset_admin'] as Role[])(
    'renders the bell for %s',
    (role) => {
      // Arrange + Act
      renderTopBar(role)

      // Assert — bell button must be present
      expect(screen.getByRole('button', { name: 'Уведомления' })).toBeInTheDocument()
    },
  )

  it.each(['tech_admin', 'employee'] as Role[])(
    'hides the bell for %s',
    (role) => {
      // Arrange + Act
      renderTopBar(role)

      // Assert — bell button must be absent
      expect(screen.queryByRole('button', { name: 'Уведомления' })).toBeNull()
    },
  )
})
