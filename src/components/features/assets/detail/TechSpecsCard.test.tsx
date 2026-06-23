/**
 * TechSpecsCard render tests.
 *
 * Covers:
 *  - All 4 spec tile labels render for a fully-specced computer asset.
 *  - Cooling + Battery tiles render for a laptop; Cooling + PSU for a desktop.
 *  - Cooling/PSU/Battery tiles do NOT render for a monitor (non-computer category).
 *  - The CPU value text is visible.
 *  - NO "[Icon] unknown name" console.warn fires during render — this is the
 *    core regression guard proving the "?" fallback icons are gone.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { TechSpecsCard } from './TechSpecsCard'
import type { Asset } from '@/domain/asset'

// ---------------------------------------------------------------------------
// Firebase mock — prevents SDK initialisation errors in jsdom.
// ---------------------------------------------------------------------------
vi.mock('@/lib/firebase', () => ({
  app: () => ({}),
  auth: () => ({}),
  db: () => ({}),
  storage: () => ({}),
  functions: () => ({}),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_SPECS = {
  cpu: 'Intel Core i7-1265U',
  gpu: 'Intel Iris Xe',
  ram: '16 ГБ',
  ssd: 'Samsung 990 PRO 1 ТБ NVMe',
}

/** Laptop asset — expects Cooling + Battery tiles (no PSU). */
const LAPTOP_ASSET: Asset = {
  id:         'asset_test_laptop',
  categoryId: 'cat_laptop',
  brand:      'Dell',
  model:      'Latitude 7420',
  invCode:    '450/300001',
  serial:     'SN-TEST-001',
  statusId:   'st_warehouse',
  assignment: null,
  branchId:   'b_main',
  deptId:     null,
  updatedAt:  '2026-06-01T10:00:00.000Z',
  currentSpecs: { ...BASE_SPECS },
}

/** Desktop asset — expects Cooling + PSU tiles (no Battery). */
const DESKTOP_ASSET: Asset = {
  ...LAPTOP_ASSET,
  id:         'asset_test_desktop',
  categoryId: 'cat_desktop',
  invCode:    '450/300002',
  serial:     'SN-TEST-002',
}

