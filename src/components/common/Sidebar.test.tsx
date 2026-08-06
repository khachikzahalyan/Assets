/**
 * Sidebar — structural and role-gate tests.
 *
 * Verifies:
 * 1. Group labels render for admin roles.
 * 2. Items are role-filtered correctly (super_admin sees everything;
 *    tech_admin is hidden from org/catalog items; employee sees only
 *    their own items and no group label).
 * 3. Active item gets aria-current="page".
 * 4. Per-group accent CSS custom properties are applied on the item element.
 * 5. Groups with no visible items (after role filter) are not rendered.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthProvider } from '@/contexts/AuthContext'
import { Sidebar } from './Sidebar'
import type { Role } from '@/config/roles'

// Mock Firebase so modules can be imported in jsdom
vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

// Mock the Icon component — we only care about the chip container, not the SVG
vi.mock('@/components/ui/icon', () => ({
  Icon: ({ name }: { name: string }) => <span data-icon={name} />,
}))

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

function renderSidebar(role: Role, currentRoute = 'dashboard', onNavigate = vi.fn()) {
  render(
    <I18nextProvider i18n={i18n}>
      <AuthProvider initialRole={role}>
        <Sidebar currentRoute={currentRoute} onNavigate={onNavigate} />
      </AuthProvider>
    </I18nextProvider>,
  )
}

// ── Group labels ────────────────────────────────────────────────────────────

describe('Sidebar — group labels', () => {
  it('renders all 5 group labels for super_admin', () => {
    renderSidebar('super_admin')
    expect(screen.getByText('Главное')).toBeInTheDocument()
    expect(screen.getByText('Активы и операции')).toBeInTheDocument()
    expect(screen.getByText('Организация')).toBeInTheDocument()
    expect(screen.getByText('Справочники')).toBeInTheDocument()
    expect(screen.getByText('Система')).toBeInTheDocument()
  })

  it('does NOT render group labels for employee', () => {
    renderSidebar('employee')
    expect(screen.queryByText('Главное')).not.toBeInTheDocument()
    expect(screen.queryByText('Активы и операции')).not.toBeInTheDocument()
  })
})

// ── Role filtering ──────────────────────────────────────────────────────────

describe('Sidebar — role filtering', () => {
  it('super_admin sees Категории and Роли и доступ', () => {
    renderSidebar('super_admin')
    expect(screen.getByRole('button', { name: /Категории/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Роли и доступ/i })).toBeInTheDocument()
  })

  it('tech_admin does NOT see Сотрудники or Категории', () => {
    renderSidebar('tech_admin')
    expect(screen.queryByRole('button', { name: /Сотрудники/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Категории/i })).not.toBeInTheDocument()
  })

  it('tech_admin does NOT see Справочники or Организация group labels (all items filtered)', () => {
    renderSidebar('tech_admin')
    expect(screen.queryByText('Справочники')).not.toBeInTheDocument()
    // Org group: employees+branches+departments all require asset_admin or super_admin
    expect(screen.queryByText('Организация')).not.toBeInTheDocument()
  })

  it('employee sees Мои активы but NOT Дашборд', () => {
    renderSidebar('employee')
    expect(screen.getByRole('button', { name: /Мои активы/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Дашборд/i })).not.toBeInTheDocument()
  })
})

// ── Active state ────────────────────────────────────────────────────────────

describe('Sidebar — active item', () => {
  it('marks the current route button with aria-current="page"', () => {
    renderSidebar('super_admin', 'assets')
    const btn = screen.getByRole('button', { name: /^Активы$/ })
    expect(btn).toHaveAttribute('aria-current', 'page')
  })

  it('does NOT mark other buttons with aria-current', () => {
    renderSidebar('super_admin', 'assets')
    const dashBtn = screen.getByRole('button', { name: /Дашборд/i })
    expect(dashBtn).not.toHaveAttribute('aria-current')
  })
})

// ── Per-group accent CSS custom properties ──────────────────────────────────

describe('Sidebar — accent custom properties on items', () => {
  it('applies --nav-accent on the Dashboard button (main group, warm orange)', () => {
    renderSidebar('super_admin', 'employees')
    const dashBtn = screen.getByRole('button', { name: /Дашборд/i })
    // main group accent = brand orange (owner: single-accent nav)
    expect(dashBtn.style.getPropertyValue('--nav-accent')).toBe('#F97316')
  })

  it('ops-group item carries the same brand accent (single-accent nav)', () => {
    renderSidebar('super_admin', 'dashboard')
    const assetsBtn = screen.getByRole('button', { name: /^Активы$/i })
    // Owner decision 2026-08-06: every group uses the brand orange.
    expect(assetsBtn.style.getPropertyValue('--nav-accent')).toBe('#F97316')
  })

  it('active item has non-transparent --nav-accent-bg', () => {
    renderSidebar('super_admin', 'dashboard')
    const dashBtn = screen.getByRole('button', { name: /Дашборд/i })
    const bg = dashBtn.style.getPropertyValue('--nav-accent-bg')
    expect(bg).not.toBe('transparent')
    expect(bg).toMatch(/^rgba/)
  })

  it('inactive item has transparent --nav-accent-bg', () => {
    renderSidebar('super_admin', 'assets')
    const dashBtn = screen.getByRole('button', { name: /Дашборд/i })
    expect(dashBtn.style.getPropertyValue('--nav-accent-bg')).toBe('transparent')
  })
})

// ── Navigation callback ─────────────────────────────────────────────────────

describe('Sidebar — navigation callback', () => {
  it('calls onNavigate with the route id when a button is clicked', async () => {
    const onNavigate = vi.fn()
    renderSidebar('super_admin', 'dashboard', onNavigate)
    // Use exact name to avoid matching "Мои активы" for "Активы"
    await userEvent.click(screen.getByRole('button', { name: /^Активы$/ }))
    expect(onNavigate).toHaveBeenCalledWith('assets')
  })
})

// ── Icon chip presence ──────────────────────────────────────────────────────

describe('Sidebar — icon chip', () => {
  it('renders a .sidebar-item-icon-chip span inside each nav button', () => {
    renderSidebar('super_admin', 'dashboard')
    const dashBtn = screen.getByRole('button', { name: /Дашборд/i })
    const chip = dashBtn.querySelector('.sidebar-item-icon-chip')
    expect(chip).not.toBeNull()
    // Chip should contain the mocked icon span (data-icon attribute)
    expect(chip!.querySelector('[data-icon]')).not.toBeNull()
  })
})
