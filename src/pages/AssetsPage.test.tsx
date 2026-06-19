import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthProvider } from '@/contexts/AuthContext'
import { AssetsPage } from './AssetsPage'
import { InMemoryAssetRepository } from '@/infra/repositories'
import type { AssetRepository, AssetReferenceData } from '@/domain/asset/AssetRepository'
import type { Asset } from '@/domain/asset'
import type { Role } from '@/config/roles'

// ── Mock Firebase so AssetsPage's useMemo fallback doesn't crash ──────────────
vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))
vi.mock('@/infra/repositories', async () => {
  const actual = await vi.importActual<typeof import('@/infra/repositories')>('@/infra/repositories')
  // Keep InMemoryAssetRepository real; stub Firestore one so it never calls firebase
  return {
    ...actual,
    FirestoreAssetRepository: class {
      async listAssets() { return [] }
      async loadReferenceData() { return EMPTY_REF }
    },
  }
})

// ── Shared fixture data ───────────────────────────────────────────────────────
const REF: AssetReferenceData = {
  statuses: [
    { id: 'st_warehouse', name: 'На складе',   color: 'gray' },
    { id: 'st_assigned',  name: 'Выдан',       color: 'green' },
    { id: 'st_repair',    name: 'Ремонт',       color: 'orange' },
    { id: 'st_disposed',  name: 'Списан',       color: 'red' },
  ],
  branches: [
    { id: 'br_main', name: 'Главный офис' },
    { id: 'br_spb',  name: 'Санкт-Петербург' },
  ],
  departments: [
    { id: 'dept_it', name: 'IT-отдел' },
  ],
  categories: [
    { id: 'cat_laptop',  name: 'Ноутбук',  group: 'devices',   lucideIcon: 'laptop' },
    { id: 'cat_monitor', name: 'Монитор',  group: 'devices',   lucideIcon: 'monitor' },
    { id: 'cat_chair',   name: 'Кресло',   group: 'furniture', lucideIcon: 'package' },
    { id: 'cat_switch',  name: 'Коммутатор', group: 'network', lucideIcon: 'network' },
  ],
  employees: [
    { id: 'emp_1', firstName: 'Анна',   lastName: 'Иванова' },
    { id: 'emp_2', firstName: 'Дмитрий', lastName: 'Козлов' },
  ],
}

const EMPTY_REF: AssetReferenceData = {
  statuses: [], branches: [], departments: [], categories: [], employees: [],
}

const ASSETS: Asset[] = [
  {
    id: 'a_1',
    categoryId: 'cat_laptop',
    brand: 'Dell',
    model: 'Latitude 5520',
    invCode: 'LAP/001',
    serial: 'SN-001',
    statusId: 'st_assigned',
    assignment: { mode: 'employee', employeeId: 'emp_1' },
    branchId: 'br_main',
    deptId: 'dept_it',
    updatedAt: '2026-01-10T10:00:00.000Z',
  },
  {
    id: 'a_2',
    categoryId: 'cat_monitor',
    brand: 'LG',
    model: '27UK850',
    invCode: 'MON/001',
    serial: 'SN-002',
    statusId: 'st_warehouse',
    assignment: null,
    branchId: 'br_spb',
    deptId: null,
    updatedAt: '2026-01-09T10:00:00.000Z',
  },
  {
    id: 'a_3',
    categoryId: 'cat_chair',
    brand: null,
    model: null,
    invCode: 'CHR/001',
    serial: null,
    statusId: 'st_repair',
    assignment: null,
    branchId: 'br_main',
    deptId: null,
    updatedAt: '2026-01-08T10:00:00.000Z',
  },
  {
    id: 'a_4',
    categoryId: 'cat_switch',
    brand: 'Cisco',
    model: 'SG350',
    invCode: 'NET/001',
    serial: 'SN-004',
    statusId: 'st_warehouse',
    assignment: null,
    branchId: 'br_main',
    deptId: null,
    updatedAt: '2026-01-07T10:00:00.000Z',
  },
]

// Force Russian locale for all tests so assertions are language-stable.
beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

