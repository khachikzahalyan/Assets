import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'

// ── Mock @/lib/auth ────────────────────────────────────────────────
// Using ReturnType<typeof vi.fn> to preserve mock methods while typing is loose
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseMock = ReturnType<typeof vi.fn<any>>
const mockSignInWithGoogle = vi.fn(async () => undefined) as LooseMock
const mockSignInWithUsernamePassword = vi.fn(async (_login: string, _password: string, _remember?: boolean) => undefined) as LooseMock

vi.mock('@/lib/auth', async (importOriginal) => {
  // Keep mapGoogleSignInError / mapPasswordSignInError real so the mapping logic
  // is actually exercised.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = await importOriginal<any>()
  return {
    ...actual,
    signInWithGoogle: () => mockSignInWithGoogle(),
    signInWithUsernamePassword: (login: string, password: string, remember?: boolean) =>
      mockSignInWithUsernamePassword(login, password, remember),
    signOutUser: vi.fn(),
    subscribeToAuthState: vi.fn(() => () => {}),
    fetchUserRole: vi.fn(async () => null),
    fetchUserProfile: vi.fn(async () => ({ role: null, employeeId: null })),
    claimPendingUser: vi.fn(async () => undefined),
  }
})

// ── Mock @/lib/firebase (AuthContext transitive dep) ───────────────
vi.mock('@/lib/firebase', () => ({
  app: () => ({}),
  auth: () => ({}),
  db: () => ({}),
  storage: () => ({}),
  functions: () => ({}),
}))

import { LoginPage } from './LoginPage'
import { AuthContext, type AuthContextValue } from '@/contexts/AuthContext'

// LoginPage reads useAuth().status to redirect away once authenticated. These
// tests exercise the signed-out form, so provide a 'signed-out' context directly
// (the real AuthProvider's mock path is always 'ready', which would redirect).
const signedOutAuth: AuthContextValue = {
  user: { id: 'u', name: 'Test', email: 't@example.com', role: 'employee', initials: 'T', avatarColor: 'bg-slate-600' },
  role: 'employee',
  status: 'signed-out',
  setRole: () => {},
  signOut: () => {},
}

function renderLoginPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={signedOutAuth}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )
}

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

beforeEach(() => {
  mockSignInWithGoogle.mockReset()
  mockSignInWithUsernamePassword.mockReset()
  mockSignInWithGoogle.mockResolvedValue(undefined)
  mockSignInWithUsernamePassword.mockResolvedValue(undefined)
})

