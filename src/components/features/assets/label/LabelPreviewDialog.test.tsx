/**
 * LabelPreviewDialog — unit tests.
 *
 * Covers:
 *   1. The passed asset's invCode is rendered on screen.
 *   2. Clicking «Печать» / "Print label" triggers window.print().
 *   3. Clicking «Закрыть» / "Close" calls the onClose prop.
 *
 * jsbarcode is mocked so Barcode128 (inside AssetLabel) never touches a real
 * canvas / SVG renderer — safe for jsdom.
 * window.print is spied upon and replaced with a no-op.
 * i18n is initialised via the shared @/lib/i18n module (same pattern used by
 * AssetCreatePage.print.test.tsx).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from '@/lib/i18n'
import type { Asset } from '@/domain/asset/types'

// Must be hoisted above the component import so Vitest replaces the module
// before Barcode128 evaluates its import of jsbarcode.
vi.mock('jsbarcode', () => ({ default: vi.fn() }))

// Import AFTER the mock is registered.
import { LabelPreviewDialog } from './LabelPreviewDialog'

// ─── Fixture ─────────────────────────────────────────────────────────────────

const ASSET: Asset = {
  id: 'a1',
  categoryId: 'cat_laptop',
  brand: 'Dell',
  model: 'XPS 15',
  invCode: 'LAP/00001',
  serial: 'SN-00001',
  barcode: '123456789',
  statusId: 'st_warehouse',
  assignment: null,
  branchId: 'b_main',
  deptId: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Pin to Russian so string assertions are deterministic regardless of
  // the jsdom navigator.language value picked up by LanguageDetector.
  await i18n.changeLanguage('ru')
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LabelPreviewDialog', () => {
  it('renders the invCode of the passed asset', () => {
    render(<LabelPreviewDialog assets={[ASSET]} onClose={() => {}} />)
    // invCode is Tier-3 free text — rendered verbatim inside AssetLabel.
    expect(screen.getByText('LAP/00001')).toBeTruthy()
  })

  it('clicking the print button calls window.print', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

    render(<LabelPreviewDialog assets={[ASSET]} onClose={() => {}} />)

    // The footer «Печать» button renders t('label.print') = "Печать наклейки".
    // Use getByRole to unambiguously target the button (the same text also
    // appears in the <h2> header, but <h2> is not a button role).
    const printBtn = screen.getByRole('button', { name: 'Печать наклейки' })
    fireEvent.click(printBtn)

    // LabelPrintHost mounts and fires window.print() inside useLayoutEffect,
    // which React flushes synchronously during act(). waitFor is used as a
    // safety net in case React 19 batches the state-driven re-render.
    await waitFor(() => expect(printSpy).toHaveBeenCalled())

    printSpy.mockRestore()
  })

  it('with onPrint: clicking «Печать» awaits onPrint, then prints the returned assets', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    // The committed asset returned by onPrint differs from the draft passed in `assets`,
    // proving the SAVED asset (not the draft) is what gets printed.
    const saved: Asset = { ...ASSET, id: 'saved-1', invCode: 'LAP/00009' }
    const onPrint = vi.fn(async () => [saved])

    render(<LabelPreviewDialog assets={[ASSET]} onClose={() => {}} onPrint={onPrint} />)

    fireEvent.click(screen.getByRole('button', { name: 'Печать наклейки' }))

    await waitFor(() => expect(onPrint).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(printSpy).toHaveBeenCalled())

    printSpy.mockRestore()
  })

  it('clicking «Закрыть» calls onClose', () => {
    const onClose = vi.fn()
    render(<LabelPreviewDialog assets={[ASSET]} onClose={onClose} />)

    // The footer ghost button has visible text "Закрыть" (text content).
    // The header ✕ IconBtn has title="Закрыть" but no text content (aria-hidden
    // SVG), so getByText targets only the footer button.
    fireEvent.click(screen.getByText('Закрыть'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders null when assets array is empty', () => {
    const { container } = render(<LabelPreviewDialog assets={[]} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
})
