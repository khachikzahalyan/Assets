/**
 * ServiceRecordModal — interaction tests.
 *
 * Tests the observable behaviour of the modal at the component seam:
 *   - no Firebase, no router, no AuthContext required (all data is passed as props)
 *   - onConfirm stub verifies the exact (kindId, kindLabel, note) args the component emits
 *   - asserts the phase2Notice placeholder banner is absent
 *
 * The modal renders two copies of its content (desktop dialog + MobileSheet).
 * MobileSheet is stubbed to render children directly so all content is in the DOM.
 * Assertions use getAllBy* and take [0] to match the first (desktop) copy where
 * multiple matches would otherwise cause false positives.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PartsAsset } from '@/domain/part/types'
import { ServiceRecordModal } from './ServiceRecordModal'

// ── i18n mock — t('x') returns 'x' so assertions can match translation keys ──
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}))

// ── MobileSheet stub — renders children directly ──────────────────────────────
vi.mock('@/components/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui')>()
  return {
    ...actual,
    MobileSheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
      open ? <div data-testid="mobile-sheet-stub">{children}</div> : null,
  }
})

// ── Fixture ───────────────────────────────────────────────────────────────────

function makeAsset(overrides: Partial<PartsAsset> = {}): PartsAsset {
  return {
    id: 'DES/001',
    assetId: 'asset_desktop_1',
    categoryId: 'cat_desktop',
    kind: 'desktop',
    name: 'HP Elite Tower',
    user: 'Alice',
    upgradeCurrent: [],
    ...overrides,
  }
}

// ── Render helper ─────────────────────────────────────────────────────────────

interface RenderOpts {
  asset?: PartsAsset | null
  onConfirm?: ReturnType<typeof vi.fn>
  onClose?: ReturnType<typeof vi.fn>
}

function renderModal({
  asset = makeAsset(),
  onConfirm = vi.fn().mockResolvedValue(undefined),
  onClose = vi.fn(),
}: RenderOpts = {}) {
  render(
    <ServiceRecordModal
      open={true}
      onClose={onClose}
      asset={asset}
      onConfirm={onConfirm}
    />,
  )
  return { onConfirm, onClose }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ServiceRecordModal', () => {

  describe('onConfirm args — kindId, kindLabel, note', () => {
    it('calls onConfirm with the selected kindId, its translated label, and the typed note', async () => {
      // Arrange
      const onConfirm = vi.fn().mockResolvedValue(undefined)
      const user = userEvent.setup()
      renderModal({ onConfirm })

      // The i18n mock returns the key as the label, so kindLabel = 'serviceModal.kinds.repair'
      const kindId = 'repair'
      const expectedLabel = 'serviceModal.kinds.repair'
      const noteText = 'Fan bearing worn'

      // Act — pick a service kind from the <select>
      const selects = screen.getAllByRole('combobox')
      await user.selectOptions(selects[0]!, kindId)

      // Type a note
      const textareas = screen.getAllByRole('textbox')
      await user.type(textareas[0]!, noteText)

      // Submit
      const confirmButtons = screen.getAllByRole('button', { name: 'serviceModal.confirm' })
      await user.click(confirmButtons[0]!)

      // Assert — onConfirm was called with exactly (kindId, kindLabel, note)
      expect(onConfirm).toHaveBeenCalledTimes(1)
      expect(onConfirm).toHaveBeenCalledWith(kindId, expectedLabel, noteText)
    })

    it('passes note as null when the textarea is left empty', async () => {
      // Arrange
      const onConfirm = vi.fn().mockResolvedValue(undefined)
      const user = userEvent.setup()
      renderModal({ onConfirm })

      // Act — pick a kind, leave note blank, submit
      const selects = screen.getAllByRole('combobox')
      await user.selectOptions(selects[0]!, 'cleaning')

      const confirmButtons = screen.getAllByRole('button', { name: 'serviceModal.confirm' })
      await user.click(confirmButtons[0]!)

      // Assert — note arg is null (empty string trimmed to null by the component)
      expect(onConfirm).toHaveBeenCalledWith('cleaning', 'serviceModal.kinds.cleaning', null)
    })

    it('passes note trimmed — leading/trailing whitespace is stripped', async () => {
      // Arrange
      const onConfirm = vi.fn().mockResolvedValue(undefined)
      const user = userEvent.setup()
      renderModal({ onConfirm })

      // Act
      const selects = screen.getAllByRole('combobox')
      await user.selectOptions(selects[0]!, 'diagnostics')

      const textareas = screen.getAllByRole('textbox')
      await user.type(textareas[0]!, '  trimmed note  ')

      const confirmButtons = screen.getAllByRole('button', { name: 'serviceModal.confirm' })
      await user.click(confirmButtons[0]!)

      // Assert — note is the trimmed value (not null, because content remains after trim)
      expect(onConfirm).toHaveBeenCalledWith('diagnostics', 'serviceModal.kinds.diagnostics', 'trimmed note')
    })
  })

  describe('phase2Notice banner — must be absent', () => {
    it('does not render a phase2Notice element', () => {
      // Arrange + Act
      renderModal()

      // Assert — no element with a phase2Notice testid
      expect(document.querySelector('[data-testid="phase2Notice"]')).toBeNull()
      expect(document.querySelector('[data-testid="phase2-notice"]')).toBeNull()
    })

    it('does not render any text containing "Phase 2" or "phase2"', () => {
      // Arrange + Act
      renderModal()

      // Assert — no Phase 2 placeholder text visible
      expect(screen.queryByText(/phase\s*2/i)).not.toBeInTheDocument()
    })
  })

  describe('submit guard — confirm button disabled until a kind is selected', () => {
    it('confirm button is disabled when no service kind is selected', () => {
      // Arrange + Act
      renderModal()

      // Assert — button is disabled (no kind selected yet)
      const confirmButtons = screen.getAllByRole('button', { name: 'serviceModal.confirm' })
      expect(confirmButtons[0]).toBeDisabled()
    })

    it('confirm button becomes enabled once a service kind is selected', async () => {
      // Arrange
      const user = userEvent.setup()
      renderModal()

      // Act — select a kind
      const selects = screen.getAllByRole('combobox')
      await user.selectOptions(selects[0]!, 'other')

      // Assert — button is now enabled
      const confirmButtons = screen.getAllByRole('button', { name: 'serviceModal.confirm' })
      expect(confirmButtons[0]).not.toBeDisabled()
    })
  })

  describe('cancel / close', () => {
    it('calls onClose when the cancel button is clicked', async () => {
      // Arrange
      const onClose = vi.fn()
      const user = userEvent.setup()
      renderModal({ onClose })

      // Act
      const cancelButtons = screen.getAllByRole('button', { name: 'serviceModal.cancel' })
      await user.click(cancelButtons[0]!)

      // Assert
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('renders nothing when asset is null', () => {
    it('renders null when asset prop is null (modal suppressed)', () => {
      // Arrange + Act
      render(
        <ServiceRecordModal
          open={true}
          onClose={vi.fn()}
          asset={null}
          onConfirm={vi.fn().mockResolvedValue(undefined)}
        />,
      )

      // Assert — no modal title rendered
      expect(screen.queryByText('serviceModal.title')).not.toBeInTheDocument()
    })
  })
})
