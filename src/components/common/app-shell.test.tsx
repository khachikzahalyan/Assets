/**
 * AppShell integration tests.
 * Uses a MemoryRouter harness (instead of BrowserRouter) so we can control
 * the initial entry and assert navigation outcomes predictably in jsdom.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthProvider } from '@/contexts/AuthContext'
import { AppShell } from './AppShell'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { StubPage } from '@/pages/StubPage'
import { PHASE_STUB_ROUTES } from '@/config'

// Mock Firebase so the module can be imported in jsdom
vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

function ShellLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

interface HarnessProps {
  initialEntries?: string[]
}

function TestHarness({ initialEntries = ['/dashboard'] }: HarnessProps) {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider initialRole="super_admin">
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route element={<ShellLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              {PHASE_STUB_ROUTES.map((id) => (
                <Route key={id} path={`/${id}`} element={<StubPage routeId={id} />} />
              ))}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </I18nextProvider>
  )
}

describe('AppShell', () => {
  it('default route renders Dashboard page', () => {
    render(<TestHarness initialEntries={['/dashboard']} />)
    // "Дашборд" appears in both the sidebar nav item and the page header
    const items = screen.getAllByText('Дашборд')
    expect(items.length).toBeGreaterThanOrEqual(1)
  })

  it('clicking a sidebar nav item navigates to the stub page', () => {
    render(<TestHarness initialEntries={['/dashboard']} />)
    // Find the "Ремонты" button in the sidebar — 'repairs' is still a PHASE_STUB_ROUTE
    const repairsBtn = screen.getByRole('button', { name: /Ремонты/i })
    fireEvent.click(repairsBtn)
    // StubPage for repairs renders its route-specific description (unique to the page body)
    expect(
      screen.getByText('Учёт ремонтов и обслуживания: заявки, статусы и история по активам.'),
    ).toBeInTheDocument()
  })

  it('Cmd+K opens the SearchPalette', () => {
    render(<TestHarness initialEntries={['/dashboard']} />)
    // SearchPalette is closed initially — placeholder not present
    expect(screen.queryByPlaceholderText('Поиск активов, сотрудников, филиалов…')).toBeNull()
    // Fire Cmd+K
    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    // The search input should now appear
    expect(screen.getByPlaceholderText('Поиск активов, сотрудников, филиалов…')).toBeInTheDocument()
  })
})
