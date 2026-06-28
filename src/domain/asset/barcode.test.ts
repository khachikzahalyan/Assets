import { describe, it, expect, vi } from 'vitest'
import { generateBarcodeCandidate, allocateUniqueBarcode } from './barcode'

describe('generateBarcodeCandidate', () => {
  it('returns a 9-digit numeric string with a non-zero first digit', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateBarcodeCandidate()).toMatch(/^[1-9]\d{8}$/)
    }
  })
})

describe('allocateUniqueBarcode', () => {
  it('returns the first candidate that is not taken', async () => {
    const taken = vi.fn(async (_c: string) => false)
    const code = await allocateUniqueBarcode(taken)
    expect(code).toMatch(/^[1-9]\d{8}$/)
    expect(taken).toHaveBeenCalledTimes(1)
  })
  it('retries while taken, then returns a free one', async () => {
    let calls = 0
    const taken = vi.fn(async () => (++calls < 3))
    const code = await allocateUniqueBarcode(taken)
    expect(code).toMatch(/^[1-9]\d{8}$/)
    expect(taken).toHaveBeenCalledTimes(3)
  })
  it('throws if it cannot find a free code within the cap', async () => {
    const taken = vi.fn(async () => true)
    await expect(allocateUniqueBarcode(taken)).rejects.toThrow(/unique barcode/i)
  })
})
