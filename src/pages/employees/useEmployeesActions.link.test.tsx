/**
 * useEmployeesActions — handleConfirmLink handover email.
 *
 * The «Привязать активы» flow (employees page → drawer → AssetPickerModal)
 * must notify the receiving employee by email for every linked asset, exactly
 * like the TransferPanel «Передать» path. Best-effort: an employee without an
 * email gets no call; the link itself never depends on the email result.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthContext } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { useEmployeesActions } from './useEmployeesActions'
import type { EmployeesDataBag } from './useEmployeesData'
import type { Employee } from '@/domain/employee'

vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

vi.mock('@/lib/notifications/sendAccessEmail', () => ({
  sendAccessEmail: vi.fn().mockResolvedValue({ ok: true }),
}))
import { sendAccessEmail } from '@/lib/notifications/sendAccessEmail'

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeEmployee(over: Partial<Employee> = {}): Employee {
  return {
    id: 'emp_1', firstName: 'Анна', lastName: 'Смирнова', email: 'anna@example.test',
    phone: null, position: null, branchId: null, departmentId: null,
    status: 'active', terminatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

const STOCK = [
  { id: 'a1', categoryId: 'cat_laptop', title: 'Dell XPS', invCode: '450/100', cat: 'Ноутбук', icon: 'laptop', group: 'devices' },
  { id: 'a2', categoryId: 'cat_printer', title: 'HP LaserJet', invCode: '460/200', cat: 'Принтер', icon: 'printer', group: 'devices' },
]

function makeBag(pickerTarget: Employee, over: Record<string, unknown> = {}) {
  const asnRepo = {
    assign: vi.fn().mockResolvedValue({ value: {}, auditId: 'a_1' }),
    returnAsset: vi.fn().mockResolvedValue({ value: {}, auditId: 'a_2' }),
    listAssignmentsForEmployee: vi.fn().mockResolvedValue([]),
  }
  const assetRepo = {
    changeStatus: vi.fn().mockResolvedValue({ value: {}, auditId: 'a_3' }),
    listAssetsForEmployee: vi.fn().mockResolvedValue([]),
  }
  const repo = {
    archiveEmployee: vi.fn().mockResolvedValue({ value: {}, auditId: 'a_4' }),
  }
  const bag = {
    repo, assetRepo, asnRepo,
    defaultLoadAssetCounts: vi.fn().mockResolvedValue({}), assetCountsProp: undefined,
    employees: [pickerTarget], former: [], catMap: new Map(),
    assetCountOf: () => 0, headOfficeBranchId: 'br_main',
    detailId: null, setDetailId: vi.fn(),
    detailLinkedAssets: [], setDetailLinkedAssets: vi.fn(),
    detailAssetsLoading: false, setDetailAssetsLoading: vi.fn(), detailReqRef: { current: 0 },
    setFormOpen: vi.fn(), setFormInitial: vi.fn(),
    handoverAssets: [], setHandoverTarget: vi.fn(), setHandoverAssets: vi.fn(),
    setPickerTarget: vi.fn(), setPickerStock: vi.fn(),
    setRestoreTarget: vi.fn(),
    handoverTarget: null, pickerTarget, pickerStock: STOCK, restoreTarget: null,
    setAssetCounts: vi.fn(),
    reload: vi.fn().mockResolvedValue(undefined),
    ...over,
  } as unknown as EmployeesDataBag
  return { bag, asnRepo, assetRepo, repo }
}

function wrapper({ children }: { children: ReactNode }) {
  const auth = {
    user: { id: 'u_1', name: 'Admin', email: 'a@x', role: 'asset_admin' as const, initials: 'A', avatarColor: '' },
    role: 'asset_admin' as const, status: 'ready' as const, setRole: () => {}, signOut: () => {},
  }
  return (
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={auth}>
        <ToastProvider>{children}</ToastProvider>
      </AuthContext.Provider>
    </I18nextProvider>
  )
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useEmployeesActions — handleConfirmLink handover email', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
    vi.mocked(sendAccessEmail).mockClear()
  })

  it('links two assets → one email per linked asset with label, code and asset id', async () => {
    const emp = makeEmployee()
    const { bag, asnRepo } = makeBag(emp)
    const { result } = renderHook(() => useEmployeesActions(bag), { wrapper })

    await act(async () => { await result.current.handleConfirmLink(['a1', 'a2']) })

    expect(asnRepo.assign).toHaveBeenCalledTimes(2)
    expect(sendAccessEmail).toHaveBeenCalledTimes(2)

    const calls = vi.mocked(sendAccessEmail).mock.calls.map(c => c[0])
    expect(calls[0]).toMatchObject({
      email: 'anna@example.test', name: 'Анна Смирнова', kind: 'asset',
      assetLabel: 'Dell XPS', assetCode: '450/100', assetId: 'a1',
    })
    expect(calls[1]).toMatchObject({
      email: 'anna@example.test', kind: 'asset',
      assetLabel: 'HP LaserJet', assetCode: '460/200', assetId: 'a2',
    })
  })

  it('employee without an email → assets link fine, no email attempted', async () => {
    const emp = makeEmployee({ email: '' })
    const { bag, asnRepo } = makeBag(emp)
    const { result } = renderHook(() => useEmployeesActions(bag), { wrapper })

    await act(async () => { await result.current.handleConfirmLink(['a1']) })

    expect(asnRepo.assign).toHaveBeenCalledTimes(1)
    expect(sendAccessEmail).not.toHaveBeenCalled()
  })
})

// ── Drawer «Передать» (handleTransferAssets) ───────────────────────────────────

describe('useEmployeesActions — handleTransferAssets handover email', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
    vi.mocked(sendAccessEmail).mockClear()
  })

  const TARGET = makeEmployee({ id: 'emp_2', firstName: 'Пето', lastName: 'Петян', email: 'peto@example.test' })
  const LINKED = [
    { id: 'a1', categoryId: 'cat_thinkpad', icon: 'laptop', title: 'Lenovo Thinkpad 5', invCode: '450/2930192', cat: 'Компьютер', transferredAt: '' },
  ]

  it('transfer to another employee → email to the receiving employee with asset label/code', async () => {
    const owner = makeEmployee()
    const { bag, assetRepo } = makeBag(owner, {
      employees: [owner, TARGET],
      detailLinkedAssets: LINKED,
    })
    const { result } = renderHook(() => useEmployeesActions(bag), { wrapper })

    await act(async () => {
      await result.current.handleTransferAssets(['a1'], { kind: 'employee', id: 'emp_2', label: 'Пето Петян' })
    })

    expect(assetRepo.changeStatus).toHaveBeenCalledTimes(1)
    expect(sendAccessEmail).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendAccessEmail).mock.calls[0]![0]).toMatchObject({
      email: 'peto@example.test', name: 'Пето Петян', kind: 'asset',
      assetLabel: 'Lenovo Thinkpad 5', assetCode: '450/2930192', assetId: 'a1',
    })
  })

  it('transfer to warehouse → no email', async () => {
    const owner = makeEmployee()
    const { bag } = makeBag(owner, { employees: [owner, TARGET], detailLinkedAssets: LINKED })
    const { result } = renderHook(() => useEmployeesActions(bag), { wrapper })

    await act(async () => {
      await result.current.handleTransferAssets(['a1'], { kind: 'warehouse' })
    })

    expect(sendAccessEmail).not.toHaveBeenCalled()
  })

  it('failed transfer → no email for the failed asset', async () => {
    const owner = makeEmployee()
    const { bag, assetRepo } = makeBag(owner, { employees: [owner, TARGET], detailLinkedAssets: LINKED })
    assetRepo.changeStatus.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useEmployeesActions(bag), { wrapper })

    await act(async () => {
      await result.current.handleTransferAssets(['a1'], { kind: 'employee', id: 'emp_2', label: 'Пето Петян' })
    })

    expect(sendAccessEmail).not.toHaveBeenCalled()
  })
})

// ── «Приёмка техники» on termination (handleHandoverConfirm) ───────────────────

describe('useEmployeesActions — handleHandoverConfirm handover email', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
    vi.mocked(sendAccessEmail).mockClear()
  })

  const TARGET = makeEmployee({ id: 'emp_2', firstName: 'Пето', lastName: 'Петян', email: 'peto@example.test' })
  const HAND = [
    { id: 'a1', categoryId: 'cat_monitor', icon: 'monitor', title: 'Asus H510', invCode: '450/2939192', sn: 'SN-K231L' },
  ]

  it('asset redirected to another employee during приёмка → email to that employee', async () => {
    const fired = makeEmployee()
    const { bag, assetRepo, repo } = makeBag(fired, {
      employees: [fired, TARGET],
      handoverTarget: fired,
      handoverAssets: HAND,
    })
    const { result } = renderHook(() => useEmployeesActions(bag), { wrapper })

    await act(async () => {
      await result.current.handleHandoverConfirm([
        { id: 'a1', received: true, destination: { kind: 'employee', id: 'emp_2', label: 'Пето Петян' } },
      ])
    })

    expect(assetRepo.changeStatus).toHaveBeenCalledTimes(1)
    expect(repo.archiveEmployee).toHaveBeenCalledTimes(1)
    expect(sendAccessEmail).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendAccessEmail).mock.calls[0]![0]).toMatchObject({
      email: 'peto@example.test', kind: 'asset',
      assetLabel: 'Asus H510', assetCode: '450/2939192', assetId: 'a1',
    })
  })

  it('asset returned to warehouse during приёмка → no email', async () => {
    const fired = makeEmployee()
    const { bag, asnRepo } = makeBag(fired, {
      employees: [fired, TARGET],
      handoverTarget: fired,
      handoverAssets: HAND,
    })
    const { result } = renderHook(() => useEmployeesActions(bag), { wrapper })

    await act(async () => {
      await result.current.handleHandoverConfirm([
        { id: 'a1', received: true, destination: { kind: 'warehouse' } },
      ])
    })

    expect(asnRepo.returnAsset).toHaveBeenCalledTimes(1)
    expect(sendAccessEmail).not.toHaveBeenCalled()
  })
})
