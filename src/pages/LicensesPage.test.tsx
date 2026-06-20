/**
 * LicensesPage component tests.
 *
 * Uses InMemory repositories injected as props so no Firestore is touched.
 * i18n is the real instance (ru locale) — consistent with sibling page tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { LicensesPage } from './LicensesPage'
import {
  InMemoryWorkstationLicenseRepository,
  InMemoryServerLicenseRepository,
  InMemoryAuditLogRepository,
} from '@/infra/repositories'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { Role } from '@/config/roles'

// Prevent real Firebase from being imported in jsdom
vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

// Prevent real Firestore repositories from being constructed (no real db passed)
vi.mock('@/infra/repositories', async () => {
  const actual = await vi.importActual<typeof import('@/infra/repositories')>('@/infra/repositories')
  return {
    ...actual,
    FirestoreWorkstationLicenseRepository: class {
      async listLicenses() { return [] }
    },
    FirestoreServerLicenseRepository: class {
      async listLicenses() { return [] }
    },
    FirestoreAuditLogRepository: class {
      async listAuditLogs() { return { rows: [], nextCursor: null } }
    },
  }
})

// Mock the revealKey module — tests that need it pass revealFn directly
vi.mock('@/lib/licenses/revealKey', () => ({
  revealLicenseKey: vi.fn(),
  setLicenseKey: vi.fn(),
}))

function authCtx(role: Role) {
  const USERS: Record<Role, { id: string; name: string; email: string }> = {
    super_admin: { id: 'u_001', name: 'Super Admin', email: 's@example.test' },
    asset_admin: { id: 'u_002', name: 'Asset Admin', email: 'a@example.test' },
    tech_admin:  { id: 'u_003', name: 'Tech Admin',  email: 't@example.test' },
    employee:    { id: 'u_004', name: 'Employee',    email: 'e@example.test' },
  }
  const u = USERS[role]
  return {
    user: { id: u.id, name: u.name, email: u.email, role, initials: 'X', avatarColor: '' },
    role,
    status: 'ready' as const,
    setRole: () => {},
    signOut: () => {},
  }
}

function makeWRepo() {
  const store = createInMemoryAuditStore()
  const ctx = inMemoryAuditContext(store)
  return new InMemoryWorkstationLicenseRepository(ctx)
}

function makeSRepo() {
  const store = createInMemoryAuditStore()
  const ctx = inMemoryAuditContext(store)
  return new InMemoryServerLicenseRepository(ctx)
}

const ACTOR_SUPER = { uid: 'u_001', role: 'super_admin' as const }

function renderPage(
  role: Role,
  wRepo: InMemoryWorkstationLicenseRepository,
  sRepo?: InMemoryServerLicenseRepository,
) {
  const aRepo = new InMemoryAuditLogRepository([])
  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={authCtx(role)}>
        <MemoryRouter>
          <LicensesPage
            workstationRepo={wRepo}
            serverRepo={sRepo ?? makeSRepo()}
            auditRepo={aRepo}
          />
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )
}

describe('LicensesPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
  })

  // ── 1. Workstation rows render ─────────────────────────────────────────────

  describe('workstation tab renders license rows', () => {
    it('shows both license names when seeded with 2 workstation licenses', async () => {
      // Arrange — seed 2 licenses: one employee-assigned, one unassigned
      const wRepo = makeWRepo()
      await wRepo.createLicense(
        { name: 'Microsoft Office 365', type: 'Subscription' },
        ACTOR_SUPER,
      )
      const { value: l2 } = await wRepo.createLicense(
        { name: 'Adobe Creative Cloud', type: 'Retail' },
        ACTOR_SUPER,
      )
      await wRepo.assignLicense(l2.id, { to: 'employee', employeeId: 'emp-1' }, ACTOR_SUPER)

      // Act
      renderPage('super_admin', wRepo)

      // Assert — both names visible; no raw key leaking
      expect(await screen.findByText('Microsoft Office 365')).toBeInTheDocument()
      expect(screen.getByText('Adobe Creative Cloud')).toBeInTheDocument()
    })

    it('does not display any raw key string in the row cells', async () => {
      // Arrange
      const wRepo = makeWRepo()
      const RAW = 'XCVF-7TR5-9HJK-5592'
      await wRepo.createLicense(
        { name: 'Secret License', type: 'Volume', rawKey: RAW },
        ACTOR_SUPER,
      )

      // Act
      renderPage('super_admin', wRepo)
      await screen.findByText('Secret License')

      // Assert — raw key must not appear anywhere in the rendered output
      expect(screen.queryByText(RAW)).toBeNull()
      // The masked form should also not appear as visible text (key is not shown in table cells)
      expect(screen.queryByText('****-****-****-5592')).toBeNull()
    })
  })

  // ── 2. Server tab visibility gating ───────────────────────────────────────

  describe('server tab visibility', () => {
    it('server tab is NOT visible for tech_admin', async () => {
      // Arrange
      const wRepo = makeWRepo()

      // Act
      renderPage('tech_admin', wRepo)

      // Assert — "Серверные" tab must be absent
      await screen.findByText('Лицензии') // page loaded
      expect(screen.queryByText('Серверные')).toBeNull()
    })

    it('server tab IS visible for super_admin', async () => {
      // Arrange
      const wRepo = makeWRepo()

      // Act
      renderPage('super_admin', wRepo)

      // Assert — "Серверные" tab must appear
      expect(await screen.findByText('Серверные')).toBeInTheDocument()
    })

    it('workstation tab is visible for tech_admin', async () => {
      // Arrange
      const wRepo = makeWRepo()

      // Act
      renderPage('tech_admin', wRepo)

      // Assert — page renders and shows empty state (no server tab shown)
      expect(await screen.findByText('Лицензий пока нет')).toBeInTheDocument()
    })
  })

  // ── 3. Empty state ────────────────────────────────────────────────────────

  it('shows empty state when there are no workstation licenses', async () => {
    // Arrange
    const wRepo = makeWRepo()

    // Act
    renderPage('super_admin', wRepo)

    // Assert
    expect(await screen.findByText('Лицензий пока нет')).toBeInTheDocument()
  })

  // ── 4. Decouple error surfacing ───────────────────────────────────────────

  describe('decouple error surfacing', () => {
    it('shows role=alert when decoupleLicense rejects', async () => {
      // Arrange — seed a device-assigned license so the Decouple button is enabled,
      // then override the repo method to reject to simulate a backend failure.
      const wRepo = makeWRepo()
      const { value: lic } = await wRepo.createLicense(
        { name: 'AutoCAD 2024', type: 'Subscription' },
        ACTOR_SUPER,
      )
      await wRepo.assignLicense(
        lic.id,
        { to: 'device', assetId: 'asset-123' },
        ACTOR_SUPER,
      )
      // Override decoupleLicense to always reject
      vi.spyOn(wRepo, 'decoupleLicense').mockRejectedValue(new Error('network error'))

      // Mock window.confirm to auto-confirm the decouple prompt
      vi.spyOn(window, 'confirm').mockReturnValue(true)

      // Act — render page, wait for the license row, then click Decouple
      renderPage('super_admin', wRepo)
      // Wait for the license row to appear
      await screen.findByText('AutoCAD 2024')

      // The decouple button is rendered via renderActions; find by test-id
      const decoupleBtn = screen.getByTestId(`decouple-btn-${lic.id}`)
      fireEvent.click(decoupleBtn)

      // Assert — role="alert" paragraph appears in the workstation tab body
      const alert = await screen.findByRole('alert')
      expect(alert).toBeInTheDocument()
      // The error message is the ru locale translation of 'error'
      expect(alert.textContent).toBe('Не удалось загрузить лицензии. Попробуйте ещё раз.')
    })
  })
})