describe('LoginPage', () => {
  it('renders the Google sign-in button', () => {
    renderLoginPage()
    expect(screen.getByText('Войти через Google')).toBeInTheDocument()
  })

  it('renders the login and password inputs', () => {
    renderLoginPage()
    expect(screen.getByPlaceholderText('Введите логин')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Введите пароль')).toBeInTheDocument()
  })

  it('renders the "Войти" submit button', () => {
    renderLoginPage()
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument()
  })

  // ── Login + password sign-in ──────────────────────────────────────────────

  it('entering login+password and submitting calls signInWithUsernamePassword', async () => {
    renderLoginPage()
    fireEvent.change(screen.getByPlaceholderText('Введите логин'), { target: { value: 'superadmin' } })
    fireEvent.change(screen.getByPlaceholderText('Введите пароль'), { target: { value: 'ams123' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Войти' })) })
    await waitFor(() => {
      expect(mockSignInWithUsernamePassword).toHaveBeenCalledWith('superadmin', 'ams123', true)
    })
  })

  it('renders the remember-me checkbox', () => {
    renderLoginPage()
    expect(screen.getByText('Запомнить меня')).toBeInTheDocument()
  })

  it('passes remember=false to sign-in when "remember me" is unchecked', async () => {
    renderLoginPage()
    fireEvent.change(screen.getByPlaceholderText('Введите логин'), { target: { value: 'superadmin' } })
    fireEvent.change(screen.getByPlaceholderText('Введите пароль'), { target: { value: 'ams123' } })
    fireEvent.click(screen.getByRole('checkbox'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Войти' })) })
    await waitFor(() => {
      expect(mockSignInWithUsernamePassword).toHaveBeenCalledWith('superadmin', 'ams123', false)
    })
  })


  it('shows an inline error and does not sign in when fields are empty', async () => {
    renderLoginPage()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Войти' })) })
    expect(screen.getByText('Введите логин и пароль')).toBeInTheDocument()
    expect(mockSignInWithUsernamePassword).not.toHaveBeenCalled()
  })

  it('shows the invalid-credentials message when sign-in rejects with auth/invalid-credential', async () => {
    const err = Object.assign(new Error('bad'), { code: 'auth/invalid-credential' })
    mockSignInWithUsernamePassword.mockRejectedValueOnce(err)
    renderLoginPage()
    fireEvent.change(screen.getByPlaceholderText('Введите логин'), { target: { value: 'superadmin' } })
    fireEvent.change(screen.getByPlaceholderText('Введите пароль'), { target: { value: 'wrong' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Войти' })) })
    await waitFor(() => {
      expect(screen.getByText('Неверный логин или пароль')).toBeInTheDocument()
    })
  })

  it('shows the provider-off message when sign-in rejects with auth/operation-not-allowed', async () => {
    const err = Object.assign(new Error('off'), { code: 'auth/operation-not-allowed' })
    mockSignInWithUsernamePassword.mockRejectedValueOnce(err)
    renderLoginPage()
    fireEvent.change(screen.getByPlaceholderText('Введите логин'), { target: { value: 'superadmin' } })
    fireEvent.change(screen.getByPlaceholderText('Введите пароль'), { target: { value: 'ams123' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Войти' })) })
    await waitFor(() => {
      expect(
        screen.getByText('Вход по паролю недоступен. Обратитесь к администратору системы.'),
      ).toBeInTheDocument()
    })
  })

  // ── Password reveal toggle ────────────────────────────────────────────────

  it('toggles the password field between hidden and visible', () => {
    renderLoginPage()
    const pw = screen.getByPlaceholderText('Введите пароль') as HTMLInputElement
    expect(pw.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Показать пароль' }))
    expect(pw.type).toBe('text')
    fireEvent.click(screen.getByRole('button', { name: 'Скрыть пароль' }))
    expect(pw.type).toBe('password')
  })

  // ── Google sign-in ────────────────────────────────────────────────────────

  it('calls signInWithGoogle when the Google button is clicked', async () => {
    renderLoginPage()
    await act(async () => { fireEvent.click(screen.getByText('Войти через Google')) })
    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1)
    })
  })

  it('shows error banner when signInWithGoogle throws', async () => {
    mockSignInWithGoogle.mockRejectedValueOnce(new Error('popup closed'))
    renderLoginPage()
    await act(async () => { fireEvent.click(screen.getByText('Войти через Google')) })
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(1)
    })
  })

  // ── Differentiated Google error messages (mapGoogleSignInError is real) ──

  it('shows unauthorizedDomain message when signInWithGoogle rejects with auth/unauthorized-domain', async () => {
    const err = Object.assign(new Error('unauthorized'), { code: 'auth/unauthorized-domain' })
    mockSignInWithGoogle.mockRejectedValueOnce(err)
    renderLoginPage()
    await act(async () => { fireEvent.click(screen.getByText('Войти через Google')) })
    await waitFor(() => {
      expect(
        screen.getByText('Адрес этого приложения не авторизован для входа. Обратитесь к администратору системы.'),
      ).toBeInTheDocument()
    })
  })

  it('shows popupClosed message when signInWithGoogle rejects with auth/popup-closed-by-user', async () => {
    const err = Object.assign(new Error('popup closed'), { code: 'auth/popup-closed-by-user' })
    mockSignInWithGoogle.mockRejectedValueOnce(err)
    renderLoginPage()
    await act(async () => { fireEvent.click(screen.getByText('Войти через Google')) })
    await waitFor(() => {
      expect(
        screen.getByText('Окно входа было закрыто. Попробуйте ещё раз.'),
      ).toBeInTheDocument()
    })
  })

  it('shows generic googleFailed message when signInWithGoogle rejects with a plain Error', async () => {
    mockSignInWithGoogle.mockRejectedValueOnce(new Error('something unexpected'))
    renderLoginPage()
    await act(async () => { fireEvent.click(screen.getByText('Войти через Google')) })
    await waitFor(() => {
      expect(
        screen.getByText('Не удалось войти через Google. Попробуйте ещё раз.'),
      ).toBeInTheDocument()
    })
  })
})
