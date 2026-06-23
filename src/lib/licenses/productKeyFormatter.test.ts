/**
 * Unit tests for productKeyFormatter utilities.
 *
 * Covers:
 *  1. Incremental typing — partial keys format into correct partial groups.
 *  2. Full 25-char input → 5 groups of 5 separated by dashes.
 *  3. Lowercase → uppercased.
 *  4. Junk characters stripped (spaces, punctuation, unicode).
 *  5. Doubled-key paste → truncated to first valid key (25 alnum chars).
 *  6. Existing dashes stripped and re-inserted correctly.
 *  7. isCompleteProductKey — false for partial, true for full (dashed and raw).
 *  8. Empty input → empty string.
 */

import { describe, it, expect } from 'vitest'
import { formatProductKey, isCompleteProductKey } from './productKeyFormatter'

describe('formatProductKey', () => {
  it('returns empty string for empty input', () => {
    expect(formatProductKey('')).toBe('')
  })

  it('incremental typing — 1 char', () => {
    expect(formatProductKey('y')).toBe('Y')
  })

  it('incremental typing — 5 chars forms first group', () => {
    expect(formatProductKey('yvwgf')).toBe('YVWGF')
  })

  it('incremental typing — 6 chars forms two groups (5 + 1)', () => {
    expect(formatProductKey('yvwgfb')).toBe('YVWGF-B')
  })

  it('incremental typing — 10 chars forms two full groups', () => {
    expect(formatProductKey('yvwgfbxnmc')).toBe('YVWGF-BXNMC')
  })

  it('incremental typing — 11 chars', () => {
    expect(formatProductKey('yvwgfbxnmch')).toBe('YVWGF-BXNMC-H')
  })

  it('full 25-char lowercase key formats into 5 groups', () => {
    expect(formatProductKey('yvwgfbxnmchtqyqcpq9966qfc')).toBe('YVWGF-BXNMC-HTQYQ-CPQ99-66QFC')
  })

  it('already-formatted key re-formats correctly (strips and re-inserts dashes)', () => {
    expect(formatProductKey('YVWGF-BXNMC-HTQYQ-CPQ99-66QFC')).toBe('YVWGF-BXNMC-HTQYQ-CPQ99-66QFC')
  })

  it('lowercase letters are uppercased', () => {
    expect(formatProductKey('abcde')).toBe('ABCDE')
    expect(formatProductKey('abcde12345fghij67890klmno')).toBe('ABCDE-12345-FGHIJ-67890-KLMNO')
  })

  it('junk characters (spaces, punctuation, unicode) are stripped', () => {
    // 'AB CD!12@34#56' → strip → 'ABCD123456' (10 alnum) → 'ABCD1-23456'
    expect(formatProductKey('AB CD!12@34#56')).toBe('ABCD1-23456')
    expect(formatProductKey('hello world!!!')).toBe('HELLO-WORLD')
    expect(formatProductKey('αβγδε')).toBe('')
  })

  it('doubled-key paste is truncated to first 25 alnum chars', () => {
    // "YVWGF-BXNMC-HTQYQ-CPQ99-66QFC" repeated twice
    const doubled = 'YVWGF-BXNMC-HTQYQ-CPQ99-66QFCYVWGF-BXNMC-HTQYQ-CPQ99-66QFC'
    expect(formatProductKey(doubled)).toBe('YVWGF-BXNMC-HTQYQ-CPQ99-66QFC')
  })

  it('doubled-key paste (lowercase, no dashes) truncated to first valid key', () => {
    const doubled = 'yvwgfbxnmchtqyqcpq9966qfc' + 'yvwgfbxnmchtqyqcpq9966qfc'
    expect(formatProductKey(doubled)).toBe('YVWGF-BXNMC-HTQYQ-CPQ99-66QFC')
  })

  it('hard cap: input with 26+ alnum chars truncates to 25', () => {
    // 26 alnum chars
    expect(formatProductKey('ABCDE12345FGHIJ67890KLMNOP')).toBe('ABCDE-12345-FGHIJ-67890-KLMNO')
  })

  it('mixed junk and valid chars — only alnum kept and capped', () => {
    expect(formatProductKey('  ab-cd-ef-gh-ij-kl-mn-op-qr-st  ')).toBe('ABCDE-FGHIJ-KLMNO-PQRST')
  })
})

describe('isCompleteProductKey', () => {
  it('returns false for empty string', () => {
    expect(isCompleteProductKey('')).toBe(false)
  })

  it('returns false for partial key (24 alnum chars)', () => {
    expect(isCompleteProductKey('YVWGF-BXNMC-HTQYQ-CPQ99-66QF')).toBe(false)
  })

  it('returns false for partial key (10 alnum chars)', () => {
    expect(isCompleteProductKey('YVWGF-BXNMC')).toBe(false)
  })

  it('returns true for complete dashed key (25 alnum chars)', () => {
    expect(isCompleteProductKey('YVWGF-BXNMC-HTQYQ-CPQ99-66QFC')).toBe(true)
  })

  it('returns true for complete raw key (25 alnum chars, no dashes)', () => {
    expect(isCompleteProductKey('YVWGFBXNMCHTQYQCPQ9966QFC')).toBe(true)
  })

  it('returns false for 26 alnum chars (over cap)', () => {
    // isCompleteProductKey only checks for exactly 25 alnum
    expect(isCompleteProductKey('ABCDE12345FGHIJ67890KLMNOP')).toBe(false)
  })
})
