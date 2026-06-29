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
    // "Дашборд" appears in the sidebar nav item, BottomNav, and the page header
    const items = screen.getAllByText('Дашборд')
    expect(items.length).toBeGreaterThanOrEqual(1)
  })

  it('sidebar no longer shows the removed stub/statuses nav items', () => {
    render(<TestHarness initialEntries={['/dashboard']} />)
    // Removed items must not render
    expect(screen.queryByRole('button', { name: /Ремонты/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Выдачи/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Статусы/i })).toBeNull()
    // "Активы" now appears in BOTH Sidebar (desktop) and BottomNav (mobile):
    // use getAllByRole to avoid "multiple elements found" throw.
    const assetsButtons = screen.getAllByRole('button', { name: /Активы/i })
    expect(assetsButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('no hamburger / mobile drawer is present', () => {
    render(<TestHarness initialEntries={['/dashboard']} />)
    // Burger button removed — class was "ams-hamburger"
    expect(document.querySelector('.ams-hamburger')).toBeNull()
    // Drawer overlay removed
    expect(document.querySelector('.sidebar-overlay')).toBeNull()
  })

  it('BottomNav renders primary items for super_admin (e.g. Активы button in nav landmark)', () => {
    render(<TestHarness initialEntries={['/dashboard']} />)
    // The BottomNav renders a <nav> landmark.  Within it, find the Активы button.
    const navEl = document.querySelector('nav')
    expect(navEl).not.toBeNull()
    const assetsBtn = Array.from(navEl!.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Активы'),
    )
    expect(assetsBtn).toBeDefined()
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
