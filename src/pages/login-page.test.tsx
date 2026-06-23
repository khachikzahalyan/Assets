import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'

// ── Mock @/lib/auth ────────────────────────────────────────────────
// Using ReturnType<typeof vi.fn> to preserve mock methods while typing is loose
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseMock = ReturnType<typeof vi.fn<any>>
const mockCompleteEmailLinkIfPresent = vi.fn(async (_prompt?: string) => false) as LooseMock
const mockSendEmployeeLink = vi.fn(async (_email: string) => undefined) as LooseMock
const mockSignInWithGoogle = vi.fn(async () => undefined) as LooseMock

vi.mock('@/lib/auth', () => ({
  completeEmailLinkIfPresent: (prompt?: string) => mockCompleteEmailLinkIfPresent(prompt),
  sendEmployeeLink: (email: string) => mockSendEmployeeLink(email),
  signInWithGoogle: () => mockSignInWithGoogle(),
  signOutUser: vi.fn(),
  subscribeToAuthState: vi.fn(() => () => {}),
  fetchUserRole: vi.fn(async () => null),
  claimPendingUser: vi.fn(async () => undefined),
}))

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
  mockCompleteEmailLinkIfPresent.mockReset()
  mockSendEmployeeLink.mockReset()
  mockSignInWithGoogle.mockReset()
  // Default: resolve without triggering auth state changes
  mockCompleteEmailLinkIfPresent.mockResolvedValue(false)
  mockSendEmployeeLink.mockResolvedValue(undefined)
  mockSignInWithGoogle.mockResolvedValue(undefined)
})

describe('LoginPage', () => {
  it('renders the Google sign-in button', () => {
    renderLoginPage()
    expect(screen.getByText('Войти через Google')).toBeInTheDocument()
  })

  it('renders the email input', () => {
    renderLoginPage()
    expect(screen.getByPlaceholderText('Введите ваш email')).toBeInTheDocument()
  })

  it('renders the "Получить ссылку" button', () => {
    renderLoginPage()
    expect(screen.getByText('Получить ссылку для входа')).toBeInTheDocument()
  })

  it('calls completeEmailLinkIfPresent on mount', async () => {
    renderLoginPage()
    await waitFor(() => {
      expect(mockCompleteEmailLinkIfPresent).toHaveBeenCalledTimes(1)
    })
  })

  it('completeEmailLinkIfPresent is called with the translated prompt string', async () => {
    renderLoginPage()
    await waitFor(() => {
      expect(mockCompleteEmailLinkIfPresent).toHaveBeenCalledWith(
        'Введите email, на который была отправлена ссылка для входа',
      )
    })
  })

  it('entering a valid email and clicking the link button calls sendEmployeeLink', async () => {
    mockSendEmployeeLink.mockResolvedValueOnce(undefined)
    renderLoginPage()

    const emailInput = screen.getByPlaceholderText('Введите ваш email')
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })

    const linkBtn = screen.getByText('Получить ссылку для входа')
    await act(async () => { fireEvent.click(linkBtn) })

    await waitFor(() => {
      expect(mockSendEmployeeLink).toHaveBeenCalledWith('test@example.com')
    })
  })

  it('shows the confirmation message after successful link send', async () => {
    mockSendEmployeeLink.mockResolvedValueOnce(undefined)
    renderLoginPage()

    const emailInput = screen.getByPlaceholderText('Введите ваш email')
    fireEvent.change(emailInput, { target: { value: 'worker@company.org' } })

    const linkBtn = screen.getByText('Получить ссылку для входа')
    await act(async () => { fireEvent.click(linkBtn) })

    await waitFor(() => {
      expect(screen.getByText('Проверьте почту')).toBeInTheDocument()
    })
    // Confirmation text contains the email
    expect(screen.getByText(/worker@company\.org/)).toBeInTheDocument()
  })

  it('shows an inline error when email is empty and link button is clicked', async () => {
    renderLoginPage()
    const linkBtn = screen.getByText('Получить ссылку для входа')
    await act(async () => { fireEvent.click(linkBtn) })
    expect(screen.getByText('Введите корректный email')).toBeInTheDocument()
    expect(mockSendEmployeeLink).not.toHaveBeenCalled()
  })

  it('shows an inline error when email is invalid format', async () => {
    renderLoginPage()
    const emailInput = screen.getByPlaceholderText('Введите ваш email')
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } })
    const linkBtn = screen.getByText('Получить ссылку для входа')
    await act(async () => { fireEvent.click(linkBtn) })
    expect(screen.getByText('Введите корректный email')).toBeInTheDocument()
    expect(mockSendEmployeeLink).not.toHaveBeenCalled()
  })

  it('shows an error banner when sendEmployeeLink throws', async () => {
    mockSendEmployeeLink.mockRejectedValueOnce(new Error('network error'))
    renderLoginPage()

    const emailInput = screen.getByPlaceholderText('Введите ваш email')
    fireEvent.change(emailInput, { target: { value: 'fail@test.com' } })

    const linkBtn = screen.getByText('Получить ссылку для входа')
    await act(async () => { fireEvent.click(linkBtn) })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('calls signInWithGoogle when the Google button is clicked', async () => {
    mockSignInWithGoogle.mockResolvedValueOnce(undefined)
    renderLoginPage()
    const googleBtn = screen.getByText('Войти через Google')
    await act(async () => { fireEvent.click(googleBtn) })
    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1)
    })
  })

  it('shows error banner when signInWithGoogle throws', async () => {
    mockSignInWithGoogle.mockRejectedValueOnce(new Error('popup closed'))
    renderLoginPage()
    const googleBtn = screen.getByText('Войти через Google')
    await act(async () => { fireEvent.click(googleBtn) })
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows an email link error banner when completeEmailLinkIfPresent throws', async () => {
    mockCompleteEmailLinkIfPresent.mockRejectedValueOnce(new Error('bad link'))
    renderLoginPage()
    await waitFor(() => {
      expect(
        screen.getByText('Ссылка недействительна или устарела. Запросите новую.'),
      ).toBeInTheDocument()
    })
  })
})
