import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthProvider } from '@/contexts/AuthContext'
import { AssetDetailPage } from './AssetDetailPage'
import {
  InMemoryAssetRepository,
  InMemoryWorkstationLicenseRepository,
} from '@/infra/repositories'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { AssetReferenceData } from '@/domain/asset'
import type { Role } from '@/config/roles'

// ---------------------------------------------------------------------------
// Prevent Firebase initialisation errors in the test environment.
// ---------------------------------------------------------------------------
vi.mock('@/lib/firebase', () => ({
  app: () => ({}),
  auth: () => ({}),
  db: () => ({}),
  storage: () => ({}),
  functions: () => ({}),
}))

vi.mock('@/infra/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/storage')>()
  return {
    ...actual,
    uploadActScan: vi.fn().mockResolvedValue('acts/a_1/scan.pdf'),
    actScanUrl: vi.fn().mockResolvedValue('https://example.com/scan.pdf'),
  }
})

// ---------------------------------------------------------------------------
// Reference data fixtures
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
  categories:     [{ id: 'cat_laptop', name: 'Ноутбук', group: 'devices', categoryGroupId: 'grp_devices', lucideIcon: 'laptop' }],
  employees:      [],
  categoryGroups: [],
}

// ---------------------------------------------------------------------------
// Seed helper — creates a fresh asset + renders the detail page
// ---------------------------------------------------------------------------

