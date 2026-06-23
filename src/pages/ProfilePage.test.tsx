import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { ProfilePage } from './ProfilePage'
import { InMemoryEmployeeRepository } from '@/infra/repositories'
import type { Employee } from '@/domain/employee'
import type { RefRow } from '@/domain/asset'

function ctx() {
  return { user: { id: 'uid_1', name: 'Иван', email: 'i@x.com', role: 'employee' as const, initials: 'И', avatarColor: '' },
    role: 'employee' as const, status: 'ready' as const, setRole: () => {}, signOut: () => {} }
}
const noRefData = async () => ({ branches: [] as RefRow[], departments: [] as RefRow[] })

const withRefData = async () => ({
  branches: [{ id: 'br_main', name: 'Головной офис' }] as RefRow[],
  departments: [{ id: 'dp_it', name: 'IT отдел' }] as RefRow[],
})

function render_(emps: Employee[], refData = noRefData) {
  render(<I18nextProvider i18n={i18n}><AuthContext.Provider value={ctx()}>
    <ProfilePage repository={new InMemoryEmployeeRepository(emps)} loadRefData={refData} />
  </AuthContext.Provider></I18nextProvider>)
}
describe('ProfilePage', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })
  it('shows the no-profile state when no doc exists', async () => {
    render_([])
    expect(await screen.findByText(/профиль ещё не заполнен/i)).toBeInTheDocument()
  })
  it('shows the profile when a doc exists', async () => {
    render_([{ id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', phone: null, position: null,
      branchId: null, departmentId: null, status: 'active', terminatedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }])
    expect(await screen.findByText('Иван Петров')).toBeInTheDocument()
  })
  it('resolves branch and department names via loadRefData', async () => {
    render_(
      [{ id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', phone: null, position: null,
        branchId: 'br_main', departmentId: 'dp_it', status: 'active', terminatedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
      withRefData,
    )
    expect(await screen.findByText('Головной офис')).toBeInTheDocument()
    expect(screen.getByText('IT отдел')).toBeInTheDocument()
  })
})
