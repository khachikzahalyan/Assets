import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthProvider } from '@/contexts/AuthContext'
import { Sidebar } from './Sidebar'
import { LanguageToggle } from './LanguageToggle'
import { ProfileMenu } from './ProfileMenu'
import { SearchPalette } from './SearchPalette'
import { Breadcrumbs } from './Breadcrumbs'

// ----------------------------------------------------------------
// Setup — switch to 'ru' once before all tests
// ----------------------------------------------------------------
beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

// Wrapper that provides i18n + AuthProvider for a given role
function Wrapper({
  children,
  initialRole = 'super_admin' as const,
}: {
  children: React.ReactNode
  initialRole?: 'super_admin' | 'asset_admin' | 'tech_admin' | 'employee'
}) {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider initialRole={initialRole}>
        {children}
      </AuthProvider>
    </I18nextProvider>
  )
}

// ----------------------------------------------------------------
// Sidebar — super_admin
// ----------------------------------------------------------------
describe('Sidebar (super_admin)', () => {
  it('renders "Дашборд" nav item', () => {
    render(
      <Wrapper>
        <Sidebar currentRoute="dashboard" onNavigate={() => undefined} />
      </Wrapper>
    )
    expect(screen.getByText('Дашборд')).toBeInTheDocument()
  })

  it('renders a "Скоро" chip for phase routes', () => {
    render(
      <Wrapper>
        <Sidebar currentRoute="dashboard" onNavigate={() => undefined} />
      </Wrapper>
    )
    // Several phase-gated items exist (assignments, repairs, parts, etc.)
    const soonChips = screen.getAllByText('Скоро')
    expect(soonChips.length).toBeGreaterThan(0)
  })
})

// ----------------------------------------------------------------
// Sidebar — employee
// ----------------------------------------------------------------
describe('Sidebar (employee)', () => {
  it('renders "Мои активы" and does NOT render "Дашборд"', () => {
    render(
      <Wrapper initialRole="employee">
        <Sidebar currentRoute="my-assets" onNavigate={() => undefined} />
      </Wrapper>
    )
    expect(screen.getByText('Мои активы')).toBeInTheDocument()
    expect(screen.queryByText('Дашборд')).toBeNull()
  })
})

// ----------------------------------------------------------------
// Sidebar — navigation callback
// ----------------------------------------------------------------
describe('Sidebar navigation', () => {
  it('clicking "Дашборд" calls onNavigate with "dashboard"', () => {
    const onNavigate = vi.fn()
    render(
      <Wrapper>
        <Sidebar currentRoute="assets" onNavigate={onNavigate} />
      </Wrapper>
    )
    fireEvent.click(screen.getByText('Дашборд'))
    expect(onNavigate).toHaveBeenCalledWith('dashboard')
  })
})

// ----------------------------------------------------------------
// LanguageToggle
// ----------------------------------------------------------------
describe('LanguageToggle', () => {
  afterEach(async () => {
    // Reset to 'ru' after each test in this suite
    await act(async () => { await i18n.changeLanguage('ru') })
  })

  it('click trigger opens the dropdown showing all three languages', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageToggle />
      </I18nextProvider>
    )
    const trigger = screen.getByTitle('Язык интерфейса')
    await act(async () => { fireEvent.click(trigger) })
    expect(screen.getByText('Русский')).toBeInTheDocument()
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Հայերեն')).toBeInTheDocument()
  })

  it('clicking English changes i18n language to start with "en"', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <LanguageToggle />
      </I18nextProvider>
    )
    // Open
    const trigger = screen.getByTitle('Язык интерфейса')
    await act(async () => { fireEvent.click(trigger) })
    // Click English
    await act(async () => { fireEvent.click(screen.getByText('English')) })
    await waitFor(() => {
      expect(i18n.language.startsWith('en')).toBe(true)
    })
  })
})

