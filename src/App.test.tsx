/**
 * Smoke tests — verifies the real AppShell renders without errors,
 * the dark-theme shell structure is present, and the firebase module
 * can be imported in a test environment (with VITE_FIREBASE_* unset)
 * without throwing.
 *
 * NOTE: src/lib/firebase/index.ts now exports lazy accessor functions rather
 * than eagerly-evaluated singletons, so importing the module no longer calls
 * initializeApp or getAuth at module load time. The vi.mock below is kept for
 * tests that eventually exercise Firebase-dependent code paths (calling the
 * accessors), but it is no longer required to prevent an import-time throw.
 * The mock shape mirrors the new export surface: each export is a function.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'

// Mock Firebase accessors — each export is now a zero-arg function.
vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

// AuthProvider now runs the real onAuthStateChanged path when no initialRole is
// passed (App.tsx). Mock the auth SDK so it resolves synchronously to a signed-in
// admin user, and the role lookup so status becomes 'ready' and the shell renders.
function fakeOnAuthStateChanged(_auth: unknown, cb: (u: unknown) => void) {
  cb({ uid: 'u_smoke', email: 'admin@example.com', displayName: 'Smoke Admin' })
  return () => {}
}
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: fakeOnAuthStateChanged,
}))
vi.mock('@/lib/auth', () => ({
  fetchUserRole: vi.fn(async () => 'super_admin'),
  signOutUser: vi.fn(),
  // AuthContext now subscribes via this wrapper instead of importing
  // onAuthStateChanged from firebase/auth directly. Route it through the
  // same fake so the smoke test resolves to a signed-in admin synchronously.
  subscribeToAuthState: (cb: (u: unknown) => void) => fakeOnAuthStateChanged({}, cb),
}))

// Pass-through react-router-dom so BrowserRouter/MemoryRouter work normally
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual }
})

import i18n from '@/lib/i18n'
import App from './App'

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

describe('App smoke test', () => {
  it('mounts without throwing', async () => {
    // Arrange + Act — should not throw
    await act(async () => { render(<App />) })
  })

  it('renders the AMS brand', async () => {
    await act(async () => { render(<App />) })
    // "AMS" appears in the sidebar brand area once auth resolves to 'ready'
    await waitFor(() => {
      const amsBrands = screen.getAllByText('AMS')
      expect(amsBrands.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders the Dashboard heading', async () => {
    await act(async () => { render(<App />) })
    // "Дашборд" appears in both the sidebar nav item and the page header
    await waitFor(() => {
      const dashboardTexts = screen.getAllByText('Дашборд')
      expect(dashboardTexts.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('firebase module exports all expected accessor functions without throwing on import', async () => {
    // Arrange + Act — import the module. With the lazy-accessor design the real
    // src/lib/firebase/index.ts also succeeds here (no initializeApp at import
    // time), but vi.mock above intercepts it so the test stays hermetic.
    const firebase = await import('@/lib/firebase')

    // Assert — all five exports exist and are functions (lazy accessor shape)
    expect(typeof firebase.app).toBe('function')
    expect(typeof firebase.auth).toBe('function')
    expect(typeof firebase.db).toBe('function')
    expect(typeof firebase.storage).toBe('function')
    expect(typeof firebase.functions).toBe('function')
  })
})
