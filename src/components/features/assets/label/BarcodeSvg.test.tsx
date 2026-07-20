import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

const jsbarcodeSpy = vi.fn()
vi.mock('jsbarcode', () => ({ default: (...args: unknown[]) => jsbarcodeSpy(...args) }))

import { BarcodeSvg } from './BarcodeSvg'

describe('BarcodeSvg', () => {
  it('calls JsBarcode with CODE128 format for legacy 9-digit value', () => {
    render(<BarcodeSvg value="100309088" />)
    expect(jsbarcodeSpy).toHaveBeenCalled()
    const [, value, opts] = jsbarcodeSpy.mock.calls[0] ?? []
    expect(value).toBe('100309088')
    expect((opts as { format: string }).format).toBe('CODE128')
  })
  it('calls JsBarcode with EAN13 format, flat=true, displayValue=false for a valid EAN-13', () => {
    jsbarcodeSpy.mockClear()
    render(<BarcodeSvg value="6291041500213" />)
    expect(jsbarcodeSpy).toHaveBeenCalled()
    const [, value, opts] = jsbarcodeSpy.mock.calls[0] ?? []
    expect(value).toBe('6291041500213')
    expect((opts as { format: string }).format).toBe('EAN13')
    expect((opts as { flat: boolean }).flat).toBe(true)
    expect((opts as { displayValue: boolean }).displayValue).toBe(false)
  })
  it('does not throw when JsBarcode itself throws (jsdom-safe)', () => {
    jsbarcodeSpy.mockImplementationOnce(() => { throw new Error('no getBBox in jsdom') })
    expect(() => render(<BarcodeSvg value="X" />)).not.toThrow()
  })
  it('sets a valid viewBox (no "px" suffix) and removes width/height attrs — regression for print bug', () => {
    // Simulate the real JsBarcode SVG renderer: sets width="210px"/height="110px" WITH a "px"
    // suffix AND its own valid viewBox. The previous code used getAttribute directly, producing
    // `viewBox="0 0 210px 110px"` (invalid SVG) — browsers ignored it and barcodes printed
    // unscaled. parseFloat strips the suffix; this test guards the fix.
    jsbarcodeSpy.mockClear()
    jsbarcodeSpy.mockImplementationOnce((_svg: SVGSVGElement) => {
      _svg.setAttribute('width', '210px')
      _svg.setAttribute('height', '110px')
      _svg.setAttribute('viewBox', '0 0 210 110')
    })
    const { container } = render(<BarcodeSvg value="6291041500213" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 210 110')
    expect(svg?.hasAttribute('width')).toBe(false)
    expect(svg?.hasAttribute('height')).toBe(false)
  })
})
