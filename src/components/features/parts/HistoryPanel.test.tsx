/**
 * HistoryPanel + HistoryRowMobile — tests for install/uninstall row display rules:
 *  - install rows show asset CATEGORY NAME (not SKU label) when partsAssets provided
 *  - serviceReplace rows show a "Сервис" chip on both desktop and mobile
 *  - receive rows are unchanged (still show SKU label)
 *  - fallback to SKU label when asset not found in partsAssets
 *
 * SEAM CHOICE: both components are pure (no Firebase, no hooks) — render with props.
 * react-i18next mocked so t('key') returns the key string.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// ── i18n mock — declared before any component import ──────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// ── jsdom shim: scrollTo is not implemented in jsdom ──────────────────────
// HistoryPanel uses scrollRef.current?.scrollTo(...) in a useEffect.
// jsdom's HTMLElement.prototype.scrollTo is undefined, so we stub it globally.
Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
  configurable: true,
  value: vi.fn(),
})

import type { Part, PartMovement, PartsAsset } from '@/domain/part/types'
import { HistoryPanel } from './HistoryPanel'
import { HistoryRowMobile } from './HistoryRowMobile'

// ── Fixture factories ──────────────────────────────────────────────────────
const makePart = (overrides: Partial<Part> = {}): Part => ({
  id: 'sku_psu_500w',
  name: 'Блок питания',
  category: 'psu',
  unit: 'шт',
  onHand: 5,
  broken: 0,
  lowStockThreshold: 3,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  createdBy: 'u1',
  updatedBy: 'u1',
  ...overrides,
})

const makeMovement = (overrides: Partial<PartMovement> = {}): PartMovement => ({
  id: 'mv_001',
  type: 'install',
  skuId: 'sku_psu_500w',
  qty: 1,
  broken: false,
  assetId: 'asset_lap_001',
  assetInvCode: 'LAP/001',
  serviceReplace: false,
  note: null,
  reason: null,
  actorUid: 'u1',
  actorRole: 'asset_admin',
  at: '2024-06-01T10:00:00Z',
  ...overrides,
})

const makePartsAsset = (overrides: Partial<PartsAsset> = {}): PartsAsset => ({
  id: 'LAP/001',
  assetId: 'asset_lap_001',
  categoryId: 'cat_laptop',
  kind: 'laptop',
  name: 'Dell XPS 15',
  user: 'Alice',
  upgradeCurrent: [],
  categoryName: 'Ноутбук',
  ...overrides,
})

// ── HistoryPanel (desktop) tests ───────────────────────────────────────────
describe('HistoryPanel (desktop, isMobile=false)', () => {
  it('install row: shows asset categoryName instead of SKU label', () => {
    const parts = [makePart()]
    const movements = [makeMovement({ type: 'install', serviceReplace: false })]
    const partsAssets = [makePartsAsset()]

    render(
      <HistoryPanel
        movements={movements}
        parts={parts}
        partsAssets={partsAssets}
        isMobile={false}
        remainingAfterMap={{ mv_001: 4 }}
      />,
    )

    // Category name shown
    expect(screen.getByText('Ноутбук')).toBeInTheDocument()
    // SKU name NOT shown as main label (it is a different element)
    // 'Блок питания' should not be the main row label
    // Note: it could appear elsewhere (e.g. tooltips) but not as the primary title text
    expect(screen.queryByText('Блок питания')).not.toBeInTheDocument()
  })

  it('install row: falls back to SKU label when asset not found in partsAssets', () => {
    const parts = [makePart()]
    // movement with assetId not present in partsAssets
    const movements = [makeMovement({ assetId: 'asset_unknown', type: 'install' })]

    render(
      <HistoryPanel
        movements={movements}
        parts={parts}
        partsAssets={[]}
        isMobile={false}
        remainingAfterMap={{ mv_001: 4 }}
      />,
    )

    // Falls back to SKU label
    expect(screen.getByText('Блок питания')).toBeInTheDocument()
  })

  it('serviceReplace install row: shows serviceChip badge', () => {
    const parts = [makePart()]
    const movements = [makeMovement({ type: 'install', serviceReplace: true })]
    const partsAssets = [makePartsAsset()]

    render(
      <HistoryPanel
        movements={movements}
        parts={parts}
        partsAssets={partsAssets}
        isMobile={false}
        remainingAfterMap={{ mv_001: 4 }}
      />,
    )

    // Service chip key rendered (t() returns key)
    expect(screen.getByText('warehouse.serviceChip')).toBeInTheDocument()
  })

  it('regular install row (serviceReplace=false): no service chip', () => {
    const parts = [makePart()]
    const movements = [makeMovement({ type: 'install', serviceReplace: false })]
    const partsAssets = [makePartsAsset()]

    render(
      <HistoryPanel
        movements={movements}
        parts={parts}
        partsAssets={partsAssets}
        isMobile={false}
        remainingAfterMap={{ mv_001: 4 }}
      />,
    )

    expect(screen.queryByText('warehouse.serviceChip')).not.toBeInTheDocument()
  })

  it('receive row: shows SKU label (not affected by partsAssets)', () => {
    const parts = [makePart()]
    const movements = [makeMovement({
      id: 'mv_receive',
      type: 'receive',
      assetId: null,
      assetInvCode: null,
      serviceReplace: false,
    })]
    const partsAssets = [makePartsAsset()]

    render(
      <HistoryPanel
        movements={movements}
        parts={parts}
        partsAssets={partsAssets}
        isMobile={false}
        remainingAfterMap={{ mv_receive: 5 }}
      />,
    )

    // SKU label shown for receive rows
    expect(screen.getByText('Блок питания')).toBeInTheDocument()
    // No service chip on receive rows
    expect(screen.queryByText('warehouse.serviceChip')).not.toBeInTheDocument()
  })

  it('uninstall row: shows asset categoryName', () => {
    const parts = [makePart()]
    const movements = [makeMovement({
      id: 'mv_uninstall',
      type: 'uninstall',
      serviceReplace: false,
    })]
    const partsAssets = [makePartsAsset()]

    render(
      <HistoryPanel
        movements={movements}
        parts={parts}
        partsAssets={partsAssets}
        isMobile={false}
        remainingAfterMap={{ mv_uninstall: 4 }}
      />,
    )

    expect(screen.getByText('Ноутбук')).toBeInTheDocument()
    expect(screen.queryByText('Блок питания')).not.toBeInTheDocument()
  })
})

// ── HistoryPanel (mobile) tests ────────────────────────────────────────────
describe('HistoryPanel (mobile, isMobile=true)', () => {
  it('install row: shows asset categoryName instead of SKU label', () => {
    const parts = [makePart()]
    const movements = [makeMovement({ type: 'install', serviceReplace: false })]
    const partsAssets = [makePartsAsset()]

    render(
      <HistoryPanel
        movements={movements}
        parts={parts}
        partsAssets={partsAssets}
        isMobile={true}
        remainingAfterMap={{ mv_001: 4 }}
      />,
    )

    expect(screen.getByText('Ноутбук')).toBeInTheDocument()
    expect(screen.queryByText('Блок питания')).not.toBeInTheDocument()
  })

  it('serviceReplace install row (mobile): shows serviceChip badge', () => {
    const parts = [makePart()]
    const movements = [makeMovement({ type: 'install', serviceReplace: true })]
    const partsAssets = [makePartsAsset()]

    render(
      <HistoryPanel
        movements={movements}
        parts={parts}
        partsAssets={partsAssets}
        isMobile={true}
        remainingAfterMap={{ mv_001: 4 }}
      />,
    )

    expect(screen.getByText('warehouse.serviceChip')).toBeInTheDocument()
  })

  it('receive row (mobile): SKU label shown, no service chip', () => {
    const parts = [makePart()]
    const movements = [makeMovement({
      id: 'mv_receive',
      type: 'receive',
      assetId: null,
      assetInvCode: null,
      serviceReplace: false,
    })]
    const partsAssets = [makePartsAsset()]

    render(
      <HistoryPanel
        movements={movements}
        parts={parts}
        partsAssets={partsAssets}
        isMobile={true}
        remainingAfterMap={{ mv_receive: 5 }}
      />,
    )

    expect(screen.getByText('Блок питания')).toBeInTheDocument()
    expect(screen.queryByText('warehouse.serviceChip')).not.toBeInTheDocument()
  })
})

// ── HistoryRowMobile (unit) tests ──────────────────────────────────────────
describe('HistoryRowMobile', () => {
  it('install row with assetCategoryName: shows category name, not skuLabel', () => {
    const mv = makeMovement({ type: 'install', serviceReplace: false })

    render(
      <HistoryRowMobile
        mv={mv}
        skuLabel="Блок питания"
        catIconName="plug"
        remainingAfter={4}
        assetCategoryName="Ноутбук"
      />,
    )

    expect(screen.getByText('Ноутбук')).toBeInTheDocument()
    // skuLabel should NOT appear as title
    expect(screen.queryByText('Блок питания')).not.toBeInTheDocument()
  })

  it('install row without assetCategoryName: falls back to skuLabel', () => {
    const mv = makeMovement({ type: 'install', serviceReplace: false })

    render(
      <HistoryRowMobile
        mv={mv}
        skuLabel="Блок питания"
        catIconName="plug"
        remainingAfter={4}
      />,
    )

    expect(screen.getByText('Блок питания')).toBeInTheDocument()
  })

  it('serviceReplace=true: renders serviceChip', () => {
    const mv = makeMovement({ type: 'install', serviceReplace: true })

    render(
      <HistoryRowMobile
        mv={mv}
        skuLabel="Блок питания"
        catIconName="plug"
        remainingAfter={4}
        assetCategoryName="Ноутбук"
        isServiceReplace={true}
      />,
    )

    expect(screen.getByText('warehouse.serviceChip')).toBeInTheDocument()
  })

  it('serviceReplace=false: no serviceChip', () => {
    const mv = makeMovement({ type: 'install', serviceReplace: false })

    render(
      <HistoryRowMobile
        mv={mv}
        skuLabel="Блок питания"
        catIconName="plug"
        remainingAfter={4}
        assetCategoryName="Ноутбук"
        isServiceReplace={false}
      />,
    )

    expect(screen.queryByText('warehouse.serviceChip')).not.toBeInTheDocument()
  })

  it('receive row: shows skuLabel even when assetCategoryName provided (receive has no asset)', () => {
    const mv = makeMovement({
      type: 'receive',
      assetId: null,
      assetInvCode: null,
      serviceReplace: false,
    })

    render(
      <HistoryRowMobile
        mv={mv}
        skuLabel="Блок питания"
        catIconName="plug"
        remainingAfter={0}
      />,
    )

    expect(screen.getByText('Блок питания')).toBeInTheDocument()
  })
})

// ── Replace-install denormalisation: «← заменил <old spec>» affordance ─────
describe('replaced-part affordance («← заменил X»)', () => {
  it('desktop install row with replacedSpec: renders the replaced-old label with old spec + storageType', () => {
    const parts = [makePart()]
    const movements = [makeMovement({
      type: 'install',
      serviceReplace: false,
      replacedSpec: 'SSD 512 ГБ',
      replacedStorageType: 'SSD',
      replacedSlotIndex: 1,
      oldDisposal: 'kept',
    })]

    render(
      <HistoryPanel
        movements={movements}
        parts={parts}
        partsAssets={[makePartsAsset()]}
        isMobile={false}
        remainingAfterMap={{ mv_001: 4 }}
      />,
    )

    // t() returns the key; the old spec is rendered next to it in the same span
    const label = screen.getByText(/warehouse\.replacedOld/)
    expect(label).toBeInTheDocument()
    expect(label.textContent).toContain('SSD 512 ГБ')
    expect(label.textContent).toContain('· SSD')
  })

  it('desktop install row WITHOUT replacedSpec: no replaced-old affordance', () => {
    const parts = [makePart()]
    const movements = [makeMovement({ type: 'install', serviceReplace: false })]

    render(
      <HistoryPanel
        movements={movements}
        parts={parts}
        partsAssets={[makePartsAsset()]}
        isMobile={false}
        remainingAfterMap={{ mv_001: 4 }}
      />,
    )

    expect(screen.queryByText(/warehouse\.replacedOld/)).not.toBeInTheDocument()
  })

  it('mobile row (HistoryRowMobile) with replacedSpec: subline carries «← заменил <old spec>»', () => {
    const mv = makeMovement({
      type: 'install',
      serviceReplace: false,
      replacedSpec: 'HDD 1 ТБ',
      replacedStorageType: 'HDD',
      oldDisposal: 'kept',
    })

    render(
      <HistoryRowMobile
        mv={mv}
        skuLabel="Блок питания"
        catIconName="plug"
        remainingAfter={4}
        assetCategoryName="Ноутбук"
      />,
    )

    expect(screen.getByText(/← warehouse\.replacedOld HDD 1 ТБ · HDD/)).toBeInTheDocument()
  })

  it('mobile row without replacedSpec: subline has no replaced-old note', () => {
    const mv = makeMovement({ type: 'install', serviceReplace: false })

    render(
      <HistoryRowMobile
        mv={mv}
        skuLabel="Блок питания"
        catIconName="plug"
        remainingAfter={4}
        assetCategoryName="Ноутбук"
      />,
    )

    expect(screen.queryByText(/warehouse\.replacedOld/)).not.toBeInTheDocument()
  })
})
