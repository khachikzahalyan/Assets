import { describe, it, expect } from 'vitest'
import { maskLicenseKey, sanitizeLicenseAuditPayload } from './maskSecrets'

// ---------------------------------------------------------------------------
// maskLicenseKey
// ---------------------------------------------------------------------------

describe('maskLicenseKey', () => {
  it('masks a standard 4-segment key, preserving the last segment', () => {
    expect(maskLicenseKey('XCVF-7TR5-9HJK-5592')).toBe('****-****-****-5592')
  })

  it('masks an 8-char key with no separators', () => {
    expect(maskLicenseKey('ABCD1234')).toBe('****1234')
  })

  it('masks a key with mixed separators, preserving last 4-alnum segment', () => {
    expect(maskLicenseKey('AAAA BBBB-CCCC')).toBe('**** ****-CCCC')
  })

  it('does NOT mask when total alnum chars is exactly 4', () => {
    // 'AB' has only 2 alnum chars — nothing masked
    expect(maskLicenseKey('AB')).toBe('AB')
  })

  it('does NOT mask when total alnum chars is 2', () => {
    expect(maskLicenseKey('AB')).toBe('AB')
  })

  it('does NOT mask a 4-alnum key', () => {
    expect(maskLicenseKey('ABCD')).toBe('ABCD')
  })

  it('does NOT mask a key with 4 alnum chars separated by dashes', () => {
    expect(maskLicenseKey('A-B-C-D')).toBe('A-B-C-D')
  })

  it('returns an empty string for empty input', () => {
    expect(maskLicenseKey('')).toBe('')
  })

  it('preserves separators in their exact original positions after masking', () => {
    // 'AB-CD-EF' has 6 alnum chars; last 4 are C,D,E,F -> preserve positions 3,6,9,12... wait
    // 'AB-CD-EF': A(0),B(1),-,C(3),D(4),-,E(6),F(7) — 6 alnum chars; keep last 4: C,D,E,F at idx 3,4,6,7
    expect(maskLicenseKey('AB-CD-EF')).toBe('**-CD-EF')
  })

  it('masks a 5-alnum key leaving last 4 intact', () => {
    // 'ABCDE': 5 alnum — mask first 1 char only
    expect(maskLicenseKey('ABCDE')).toBe('*BCDE')
  })

  it('handles keys where separators are only spaces', () => {
    // '1234 5678': 8 alnum; last 4 = 5,6,7,8 -> '1234 5678' masked to '**** 5678'
    expect(maskLicenseKey('1234 5678')).toBe('**** 5678')
  })

  it('handles a single alphanumeric character (no masking)', () => {
    expect(maskLicenseKey('A')).toBe('A')
  })

  it('handles a string of only separators', () => {
    expect(maskLicenseKey('----')).toBe('----')
  })
})

// ---------------------------------------------------------------------------
// sanitizeLicenseAuditPayload
// ---------------------------------------------------------------------------

describe('sanitizeLicenseAuditPayload', () => {
  it('masks the `key` property and leaves other props untouched', () => {
    const input = { key: 'XCVF-7TR5-9HJK-5592', name: 'Win' }
    const result = sanitizeLicenseAuditPayload(input)
    expect(result.key).toBe('****-****-****-5592')
    expect(result.name).toBe('Win')
  })

  it('leaves a payload with no `key` property completely unchanged', () => {
    const input = { id: '123', status: 'active', count: 42 }
    const result = sanitizeLicenseAuditPayload(input)
    expect(result).toEqual({ id: '123', status: 'active', count: 42 })
  })

  it('masks a nested `key` property', () => {
    const input = { secrets: { current: { key: 'AAAA-BBBB-1234' } } }
    const result = sanitizeLicenseAuditPayload(input)
    expect(result.secrets.current.key).toBe('****-****-1234')
  })

  it('handles arrays by recursing into elements', () => {
    const input = [{ key: 'ABCD1234' }, { key: 'AB' }]
    const result = sanitizeLicenseAuditPayload(input)
    expect(result[0]?.key).toBe('****1234')
    expect(result[1]?.key).toBe('AB')
  })

  it('passes through primitives unchanged', () => {
    expect(sanitizeLicenseAuditPayload(42)).toBe(42)
    expect(sanitizeLicenseAuditPayload('raw string')).toBe('raw string')
    expect(sanitizeLicenseAuditPayload(null)).toBeNull()
    expect(sanitizeLicenseAuditPayload(true)).toBe(true)
  })

  it('does not mask a `key` property whose value is not a string', () => {
    const input = { key: 12345 }
    const result = sanitizeLicenseAuditPayload(input)
    // Non-string key values must be passed through recursed but not masked.
    expect(result.key).toBe(12345)
  })

  it('masks multiple `key` properties at different nesting levels', () => {
    const input = {
      key: 'XCVF-7TR5-9HJK-5592',
      child: {
        key: 'ABCD1234',
        other: 'untouched',
      },
    }
    const result = sanitizeLicenseAuditPayload(input)
    expect(result.key).toBe('****-****-****-5592')
    expect(result.child.key).toBe('****1234')
    expect(result.child.other).toBe('untouched')
  })
})
