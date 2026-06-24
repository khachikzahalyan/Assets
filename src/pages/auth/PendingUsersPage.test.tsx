import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { PendingUsersPage } from './PendingUsersPage'
import { InMemoryUserRepository } from '@/infra/repositories'
import type { PendingUser } from '@/domain/user'

// Mock Firebase so the page's lazy defaultRepo doesn't crash
vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))
vi.mock('@/infra/repositories', async () => {
  const actual = await vi.importActual<typeof import('@/infra/repositories')>('@/infra/repositories')
  return {
    ...actual,
    FirestoreUserRepository: class {
      async listPendingUsers() { return [] }
      async assignRole() { return { value: { id: 'u_1', email: 'test@x.com', displayName: 'Test', role: 'super_admin', status: 'active', createdAt: null }, auditId: 'a_1' } }
    },
  }
})

function authCtx() {
  return {
    user: { id: 'u_super', name: 'Super Admin', email: 'su@x.com', role: 'super_admin' as const, initials: 'SA', avatarColor: '' },
    role: 'super_admin' as const,
    status: 'ready' as const,
    setRole: () => {},
    signOut: () => {},
  }
}

function pendingUser(over: Partial<PendingUser> = {}): PendingUser {
  return {
    id: 'uid_pending',
    email: 'pending@example.com',
    displayName: 'Олег Тестов',
    role: null,
    status: 'no-role',
    createdAt: '2026-01-15T10:00:00.000Z',
    ...over,
  }
}

function renderPage(users: PendingUser[]) {
  const repo = new InMemoryUserRepository(users)
  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={authCtx()}>
        <MemoryRouter>
          <PendingUsersPage repository={repo} />
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )
  return repo
}

describe('PendingUsersPage', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })

  it('renders a pending user row', async () => {
    renderPage([pendingUser()])
    expect(await screen.findByText('pending@example.com')).toBeInTheDocument()
  })

  it('shows empty state when there are no pending users', async () => {
    renderPage([])
    expect(await screen.findByText(/Нет ожидающих пользователей/)).toBeInTheDocument()
  })

  it('opens the assign dialog and calls repo.assignRole on submit', async () => {
    const repo = renderPage([pendingUser()])
    const assignRoleSpy = vi.spyOn(repo, 'assignRole')

    // Wait for the row to appear, then click "Назначить роль"
    const assignBtn = await screen.findByRole('button', { name: /Назначить роль/ })
    fireEvent.click(assignBtn)

    // Dialog opens — select a non-employee role so no extra fields appear
    const roleSelect = await screen.findByRole('combobox', { name: /Роль/ })
    fireEvent.change(roleSelect, { target: { value: 'asset_admin' } })

    // Submit — use exact text to avoid matching the row "Назначить роль" button
    const submitBtn = screen.getByRole('button', { name: /^Назначить$/ })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(assignRoleSpy).toHaveBeenCalledWith(
        expect.objectContaining({ uid: 'uid_pending', role: 'asset_admin' }),
        expect.objectContaining({ uid: 'u_super', role: 'super_admin' }),
      )
    })
  })
})
