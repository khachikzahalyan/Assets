/**
 * AssetDetailPage — TransferPanel / RepairCard / role-gating integration tests.
 *
 * What changed from the old tests:
 * - The old "Назначить" (AssignmentForm / LifecycleActions) flow is GONE.
 *   Transfer now goes through AssignmentCard «Передать» → TransferPanel →
 *   ModeTile selection → commit «Передать».
 * - The underlying repository call is now `changeStatus(id, toStatusId, actor, { assignment })`
 *   which writes action 'status_changed' to the audit log (NOT 'assigned' / 'returned').
 * - The old AssignmentRepository.assign path enqueued mail — the new changeStatus path does NOT.
 *   All mail assertions have been REMOVED (see below for rationale).
 * - "Вернуть" (return) lifecycle button is gone; warehouse-return is done via
 *   TransferPanel «Склад» mode.
 * - AssignmentForm file-validation test: removed (AssignmentForm is no longer wired into the page).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { AssetDetailPage } from './AssetDetailPage'
import {
  InMemoryAssetRepository,
  InMemoryAssignmentRepository,
  type MailEntry,
} from '@/infra/repositories'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'
import type { Asset, AssetReferenceData } from '@/domain/asset'

// Prevent Firebase initialisation errors in test environment (no VITE_FIREBASE_* env vars).
vi.mock('@/lib/firebase', () => ({
  app: () => ({}),
  auth: () => ({}),
  db: () => ({}),
  storage: () => ({}),
  functions: () => ({}),
}))

// Prevent storage upload calls in tests
vi.mock('@/infra/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infra/storage')>()
  return {
    ...actual,
    uploadActScan: vi.fn().mockResolvedValue('acts/a_1/scan.pdf'),
    actScanUrl: vi.fn().mockResolvedValue('https://example.com/scan.pdf'),
  }
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function refData(): AssetReferenceData {
  return {
    statuses: [
      { id: 'st_warehouse', name: 'На складе', color: 'gray' },
      { id: 'st_assigned',  name: 'Выдано',    color: 'green' },
      { id: 'st_repair',    name: 'В ремонте', color: 'orange' },
      { id: 'st_disposed',  name: 'Списано',   color: 'red' },
    ],
    branches: [
      { id: 'br_main', name: 'Главный' },
      { id: 'br_2',    name: 'Филиал 2' },
    ],
    departments: [
      { id: 'dept_1', name: 'ИТ-отдел' },
    ],
    categories: [
      { id: 'cat_laptop', name: 'Ноутбук', group: 'devices', lucideIcon: 'laptop' },
    ],
    employees: [
      { id: 'e_1', firstName: 'Иван', lastName: 'Петров', email: 'ivan@example.test' },
    ],
  }
}

function mkAsset(over: Partial<Asset> = {}): Asset {
  return {
    id: 'a_1', categoryId: 'cat_laptop', brand: 'Dell', model: 'XPS', invCode: '450/1',
    serial: 'SN', statusId: 'st_warehouse', assignment: null, branchId: 'br_main', deptId: null,
    updatedAt: '2026-01-01T00:00:00.000Z', currentSpecs: null,
    ...over,
  }
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderPage(
  assets: Asset[],
  mail: MailEntry[],
  role: 'super_admin' | 'asset_admin' | 'tech_admin' | 'employee' = 'asset_admin',
) {
  const store    = createInMemoryAuditStore()
  const ctx      = inMemoryAuditContext(store)
  const assetRepo = new InMemoryAssetRepository(assets, refData(), ctx)
  const asnRepo   = new InMemoryAssignmentRepository(assets, mail, ctx)
  const auth = {
    user: { id: 'u_1', name: 'A', email: 'a@example.test', role, initials: 'A', avatarColor: '' },
    role,
    status: 'ready' as const,
    setRole: () => {},
    signOut: () => {},
  }
  render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/assets/a_1']}>
          <Routes>
            <Route
              path="/assets/:id"
              element={<AssetDetailPage repository={assetRepo} assignmentRepository={asnRepo} />}
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )
  return { store, assetRepo }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AssetDetailPage — TransferPanel flow', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })

  // ---- 1. ASSIGN TO BRANCH ------------------------------------------------
  it('assign to branch: AssignmentCard «Передать» → Филиал → select → commit → st_assigned + branch assignment + status_changed audit', async () => {
    // Arrange
    const assets = [mkAsset()]; const mail: MailEntry[] = []
    const { store, assetRepo } = renderPage(assets, mail)

    // Wait for page to load
    await waitFor(() => screen.getByText(/450\/1/))

    // Act: open TransferPanel
    fireEvent.click(screen.getByRole('button', { name: /Передать/i }))

    // Act: click «Филиал» mode tile
    const branchTile = await screen.findByRole('button', { name: 'Филиал' })
    fireEvent.click(branchTile)

    // Act: select branch from the Select dropdown
    const selectEl = await screen.findByRole('combobox')
    fireEvent.change(selectEl, { target: { value: 'br_2' } })

    // Act: click the commit «Передать» button (the one in TransferPanel footer)
    await waitFor(() => {
      const btns = screen.getAllByRole('button', { name: /Передать/i })
      expect(btns.length).toBeGreaterThanOrEqual(1)
    })
    const allTransferBtns = screen.getAllByRole('button', { name: /Передать/i })
    fireEvent.click(allTransferBtns[allTransferBtns.length - 1]!)

    // Assert (a): asset is now st_assigned with branch assignment
    await waitFor(async () => {
      const updated = await assetRepo.getAsset('a_1')
      expect(updated?.statusId).toBe('st_assigned')
      expect(updated?.assignment).toEqual({ mode: 'branch', branchId: 'br_2' })
    })

    // Assert (b): exactly one 'status_changed' audit entry (transfer action)
    // NOTE: changeStatus writes 'status_changed', NOT 'assigned' — this is by design.
    // The old AssignmentRepository.assign wrote 'assigned'; the new path does not.
    expect(store.logs.filter(l => l.action === 'status_changed')).toHaveLength(1)

    // NOTE: mail assertions REMOVED — the new changeStatus transfer path does NOT enqueue
    // mail. Only the old AssignmentRepository.assign path did.
  }, 15000)

  // ---- 2. ASSIGN TO EMPLOYEE ----------------------------------------------
  it('assign to employee: Сотрудник mode → select → commit → st_assigned + employee assignment + status_changed audit', async () => {
    // Arrange
    const assets = [mkAsset()]; const mail: MailEntry[] = []
    const { store, assetRepo } = renderPage(assets, mail)

    await waitFor(() => screen.getByText(/450\/1/))

    // Act: open TransferPanel
    fireEvent.click(screen.getByRole('button', { name: /Передать/i }))

    // Act: click «Сотрудник» mode tile
    const empTile = await screen.findByRole('button', { name: 'Сотрудник' })
    fireEvent.click(empTile)

    // Act: select the employee
    const selectEl = await screen.findByRole('combobox')
    fireEvent.change(selectEl, { target: { value: 'e_1' } })

    // Act: commit
    const allTransferBtns = screen.getAllByRole('button', { name: /Передать/i })
    fireEvent.click(allTransferBtns[allTransferBtns.length - 1]!)

    // Assert (a): asset assigned to employee
    await waitFor(async () => {
      const updated = await assetRepo.getAsset('a_1')
      expect(updated?.statusId).toBe('st_assigned')
      expect(updated?.assignment).toMatchObject({ mode: 'employee', employeeId: 'e_1' })
    })

    // Assert (b): one 'status_changed' audit entry
    // NOTE: transfer via changeStatus writes 'status_changed', NOT 'assigned'.
    expect(store.logs.filter(l => l.action === 'status_changed')).toHaveLength(1)

    // NOTE: mail assertions REMOVED — the new changeStatus transfer path does NOT enqueue mail.
  }, 15000)

  // ---- 3. RETURN TO WAREHOUSE (via TransferPanel «Склад» mode) ------------
  it('return to warehouse: Передать → Склад → commit → st_warehouse + assignment null + status_changed audit', async () => {
    // Arrange: start from an assigned asset
    const assets = [mkAsset({ statusId: 'st_assigned', assignment: { mode: 'branch', branchId: 'br_main' } })]
    const mail: MailEntry[] = []
    const { store, assetRepo } = renderPage(assets, mail)

    await waitFor(() => screen.getByText(/450\/1/))

    // Act: open TransferPanel
    fireEvent.click(screen.getByRole('button', { name: /Передать/i }))

    // Act: click «Склад» mode tile
    const warehouseTile = await screen.findByRole('button', { name: 'Склад' })
    fireEvent.click(warehouseTile)

    // Act: commit (Склад mode is immediately valid — no sub-form needed)
    const allTransferBtns = screen.getAllByRole('button', { name: /Передать/i })
    fireEvent.click(allTransferBtns[allTransferBtns.length - 1]!)

    // Assert (a): asset returned to warehouse, assignment cleared
    await waitFor(async () => {
      const updated = await assetRepo.getAsset('a_1')
      expect(updated?.statusId).toBe('st_warehouse')
      expect(updated?.assignment).toBeNull()
    })

    // Assert (b): one 'status_changed' audit entry
    // NOTE: 'returned' is no longer used — the new path writes 'status_changed'.
    expect(store.logs.filter(l => l.action === 'status_changed')).toHaveLength(1)
  }, 15000)

  // ---- 4. ASSIGN TO DEPARTMENT --------------------------------------------
  it('assign to department: Отдел mode → select → commit → st_assigned + department assignment', async () => {
    // Arrange
    const assets = [mkAsset()]; const mail: MailEntry[] = []
    const { assetRepo } = renderPage(assets, mail)

    await waitFor(() => screen.getByText(/450\/1/))

    // Act: open TransferPanel
    fireEvent.click(screen.getByRole('button', { name: /Передать/i }))

    // Act: click «Отдел» mode tile
    const deptTile = await screen.findByRole('button', { name: 'Отдел' })
    fireEvent.click(deptTile)

    // Act: select the department
    const selectEl = await screen.findByRole('combobox')
    fireEvent.change(selectEl, { target: { value: 'dept_1' } })

    // Act: commit
    const allTransferBtns = screen.getAllByRole('button', { name: /Передать/i })
    fireEvent.click(allTransferBtns[allTransferBtns.length - 1]!)

    // Assert: asset assigned to department
    await waitFor(async () => {
      const updated = await assetRepo.getAsset('a_1')
      expect(updated?.statusId).toBe('st_assigned')
      expect(updated?.assignment).toMatchObject({ mode: 'department', departmentId: 'dept_1' })
    })
  }, 15000)

  // ---- 5. TEMPORARY ASSIGNMENT --------------------------------------------
  it('assign temporarily (Аудитор + today date as default): Временно mode → kind → commit → st_assigned + temporary assignment', async () => {
    // Arrange
    const assets = [mkAsset()]; const mail: MailEntry[] = []
    const { assetRepo } = renderPage(assets, mail)

    await waitFor(() => screen.getByText(/450\/1/))

    // Act: open TransferPanel
    fireEvent.click(screen.getByRole('button', { name: /Передать/i }))

    // Act: click «Временно» mode tile
    const tempTile = await screen.findByRole('button', { name: 'Временно' })
    fireEvent.click(tempTile)

    // Act: select kind «Аудитор» from the Select in the temporary form.
    // TransferPanel initialises returnDate to todayStr, so once tempKind is set the
    // form is valid (returnDate >= todayStr is satisfied).
    const selectEl = await screen.findByRole('combobox')
    fireEvent.change(selectEl, { target: { value: 'audit' } })

    // Assert: commit button is now enabled
    await waitFor(() => {
      const allTransferBtns = screen.getAllByRole('button', { name: /Передать/i })
      const commitBtn = allTransferBtns[allTransferBtns.length - 1]!
      expect(commitBtn).not.toBeDisabled()
    })

    // Act: commit
    const allTransferBtns = screen.getAllByRole('button', { name: /Передать/i })
    fireEvent.click(allTransferBtns[allTransferBtns.length - 1]!)

    // Assert: asset assigned temporarily with audit kind
    await waitFor(async () => {
      const updated = await assetRepo.getAsset('a_1')
      expect(updated?.statusId).toBe('st_assigned')
      expect(updated?.assignment).toMatchObject({
        mode: 'temporary',
        tempKind: 'audit',
        isTemporary: true,
      })
    })
  }, 15000)

  // ---- 6. ROLE GATING: tech_admin has no «Передать» button ---------------
  it('tech_admin sees no «Передать» button in AssignmentCard but DOES see «Отправить в ремонт»', async () => {
    // Arrange
    const assets = [mkAsset()]; const mail: MailEntry[] = []
    renderPage(assets, mail, 'tech_admin')

    // Act: wait for page to load (repair card is visible for tech_admin)
    await screen.findByRole('button', { name: /Отправить в ремонт/ })

    // Assert: «Передать» is NOT present (canAssign=false for tech_admin)
    expect(screen.queryByRole('button', { name: /Передать/ })).toBeNull()
  }, 10000)
})

// ---------------------------------------------------------------------------
// REPAIR FLOW
// ---------------------------------------------------------------------------

describe('AssetDetailPage — RepairCard flow', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })

  it('Отправить в ремонт → reason → Подтвердить → st_repair + status_changed audit entry with comment', async () => {
    // Arrange
    const assets = [mkAsset()]; const mail: MailEntry[] = []
    const { store, assetRepo } = renderPage(assets, mail, 'tech_admin')

    await waitFor(() => screen.getByText(/450\/1/))

    // Act: click «Отправить в ремонт» dashed trigger button
    const sendBtn = screen.getByRole('button', { name: /Отправить в ремонт/ })
    fireEvent.click(sendBtn)

    // Act: type reason
    const repairTextarea = await screen.findByPlaceholderText(/Например: не включается/i)
    fireEvent.change(repairTextarea, { target: { value: 'Треснул экран' } })

    // Act: confirm
    const confirmBtn = screen.getByRole('button', { name: /Подтвердить/i })
    fireEvent.click(confirmBtn)

    // Assert: asset in repair
    await waitFor(async () => {
      const updated = await assetRepo.getAsset('a_1')
      expect(updated?.statusId).toBe('st_repair')
    })

    // Assert: one 'status_changed' audit with comment
    const repairLogs = store.logs.filter(l => l.action === 'status_changed')
    expect(repairLogs).toHaveLength(1)
    expect(repairLogs[0]?.comment).toBe('Треснул экран')
  }, 10000)

  it('Вернуть из ремонта → st_assigned + status_changed audit', async () => {
    // Arrange: asset pre-set to st_repair
    const assets = [mkAsset({ statusId: 'st_repair' })]; const mail: MailEntry[] = []
    const { store, assetRepo } = renderPage(assets, mail, 'tech_admin')

    await waitFor(() => screen.getByText(/450\/1/))

    // Assert: «Вернуть из ремонта» is shown (in-repair state)
    const returnBtn = await screen.findByRole('button', { name: /Вернуть из ремонта/ })

    // Act
    fireEvent.click(returnBtn)

    // Assert: asset returned to st_assigned (returnFromRepair → «Выдано» per spec)
    await waitFor(async () => {
      const updated = await assetRepo.getAsset('a_1')
      expect(updated?.statusId).toBe('st_assigned')
    })

    // Assert: one 'status_changed' audit entry
    expect(store.logs.filter(l => l.action === 'status_changed')).toHaveLength(1)
  }, 10000)
})
