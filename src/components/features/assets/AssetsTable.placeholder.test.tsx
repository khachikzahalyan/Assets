/**
 * AssetsTable placeholder-row tests.
 * Verifies that the desktop table renders placeholder filler rows when there
 * are fewer real rows than minRows, and that:
 *   - placeholder divs carry aria-hidden="true"
 *   - placeholder divs do NOT have role="row" (so getAllByRole('row') counts stay correct)
 *   - no placeholders when rows.length >= minRows
 *   - placeholders are absent when rows is empty (EmptyState is shown instead at the Page level;
 *     at the Table level with 0 rows and minRows=3 we still get 3 placeholders — the Page
 *     guards this by showing EmptyState before rendering AssetsTable)
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { AssetsTable } from './AssetsTable'
import type { AssetReferenceData } from '@/domain/asset/AssetRepository'
import type { Asset } from '@/domain/asset'

// ── Minimal ref fixture ───────────────────────────────────────────────────────
const REF: AssetReferenceData = {
  statuses:    [{ id: 'st_warehouse', name: 'На складе', color: 'gray' }],
  branches:    [{ id: 'br_main', name: 'Главный офис' }],
  departments: [],
  categories:  [{ id: 'cat_laptop', name: 'Ноутбук', group: 'devices', lucideIcon: 'laptop' }],
  employees:   [],
}

// ── Asset factory ─────────────────────────────────────────────────────────────
function makeAsset(n: number): Asset {
  return {
    id: `a_${n}`,
    categoryId: 'cat_laptop',
    brand: 'Dell',
    model: `Model${n}`,
    invCode: `LAP/${String(n).padStart(3, '0')}`,
    serial: null,
    statusId: 'st_warehouse',
    assignment: null,
    branchId: 'br_main',
    deptId: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

beforeAll(async () => {
  await i18n.changeLanguage('ru')
})

// ── Render helper ─────────────────────────────────────────────────────────────
function renderTable(assets: Asset[], minRows = 10) {
  return render(
    <I18nextProvider i18n={i18n}>
      <AssetsTable
        rows={assets}
        ref={REF}
        canMutate={false}
        minRows={minRows}
      />
    </I18nextProvider>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('AssetsTable placeholder rows', () => {
  it('renders placeholder divs when rows < minRows', () => {
    renderTable([makeAsset(1), makeAsset(2), makeAsset(3)], 10)
    // 10 - 3 = 7 placeholders
    const placeholders = document.querySelectorAll('[data-testid="asset-table-placeholder"]')
    expect(placeholders.length).toBe(7)
  })

  it('all placeholder divs carry aria-hidden="true"', () => {
    renderTable([makeAsset(1)], 5)
    // 5 - 1 = 4 placeholders
    const placeholders = document.querySelectorAll('[data-testid="asset-table-placeholder"]')
    expect(placeholders.length).toBe(4)
    placeholders.forEach(el => {
      expect(el.getAttribute('aria-hidden')).toBe('true')
    })
  })

  it('placeholder divs do NOT have role="row"', () => {
    renderTable([makeAsset(1), makeAsset(2)], 5)
    const placeholders = document.querySelectorAll('[data-testid="asset-table-placeholder"]')
    expect(placeholders.length).toBe(3)
    placeholders.forEach(el => {
      expect(el.getAttribute('role')).toBeNull()
    })
  })

  it('getAllByRole("row") only counts real rows + header (not placeholders)', () => {
    renderTable([makeAsset(1), makeAsset(2), makeAsset(3)], 10)
    // jsdom returns false for matchMedia → isMobile=false → desktop table renders
    // header row (1) + 3 real rows = 4
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBe(4)
  })

  it('no placeholders when rows.length === minRows', () => {
    const assets = Array.from({ length: 10 }, (_, i) => makeAsset(i))
    renderTable(assets, 10)
    const placeholders = document.querySelectorAll('[data-testid="asset-table-placeholder"]')
    expect(placeholders.length).toBe(0)
  })

  it('no placeholders when rows.length > minRows', () => {
    const assets = Array.from({ length: 12 }, (_, i) => makeAsset(i))
    renderTable(assets, 10)
    const placeholders = document.querySelectorAll('[data-testid="asset-table-placeholder"]')
    expect(placeholders.length).toBe(0)
  })

  it('7 assets → 3 placeholders (10 - 7 = 3)', () => {
    const assets = Array.from({ length: 7 }, (_, i) => makeAsset(i))
    renderTable(assets, 10)
    const placeholders = document.querySelectorAll('[data-testid="asset-table-placeholder"]')
    expect(placeholders.length).toBe(3)
  })
})
