/**
 * InstallModal slot-decision interaction tests.
 *
 * We test the OBSERVABLE slot-decision UI that the modal renders when
 * different upgradeCurrent configurations are present on the selected asset.
 * Domain helpers (partStock.ts) are NOT mocked — we use their real behaviour
 * so the test exercises the full seam from props → helpers → rendered options.
 *
 * Three slot scenarios are covered:
 *   (i)   empty slot     → straight-install path (no replace/add radio shown)
 *   (ii)  occupied single-slot category (cooler) → forced replace, no "add" option
 *   (iii) occupied multi-slot category (ram)     → offers BOTH replace AND add
 *
 * The modal is rendered in isolation — no Firebase, no router, no AuthContext
 * needed (it takes all data as props).
 *
 * NOTE: InstallModal renders two copies of its content: one inside a desktop
 * <div role="dialog"> and one inside <MobileSheet>. In jsdom all content is
 * in the DOM, so we use getAllByRole / getAllByLabelText and take [0] to get
 * the first match from the desktop copy.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Part, PartsAsset, UpgradeSlot } from '@/domain/part/types'
import { InstallModal } from './InstallModal'

// ── i18n mock — every t('x') returns 'x' ─────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}))

// ── MobileSheet stub — renders children directly so the content is in DOM ─────
// This avoids jsdom portal / focus-trap issues while keeping assertions intact.
vi.mock('@/components/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui')>()
  return {
    ...actual,
    MobileSheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
      open ? <div data-testid="mobile-sheet">{children}</div> : null,
  }
})

// ── Fixture factories ─────────────────────────────────────────────────────────

/** RAM SKU — multi-slot category */
function makeRamSku(overrides: Partial<Part> = {}): Part {
  return {
    id: 'sku_ram_8gb', name: 'RAM 8 GB', category: 'ram',
    unit: 'шт', onHand: 3, broken: 0, lowStockThreshold: 5,
    createdAt: '2024-01-01', updatedAt: '2024-01-01',
    createdBy: 'u1', updatedBy: 'u1',
    ...overrides,
  }
}

/** Cooler SKU — single-slot category (non-server) */
function makeCoolerSku(overrides: Partial<Part> = {}): Part {
  return {
    id: 'sku_cooler_noctua', name: 'Noctua NH-D15', category: 'cooler',
    unit: 'шт', onHand: 2, broken: 0, lowStockThreshold: 3,
    createdAt: '2024-01-01', updatedAt: '2024-01-01',
    createdBy: 'u1', updatedBy: 'u1',
    ...overrides,
  }
}

/**
 * Build a PartsAsset for a desktop (cat_desktop) with given upgradeCurrent.
 * cat_desktop → family='desktop' → slotIsSingle(cooler, 'desktop') = true.
 */
function makeDesktopAsset(upgradeCurrent: UpgradeSlot[]): PartsAsset {
  return {
    id: 'DES/001', assetId: 'asset_desktop_1',
    categoryId: 'cat_desktop',
    kind: 'desktop', name: 'HP Elite Tower', user: 'Alice',
    upgradeCurrent,
  }
}

/**
 * Build a PartsAsset for a server (cat_server) with given upgradeCurrent.
 * cat_server → family='server' → slotIsSingle(cooler, 'server') = false (multi-slot).
 */
function makeServerAsset(upgradeCurrent: UpgradeSlot[]): PartsAsset {
  return {
    id: 'SRV/001', assetId: 'asset_server_1',
    categoryId: 'cat_server',
    kind: 'server', name: 'Dell PowerEdge R740', user: 'DataCentre',
    upgradeCurrent,
  }
}

// ── Shared render helper ──────────────────────────────────────────────────────

interface RenderInstallModalOpts {
  sku: Part
  partsAssets: PartsAsset[]
  onConfirm?: ReturnType<typeof vi.fn>
  onClose?: ReturnType<typeof vi.fn>
}

