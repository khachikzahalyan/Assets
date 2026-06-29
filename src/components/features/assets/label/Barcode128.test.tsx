import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

const jsbarcodeSpy = vi.fn()
vi.mock('jsbarcode', () => ({ default: (...args: unknown[]) => jsbarcodeSpy(...args) }))

import { Barcode128 } from './Barcode128'

describe('Barcode128', () => {
  it('calls JsBarcode with the value and CODE128 format', () => {
    render(<Barcode128 value="100309088" />)
    expect(jsbarcodeSpy).toHaveBeenCalled()
    const [, value, opts] = jsbarcodeSpy.mock.calls[0] ?? []
    expect(value).toBe('100309088')
    expect((opts as { format: string }).format).toBe('CODE128')
  })
  it('does not throw when JsBarcode itself throws (jsdom-safe)', () => {
    jsbarcodeSpy.mockImplementationOnce(() => { throw new Error('no getBBox in jsdom') })
    expect(() => render(<Barcode128 value="X" />)).not.toThrow()
  })
})
