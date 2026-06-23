/**
 * WindowsKeysSection component tests.
 *
 * Exercises: filter chip toggling, status display, activate button, row click
 * opening KeyDetailsModal, masked-key rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { WindowsKeysSection } from './WindowsKeysSection'
import type { WorkstationLicense } from '@/domain/license'
import type { AuditLog } from '@/domain/audit'
import type { Actor } from '@/domain/asset'
import type { WorkstationLicenseRepository } from '@/domain/license'

vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

vi.mock('@/lib/licenses/revealKey', () => ({
  revealLicenseKey: vi.fn(),
  setLicenseKey: vi.fn(),
}))

// ── Fixtures ───────────────────────────────────────────────────────────────────

const NOW = '2026-06-22T12:00:00.000Z'

function makeLicense(overrides: Partial<WorkstationLicense> = {}): WorkstationLicense {
  return {
    id: 'lic_1',
    name: 'Windows 11 Pro',
    vendor: 'Microsoft',
    type: 'OEM',
    isReusable: false,
    assignmentType: 'unassigned',
    assignedToEmployeeId: null,
    assignedToAssetId: null,
    assignedAt: null,
    assignedBy: null,
    lifecycleStatus: 'active',
    retiredAt: null,
    retiredWithAssetId: null,
    expiresAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: 'u_001',
    updatedBy: 'u_001',
    ...overrides,
  }
}

function makeAuditEntry(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'al_1',
    entityType: 'license',
    entityId: 'lic_1',
    action: 'created',
    actorUid: 'u_001',
    actorRole: 'super_admin',
    before: null,
    after: null,
    comment: null,
    at: NOW,
    ...overrides,
  }
}

const ACTOR: Actor = { uid: 'u_001', role: 'super_admin' }

function makeWRepoStub(): WorkstationLicenseRepository {
  return {
    listLicenses: vi.fn().mockResolvedValue([]),
    getLicense: vi.fn(),
    createLicense: vi.fn(),
    assignLicense: vi.fn().mockResolvedValue({ value: {}, auditLog: {} }),
    decoupleLicense: vi.fn(),
    retireLicense: vi.fn(),
  } as unknown as WorkstationLicenseRepository
}

interface RenderOpts {
  licenses?: WorkstationLicense[]
  maskedKeys?: Record<string, string>
  auditMap?: Record<string, AuditLog[]>
  assetNameMap?: Record<string, { name: string; invCode: string }>
  canReveal?: boolean
  search?: string
  wRepo?: WorkstationLicenseRepository
  onActivated?: () => void
}

function renderSection({
  licenses = [],
  maskedKeys = {},
  auditMap = {},
  assetNameMap = {},
  canReveal = true,
  search = '',
  wRepo,
  onActivated,
}: RenderOpts = {}) {
  const resolvedRepo = wRepo ?? makeWRepoStub()
  render(
    <I18nextProvider i18n={i18n}>
      <WindowsKeysSection
        licenses={licenses}
        keylessAssets={[]}
        maskedKeys={maskedKeys}
        auditMap={auditMap}
        assetNameMap={assetNameMap}
        canReveal={canReveal}
        actor={ACTOR}
        wRepo={resolvedRepo}
        search={search}
        {...(onActivated ? { onActivated } : {})}
      />
    </I18nextProvider>,
  )
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('WindowsKeysSection', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
  })

  // ── 1. Filter chips ─────────────────────────────────────────────────────────

  it('renders both filter chips: filter-in_use and filter-free', () => {
    // Arrange + Act
    renderSection()

    // Assert
    expect(screen.getByTestId('filter-in_use')).toBeInTheDocument()
    expect(screen.getByTestId('filter-free')).toBeInTheDocument()
  })

  it('default filter is in_use — in_use rows are shown', () => {
    // Arrange
    const inUseLic = makeLicense({
      id: 'lic_inuse',
      name: 'Windows 11 Home',
      assignmentType: 'device',
      assignedToAssetId: 'ast-1',
      lifecycleStatus: 'active',
    })
    const freeLic = makeLicense({
      id: 'lic_free',
      name: 'Windows 10 Pro',
      assignmentType: 'unassigned',
      lifecycleStatus: 'active',
    })

    // Act
    renderSection({ licenses: [inUseLic, freeLic] })

    // Assert — in_use row visible, free row NOT visible
    expect(screen.getByTestId('key-row-lic_inuse')).toBeInTheDocument()
    expect(screen.queryByTestId('key-row-lic_free')).toBeNull()
  })

  it('clicking filter-free shows free rows and hides in_use rows', () => {
    // Arrange
    const inUseLic = makeLicense({
      id: 'lic_inuse',
      name: 'Windows 11 Home',
      assignmentType: 'device',
      assignedToAssetId: 'ast-1',
      lifecycleStatus: 'active',
    })
    const freeLic = makeLicense({
      id: 'lic_free',
      name: 'Windows 10 Pro',
      assignmentType: 'unassigned',
      lifecycleStatus: 'active',
    })
    renderSection({ licenses: [inUseLic, freeLic] })

    // Act
    fireEvent.click(screen.getByTestId('filter-free'))

    // Assert — free row now visible; in_use row gone
    expect(screen.getByTestId('key-row-lic_free')).toBeInTheDocument()
    expect(screen.queryByTestId('key-row-lic_inuse')).toBeNull()
  })

  // ── 2. Status display ───────────────────────────────────────────────────────

  it('device-bound active license row shows "Используется" status chip', () => {
    // Arrange
    const lic = makeLicense({
      id: 'lic_1',
      assignmentType: 'device',
      assignedToAssetId: 'ast-1',
      lifecycleStatus: 'active',
    })

    // Act
    renderSection({ licenses: [lic] })

    // Assert — row is in in_use filter, chip says Используется
    const row = screen.getByTestId('key-row-lic_1')
    expect(row.textContent).toContain(i18n.t('keys.statusInUse', { ns: 'licenses' }))
  })

  it('unassigned active license row shows "Свободен" status chip when free filter active', () => {
    // Arrange
    const lic = makeLicense({
      id: 'lic_free_1',
      assignmentType: 'unassigned',
      lifecycleStatus: 'active',
    })

    // Act
    renderSection({ licenses: [lic] })
    fireEvent.click(screen.getByTestId('filter-free'))

    // Assert
    const row = screen.getByTestId('key-row-lic_free_1')
    expect(row.textContent).toContain(i18n.t('keys.statusFree', { ns: 'licenses' }))
  })

  it('retired license row is NOT rendered in either filter', () => {
    // Arrange — retired license should be excluded entirely
    const retired = makeLicense({
      id: 'lic_retired',
      lifecycleStatus: 'retired',
      assignmentType: 'unassigned',
    })

    // Act
    renderSection({ licenses: [retired] })

    // Assert — not visible in in_use
    expect(screen.queryByTestId('key-row-lic_retired')).toBeNull()

    fireEvent.click(screen.getByTestId('filter-free'))
    // Assert — not visible in free either
    expect(screen.queryByTestId('key-row-lic_retired')).toBeNull()
  })

  it('employee-assigned license is excluded from the table', () => {
    // Arrange
    const empLic = makeLicense({
      id: 'lic_emp',
      assignmentType: 'employee',
      assignedToEmployeeId: 'emp-1',
      lifecycleStatus: 'active',
    })

    // Act
    renderSection({ licenses: [empLic] })

    // Assert — not shown in either filter
    expect(screen.queryByTestId('key-row-lic_emp')).toBeNull()
    fireEvent.click(screen.getByTestId('filter-free'))
    expect(screen.queryByTestId('key-row-lic_emp')).toBeNull()
  })

  // ── 3. Masked key rendering ─────────────────────────────────────────────────

  it('masked key text is rendered in the row (not raw key)', () => {
    // Arrange
    const lic = makeLicense({
      id: 'lic_masked',
      assignmentType: 'device',
      assignedToAssetId: 'ast-1',
      lifecycleStatus: 'active',
    })
    const MASKED = '****-****-****-5592'
    const RAW = 'XCVF-7TR5-9HJK-5592'

    // Act
    renderSection({
      licenses: [lic],
      maskedKeys: { lic_masked: MASKED },
    })

    // Assert — masked value shown, raw key not shown
    const row = screen.getByTestId('key-row-lic_masked')
    expect(row.textContent).toContain(MASKED)
    expect(screen.queryByText(RAW)).toBeNull()
  })

  it('row shows fallback "—" when no masked key entry exists for the license', () => {
    // Arrange — no maskedKeys entry for lic_1
    const lic = makeLicense({
      id: 'lic_nomask',
      assignmentType: 'device',
      assignedToAssetId: 'ast-1',
      lifecycleStatus: 'active',
    })

    // Act
    renderSection({ licenses: [lic], maskedKeys: {} })

    // Assert
    const row = screen.getByTestId('key-row-lic_nomask')
    expect(row.textContent).toContain('—')
  })

  // ── 4. Activate button ──────────────────────────────────────────────────────

  it('activate button (activate-btn-{id}) appears for free keys', () => {
    // Arrange
    const freeLic = makeLicense({
      id: 'lic_free_act',
      assignmentType: 'unassigned',
      lifecycleStatus: 'active',
    })

    // Act
    renderSection({ licenses: [freeLic] })
    fireEvent.click(screen.getByTestId('filter-free'))

    // Assert
    expect(screen.getByTestId('activate-btn-lic_free_act')).toBeInTheDocument()
  })

  it('activate button is NOT shown for in_use keys', () => {
    // Arrange
    const inUseLic = makeLicense({
      id: 'lic_inuse_no_btn',
      assignmentType: 'device',
      assignedToAssetId: 'ast-1',
      lifecycleStatus: 'active',
    })

    // Act
    renderSection({ licenses: [inUseLic] })

    // Assert — no activate button in in_use filter
    expect(screen.queryByTestId('activate-btn-lic_inuse_no_btn')).toBeNull()
  })

  it('clicking activate button opens ActivateKeyModal (does not open details modal)', () => {
    // Arrange
    const freeLic = makeLicense({
      id: 'lic_activate_open',
      name: 'Windows 11 Home',
      assignmentType: 'unassigned',
      lifecycleStatus: 'active',
    })
    renderSection({
      licenses: [freeLic],
      maskedKeys: { lic_activate_open: '****-****-0000' },
    })
    fireEvent.click(screen.getByTestId('filter-free'))

    // Act — click activate (not the row)
    const activateBtn = screen.getByTestId('activate-btn-lic_activate_open')
    fireEvent.click(activateBtn)

    // Assert — ActivateKeyModal renders (it renders in a portal but aria-modal should be present)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  // ── 5. Row click opens KeyDetailsModal ──────────────────────────────────────

  it('clicking a row opens KeyDetailsModal', () => {
    // Arrange
    const lic = makeLicense({
      id: 'lic_details',
      assignmentType: 'device',
      assignedToAssetId: 'ast-1',
      lifecycleStatus: 'active',
    })
    renderSection({
      licenses: [lic],
      maskedKeys: { lic_details: '****-****-ABCD' },
    })

    // Act
    fireEvent.click(screen.getByTestId('key-row-lic_details'))

    // Assert — modal opens (role=dialog in portal)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('passes audit entries into the opened KeyDetailsModal history timeline', () => {
    const lic = makeLicense({
      id: 'lic_hist',
      assignmentType: 'device',
      assignedToAssetId: 'ast-9',
      lifecycleStatus: 'active',
    })
    renderSection({
      licenses: [lic],
      maskedKeys: { lic_hist: '****-****-ABCD' },
      auditMap: { lic_hist: [makeAuditEntry({ id: 'al_hist', entityId: 'lic_hist', action: 'assigned' })] },
    })

    fireEvent.click(screen.getByTestId('key-row-lic_hist'))

    // The history heading renders inside the opened modal (not the empty state).
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).queryByText(i18n.t('licenses:keyDetails.historyEmpty'))).not.toBeInTheDocument()
  })

  // ── 6. Search filtering ─────────────────────────────────────────────────────

  it('search filters out rows that do not match the query', () => {
    // Arrange
    const win11 = makeLicense({
      id: 'lic_win11',
      name: 'Windows 11 Pro',
      assignmentType: 'device',
      assignedToAssetId: 'ast-1',
      lifecycleStatus: 'active',
    })
    const office = makeLicense({
      id: 'lic_office',
      name: 'Microsoft Office',
      assignmentType: 'device',
      assignedToAssetId: 'ast-2',
      lifecycleStatus: 'active',
    })

    // Act — search for "office"
    renderSection({ licenses: [win11, office], search: 'office' })

    // Assert — only office row visible
    expect(screen.queryByTestId('key-row-lic_win11')).toBeNull()
    expect(screen.getByTestId('key-row-lic_office')).toBeInTheDocument()
  })

  // ── 7. Asset name display ───────────────────────────────────────────────────

  it('displays asset name from assetNameMap for in_use keys', () => {
    // Arrange
    const lic = makeLicense({
      id: 'lic_named',
      assignmentType: 'device',
      assignedToAssetId: 'ast-99',
      lifecycleStatus: 'active',
    })

    // Act
    renderSection({
      licenses: [lic],
      assetNameMap: { 'ast-99': { name: 'Dell Latitude 7420', invCode: '450/302042' } },
    })

    // Assert
    const row = screen.getByTestId('key-row-lic_named')
    expect(row.textContent).toContain('Dell Latitude 7420')
    expect(row.textContent).toContain('450/302042')
  })

  // ── 8. Filter chip counts ───────────────────────────────────────────────────

  it('filter chip counts reflect the number of licenses per status', () => {
    // Arrange — 2 in_use, 1 free
    const lic1 = makeLicense({ id: 'l1', assignmentType: 'device', assignedToAssetId: 'a1', lifecycleStatus: 'active' })
    const lic2 = makeLicense({ id: 'l2', name: 'W10', assignmentType: 'device', assignedToAssetId: 'a2', lifecycleStatus: 'active' })
    const lic3 = makeLicense({ id: 'l3', name: 'W7', assignmentType: 'unassigned', lifecycleStatus: 'active' })

    // Act
    renderSection({ licenses: [lic1, lic2, lic3] })

    // Assert — in_use chip shows 2, free chip shows 1
    const inUseChip = screen.getByTestId('filter-in_use')
    const freeChip  = screen.getByTestId('filter-free')
    expect(inUseChip.textContent).toContain('2')
    expect(freeChip.textContent).toContain('1')
  })
})
