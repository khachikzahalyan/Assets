/**
 * AssetsPage — SWR cache integration tests.
 *
 * Task 6 of docs/superpowers/plans/list-page-swr-cache.md.
 *
 * (A) Warm-remount: a second mount of AssetsPage with the SAME repo instance
 *     reads its data from the SWR cache synchronously (loading=false from
 *     useCachedResource's useState initializer) so rows are present in the DOM
 *     immediately after render() returns — no waitFor needed, no skeleton rendered.
 *
 * (B) Background refresh: after the warm remount the hook fires a background
 *     revalidation (refreshing=true, loading stays false). A 3rd asset injected
 *     by the second repo call must appear via waitFor without any skeleton flash
 *     (loading never becomes true during background refresh).
 *
 * Cache isolation: setup.ts runs clearResourceCache() in afterEach, so the SWR
 * store is wiped between separate `it(...)` blocks.  The two mounts WITHIN each
 * test share the cache because clearResourceCache has not yet run — this is the
 * exact behaviour under test.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AuthProvider } from '@/contexts/AuthContext'
import { AssetsPage } from './AssetsPage'
import { InMemoryAssetRepository } from '@/infra/repositories'
import type { AssetRepository, AssetReferenceData } from '@/domain/asset/AssetRepository'
import type { Asset } from '@/domain/asset'
import type { Role } from '@/config/roles'

// ── Mocks — mirrors AssetsPage.test.tsx exactly ───────────────────────────────
vi.mock('@/lib/firebase', () => ({
  app:       () => ({}),
  auth:      () => ({}),
  db:        () => ({}),
  storage:   () => ({}),
  functions: () => ({}),
}))

vi.mock('@/infra/repositories', async () => {
  const actual = await vi.importActual<typeof import('@/infra/repositories')>('@/infra/repositories')
  // EMPTY_REF is defined inside the factory to survive vi.mock() hoisting.
  const EMPTY_REF: AssetReferenceData = {
    statuses: [], branches: [], departments: [], categories: [], employees: [], categoryGroups: [],
  }
  return {
    ...actual,
    FirestoreAssetRepository: class {
      async listAssets() { return [] }
      async loadReferenceData() { return EMPTY_REF }
    },
  }
})

// ── Reference-data fixture ────────────────────────────────────────────────────
const REF: AssetReferenceData = {
  statuses:       [{ id: 'st_warehouse', name: 'На складе', color: 'gray' }],
  branches:       [{ id: 'br_main', name: 'Главный офис' }],
  departments:    [{ id: 'dept_it',  name: 'IT-отдел' }],
  categories:     [{
    id: 'cat_laptop', name: 'Ноутбук', group: 'devices',
    categoryGroupId: 'grp_devices', lucideIcon: 'laptop',
  }],
  employees:      [],
  categoryGroups: [],
}

// ── Asset fixtures — inv codes unique to this file to avoid cross-file matches ─
const ASSET_A: Asset = {
  id: 'cache_a1', categoryId: 'cat_laptop', brand: 'Dell', model: 'XPS 15',
  invCode: 'CACHE/001', serial: 'S-C1', statusId: 'st_warehouse',
  assignment: null, branchId: 'br_main', deptId: null,
  updatedAt: '2026-01-10T10:00:00.000Z',
}
const ASSET_B: Asset = {
  id: 'cache_a2', categoryId: 'cat_laptop', brand: 'HP', model: 'EliteBook',
  invCode: 'CACHE/002', serial: 'S-C2', statusId: 'st_warehouse',
  assignment: null, branchId: 'br_main', deptId: null,
  updatedAt: '2026-01-09T10:00:00.000Z',
}
const ASSET_C: Asset = {
  id: 'cache_a3', categoryId: 'cat_laptop', brand: 'Lenovo', model: 'ThinkPad X1',
  invCode: 'CACHE/003', serial: 'S-C3', statusId: 'st_warehouse',
  assignment: null, branchId: 'br_main', deptId: null,
  updatedAt: '2026-01-08T10:00:00.000Z',
}

// Force Russian locale so assertions are language-stable (matches AssetsPage.test.tsx).
beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

function renderPage(role: Role, repository: AssetRepository) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <AuthProvider initialRole={role}>
          <AssetsPage repository={repository} />
        </AuthProvider>
      </MemoryRouter>
    </I18nextProvider>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('AssetsPage SWR cache', () => {
  it(
    '(A) warm remount: rows render synchronously without skeleton on second mount',
    async () => {
      // Arrange — single repo instance shared across both mounts
      const repo = new InMemoryAssetRepository([ASSET_A, ASSET_B], REF)

      // First mount: cold load (loading=true); wait for data to appear in the DOM
      const { unmount } = renderPage('asset_admin', repo)
      await waitFor(() => expect(screen.getByText('CACHE/001')).toBeInTheDocument())
      // Cache is now populated with the fetched { assets, ref } for this repo's key.
      unmount()

      // Second mount: cache hit — useCachedResource's useState initializer reads from
      // the module-scope store and returns { loading: false, data: cached } immediately.
      renderPage('asset_admin', repo)

      // ── Synchronous assertions — NO waitFor ──
      // Rows must be present in the first rendered frame because loading=false.
      expect(screen.getByText('CACHE/001')).toBeInTheDocument()
      expect(screen.getByText('CACHE/002')).toBeInTheDocument()

      // Skeletons must be absent (renderTableRegion only renders them when loading=true).
      // jsdom matchMedia stub (setup.ts) returns matches=false → isMobile=false → only
      // TableSkeleton is the candidate, but neither variant should appear here.
      expect(screen.queryByTestId('table-skeleton')).toBeNull()
      expect(screen.queryByTestId('card-list-skeleton')).toBeNull()
    },
  )

  it(
    '(B) background refresh: 3rd asset appears without any skeleton flash',
    async () => {
      // Arrange — controlled repo whose listAssets returns 2 assets on call 1
      // (first mount) and 3 assets on call 2 (background refresh on second mount).
      let listCallCount = 0
      const controlled: AssetRepository = {
        listAssets: vi.fn().mockImplementation(() => {
          listCallCount++
          const assets = listCallCount === 1
            ? [ASSET_A, ASSET_B]
            : [ASSET_A, ASSET_B, ASSET_C]
          return Promise.resolve(assets)
        }),
        loadReferenceData:     vi.fn().mockResolvedValue(REF),
        listAssetsForEmployee: vi.fn().mockResolvedValue([]),
        loadSelfServiceRefData: vi.fn().mockResolvedValue({
          statuses: [], categories: [], branches: [], departments: [],
        }),
        findByInvCode: vi.fn().mockResolvedValue(null),
      }

      // First mount: cold — listAssets call 1 → [ASSET_A, ASSET_B] cached
      const { unmount } = renderPage('asset_admin', controlled)
      await waitFor(() => expect(screen.getByText('CACHE/001')).toBeInTheDocument())
      unmount()

      // Second mount: warm — 2 assets from cache shown immediately; background
      // fetch fires (listAssets call 2 → [ASSET_A, ASSET_B, ASSET_C]).
      renderPage('asset_admin', controlled)

      // Immediately after render(): cached rows present, no skeleton
      expect(screen.getByText('CACHE/001')).toBeInTheDocument()
      expect(screen.getByText('CACHE/002')).toBeInTheDocument()
      expect(screen.queryByTestId('table-skeleton')).toBeNull()
      expect(screen.queryByTestId('card-list-skeleton')).toBeNull()

      // Background fetch resolves — 3rd asset must appear
      await waitFor(() => expect(screen.getByText('CACHE/003')).toBeInTheDocument())

      // After the update: still no skeleton (loading never became true; only
      // `refreshing` toggled, which is not wired to skeleton rendering).
      expect(screen.queryByTestId('table-skeleton')).toBeNull()
      expect(screen.queryByTestId('card-list-skeleton')).toBeNull()
    },
  )
})
