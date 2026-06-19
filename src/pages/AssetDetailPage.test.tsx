import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthProvider } from '@/contexts/AuthContext'
import { AssetDetailPage } from './AssetDetailPage'
import { InMemoryAssetRepository, InMemoryWorkstationLicenseRepository } from '@/infra/repositories'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { AssetReferenceData } from '@/domain/asset'
import type { Role } from '@/config/roles'

const REF: AssetReferenceData = {
  statuses: [
    { id: 'st_warehouse', name: 'На складе', color: 'gray' },
    { id: 'st_assigned', name: 'Выдано', color: 'emerald' },
    { id: 'st_repair', name: 'В ремонте', color: 'orange' },
    { id: 'st_disposed', name: 'Списано', color: 'red' },
  ],
  branches: [{ id: 'b_main', name: 'HQ' }], departments: [],
  categories: [{ id: 'cat_laptop', name: 'Ноутбук', group: 'devices', lucideIcon: 'laptop' }],
  employees: [],
}

async function seed(role: Role) {
  const store = createInMemoryAuditStore()
  const repo = new InMemoryAssetRepository([], REF, inMemoryAuditContext(store))
  const { value } = await repo.createAsset(
    {
      categoryId: 'cat_laptop',
      brand: 'Dell',
      model: 'XPS',
      invCode: '450/1',
      serial: 'SN1',
      assignment: null,
      branchId: 'b_main',
      deptId: null,
      currentSpecs: { ram: '8 ГБ' },
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

describe('AssetDetailPage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('ru')
  })

  it('renders the asset identity (inv code + brand/model)', async () => {
    await seed('tech_admin')
    await waitFor(() => screen.getByText(/450\/1/))
    expect(screen.getByText(/Dell|XPS/)).toBeTruthy()
  })

  it('Upgrades panel + add-action visible for tech_admin on a hasSpecs category', async () => {
    await seed('tech_admin')
    await waitFor(() => screen.getByText(/Апгрейд/i))
    expect(screen.getByRole('button', { name: /Добавить апгрейд/i })).toBeTruthy()
  })

  it('Upgrades add-action is NOT shown to asset_admin (tech-only)', async () => {
    await seed('asset_admin')
    await waitFor(() => screen.getByText(/450\/1/))
    expect(screen.queryByRole('button', { name: /Добавить апгрейд/i })).toBeNull()
  })

  it('write-off decouples a reusable device-bound workstation license', async () => {
    const store = createInMemoryAuditStore()
    const auditCtx = inMemoryAuditContext(store)
    const licenseRepo = new InMemoryWorkstationLicenseRepository(auditCtx)
    const repo = new InMemoryAssetRepository([], REF, auditCtx, licenseRepo)

    // Seed an asset
    const { value: asset } = await repo.createAsset(
      {
        categoryId: 'cat_laptop',
        brand: 'Dell',
        model: 'XPS',
        invCode: '999/1',
        serial: 'SN99',
        assignment: null,
        branchId: 'b_main',
        deptId: null,
        currentSpecs: null,
      },
      { uid: 'u1', role: 'asset_admin' },
    )

    // Seed a reusable license device-bound to the asset
    await licenseRepo.createLicense(
      {
        name: 'Windows 11 Pro',
        type: 'Retail',
        isReusable: true,
        assign: { to: 'device', assetId: asset.id },
      },
      { uid: 'u1', role: 'asset_admin' },
    )

    // Confirm it is bound before the write-off
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

    // Wait for detail page to load, then click write-off
    await waitFor(() => screen.getByText(/999\/1/))
    const writeOffBtn = screen.getByRole('button', { name: /Списать/i })
    fireEvent.click(writeOffBtn)

    // After the async service call, asset is disposed and license is decoupled
    await waitFor(async () => {
      const updated = await repo.getAsset(asset.id)
      expect(updated?.statusId).toBe('st_disposed')
    })

    const boundAfter = await licenseRepo.listForAsset(asset.id)
    expect(boundAfter).toHaveLength(0)
  })

  it('tech_admin can add an upgrade and the audit/upgrade list updates', async () => {
    const { repo, asset } = await seed('tech_admin')

    // Wait for the page to load and the "Добавить апгрейд" button to appear
    await waitFor(() => screen.getByRole('button', { name: /Добавить апгрейд/i }))

    // Click "Добавить апгрейд" to open the inline sub-form
    fireEvent.click(screen.getByRole('button', { name: /Добавить апгрейд/i }))

    // Wait for the after input to appear (the sub-form opened)
    await waitFor(() => screen.getByPlaceholderText(/Стало/i))

    // Component Select defaults to 'RAM' (first UPGRADE_COMPONENTS option) — confirm it's selected
    const componentSelect = screen.getByRole('combobox') as HTMLSelectElement
    expect(componentSelect.value).toBe('RAM')

    // Type '16 ГБ' into the after field
    const afterInput = screen.getByPlaceholderText(/Стало/i)
    fireEvent.change(afterInput, { target: { value: '16 ГБ' } })

    // Click the confirm button
    const confirmBtn = screen.getByRole('button', { name: /Сохранить/i })
    fireEvent.click(confirmBtn)

    // Wait for the upgrade to be saved and the list to update
    await waitFor(async () => {
      const upgrades = await repo.listUpgrades(asset.id)
      expect(upgrades.length).toBe(1)
    })

    // Verify the spec was updated
    const updated = await repo.getAsset(asset.id)
    expect(updated?.currentSpecs?.ram).toBe('16 ГБ')
  })
})