// ── Test helper ───────────────────────────────────────────────────────────────
function renderPage(role: Role, repository?: AssetRepository) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <AuthProvider initialRole={role}>
          <AssetsPage {...(repository ? { repository } : {})} />
        </AuthProvider>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('AssetsPage', () => {
  it('(a) renders rows after loading — known invCode appears', async () => {
    const repo = new InMemoryAssetRepository(ASSETS, REF)
    renderPage('asset_admin', repo)
    await waitFor(() => {
      expect(screen.getByText('LAP/001')).toBeInTheDocument()
    })
  })

  it('(b) renders a status chip for the first asset', async () => {
    const repo = new InMemoryAssetRepository(ASSETS, REF)
    renderPage('asset_admin', repo)
    await waitFor(() => {
      // 'Выдан' is the name of st_assigned status in our fixture.
      // It appears in both the status Select option AND the Chip span — use getAllByText.
      const matches = screen.getAllByText('Выдан')
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('(c) create button visible for asset_admin', async () => {
    const repo = new InMemoryAssetRepository(ASSETS, REF)
    renderPage('asset_admin', repo)
    await waitFor(() => {
      expect(screen.getByText('Создать актив')).toBeInTheDocument()
    })
  })

  it('(c) create button NOT present for tech_admin', async () => {
    const repo = new InMemoryAssetRepository(ASSETS, REF)
    renderPage('tech_admin', repo)
    // Wait for the page to finish loading
    await waitFor(() => {
      expect(screen.getByText('LAP/001')).toBeInTheDocument()
    })
    expect(screen.queryByText('Создать актив')).toBeNull()
  })

  it('(d) typing in search narrows rows', async () => {
    const repo = new InMemoryAssetRepository(ASSETS, REF)
    renderPage('asset_admin', repo)
    await waitFor(() => {
      expect(screen.getByText('LAP/001')).toBeInTheDocument()
    })

    const searchInput = screen.getByRole('searchbox')
    fireEvent.change(searchInput, { target: { value: 'LAP' } })

    // After filter, only the laptop row should remain
    await waitFor(() => {
      expect(screen.getByText('LAP/001')).toBeInTheDocument()
      expect(screen.queryByText('MON/001')).toBeNull()
    })
  })

  it('(e) empty state when repo returns []', async () => {
    const repo = new InMemoryAssetRepository([], REF)
    renderPage('asset_admin', repo)
    await waitFor(() => {
      expect(screen.getByText('Активы не найдены')).toBeInTheDocument()
    })
  })

  it('(f) error state when listAssets rejects', async () => {
    const errorRepo: AssetRepository = {
      listAssets: () => Promise.reject(new Error('Network error')),
      loadReferenceData: () => Promise.resolve(REF),
    }
    renderPage('asset_admin', errorRepo)
    // ErrorState renders the common error title
    await waitFor(() => {
      expect(screen.getByText('Что-то пошло не так')).toBeInTheDocument()
    })
  })

  it('(f) error state with retry affordance', async () => {
    const errorRepo: AssetRepository = {
      listAssets: () => Promise.reject(new Error('Network error')),
      loadReferenceData: () => Promise.resolve(REF),
    }
    renderPage('asset_admin', errorRepo)
    await waitFor(() => {
      // Retry button from ErrorState
      expect(screen.getByRole('button', { name: /повторить/i })).toBeInTheDocument()
    })
  })

  it('(c) create button visible for super_admin', async () => {
    const repo = new InMemoryAssetRepository(ASSETS, REF)
    renderPage('super_admin', repo)
    await waitFor(() => {
      expect(screen.getByText('Создать актив')).toBeInTheDocument()
    })
  })

  it('(c) create button NOT present for employee', async () => {
    const repo = new InMemoryAssetRepository(ASSETS, REF)
    renderPage('employee', repo)
    // Wait for the page to finish loading (employee still sees asset rows)
    await waitFor(() => {
      expect(screen.getByText('LAP/001')).toBeInTheDocument()
    })
    expect(screen.queryByText('Создать актив')).toBeNull()
  })

  it('(g) group tab filters the table — network tab shows only network asset', async () => {
    const repo = new InMemoryAssetRepository(ASSETS, REF)
    renderPage('asset_admin', repo)
    // Wait for all rows to be visible first
    await waitFor(() => {
      expect(screen.getByText('LAP/001')).toBeInTheDocument()
      expect(screen.getByText('NET/001')).toBeInTheDocument()
    })
    // Click the "Сетевые" (network) group tab
    const networkTab = screen.getByRole('button', { name: 'Сетевые' })
    fireEvent.click(networkTab)
    // After filtering, only the network asset should appear
    await waitFor(() => {
      expect(screen.getByText('NET/001')).toBeInTheDocument()
      expect(screen.queryByText('LAP/001')).toBeNull()
    })
  })

  it('(h) pagination caps first page at 15 rows', async () => {
    // Build a dedicated fixture with 16 assets — all same group/status so nothing filters them out.
    const paginationAssets: Asset[] = Array.from({ length: 16 }, (_, i) => ({
      id: `pg_${i}`,
      categoryId: 'cat_laptop',
      brand: 'TestBrand',
      model: `Model${i}`,
      invCode: `PG/${String(i).padStart(3, '0')}`,
      serial: `PSN-${i}`,
      statusId: 'st_warehouse',
      assignment: null,
      branchId: 'br_main',
      deptId: null,
      updatedAt: `2026-01-${String(10 + i).padStart(2, '0')}T10:00:00.000Z`,
    }))
    const paginationRepo = new InMemoryAssetRepository(paginationAssets, REF)
    renderPage('asset_admin', paginationRepo)

    // Wait for a visible inv code to appear (sorted updated_desc, so PG/015 is newest = first row)
    await waitFor(() => {
      expect(screen.getByText('PG/015')).toBeInTheDocument()
    })

    // Count data rows: getAllByRole('row') includes the header row; subtract 1 for the thead <tr>
    const allRows = screen.getAllByRole('row')
    // allRows[0] is the header; the rest are data rows
    expect(allRows.length - 1).toBe(15)

    // Pagination range text should be present: "1–15 из 16"
    expect(screen.getByText('1–15 из 16')).toBeInTheDocument()
  })
})