/** Monitor asset — NOT a computer family; should NOT render Cooling/PSU/Battery. */
const MONITOR_ASSET: Asset = {
  ...LAPTOP_ASSET,
  id:         'asset_test_monitor',
  categoryId: 'cat_monitor',
  invCode:    '450/300003',
  serial:     'SN-TEST-003',
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('TechSpecsCard', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('ru')
  })

  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  function renderCard(asset: Asset = LAPTOP_ASSET) {
    return render(
      <I18nextProvider i18n={i18n}>
        <TechSpecsCard asset={asset} licenses={[]} />
      </I18nextProvider>,
    )
  }

  // ---- Core spec tile labels (laptop) --------------------------------------

  it('renders the Процессор tile label', () => {
    renderCard()
    expect(screen.getByText('Процессор')).toBeInTheDocument()
  })

  it('renders the Видеокарта tile label', () => {
    renderCard()
    expect(screen.getByText('Видеокарта')).toBeInTheDocument()
  })

  it('renders the Оперативная память tile label', () => {
    renderCard()
    expect(screen.getByText('Оперативная память')).toBeInTheDocument()
  })

  it('renders the Накопитель tile label', () => {
    renderCard()
    expect(screen.getByText('Накопитель')).toBeInTheDocument()
  })

  // ---- CPU value -----------------------------------------------------------

  it('renders the CPU value text', () => {
    renderCard()
    expect(screen.getByText('Intel Core i7-1265U')).toBeInTheDocument()
  })

  // ---- No unknown-icon warnings — core regression guard -------------------

  it('does NOT emit [Icon] unknown name warning during render', () => {
    renderCard()
    const unknownIconWarns = warnSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('[Icon] unknown name'),
    )
    expect(unknownIconWarns).toHaveLength(0)
  })

  // ---- Storage badge -------------------------------------------------------

  it('renders the NVMe badge for the SSD spec', () => {
    renderCard()
    expect(screen.getByText('NVMe')).toBeInTheDocument()
  })

  // ---- Empty specs fallback ------------------------------------------------

  it('shows empty-specs placeholder when asset has no currentSpecs', () => {
    const noSpecsAsset: Asset = { ...LAPTOP_ASSET, currentSpecs: null }
    renderCard(noSpecsAsset)
    expect(screen.queryByText('Процессор')).toBeNull()
    expect(screen.queryByText('Видеокарта')).toBeNull()
  })

  // ---- Laptop: Cooling + Battery tiles (no PSU) ----------------------------

  it('renders the Охлаждение tile for a laptop', () => {
    renderCard(LAPTOP_ASSET)
    expect(screen.getByText('Охлаждение')).toBeInTheDocument()
  })

  it('renders the Аккумулятор tile for a laptop', () => {
    renderCard(LAPTOP_ASSET)
    expect(screen.getByText('Аккумулятор')).toBeInTheDocument()
  })

  it('does NOT render a PSU tile for a laptop', () => {
    renderCard(LAPTOP_ASSET)
    expect(screen.queryByText('Блок питания')).toBeNull()
    expect(screen.queryByText('Блоки питания')).toBeNull()
  })

  // ---- Desktop: Cooling + PSU tiles (no Battery) ---------------------------

  it('renders the Охлаждение tile for a desktop', () => {
    renderCard(DESKTOP_ASSET)
    expect(screen.getByText('Охлаждение')).toBeInTheDocument()
  })

  it('renders the Блок питания tile for a desktop', () => {
    renderCard(DESKTOP_ASSET)
    expect(screen.getByText('Блок питания')).toBeInTheDocument()
  })

  it('does NOT render the Аккумулятор tile for a desktop', () => {
    renderCard(DESKTOP_ASSET)
    expect(screen.queryByText('Аккумулятор')).toBeNull()
  })

  // ---- Monitor: no Cooling / PSU / Battery tiles ---------------------------

  it('does NOT render Cooling tile for a monitor', () => {
    renderCard(MONITOR_ASSET)
    expect(screen.queryByText('Охлаждение')).toBeNull()
  })

  it('does NOT render PSU tile for a monitor', () => {
    renderCard(MONITOR_ASSET)
    expect(screen.queryByText('Блок питания')).toBeNull()
    expect(screen.queryByText('Блоки питания')).toBeNull()
  })

  it('does NOT render Battery tile for a monitor', () => {
    renderCard(MONITOR_ASSET)
    expect(screen.queryByText('Аккумулятор')).toBeNull()
  })

  // ---- Multi-slot storage (updated: ONE tile with plural label + all entries) ----

  it('renders ONE «Накопители» tile (plural) for a 3-slot SSD+HDD+M.2 storage string', () => {
    const multiSlotAsset: Asset = {
      ...LAPTOP_ASSET,
      id:         'asset_test_multislot',
      invCode:    '450/300010',
      serial:     'SN-MULTI-001',
      currentSpecs: {
        cpu: 'Intel Core i7-1265U',
        ram: '16 ГБ',
        ssd: 'SSD 256 ГБ + HDD 1 ТБ + M.2 512 ГБ',
      },
    }
    renderCard(multiSlotAsset)

    // Exactly ONE plural label — no separate «Накопитель» tile
    expect(screen.getByText('Накопители')).toBeInTheDocument()
    expect(screen.queryByText('Накопитель')).toBeNull()
  })

  it('shows all 3 badge+capacity entries inside the single Накопители tile', () => {
    const multiSlotAsset: Asset = {
      ...LAPTOP_ASSET,
      id:         'asset_test_multislot_badges',
      invCode:    '450/300011',
      serial:     'SN-MULTI-002',
      currentSpecs: {
        ssd: 'SSD 256 ГБ + HDD 1 ТБ + M.2 512 ГБ',
      },
    }
    renderCard(multiSlotAsset)

    // All type badges are visible inside the single tile
    expect(screen.getByText('SSD')).toBeInTheDocument()
    expect(screen.getByText('HDD')).toBeInTheDocument()
    expect(screen.getByText('M.2')).toBeInTheDocument()
    // All capacity values are visible
    expect(screen.getByText('256 ГБ')).toBeInTheDocument()
    expect(screen.getByText('1 ТБ')).toBeInTheDocument()
    expect(screen.getByText('512 ГБ')).toBeInTheDocument()
  })

  it('renders ONE singular «Накопитель» tile for a single-drive storage string', () => {
    const singleDriveAsset: Asset = {
      ...LAPTOP_ASSET,
      id:         'asset_test_single_drive',
      invCode:    '450/300012',
      serial:     'SN-SINGLE-001',
      currentSpecs: {
        ssd: 'SSD 512 ГБ',
      },
    }
    renderCard(singleDriveAsset)

    expect(screen.getByText('Накопитель')).toBeInTheDocument()
    expect(screen.queryByText('Накопители')).toBeNull()
  })

  // ---- Factory status green (Bug 2 fix) ------------------------------------

  it('factory cooling value "Заводское" renders with emerald colour class', () => {
    renderCard(LAPTOP_ASSET)
    // The value <p> element should carry the emerald class
    const coolingValue = screen.getByText('Заводское')
    expect(coolingValue.className).toContain('text-emerald-300')
  })

  it('factory battery value "Заводская" renders with emerald colour class', () => {
    renderCard(LAPTOP_ASSET)
    const batteryValue = screen.getByText('Заводская')
    expect(batteryValue.className).toContain('text-emerald-300')
  })

  it('factory PSU value "Заводской" renders with emerald colour class for desktop', () => {
    renderCard(DESKTOP_ASSET)
    const psuValue = screen.getByText('Заводской')
    expect(psuValue.className).toContain('text-emerald-300')
  })
})