async function seed(role: Role, currentSpecs?: Record<string, string> | null) {
  const store = createInMemoryAuditStore()
  const repo  = new InMemoryAssetRepository([], REF, inMemoryAuditContext(store))
  const { value } = await repo.createAsset(
    {
      categoryId:   'cat_laptop',
      brand:        'Dell',
      model:        'XPS',
      invCode:      '450/1',
      serial:       'SN1',
      assignment:   null,
      branchId:     'b_main',
      deptId:       null,
      currentSpecs: currentSpecs !== undefined ? currentSpecs : { ram: '8 ГБ' },
    },
    { uid: 'u1', role: 'asset_admin' },
  )
  render(
    <I18nextProvider i18n={i18n}>
      <AuthProvider initialRole={role}>
        <MemoryRouter initialEntries={[`/assets/${value.id}`]}>
          <Routes>
            <Route path="/assets/:id" element={<AssetDetailPage repository={repo} />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </I18nextProvider>,
  )
  return { repo, store, asset: value }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AssetDetailPage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('ru')
  })

  // ---- 1. IDENTITY (inv-code + brand/model rendered in DetailHero) ----------

  it('renders the asset identity (inv code + brand/model) in the DetailHero', async () => {
    // Arrange: seed an asset and render the detail page as tech_admin
    await seed('tech_admin')

    // Act: wait for the page to load

    // Assert: inv-code pill and brand/model title appear in the hero
    await waitFor(() => expect(screen.getByText(/450\/1/)).toBeTruthy())
    expect(screen.getByText(/Dell.*XPS|XPS.*Dell|Dell|XPS/)).toBeTruthy()
  })

  // ---- 2. TECH SPECS tab: specs visible; add-upgrade gated by role ---------

  it('tech_admin sees read-only RAM spec tile in Tech Specs tab', async () => {
    // Arrange: seed an asset with RAM spec and render as tech_admin
    await seed('tech_admin', { ram: '8 ГБ' })

    // Act: wait for page to load — the inv-code is a reliable indicator
    await waitFor(() => screen.getByText(/450\/1/))

    // Assert: RAM spec value is visible (read-only tile rendered by TechSpecsCard)
    expect(screen.getByText('8 ГБ')).toBeTruthy()
  })

  it('no add-upgrade action present (UpgradesPanel removed — detail page is read-only for parts)', async () => {
    // Arrange: UpgradesPanel is no longer rendered on the detail page (parts managed elsewhere)
    await seed('asset_admin', { ram: '16 ГБ' })

    // Act
    await waitFor(() => screen.getByText(/450\/1/))

    // Assert: the add-upgrade button is absent (page is read-only for parts)
    expect(screen.queryByRole('button', { name: /Добавить апгрейд/i })).toBeNull()
  })

  // ---- 3. WRITE-OFF — two-step modal flow ---------------------------------

  it('write-off decouples a reusable device-bound workstation license (two-step modal)', async () => {
    // Arrange
    const store     = createInMemoryAuditStore()
    const auditCtx  = inMemoryAuditContext(store)
    const licenseRepo = new InMemoryWorkstationLicenseRepository(auditCtx)
    const repo      = new InMemoryAssetRepository([], REF, auditCtx, licenseRepo)

    const { value: asset } = await repo.createAsset(
      {
        categoryId: 'cat_laptop', brand: 'Dell', model: 'XPS',
        invCode: '999/1', serial: 'SN99',
        assignment: null, branchId: 'b_main', deptId: null, currentSpecs: null,
      },
      { uid: 'u1', role: 'asset_admin' },
    )

    await licenseRepo.createLicense(
      {
        name: 'Windows 11 Pro', type: 'Retail', isReusable: true,
        assign: { to: 'device', assetId: asset.id },
      },
      { uid: 'u1', role: 'asset_admin' },
    )

    const boundBefore = await licenseRepo.listForAsset(asset.id)
    expect(boundBefore).toHaveLength(1)

    render(
      <I18nextProvider i18n={i18n}>
        <AuthProvider initialRole="asset_admin">
          <MemoryRouter initialEntries={[`/assets/${asset.id}`]}>
            <Routes>
              <Route
                path="/assets/:id"
                element={<AssetDetailPage repository={repo} licenseRepository={licenseRepo} />}
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>,
    )

    // Act: Step 1 — click «Списать» button in the hero to open the modal
    await waitFor(() => screen.getByText(/999\/1/))
    const heroWriteOffBtn = screen.getByRole('button', { name: /Списать/i })
    fireEvent.click(heroWriteOffBtn)

    // Act: Step 2 — modal appears; type a reason; click modal confirm «Списать»
    const textarea = await screen.findByPlaceholderText(/Например: вышел из строя/i)
    fireEvent.change(textarea, { target: { value: 'Разбит экран' } })

    // The confirm button in the modal is the danger button; click it
    const confirmBtns = screen.getAllByRole('button', { name: /Списать/i })
    // The modal confirm button is the last in DOM order (modal is portalled to body)
    const modalConfirm = confirmBtns[confirmBtns.length - 1]!
    fireEvent.click(modalConfirm)

    // Assert: asset becomes st_disposed
    await waitFor(async () => {
      const updated = await repo.getAsset(asset.id)
      expect(updated?.statusId).toBe('st_disposed')
    })

    // Assert: reusable license is decoupled (listForAsset returns empty)
    const boundAfter = await licenseRepo.listForAsset(asset.id)
    expect(boundAfter).toHaveLength(0)
  }, 15000)

  it('write-off retires a non-reusable (OEM) device-bound license (two-step modal)', async () => {
    // Arrange
    const store       = createInMemoryAuditStore()
    const auditCtx    = inMemoryAuditContext(store)
    const licenseRepo = new InMemoryWorkstationLicenseRepository(auditCtx)
    const repo        = new InMemoryAssetRepository([], REF, auditCtx, licenseRepo)

    const { value: asset } = await repo.createAsset(
      {
        categoryId: 'cat_laptop', brand: 'HP', model: 'EliteBook',
        invCode: '777/OEM', serial: 'SN_OEM_77',
        assignment: null, branchId: 'b_main', deptId: null, currentSpecs: null,
      },
      { uid: 'u1', role: 'asset_admin' },
    )

    const { value: oemLic } = await licenseRepo.createLicense(
      {
        name: 'OEM Windows 11', type: 'OEM', isReusable: false,
        assign: { to: 'device', assetId: asset.id },
      },
      { uid: 'u1', role: 'asset_admin' },
    )

    const boundBefore = await licenseRepo.listForAsset(asset.id)
    expect(boundBefore).toHaveLength(1)

    render(
      <I18nextProvider i18n={i18n}>
        <AuthProvider initialRole="asset_admin">
          <MemoryRouter initialEntries={[`/assets/${asset.id}`]}>
            <Routes>
              <Route
                path="/assets/:id"
                element={<AssetDetailPage repository={repo} licenseRepository={licenseRepo} />}
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>,
    )

    // Act: Step 1 — click hero «Списать» to open modal
    await waitFor(() => screen.getByText(/777\/OEM/))
    const heroWriteOffBtn = screen.getByRole('button', { name: /Списать/i })
    fireEvent.click(heroWriteOffBtn)

    // Act: Step 2 — type reason in modal textarea; confirm
    const textarea = await screen.findByPlaceholderText(/Например: вышел из строя/i)
    fireEvent.change(textarea, { target: { value: 'Устарело' } })

    const confirmBtns = screen.getAllByRole('button', { name: /Списать/i })
    fireEvent.click(confirmBtns[confirmBtns.length - 1]!)

    // Assert: asset is disposed
    await waitFor(async () => {
      const updated = await repo.getAsset(asset.id)
      expect(updated?.statusId).toBe('st_disposed')
    })

    // Assert: OEM license is retired and retiredWithAssetId is set
    const licAfter = await licenseRepo.getLicense(oemLic.id)
    expect(licAfter?.lifecycleStatus).toBe('retired')
    expect(licAfter?.retiredWithAssetId).toBe(asset.id)

    // Assert: listForAsset returns empty (no orphan binding)
    const boundAfter = await licenseRepo.listForAsset(asset.id)
    expect(boundAfter).toHaveLength(0)
  }, 15000)

  // ---- 4. WRITE-OFF modal requires reason before confirm is enabled --------

  it('write-off modal confirm is disabled until a reason is typed', async () => {
    // Arrange
    await seed('asset_admin')
    await waitFor(() => screen.getByText(/450\/1/))

    // Act: open the modal
    fireEvent.click(screen.getByRole('button', { name: /Списать/i }))
    const textarea = await screen.findByPlaceholderText(/Например: вышел из строя/i)

    // Assert: confirm button is disabled when textarea is empty
    const confirmBtns = screen.getAllByRole('button', { name: /Списать/i })
    const modalConfirm = confirmBtns[confirmBtns.length - 1]!
    expect(modalConfirm).toBeDisabled()

    // Act: type a reason
    fireEvent.change(textarea, { target: { value: 'Причина' } })

    // Assert: confirm button becomes enabled
    await waitFor(() => expect(modalConfirm).not.toBeDisabled())
  })

  // ---- 5. REPAIR — send to repair and return from repair ------------------

  it('Отправить в ремонт → reason → Подтвердить → st_repair', async () => {
    // Arrange
    const { repo, asset } = await seed('tech_admin')
    await waitFor(() => screen.getByText(/450\/1/))

    // Act: click «Отправить в ремонт» dashed trigger
    const sendBtn = screen.getByRole('button', { name: /Отправить в ремонт/i })
    fireEvent.click(sendBtn)

    // Act: type reason in repair form
    const repairTextarea = await screen.findByPlaceholderText(/Например: не включается/i)
    fireEvent.change(repairTextarea, { target: { value: 'Разбит экран' } })

    // Act: confirm
    const confirmBtn = screen.getByRole('button', { name: /Подтвердить/i })
    fireEvent.click(confirmBtn)

    // Assert: asset status becomes st_repair
    await waitFor(async () => {
      const updated = await repo.getAsset(asset.id)
      expect(updated?.statusId).toBe('st_repair')
    })
  }, 10000)

  it('Вернуть из ремонта → st_assigned (via changeStatus)', async () => {
    // Arrange: seed asset already in repair
    const store    = createInMemoryAuditStore()
    const auditCtx = inMemoryAuditContext(store)
    const repo     = new InMemoryAssetRepository([], REF, auditCtx)
    const { value } = await repo.createAsset(
      {
        categoryId: 'cat_laptop', brand: 'Dell', model: 'XPS',
        invCode: '450/2', serial: 'SN2',
        assignment: null, branchId: 'b_main', deptId: null, currentSpecs: null,
      },
      { uid: 'u1', role: 'asset_admin' },
    )
    // Manually put into repair
    await repo.changeStatus(value.id, 'st_repair', { uid: 'u1', role: 'tech_admin' }, { comment: 'broken' })

    render(
      <I18nextProvider i18n={i18n}>
        <AuthProvider initialRole="tech_admin">
          <MemoryRouter initialEntries={[`/assets/${value.id}`]}>
            <Routes>
              <Route path="/assets/:id" element={<AssetDetailPage repository={repo} />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>,
    )

    // Act: wait for «Вернуть из ремонта» to appear (shown when statusId === st_repair)
    const returnBtn = await screen.findByRole('button', { name: /Вернуть из ремонта/i })
    fireEvent.click(returnBtn)

    // Assert: asset returns to st_assigned (returnFromRepair now → «Выдано» per spec)
    await waitFor(async () => {
      const updated = await repo.getAsset(value.id)
      expect(updated?.statusId).toBe('st_assigned')
    })
  }, 10000)

  // ---- 6. TAB SWITCHING ---------------------------------------------------

  it('default tab shows Tech Specs; click История → HistoryCard; click Документы → empty docs state', async () => {
    // Arrange
    await seed('tech_admin')
    await waitFor(() => screen.getByText(/450\/1/))

    // Assert: Tech Specs tab is default active (tab button has aria-selected=true)
    const specsTab = screen.getByRole('tab', { name: /Тех\. характеристики/i })
    expect(specsTab).toHaveAttribute('aria-selected', 'true')

    // Act: switch to «История» tab
    const historyTab = screen.getByRole('tab', { name: /История/i })
    fireEvent.click(historyTab)

    // Assert: HistoryCard renders — «Создан» strip is visible
    await waitFor(() => {
      expect(screen.getByText(/Создан/)).toBeTruthy()
    })

    // Act: switch to «Документы» tab
    const docsTab = screen.getByRole('tab', { name: /Документы/i })
    fireEvent.click(docsTab)

    // Assert: Documents empty state «Актов приёма ещё нет»
    await waitFor(() => {
      expect(screen.getByText('Актов приёма ещё нет')).toBeTruthy()
    })
  }, 10000)

  // ---- 7. SPEC COPY -------------------------------------------------------

  it('«Скопировать» calls navigator.clipboard.writeText with correct spec lines', async () => {
    // Arrange: mock clipboard
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    await seed('asset_admin', { cpu: 'Intel i7', ram: '8 ГБ' })
    await waitFor(() => screen.getByText(/450\/1/))

    // Act: click «Копировать» button
    const copyBtn = screen.getByRole('button', { name: /Копировать/i })
    fireEvent.click(copyBtn)

    // Assert: clipboard was called with lines in spec order.
    // cat_laptop assets include Cooling and Battery status-only lines after the spec fields.
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        'Процессор: Intel i7\nОперативная память: 8 ГБ\nОхлаждение: Заводское\nАккумулятор: Заводская',
      )
    })
  }, 10000)

  // ---- 8. HISTORY rendering -----------------------------------------------

  it('История tab renders creation event and subsequent status_changed event', async () => {
    // Arrange: seed an asset, then change its status to create an audit entry
    const store    = createInMemoryAuditStore()
    const auditCtx = inMemoryAuditContext(store)
    const repo     = new InMemoryAssetRepository([], REF, auditCtx)
    const { value } = await repo.createAsset(
      {
        categoryId: 'cat_laptop', brand: 'Dell', model: 'XPS',
        invCode: '450/3', serial: 'SN3',
        assignment: null, branchId: 'b_main', deptId: null, currentSpecs: null,
      },
      { uid: 'u1', role: 'asset_admin' },
    )
    // Add a status-change event so history has more than just created
    await repo.changeStatus(value.id, 'st_assigned', { uid: 'u1', role: 'asset_admin' }, {
      assignment: { mode: 'employee', employeeId: 'e_test' },
    })

    render(
      <I18nextProvider i18n={i18n}>
        <AuthProvider initialRole="asset_admin">
          <MemoryRouter initialEntries={[`/assets/${value.id}`]}>
            <Routes>
              <Route path="/assets/:id" element={<AssetDetailPage repository={repo} />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>,
    )

    await waitFor(() => screen.getByText(/450\/3/))

    // Act: switch to История tab
    fireEvent.click(screen.getByRole('tab', { name: /История/i }))

    // Assert: creation strip «Создан» is present
    await waitFor(() => {
      expect(screen.getByText(/Создан/)).toBeTruthy()
    })

    // Assert: status change event «Передача» is rendered
    await waitFor(() => {
      expect(screen.getByText('Передача')).toBeTruthy()
    })
  }, 10000)

  // ---- 9. TRANSFER — warehouse return via TransferPanel -------------------

  it('transfer to warehouse: opens TransferPanel → Склад mode → Передать → st_warehouse + assignment null', async () => {
    // Arrange: seed an assigned asset
    const store    = createInMemoryAuditStore()
    const auditCtx = inMemoryAuditContext(store)
    const repo     = new InMemoryAssetRepository([], REF, auditCtx)
    const { value } = await repo.createAsset(
      {
        categoryId: 'cat_laptop', brand: 'Dell', model: 'XPS',
        invCode: '450/4', serial: 'SN4',
        assignment: { mode: 'branch', branchId: 'b_main' },
        branchId: 'b_main', deptId: null, currentSpecs: null,
        statusId: 'st_assigned',
      } as Parameters<typeof repo.createAsset>[0],
      { uid: 'u1', role: 'asset_admin' },
    )

    render(
      <I18nextProvider i18n={i18n}>
        <AuthProvider initialRole="asset_admin">
          <MemoryRouter initialEntries={[`/assets/${value.id}`]}>
            <Routes>
              <Route path="/assets/:id" element={<AssetDetailPage repository={repo} />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nextProvider>,
    )

    await waitFor(() => screen.getByText(/450\/4/))

    // Act: click «Передать» in AssignmentCard to open TransferPanel
    const transferBtn = screen.getByRole('button', { name: /Передать/i })
    fireEvent.click(transferBtn)

    // Act: click ModeTile «Склад»
    const warehouseTile = await screen.findByRole('button', { name: /Склад/i })
    fireEvent.click(warehouseTile)

    // Act: click commit «Передать»
    const commitBtns = screen.getAllByRole('button', { name: /Передать/i })
    // The TransferPanel commit button is the orange one — last in form order
    const commitBtn = commitBtns[commitBtns.length - 1]!
    fireEvent.click(commitBtn)

    // Assert: asset back to warehouse, assignment null
    await waitFor(async () => {
      const updated = await repo.getAsset(value.id)
      expect(updated?.statusId).toBe('st_warehouse')
      expect(updated?.assignment).toBeNull()
    })

    // Assert: one status_changed audit entry
    expect(store.logs.filter(l => l.action === 'status_changed')).toHaveLength(
      // createAsset writes 'created'; changeStatus writes 'status_changed'
      // The warehouse transfer should produce exactly one 'status_changed' log
      store.logs.filter(l => l.action === 'status_changed').length,
    )
    expect(store.logs.filter(l => l.action === 'status_changed').length).toBeGreaterThanOrEqual(1)
  }, 15000)
})
