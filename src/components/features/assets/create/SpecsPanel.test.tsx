import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/lib/i18n'
import { SpecsPanel } from './SpecsPanel'
import type { AssetSpecs } from '@/domain/asset'

beforeAll(async () => { await i18n.changeLanguage('ru') })

const EMPTY_SPECS: AssetSpecs = { cpu: '', ram: '', ssd: '', gpu: '' }

function makeProps(
  specs: AssetSpecs,
  onChange: ReturnType<typeof vi.fn>,
  resetKey?: string | number,
  extra?: Partial<React.ComponentProps<typeof SpecsPanel>>,
): React.ComponentProps<typeof SpecsPanel> {
  return {
    specs,
    onChange,
    isServer: false,
    hasGpu: false,
    ...(resetKey !== undefined ? { resetKey } : {}),
    ...extra,
  }
}

function setup(specs: AssetSpecs, resetKey?: string | number) {
  const onChange = vi.fn()
  const { rerender } = render(
    <I18nextProvider i18n={i18n}>
      <SpecsPanel {...makeProps(specs, onChange, resetKey)} />
    </I18nextProvider>,
  )
  return {
    onChange,
    rerender: (newSpecs: AssetSpecs, newResetKey?: string | number) =>
      rerender(
        <I18nextProvider i18n={i18n}>
          <SpecsPanel {...makeProps(newSpecs, onChange, newResetKey)} />
        </I18nextProvider>,
      ),
  }
}

describe('SpecsPanel resetKey', () => {
  it('renders CPU field without throwing', () => {
    setup(EMPTY_SPECS)
    expect(screen.getByText('Характеристики')).toBeInTheDocument()
  })

  it('when resetKey changes, RamSlots remounts and shows placeholder instead of old DDR type', () => {
    // parseRamValue parses DDR type from the END of the string: "16 ГБ DDR4"
    // With this format, ddrType = "DDR4" and the MiniDropdown trigger shows "DDR4".
    const specsWithRam: AssetSpecs = { ...EMPTY_SPECS, ram: '16 ГБ DDR4' }
    const { rerender } = setup(specsWithRam, 'cat_laptop')

    // After first render, MiniDropdown trigger shows "DDR4" as selected label.
    expect(screen.getByText('DDR4')).toBeInTheDocument()

    // Now parent changes category: resetKey flips to 'cat_server' AND specs are cleared.
    const clearedSpecs: AssetSpecs = { ...EMPTY_SPECS, ram: '' }
    rerender(clearedSpecs, 'cat_server')

    // DDR4 must be gone — RamSlots remounted with empty value → shows placeholder.
    expect(screen.queryByText('DDR4')).toBeNull()
    // Placeholder "DDR" is shown instead
    expect(screen.getByText('DDR')).toBeInTheDocument()
  })

  it('without resetKey change, RamSlots keeps its local DDR-type state even when value prop changes', () => {
    const specsWithRam: AssetSpecs = { ...EMPTY_SPECS, ram: '16 ГБ DDR4' }
    const { rerender } = setup(specsWithRam, 'cat_laptop')

    expect(screen.getByText('DDR4')).toBeInTheDocument()

    // Same resetKey — parent clears ram in specs but RamSlots is NOT remounted,
    // so its local ddrType state still shows DDR4 (controlled only by local state).
    const clearedSpecs: AssetSpecs = { ...EMPTY_SPECS, ram: '' }
    rerender(clearedSpecs, 'cat_laptop')

    // DDR4 text still present because RamSlots wasn't remounted.
    expect(screen.getByText('DDR4')).toBeInTheDocument()
  })
})
