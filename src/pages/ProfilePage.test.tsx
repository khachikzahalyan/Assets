import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { ProfilePage } from './ProfilePage'
import { InMemoryEmployeeRepository } from '@/infra/repositories'
import type { Employee } from '@/domain/employee'

function ctx() {
  return { user: { id: 'uid_1', name: 'Иван', email: 'i@x.com', role: 'employee' as const, initials: 'И', avatarColor: '' },
    role: 'employee' as const, status: 'ready' as const, setRole: () => {}, signOut: () => {} }
}
function render_(emps: Employee[]) {
  render(<I18nextProvider i18n={i18n}><AuthContext.Provider value={ctx()}>
    <ProfilePage repository={new InMemoryEmployeeRepository(emps)} />
  </AuthContext.Provider></I18nextProvider>)
}
describe('ProfilePage', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })
  it('shows the no-profile state when no doc exists', async () => {
    render_([])
    expect(await screen.findByText(/профиль ещё не заполнен/i)).toBeInTheDocument()
  })
  it('shows the profile when a doc exists', async () => {
    render_([{ id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', position: null,
      branchId: null, departmentId: null, status: 'active', terminatedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }])
    expect(await screen.findByText('Иван Петров')).toBeInTheDocument()
  })
})
