import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { RolesPage } from './RolesPage'
import { InMemoryUserRepository } from '@/infra/repositories'
import type { User } from '@/domain/user'

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
      async listUsers() { return [] }
      async assignRole() {
        return {
          value: { id: 'aa1', email: 'aa1@x.io', displayName: 'Asset Admin', role: 'tech_admin', status: 'active', createdAt: null },
          auditId: 'a_1',
        }
      }
    },
  }
})

function authCtx() {
  return {
    user: { id: 'su1', name: 'Super One', email: 'su1@x.io', role: 'super_admin' as const, initials: 'SO', avatarColor: '' },
    role: 'super_admin' as const,
    status: 'ready' as const,
    setRole: () => {},
    signOut: () => {},
  }
}

function makeRepo() {
  const users: User[] = [
    { id: 'su1', email: 'su1@x.io', displayName: 'Super One', role: 'super_admin', status: 'active', createdAt: '2026-01-03T00:00:00.000Z' },
    { id: 'aa1', email: 'aa1@x.io', displayName: 'Asset Admin', role: 'asset_admin', status: 'active', createdAt: '2026-01-02T00:00:00.000Z' },
    { id: 'np1', email: 'np1@x.io', displayName: 'No Role', role: null, status: 'no-role', createdAt: '2026-01-04T00:00:00.000Z' },
  ]
  return new InMemoryUserRepository(users)
}

function renderPage(repo = makeRepo()) {
  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={authCtx()}>
        <MemoryRouter>
          <RolesPage repository={repo} />
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )
  return repo
}

describe('RolesPage', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })

  it('renders the roster after load', async () => {
    renderPage()
    expect(await screen.findByText('Super One')).toBeInTheDocument()
    expect(screen.getByText('Asset Admin')).toBeInTheDocument()
    expect(screen.getByText('No Role')).toBeInTheDocument()
  })

  it('marks the current user row as "you"', async () => {
    renderPage()
    await screen.findByText('Super One')
    expect(screen.getByText('Это вы')).toBeInTheDocument()
  })

  it('filters by search', async () => {
    renderPage()
    await screen.findByText('Super One')
    fireEvent.change(screen.getByPlaceholderText('Поиск по имени или эл. почте'), { target: { value: 'asset' } })
    expect(screen.getByText('Asset Admin')).toBeInTheDocument()
    expect(screen.queryByText('Super One')).not.toBeInTheDocument()
  })

  it('blocks self-demotion with the guard message', async () => {
    renderPage()
    await screen.findByText('Super One')
    // open the dialog on the current user's own row
    const row = screen.getByText('Super One').closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: /Изменить роль/ }))
    // pick asset_admin then confirm
    fireEvent.change(await screen.findByLabelText('Новая роль'), { target: { value: 'asset_admin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))
    expect(await screen.findByText('Нельзя снять с себя роль Супер Админа')).toBeInTheDocument()
  })

  it('changes a non-super role successfully', async () => {
    const repo = makeRepo()
    const spy = vi.spyOn(repo, 'assignRole')
    renderPage(repo)
    await screen.findByText('Asset Admin')
    const row = screen.getByText('Asset Admin').closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: /Изменить роль/ }))
    fireEvent.change(await screen.findByLabelText('Новая роль'), { target: { value: 'tech_admin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }))
    await waitFor(() => expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'aa1', role: 'tech_admin' }),
      expect.objectContaining({ uid: 'su1', role: 'super_admin' }),
    ))
  })
})