function renderInstallModal({
  sku, partsAssets,
  onConfirm = vi.fn(), onClose = vi.fn(),
}: RenderInstallModalOpts) {
  return render(
    <InstallModal
      open={true}
      onClose={onClose}
      sku={sku}
      partsAssets={partsAssets}
      onConfirm={onConfirm}
    />,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InstallModal — slot-decision rendering', () => {

  describe('(i) empty slot — straight-install path', () => {
    it('does not render the replace/add radio buttons when no occupied slot exists', async () => {
      // Arrange — RAM asset has one empty RAM slot
      const sku = makeRamSku()
      const asset = makeDesktopAsset([
        { kind: 'ram', spec: '', installedAt: null },          // empty slot
      ])
      const user = userEvent.setup()

      // Act — render and select the asset
      renderInstallModal({ sku, partsAssets: [asset] })
      await user.selectOptions(screen.getAllByRole('combobox')[0]!, asset.id)

      // Assert — no action-mode radios (replace/add) are rendered
      expect(screen.queryByDisplayValue('replace')).not.toBeInTheDocument()
      expect(screen.queryByDisplayValue('add')).not.toBeInTheDocument()
    })

    it('does not render the replace/add radio buttons when upgradeCurrent is empty (no slots at all)', async () => {
      // Arrange — asset has no upgradeCurrent entries at all
      const sku = makeRamSku()
      const asset = makeDesktopAsset([])
      const user = userEvent.setup()

      // Act
      renderInstallModal({ sku, partsAssets: [asset] })
      await user.selectOptions(screen.getAllByRole('combobox')[0]!, asset.id)

      // Assert
      expect(screen.queryByDisplayValue('replace')).not.toBeInTheDocument()
      expect(screen.queryByDisplayValue('add')).not.toBeInTheDocument()
    })
  })

  describe('(ii) occupied single-slot category — forced replace', () => {
    it('shows replace option but NOT the add option for a single-slot category (cooler on desktop)', async () => {
      // Arrange — desktop with an occupied cooler slot
      const sku = makeCoolerSku()
      const asset = makeDesktopAsset([
        { kind: 'cooler', spec: 'be quiet! Pure Rock 2', installedAt: '2024-01-01' },
      ])
      const user = userEvent.setup()

      // Act
      renderInstallModal({ sku, partsAssets: [asset] })
      await user.selectOptions(screen.getAllByRole('combobox')[0]!, asset.id)

      // Assert — replace radio is present, add radio is NOT (isSingle=true → add hidden)
      const replaceRadios = screen.getAllByDisplayValue('replace')
      expect(replaceRadios.length).toBeGreaterThan(0)
      expect(screen.queryByDisplayValue('add')).not.toBeInTheDocument()
    })

    it('shows the occupied slot spec as a replacement candidate', async () => {
      // Arrange
      const sku = makeCoolerSku()
      const asset = makeDesktopAsset([
        { kind: 'cooler', spec: 'be quiet! Pure Rock 2', installedAt: '2024-01-01' },
      ])
      const user = userEvent.setup()

      // Act
      renderInstallModal({ sku, partsAssets: [asset] })
      await user.selectOptions(screen.getAllByRole('combobox')[0]!, asset.id)

      // Assert — the occupied slot spec text is shown in the slot picker
      expect(screen.getAllByText('be quiet! Pure Rock 2').length).toBeGreaterThan(0)
    })
  })

  describe('(iii) occupied multi-slot category — replace OR add', () => {
    it('shows BOTH replace and add radio buttons for a multi-slot category (ram on desktop)', async () => {
      // Arrange — desktop with one occupied RAM slot
      const sku = makeRamSku()
      const asset = makeDesktopAsset([
        { kind: 'ram', spec: 'Samsung 8 GB DDR4', installedAt: '2024-01-01' },
      ])
      const user = userEvent.setup()

      // Act
      renderInstallModal({ sku, partsAssets: [asset] })
      await user.selectOptions(screen.getAllByRole('combobox')[0]!, asset.id)

      // Assert — both replace and add radios present (isSingle=false for RAM)
      const replaceRadios = screen.getAllByDisplayValue('replace')
      const addRadios = screen.getAllByDisplayValue('add')
      expect(replaceRadios.length).toBeGreaterThan(0)
      expect(addRadios.length).toBeGreaterThan(0)
    })

    it('shows BOTH replace and add for multi-slot cooler on a server', async () => {
      // Arrange — server (multi-slot cooler) with an occupied cooler slot
      const sku = makeCoolerSku()
      const asset = makeServerAsset([
        { kind: 'cooler', spec: 'Noctua NH-U12DX i4', installedAt: '2024-01-01' },
      ])
      const user = userEvent.setup()

      // Act
      renderInstallModal({ sku, partsAssets: [asset] })
      await user.selectOptions(screen.getAllByRole('combobox')[0]!, asset.id)

      // Assert — server family → slotIsSingle(cooler, 'server') = false → add shown
      const addRadios = screen.getAllByDisplayValue('add')
      expect(addRadios.length).toBeGreaterThan(0)
    })

    it('selecting the add radio keeps the add mode active', async () => {
      // Arrange
      const sku = makeRamSku()
      const asset = makeDesktopAsset([
        { kind: 'ram', spec: 'Kingston 16 GB DDR5', installedAt: '2024-01-01' },
      ])
      const user = userEvent.setup()

      // Act
      renderInstallModal({ sku, partsAssets: [asset] })
      await user.selectOptions(screen.getAllByRole('combobox')[0]!, asset.id)
      // Click first "add" radio (desktop copy is [0])
      await user.click(screen.getAllByDisplayValue('add')[0]!)

      // Assert — re-query after interaction to get the current DOM state
      // At least one "add" radio should be checked after clicking it
      const addRadiosAfter = screen.getAllByDisplayValue('add') as HTMLInputElement[]
      expect(addRadiosAfter.some(r => r.checked)).toBe(true)
    })
  })

  describe('asset selector initial state', () => {
    it('does not show slot-decision UI before an asset is selected', () => {
      // Arrange — no asset selected yet
      renderInstallModal({ sku: makeRamSku(), partsAssets: [makeDesktopAsset([])] })

      // Assert — no action radios shown before selection
      expect(screen.queryByDisplayValue('replace')).not.toBeInTheDocument()
      expect(screen.queryByDisplayValue('add')).not.toBeInTheDocument()
    })
  })
})