// ----------------------------------------------------------------
// ProfileMenu
// ----------------------------------------------------------------
describe('ProfileMenu', () => {
  it('open menu shows user name "Иван Петров" for super_admin', async () => {
    render(
      <Wrapper initialRole="super_admin">
        <ProfileMenu />
      </Wrapper>
    )
    // Trigger opens the dropdown
    const trigger = screen.getByTitle('Иван Петров')
    fireEvent.click(trigger)
    // User name appears in the dropdown header
    const names = screen.getAllByText('Иван Петров')
    expect(names.length).toBeGreaterThan(0)
  })

  it('DEV role-switcher section renders 4 role rows', () => {
    render(
      <Wrapper initialRole="super_admin">
        <ProfileMenu />
      </Wrapper>
    )
    const trigger = screen.getByTitle('Иван Петров')
    fireEvent.click(trigger)
    // In DEV (vitest env has import.meta.env.DEV = true), the role switcher renders
    // Check all 4 role labels appear somewhere in the menu (multiple elements OK)
    expect(screen.getAllByText('Супер Админ').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Админ активов').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Тех. Админ').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Сотрудник').length).toBeGreaterThan(0)
  })

  it('clicking a role in role-switcher does not throw', () => {
    render(
      <Wrapper initialRole="super_admin">
        <ProfileMenu />
      </Wrapper>
    )
    const trigger = screen.getByTitle('Иван Петров')
    fireEvent.click(trigger)
    // Find "Сотрудник" role button inside the role switcher and click it
    const roleBtns = screen.getAllByRole('button')
    const employeeBtn = roleBtns.find((b) => b.textContent?.includes('Сотрудник') && b.textContent?.includes('СО'))
    expect(employeeBtn).toBeDefined()
    expect(() => fireEvent.click(employeeBtn!)).not.toThrow()
  })
})

// ----------------------------------------------------------------
// SearchPalette
// ----------------------------------------------------------------
describe('SearchPalette', () => {
  it('open=true renders the search input with placeholder', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <SearchPalette open onClose={() => undefined} onPick={() => undefined} />
      </I18nextProvider>
    )
    expect(screen.getByPlaceholderText('Поиск активов, сотрудников, филиалов…')).toBeInTheDocument()
  })

  it('renders at least one mock result when open with empty query', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <SearchPalette open onClose={() => undefined} onPick={() => undefined} />
      </I18nextProvider>
    )
    expect(screen.getByText('MacBook Pro 16" 2024')).toBeInTheDocument()
  })

  it('typing "Mac" filters results to fewer items', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <SearchPalette open onClose={() => undefined} onPick={() => undefined} />
      </I18nextProvider>
    )
    const input = screen.getByPlaceholderText('Поиск активов, сотрудников, филиалов…')
    fireEvent.change(input, { target: { value: 'Mac' } })
    // MacBook matches; Dell does not
    expect(screen.getByText('MacBook Pro 16" 2024')).toBeInTheDocument()
    expect(screen.queryByText('Dell UltraSharp U2723QE')).toBeNull()
  })

  it('Escape key calls onClose', () => {
    const onClose = vi.fn()
    render(
      <I18nextProvider i18n={i18n}>
        <SearchPalette open onClose={onClose} onPick={() => undefined} />
      </I18nextProvider>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('open=false renders nothing', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <SearchPalette open={false} onClose={() => undefined} onPick={() => undefined} />
      </I18nextProvider>
    )
    // createPortal returns null when open=false
    expect(container.firstChild).toBeNull()
  })
})

// ----------------------------------------------------------------
// Breadcrumbs
// ----------------------------------------------------------------
describe('Breadcrumbs', () => {
  it('renders last item with font-semibold text-[#F8FAFC] class', () => {
    const { container } = render(
      <Breadcrumbs items={['AMS', 'Активы']} />
    )
    const spans = container.querySelectorAll('span span')
    // Find the last text span
    const lastSpan = spans[spans.length - 1]
    expect(lastSpan?.className).toContain('font-semibold')
    expect(lastSpan?.className).toContain('text-[#F8FAFC]')
  })

  it('renders a separator between items', () => {
    const { container } = render(
      <Breadcrumbs items={['AMS', 'Активы', 'Деталь']} />
    )
    // Chevron-right SVGs appear as separators
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(2)
  })
})
