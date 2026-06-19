import { describe, it, expect } from 'vitest'
import { maskKey } from './maskKey'

describe('maskKey', () => {
  it('masks a 4-group dash-separated key, keeping the last group', () => {
    expect(maskKey('XCVF-7TR5-9HJK-5592')).toBe('****-****-****-5592')
  })

  it('masks an 8-char key, keeping the last 4 chars', () => {
    expect(maskKey('ABCD1234')).toBe('****1234')
  })

  it('returns as-is when there are 4 or fewer alphanumeric chars', () => {
    expect(maskKey('AB')).toBe('AB')
  })

  it('returns an empty string unchanged', () => {
    expect(maskKey('')).toBe('')
  })

  it('preserves separators in their original positions', () => {
    expect(maskKey('AAAA BBBB-CCCC')).toBe('**** ****-CCCC')
  })

  it('does not mask when exactly 4 alphanumeric chars', () => {
    expect(maskKey('ABCD')).toBe('ABCD')
    expect(maskKey('A-B-C-D')).toBe('A-B-C-D')
  })
})
