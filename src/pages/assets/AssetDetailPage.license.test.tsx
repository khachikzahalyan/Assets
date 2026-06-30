/**
 * AssetDetailPage — license display integration tests.
 *
 * Exercises the three mandatory display states for the license block on AssetDetailPage:
 *   d)  BOUND RETAIL (key exists)  — full key + «Копировать» button.
 *   d1) BOUND RETAIL (no key)      — probe throws → «Ключ не задан», no «Копировать».
 *   d2) BOUND OEM                  — renders «OEM» in key position, no «Копировать».
 *   LEGACY NO LICENSE DOC          — hasOemLicense category, no license bound → default OEM card.
 *   e)  PERMISSION: asset_admin    — no «Добавить лицензию»; default OEM card renders (read-only).
 *   f)  PERMISSION: employee       — no «Добавить лицензию»; default OEM card renders (read-only).
 *
 * The old ATTACH tests (a/b/c) are removed — the attach flow no longer lives in LicenseBlock.
 *
 * Uses:
 *  - Real InMemoryWorkstationLicenseRepository (not a hand-mock) for end-to-end state assertions.
 *  - AuthContext.Provider with an inline value so we can precisely control role.
 *  - A category with hasOemLicense=true so the license section always renders.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { AssetDetailPage } from './AssetDetailPage'
import {
  InMemoryAssetRepository,
  InMemoryWorkstationLicenseRepository,
} from '@/infra/repositories'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { AssetReferenceData } from '@/domain/asset'
import type { AuthContextValue } from '@/contexts/AuthContext'

// ---------------------------------------------------------------------------
// Prevent Firebase SDK initialisation errors in the test environment.
// ---------------------------------------------------------------------------

vi.mock('@/lib/firebase', () => ({
  app: () => ({}),
  auth: () => ({}),
  db: () => ({}),
  storage: () => ({}),
  functions: () => ({}),
}))

// ---------------------------------------------------------------------------
// Mock revealLicenseKey so the lazy probe in LicenseBlock runs deterministically.
// Default: resolves with a stub key (simulates "key exists" → hasKey=true).
// Individual tests override via revealLicenseKeyMock.mockRejectedValue()
// to simulate the "no key yet" path.
// ---------------------------------------------------------------------------

vi.mock('@/lib/licenses/revealKey', () => ({
  revealLicenseKey: vi.fn().mockResolvedValue('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX'),
  setLicenseKey: vi.fn().mockResolvedValue(undefined),
}))

import { revealLicenseKey as revealLicenseKeyImport } from '@/lib/licenses/revealKey'
const revealLicenseKeyMock = vi.mocked(revealLicenseKeyImport)

vi.mock('@/infra/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/storage')>()
  return {
    ...actual,
    uploadActScan: vi.fn().mockResolvedValue('acts/a_1/scan.pdf'),
    actScanUrl: vi.fn().mockResolvedValue('https://example.com/scan.pdf'),
  }
})

// ---------------------------------------------------------------------------
// Reference data — includes a category with hasOemLicense: true so that
// the license section always renders for this category.
// ---------------------------------------------------------------------------

const REF: AssetReferenceData = {
  statuses: [
    { id: 'st_warehouse', name: 'На складе', color: 'gray' },
    { id: 'st_assigned',  name: 'Выдано',    color: 'emerald' },
    { id: 'st_repair',    name: 'В ремонте', color: 'orange' },
    { id: 'st_disposed',  name: 'Списано',   color: 'red' },
  ],
  branches:    [{ id: 'b_main', name: 'HQ' }],
  departments: [],
  categories:  [
    {
      id: 'cat_laptop',
      name: 'Ноутбук',
      group: 'devices',
      categoryGroupId: 'grp_devices',
      lucideIcon: 'laptop',
      hasOemLicense: true,
    },
  ],
  employees:      [],
  categoryGroups: [],
}

// ---------------------------------------------------------------------------
// Auth context values for each role
// ---------------------------------------------------------------------------

function makeAuth(role: 'super_admin' | 'asset_admin' | 'tech_admin' | 'employee'): AuthContextValue {
  const users = {
    super_admin: { id: 'u_001', name: 'Иван Петров',    email: 'i.petrov@example.test',   role: 'super_admin' as const, initials: 'ИП', avatarColor: '' },
    asset_admin: { id: 'u_002', name: 'Анна Сидорова',  email: 'a.sidorova@example.test', role: 'asset_admin' as const, initials: 'АС', avatarColor: '' },
    tech_admin:  { id: 'u_003', name: 'Дмитрий Козлов', email: 'd.kozlov@example.test',   role: 'tech_admin'  as const, initials: 'ДК', avatarColor: '' },
    employee:    { id: 'u_004', name: 'Сергей Иванов',  email: 's.ivanov@example.test',   role: 'employee'    as const, initials: 'СИ', avatarColor: '' },
  }
  return {
    user: users[role],
    role,
    status: 'ready' as const,
    setRole: () => {},
    signOut: () => {},
  }
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

interface SeedOptions {
  role?: 'super_admin' | 'asset_admin' | 'tech_admin' | 'employee'
  statusId?: string
  onPersistOemSecret?: (licenseId: string, rawKey: string) => Promise<void>
}

async function seedAndRender({
  role = 'super_admin',
  statusId = 'st_warehouse',
  onPersistOemSecret,
}: SeedOptions = {}) {
  const store       = createInMemoryAuditStore()
  const auditCtx    = inMemoryAuditContext(store)
  const licenseRepo = new InMemoryWorkstationLicenseRepository(auditCtx)
  const assetRepo   = new InMemoryAssetRepository([], REF, auditCtx, licenseRepo)

  const { value: asset } = await assetRepo.createAsset(
    {
      categoryId: 'cat_laptop',
      brand: 'Dell',
      model: 'XPS',
      invCode: '450/LIC1',
      serial: 'SN-LIC1',
      assignment: null,
      branchId: 'b_main',
      deptId: null,
      currentSpecs: null,
      ...(statusId !== 'st_warehouse' ? { statusId } : {}),
    } as Parameters<typeof assetRepo.createAsset>[0],
    { uid: 'u1', role: 'asset_admin' },
  )

  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={makeAuth(role)}>
        <MemoryRouter initialEntries={[`/assets/${asset.id}`]}>
          <Routes>
            <Route
              path="/assets/:id"
              element={
                <AssetDetailPage
                  repository={assetRepo}
                  licenseRepository={licenseRepo}
                  {...(onPersistOemSecret ? { onPersistOemSecret } : {})}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )

  return { asset, assetRepo, licenseRepo, store }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AssetDetailPage — license display states', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
    // Reset the revealLicenseKey mock between tests so default (resolves with key) is restored.
    revealLicenseKeyMock.mockReset()
    revealLicenseKeyMock.mockResolvedValue('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX')
  })

  // ---- d) BOUND CARD: Retail + probe resolves (key exists) → full key displayed + «Копировать», NO «Открепить» ----

  it('BOUND RETAIL (key exists): probe resolves → FULL KEY displayed (not dots), «Копировать» visible, «Задать ключ» hidden, no «Открепить»', async () => {
    // Arrange: revealLicenseKey resolves (key exists in the secrets store).
    // The default mock resolves with 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX'; no override needed.

    const store    = createInMemoryAuditStore()
    const auditCtx = inMemoryAuditContext(store)
    const licenseRepo = new InMemoryWorkstationLicenseRepository(auditCtx)
    const assetRepo   = new InMemoryAssetRepository([], REF, auditCtx, licenseRepo)

    const { value: asset } = await assetRepo.createAsset(
      {
        categoryId: 'cat_laptop', brand: 'Dell', model: 'Latitude',
        invCode: '450/LIC3', serial: 'SN-LIC3',
        assignment: null, branchId: 'b_main', deptId: null, currentSpecs: null,
      },
      { uid: 'u1', role: 'asset_admin' },
    )

    await licenseRepo.createLicense(
      {
        name: 'Dell Latitude — Ключ продукта', type: 'Retail', isReusable: true,
        assign: { to: 'device', assetId: asset.id },
      },
      { uid: 'u1', role: 'asset_admin' },
    )

    render(
      <I18nextProvider i18n={i18n}>
        <AuthContext.Provider value={makeAuth('super_admin')}>
          <MemoryRouter initialEntries={[`/assets/${asset.id}`]}>
            <Routes>
              <Route
                path="/assets/:id"
                element={
                  <AssetDetailPage
                    repository={assetRepo}
                    licenseRepository={licenseRepo}
                  />
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </I18nextProvider>,
    )

    await waitFor(() => screen.getByText(/450\/LIC3/))

    // The full key must be displayed in the key line (not masked dots) once the probe resolves.
    expect(await screen.findByText('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX')).toBeTruthy()
    // «Копировать» button is visible …
    expect(await screen.findByRole('button', { name: /Копировать/i })).toBeTruthy()
    // … «Задать ключ» is hidden (key already exists) …
    expect(screen.queryByRole('button', { name: /Задать ключ/i })).toBeNull()
    // … Retail must NOT show the OEM «Встроен в BIOS» semantic …
    expect(screen.queryByText(/Встроен в BIOS/i)).toBeNull()
    // … and there is NO «Открепить» detach in the asset-detail license block.
    expect(screen.queryByRole('button', { name: /Открепить/i })).toBeNull()
    // … masked dots placeholder must NOT be shown.
    expect(screen.queryByText(/••••/)).toBeNull()
  }, 20000)

  // ---- d1) BOUND CARD: Retail + probe throws (key genuinely absent) → «Ключ не задан», NO «Задать ключ», NO «Копировать» ----

  it('BOUND RETAIL (no key): probe throws → «Ключ не задан» shown, NO «Задать ключ» button, NO «Копировать»', async () => {
    // Arrange: simulate the secrets doc not existing for this license (legacy/edge asset).
    revealLicenseKeyMock.mockRejectedValue(new Error('license-key/not-found'))

    const store    = createInMemoryAuditStore()
    const auditCtx = inMemoryAuditContext(store)
    const licenseRepo = new InMemoryWorkstationLicenseRepository(auditCtx)
    const assetRepo   = new InMemoryAssetRepository([], REF, auditCtx, licenseRepo)

    const { value: asset } = await assetRepo.createAsset(
      {
        categoryId: 'cat_laptop', brand: 'Dell', model: 'Latitude',
        invCode: '450/LIC3B', serial: 'SN-LIC3B',
        assignment: null, branchId: 'b_main', deptId: null, currentSpecs: null,
      },
      { uid: 'u1', role: 'asset_admin' },
    )

    await licenseRepo.createLicense(
      {
        name: 'Dell Latitude — Ключ продукта', type: 'Retail', isReusable: true,
        assign: { to: 'device', assetId: asset.id },
      },
      { uid: 'u1', role: 'asset_admin' },
    )

    render(
      <I18nextProvider i18n={i18n}>
        <AuthContext.Provider value={makeAuth('super_admin')}>
          <MemoryRouter initialEntries={[`/assets/${asset.id}`]}>
            <Routes>
              <Route
                path="/assets/:id"
                element={
                  <AssetDetailPage
                    repository={assetRepo}
                    licenseRepository={licenseRepo}
                  />
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </I18nextProvider>,
    )

    await waitFor(() => screen.getByText(/450\/LIC3B/))

    // When the probe throws (hasKey=false), «Ключ не задан» muted label is shown …
    expect(await screen.findByText(/Ключ не задан/i)).toBeTruthy()
    // … «Задать ключ» is NEVER shown (removed entirely) …
    expect(screen.queryByRole('button', { name: /Задать ключ/i })).toBeNull()
    // … and «Копировать» is hidden (no key to copy).
    expect(screen.queryByRole('button', { name: /Копировать/i })).toBeNull()
  }, 20000)

  // ---- d2) BOUND CARD: OEM → «OEM» in key position, NO «Копировать», NO «Открепить» ----

  it('BOUND OEM: an OEM-digital license renders «OEM» text in key position, no «Копировать», no «Открепить»', async () => {
    const store    = createInMemoryAuditStore()
    const auditCtx = inMemoryAuditContext(store)
    const licenseRepo = new InMemoryWorkstationLicenseRepository(auditCtx)
    const assetRepo   = new InMemoryAssetRepository([], REF, auditCtx, licenseRepo)

    const { value: asset } = await assetRepo.createAsset(
      {
        categoryId: 'cat_laptop', brand: 'Dell', model: 'OptiPlex',
        invCode: '450/LIC4', serial: 'SN-LIC4',
        assignment: null, branchId: 'b_main', deptId: null, currentSpecs: null,
      },
      { uid: 'u1', role: 'asset_admin' },
    )

    await licenseRepo.createLicense(
      {
        name: 'OEM — Dell OptiPlex', type: 'OEM', isReusable: false,
        assign: { to: 'device', assetId: asset.id },
      },
      { uid: 'u1', role: 'asset_admin' },
    )

    render(
      <I18nextProvider i18n={i18n}>
        <AuthContext.Provider value={makeAuth('super_admin')}>
          <MemoryRouter initialEntries={[`/assets/${asset.id}`]}>
            <Routes>
              <Route
                path="/assets/:id"
                element={
                  <AssetDetailPage
                    repository={assetRepo}
                    licenseRepository={licenseRepo}
                  />
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </I18nextProvider>,
    )

    await waitFor(() => screen.getByText(/450\/LIC4/))

    // Wait for license section to render
    await waitFor(() => screen.getByText('OEM — Dell OptiPlex'))

    // OEM-digital shows «OEM» in the key position (NOT «Встроен в BIOS»)
    // Find at least one element with exact text «OEM» (the chip label also says «OEM»,
    // so use getAllByText and assert length >= 1)
    expect(screen.getAllByText('OEM').length).toBeGreaterThanOrEqual(1)
    // «Встроен в BIOS» must NOT appear
    expect(screen.queryByText(/Встроен в BIOS/i)).toBeNull()
    // No copy button
    expect(screen.queryByRole('button', { name: /Копировать/i })).toBeNull()
    // No attach button
    expect(screen.queryByRole('button', { name: /Добавить лицензию/i })).toBeNull()
  }, 20000)

  // ---- LEGACY NO LICENSE DOC: hasOemLicense category, no license bound → default OEM card ----

  it('LEGACY (no license doc): hasOemLicense category with no license bound → renders default OEM card, NO «Добавить лицензию»', async () => {
    // Asset has hasOemLicense category but no license attached yet (legacy / pre-coupling scenario)
    await seedAndRender({ role: 'super_admin' })
    // seedAndRender creates asset on cat_laptop (hasOemLicense=true) with no license seeded

    await waitFor(() => screen.getByText(/450\/LIC1/))

    // The license block must render the default OEM card — showing «OEM» text
    // (could be the chip label, the key-position text, or both)
    const oemTexts = await screen.findAllByText('OEM')
    expect(oemTexts.length).toBeGreaterThanOrEqual(1)

    // No «Добавить лицензию» button — the attach flow is gone from this block
    expect(screen.queryByRole('button', { name: /Добавить лицензию/i })).toBeNull()
    // No «Лицензия не привязана» text — the empty state is removed
    expect(screen.queryByText(/Лицензия не привязана/i)).toBeNull()
  }, 20000)

  // ---- e) PERMISSION GATE: asset_admin cannot manage licenses ---------------

  it('PERMISSION: asset_admin role — no «Добавить лицензию» button; default OEM card renders (read-only)', async () => {
    // Arrange: asset_admin cannot manage license keys (canManageLicense = false)
    await seedAndRender({ role: 'asset_admin' })

    // Wait for page to load (invCode appears in the hero)
    await waitFor(() => screen.getByText(/450\/LIC1/))

    // No attach button — asset_admin cannot manage licenses
    expect(screen.queryByRole('button', { name: /Добавить лицензию/i })).toBeNull()
    // No detach button
    expect(screen.queryByRole('button', { name: /Открепить/i })).toBeNull()
    // The default OEM card renders (license section IS shown even for read-only role)
    const oemTexts = await screen.findAllByText('OEM')
    expect(oemTexts.length).toBeGreaterThanOrEqual(1)
  }, 15000)

  // ---- f) PERMISSION GATE: employee role cannot manage licenses ------------

  it('PERMISSION: employee role — no «Добавить лицензию» button; default OEM card renders (read-only)', async () => {
    await seedAndRender({ role: 'employee' })

    await waitFor(() => screen.getByText(/450\/LIC1/))

    expect(screen.queryByRole('button', { name: /Добавить лицензию/i })).toBeNull()
    // Default OEM card renders
    const oemTexts = await screen.findAllByText('OEM')
    expect(oemTexts.length).toBeGreaterThanOrEqual(1)
  }, 15000)
})
