/**
 * BottomNav unit tests.
 *
 * Verifies:
 *  - super_admin sees exactly 5 primary items (dashboard/assets/employees/scan/settings)
 *  - employee sees exactly 3 self-service items (my-assets/my-acts/profile)
 *  - active item carries aria-current="page" and the accent CSS class
 *  - clicking an item calls onNavigate with the correct route id
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'
import type { Role } from '@/config'
import { BottomNav } from './BottomNav'
import i18n from '@/lib/i18n'

// ── helpers ────────────────────────────────────────────────────────────────

function makeCtx(role: Role): AuthContextValue {
  return {
    user: {
      id: 'u_test',
      name: 'Test User',
      email: 'test@example.com',
      role,
      initials: 'TU',
      avatarColor: 'bg-accent',
    },
    role,
    status: 'ready',
    setRole: vi.fn(),
    signOut: vi.fn(),
  }
}

function renderBottomNav(
  role: Role,
  currentRoute = 'dashboard',
  onNavigate = vi.fn(),
) {
  return render(
    <AuthContext.Provider value={makeCtx(role)}>
      <BottomNav currentRoute={currentRoute} onNavigate={onNavigate} />
    </AuthContext.Provider>,
  )
}

// ── setup ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

// ── tests ──────────────────────────────────────────────────────────────────

describe('BottomNav — super_admin', () => {
  it('renders exactly 5 primary items', () => {
    renderBottomNav('super_admin', 'dashboard')
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(5)
  })

  it('shows the curated set: Дашборд, Активы, Сотрудники, Сканировать, Настройки', () => {
    renderBottomNav('super_admin', 'dashboard')
    expect(screen.getByText('Дашборд')).toBeInTheDocument()
    expect(screen.getByText('Активы')).toBeInTheDocument()
    expect(screen.getByText('Сотрудники')).toBeInTheDocument()
    expect(screen.getByText('Сканировать')).toBeInTheDocument()
    expect(screen.getByText('Настройки')).toBeInTheDocument()
  })

  it('does NOT show items outside the curated 5 (e.g. Лицензии, Филиалы)', () => {
    renderBottomNav('super_admin', 'dashboard')
    expect(screen.queryByText('Лицензии')).not.toBeInTheDocument()
    expect(screen.queryByText('Филиалы')).not.toBeInTheDocument()
  })
})

describe('BottomNav — employee', () => {
  it('renders exactly 3 self-service items', () => {
    renderBottomNav('employee', 'my-assets')
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
  })

  it('shows: Мои активы, Мои акты, Профиль', () => {
    renderBottomNav('employee', 'my-assets')
    expect(screen.getByText('Мои активы')).toBeInTheDocument()
    expect(screen.getByText('Мои акты')).toBeInTheDocument()
    expect(screen.getByText('Профиль')).toBeInTheDocument()
  })

  it('does NOT show admin-only items', () => {
    renderBottomNav('employee', 'my-assets')
    expect(screen.queryByText('Дашборд')).not.toBeInTheDocument()
    expect(screen.queryByText('Активы')).not.toBeInTheDocument()
  })
})

describe('BottomNav — active state', () => {
  it('active item has aria-current="page"', () => {
    renderBottomNav('super_admin', 'assets')
    const activeBtn = screen.getByText('Активы').closest('button')
    expect(activeBtn).toHaveAttribute('aria-current', 'page')
  })

  it('inactive items do NOT have aria-current', () => {
    renderBottomNav('super_admin', 'assets')
    const inactiveBtn = screen.getByText('Дашборд').closest('button')
    expect(inactiveBtn).not.toHaveAttribute('aria-current')
  })

  it('active item button contains the accent class', () => {
    renderBottomNav('super_admin', 'assets')
    const activeBtn = screen.getByText('Активы').closest('button')
    expect(activeBtn?.className).toContain('text-accent')
  })

  it('inactive item button does not contain the accent class', () => {
    renderBottomNav('super_admin', 'assets')
    const inactiveBtn = screen.getByText('Дашборд').closest('button')
    expect(inactiveBtn?.className).not.toContain('text-accent')
  })
})

describe('BottomNav — navigation', () => {
  it('clicking an item calls onNavigate with the route id', () => {
    const onNavigate = vi.fn()
    renderBottomNav('super_admin', 'dashboard', onNavigate)
    fireEvent.click(screen.getByText('Активы'))
    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(onNavigate).toHaveBeenCalledWith('assets')
  })

  it('clicking the active item still calls onNavigate', () => {
    const onNavigate = vi.fn()
    renderBottomNav('super_admin', 'assets', onNavigate)
    fireEvent.click(screen.getByText('Активы'))
    expect(onNavigate).toHaveBeenCalledWith('assets')
  })

  it('clicking Настройки calls onNavigate with "settings"', () => {
    const onNavigate = vi.fn()
    renderBottomNav('super_admin', 'dashboard', onNavigate)
    fireEvent.click(screen.getByText('Настройки'))
    expect(onNavigate).toHaveBeenCalledWith('settings')
  })
})

describe('BottomNav — tech_admin', () => {
  it('sees dashboard, assets, scan, licenses, parts (no employees or settings)', () => {
    renderBottomNav('tech_admin', 'dashboard')
    expect(screen.getByText('Дашборд')).toBeInTheDocument()
    expect(screen.getByText('Активы')).toBeInTheDocument()
    expect(screen.getByText('Сканировать')).toBeInTheDocument()
    expect(screen.getByText('Лицензии')).toBeInTheDocument()
    expect(screen.getByText('Запчасти')).toBeInTheDocument()
    expect(screen.queryByText('Сотрудники')).not.toBeInTheDocument()
    expect(screen.queryByText('Настройки')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })
})
