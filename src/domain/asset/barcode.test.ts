import { describe, it, expect, vi } from 'vitest'
import {
  generateBarcodeCandidate,
  allocateUniqueBarcode,
  ean13CheckDigit,
  isValidEan13,
} from './barcode'

describe('generateBarcodeCandidate', () => {
  it('returns a 13-digit EAN-13 string with a non-zero first digit', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateBarcodeCandidate()).toMatch(/^[1-9]\d{12}$/)
    }
  })
  it('always produces a valid EAN-13 check digit', () => {
    for (let i = 0; i < 200; i++) {
      expect(isValidEan13(generateBarcodeCandidate())).toBe(true)
    }
  })
})

describe('ean13CheckDigit', () => {
  it('computes the known vector 629104150021 → 3', () => {
    expect(ean13CheckDigit('629104150021')).toBe('3')
  })
})

describe('isValidEan13', () => {
  it('accepts a valid EAN-13', () => {
    expect(isValidEan13('6291041500213')).toBe(true)
  })
  it('rejects a wrong check digit', () => {
    expect(isValidEan13('6291041500210')).toBe(false)
  })
  it('rejects wrong lengths', () => {
    expect(isValidEan13('100309088')).toBe(false) // 9-digit legacy code
    expect(isValidEan13('629104150021')).toBe(false) // 12 digits
  })
  it('rejects non-digit characters', () => {
    expect(isValidEan13('629104150021X')).toBe(false)
  })
})

describe('allocateUniqueBarcode', () => {
  it('returns the first candidate that is not taken', async () => {
    const taken = vi.fn(async (_c: string) => false)
    const code = await allocateUniqueBarcode(taken)
    expect(code).toMatch(/^[1-9]\d{12}$/)
    expect(taken).toHaveBeenCalledTimes(1)
  })
  it('retries while taken, then returns a free one', async () => {
    let calls = 0
    const taken = vi.fn(async () => (++calls < 3))
    const code = await allocateUniqueBarcode(taken)
    expect(code).toMatch(/^[1-9]\d{12}$/)
    expect(taken).toHaveBeenCalledTimes(3)
  })
  it('throws if it cannot find a free code within the cap', async () => {
    const taken = vi.fn(async () => true)
    await expect(allocateUniqueBarcode(taken)).rejects.toThrow(/unique barcode/i)
  })
})
