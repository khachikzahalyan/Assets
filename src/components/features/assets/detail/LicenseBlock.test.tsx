/**
 * LicenseBlock — license-type badge regression tests.
 *
 * Bug guarded: a manually-entered (Retail) product key was displayed with an
 * «OEM» chip — the compact (mobile) mode hardcoded OEM regardless of lic.type,
 * and after write-off (manual key decoupled → no bound license) the block fell
 * back to the assumed-OEM legacy card ("Windows [OEM]").
 *
 * Covers:
 *  - compact + bound Retail  → license name + «Retail» chip, NO «OEM» text.
 *  - compact + bound OEM     → «OEM» chip.
 *  - compact + no lic, active asset   → legacy assumed-OEM card (unchanged).
 *  - compact + no lic, DISPOSED asset → renders nothing.
 *  - desktop + bound Retail  → «Retail» chip, NO «OEM» chip.
 *  - desktop + no lic, DISPOSED asset → renders nothing.
 *  - TechSpecsCard (disposed + hasOemLicenseCap, no licenses) → no «OEM» anywhere.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest'
import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { LicenseBlock } from './LicenseBlock'
import { TechSpecsCard } from './TechSpecsCard'
import type { Asset } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'

// ---------------------------------------------------------------------------
// Firebase / secrets mocks — prevent SDK initialisation in jsdom.
// ---------------------------------------------------------------------------
vi.mock('@/lib/firebase', () => ({
  app: () => ({}),
  auth: () => ({}),
  db: () => ({}),
  storage: () => ({}),
  functions: () => ({}),
}))

vi.mock('@/lib/licenses/revealKey', () => ({
  revealLicenseKey: vi.fn().mockResolvedValue('XXXXX-XXXXX-XXXXX-XXXXX-XXXXX'),
  setLicenseKey: vi.fn().mockResolvedValue(undefined),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTIVE_ASSET: Asset = {
  id:         'asset_lic_badge',
  categoryId: 'cat_laptop',
  brand:      'Asus',
  model:      'VivoBook Pro',
  invCode:    '450/302042',
  serial:     'SN-BADGE-001',
  statusId:   'st_warehouse',
  assignment: null,
  branchId:   'b_main',
  deptId:     null,
  updatedAt:  '2026-07-01T10:00:00.000Z',
  currentSpecs: null,
}

const DISPOSED_ASSET: Asset = { ...ACTIVE_ASSET, statusId: 'st_disposed' }

function makeLicense(over: Partial<WorkstationLicense> = {}): WorkstationLicense {
  return {
    id: 'lic_1',
    name: 'Asus VivoBook Pro — Ключ продукта',
    vendor: null,
    type: 'Retail',
    isReusable: true,
    assignmentType: 'device',
    assignedToAssetId: ACTIVE_ASSET.id,
    lifecycleStatus: 'active',
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
    createdBy: 'u1',
    updatedBy: 'u1',
    ...over,
  }
}

// employee role: no key-reveal probe runs (canCopyForProbe=false) — badge
// assertions stay synchronous.
const AUTH: AuthContextValue = {
  user: { id: 'u_004', name: 'Сергей Иванов', email: 's.ivanov@example.test', role: 'employee', initials: 'СИ', avatarColor: '' },
  role: 'employee',
  status: 'ready',
  setRole: () => {},
  signOut: () => {},
}

function renderBlock(ui: ReactElement) {
  return render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={AUTH}>{ui}</AuthContext.Provider>
    </I18nextProvider>,
  )
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('LicenseBlock — license-type badge', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('ru')
  })

  // ---- COMPACT (mobile) ----------------------------------------------------

  it('compact + bound Retail: shows license name and «Retail» chip, NO «OEM» text', () => {
    const lic = makeLicense()
    renderBlock(<LicenseBlock asset={ACTIVE_ASSET} licenses={[lic]} compact />)

    expect(screen.getByText('Asus VivoBook Pro — Ключ продукта')).toBeInTheDocument()
    expect(screen.getByText('Retail')).toBeInTheDocument()
    expect(screen.queryByText('OEM')).toBeNull()
    expect(screen.queryByText(/OEM — /)).toBeNull()
  })

  it('compact + bound OEM: shows «OEM» chip', () => {
    const lic = makeLicense({ name: 'OEM — Asus VivoBook Pro', type: 'OEM', isReusable: false })
    renderBlock(<LicenseBlock asset={ACTIVE_ASSET} licenses={[lic]} compact />)

    expect(screen.getByText('OEM — Asus VivoBook Pro')).toBeInTheDocument()
    expect(screen.getByText('OEM')).toBeInTheDocument()
    expect(screen.queryByText('Retail')).toBeNull()
  })

  it('compact + no license on an ACTIVE asset: legacy assumed-OEM card still renders (Windows + OEM)', () => {
    renderBlock(<LicenseBlock asset={ACTIVE_ASSET} licenses={[]} compact />)

    expect(screen.getByText('Windows')).toBeInTheDocument()
    expect(screen.getByText('OEM')).toBeInTheDocument()
  })

  it('compact + no license on a DISPOSED asset: renders NOTHING (freed manual key must not look OEM)', () => {
    const { container } = renderBlock(<LicenseBlock asset={DISPOSED_ASSET} licenses={[]} compact />)

    expect(container.firstChild).toBeNull()
    expect(screen.queryByText('OEM')).toBeNull()
    expect(screen.queryByText('Windows')).toBeNull()
  })

  // ---- DESKTOP ---------------------------------------------------------------

  it('desktop + bound Retail: «Retail» chip, NO «OEM» chip', () => {
    const lic = makeLicense()
    renderBlock(<LicenseBlock asset={ACTIVE_ASSET} licenses={[lic]} />)

    expect(screen.getByText('Asus VivoBook Pro — Ключ продукта')).toBeInTheDocument()
    expect(screen.getByText('Retail')).toBeInTheDocument()
    expect(screen.queryByText('OEM')).toBeNull()
  })

  it('desktop + no license on a DISPOSED asset: renders NOTHING (no assumed-OEM fallback)', () => {
    const { container } = renderBlock(<LicenseBlock asset={DISPOSED_ASSET} licenses={[]} />)

    expect(container.firstChild).toBeNull()
    expect(screen.queryByText('OEM')).toBeNull()
  })

  // ---- TechSpecsCard integration --------------------------------------------

  it('TechSpecsCard (disposed asset, hasOemLicenseCap, no bound licenses): no «OEM» text anywhere', () => {
    renderBlock(
      <TechSpecsCard asset={DISPOSED_ASSET} licenses={[]} hasOemLicenseCap />,
    )

    expect(screen.queryByText('OEM')).toBeNull()
    expect(screen.queryByText('Windows')).toBeNull()
  })

  it('TechSpecsCard (active asset, hasOemLicenseCap, bound Retail): «Retail» chip, no «OEM»', () => {
    const lic = makeLicense()
    renderBlock(
      <TechSpecsCard asset={ACTIVE_ASSET} licenses={[lic]} hasOemLicenseCap />,
    )

    expect(screen.getByText('Retail')).toBeInTheDocument()
    expect(screen.queryByText('OEM')).toBeNull()
  })
})
