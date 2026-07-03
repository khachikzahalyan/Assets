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
})
