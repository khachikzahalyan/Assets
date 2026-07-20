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

/** Build a repo with N pending users (all no-role). */
function makePendingRepo(count: number) {
  const users: PendingUser[] = Array.from({ length: count }, (_, i) => ({
    id: `pending_${i + 1}`,
    email: `user${i + 1}@example.com`,
    displayName: `Pending User ${i + 1}`,
    role: null,
    status: 'no-role' as const,
    createdAt: '2026-01-15T10:00:00.000Z',
  }))
  return new InMemoryUserRepository(users)
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

function renderWithRepo(repo: InMemoryUserRepository) {
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

  it('renders no page header — the card starts directly with the search bar', async () => {
    renderPage([pendingUser()])
    await screen.findByText('pending@example.com')
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('ListCard is rendered (floating-card shell present)', async () => {
    renderPage([pendingUser()])
    await screen.findByText('pending@example.com')
    expect(document.getElementById('pending-users-search')).toBeInTheDocument()
  })

  it('shows loading state while listPendingUsers has not resolved', () => {
    const pendingRepo = {
      listPendingUsers: () => new Promise<never>(() => {}),
      listUsers: () => new Promise<never>(() => {}),
      assignRole: vi.fn(),
    }
    render(
      <I18nextProvider i18n={i18n}>
        <AuthContext.Provider value={authCtx()}>
          <MemoryRouter>
            <PendingUsersPage repository={pendingRepo as any} />
          </MemoryRouter>
        </AuthContext.Provider>
      </I18nextProvider>,
    )
    // No user data rows rendered yet — loading state
    expect(screen.queryByText('pending@example.com')).not.toBeInTheDocument()
  })

  it('shows error state on rejection and retry re-invokes listPendingUsers', async () => {
    const listPendingUsers = vi.fn().mockRejectedValue(new Error('network'))
    const errorRepo = {
      listPendingUsers,
      listUsers: () => Promise.resolve([]),
      assignRole: vi.fn(),
    }
    render(
      <I18nextProvider i18n={i18n}>
        <AuthContext.Provider value={authCtx()}>
          <MemoryRouter>
            <PendingUsersPage repository={errorRepo as any} />
          </MemoryRouter>
        </AuthContext.Provider>
      </I18nextProvider>,
    )

    expect(await screen.findByRole('button', { name: /Повторить/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Повторить/ }))

    await waitFor(() => expect(listPendingUsers).toHaveBeenCalledTimes(2))
  })

  it('search filters pending users by name', async () => {
    renderPage([
      pendingUser({ id: 'u1', displayName: 'Олег Тестов', email: 'oleg@example.com' }),
      pendingUser({ id: 'u2', displayName: 'Анна Смирнова', email: 'anna@example.com' }),
    ])
    await screen.findByText('Олег Тестов')

    fireEvent.change(document.getElementById('pending-users-search')!, { target: { value: 'Анна' } })
    expect(screen.getByText('Анна Смирнова')).toBeInTheDocument()
    expect(screen.queryByText('Олег Тестов')).not.toBeInTheDocument()
  })

  it('paginates: 11 pending users → page 1 shows 10, Next shows remaining 1', async () => {
    const repo = makePendingRepo(11)
    renderWithRepo(repo)

    // Wait for first user to appear
    await screen.findByText('Pending User 1')

    // Page 1: DataTable header row + 10 data rows = 11 total role="row"
    const allRows = screen.getAllByRole('row')
    expect(allRows.length).toBe(11)

    // User 11 must NOT be visible on page 1
    expect(screen.queryByText('Pending User 11')).not.toBeInTheDocument()

    // Click Next
    const nextBtn = screen.getByRole('button', { name: /След/ })
    fireEvent.click(nextBtn)

    // Page 2: Pending User 11 appears
    await screen.findByText('Pending User 11')
    expect(screen.queryByText('Pending User 1')).not.toBeInTheDocument()
  })

  it('search change resets pagination to page 1', async () => {
    // 11 users named "Alpha User N" + 1 named "Beta User"
    const users: PendingUser[] = [
      ...Array.from({ length: 11 }, (_, i) => ({
        id: `alpha_${i + 1}`,
        email: `alpha${i + 1}@example.com`,
        displayName: `Alpha User ${i + 1}`,
        role: null as null,
        status: 'no-role' as const,
        createdAt: '2026-01-15T10:00:00.000Z',
      })),
      {
        id: 'beta_1',
        email: 'beta@example.com',
        displayName: 'Beta User',
        role: null,
        status: 'no-role' as const,
        createdAt: '2026-01-15T10:00:00.000Z',
      },
    ]
    const repo = new InMemoryUserRepository(users)
    renderWithRepo(repo)

    await screen.findByText('Alpha User 1')

    // Navigate to page 2 to see Alpha User 11
    fireEvent.click(screen.getByRole('button', { name: /След/ }))
    await screen.findByText('Alpha User 11')

    // Search for "Beta" — should reset to page 1 and show Beta User
    fireEvent.change(document.getElementById('pending-users-search')!, { target: { value: 'Beta' } })
    expect(await screen.findByText('Beta User')).toBeInTheDocument()
    expect(screen.queryByText('Alpha User 11')).not.toBeInTheDocument()
  })
})
