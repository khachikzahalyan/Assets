// src/domain/asset/assetSearch.test.ts
//
// Pure unit tests for matchesAssetSearch.
// No Firebase, no React — plain Vitest over a pure function.

import { describe, it, expect } from 'vitest'
import { matchesAssetSearch } from './assetSearch'

// Minimal asset shape expected by the function
type SearchableAsset = { invCode: string; brand: string | null; model: string | null; serial: string | null }

function makeAsset(overrides: Partial<SearchableAsset> = {}): SearchableAsset {
  return {
    invCode: '450/302042',
    brand: 'Dell',
    model: 'Latitude 7420',
    serial: 'SN-001',
    ...overrides,
  }
}

describe('matchesAssetSearch', () => {
  // Empty / whitespace search always matches
  it('returns true for an empty search string', () => {
    expect(matchesAssetSearch(makeAsset(), '')).toBe(true)
  })

  it('returns true for a whitespace-only search string', () => {
    expect(matchesAssetSearch(makeAsset(), '   ')).toBe(true)
  })

  // Single-field matches (case-insensitive)
  it('matches on invCode (exact)', () => {
    expect(matchesAssetSearch(makeAsset({ invCode: '450/302042' }), '450/302042')).toBe(true)
  })

  it('matches on invCode (case-insensitive partial)', () => {
    expect(matchesAssetSearch(makeAsset({ invCode: '450/302042' }), '302')).toBe(true)
  })

  it('matches on brand case-insensitively', () => {
    expect(matchesAssetSearch(makeAsset({ brand: 'Dell' }), 'dell')).toBe(true)
    expect(matchesAssetSearch(makeAsset({ brand: 'Dell' }), 'DELL')).toBe(true)
  })

  it('matches on model case-insensitively', () => {
    expect(matchesAssetSearch(makeAsset({ model: 'Latitude 7420' }), 'latitude')).toBe(true)
    expect(matchesAssetSearch(makeAsset({ model: 'Latitude 7420' }), '7420')).toBe(true)
  })

  it('matches on serial case-insensitively', () => {
    expect(matchesAssetSearch(makeAsset({ serial: 'SN-ABC-001' }), 'sn-abc')).toBe(true)
  })

  // Match across joined fields
  it('matches a token that spans the joined-field boundary', () => {
    // "dell latitude" — brand + model joined
    expect(matchesAssetSearch(makeAsset({ brand: 'Dell', model: 'Latitude 7420' }), 'dell latitude')).toBe(true)
  })

  // Non-match cases
  it('returns false when no field contains the search token', () => {
    expect(matchesAssetSearch(makeAsset(), 'samsung')).toBe(false)
  })

  it('returns false when the search does not match after trimming', () => {
    expect(matchesAssetSearch(makeAsset({ brand: 'Dell' }), 'apple')).toBe(false)
  })

  // Null / absent optional fields do not crash and do not match
  it('does not crash when brand is null and does not match against null', () => {
    const a = makeAsset({ brand: null })
    expect(matchesAssetSearch(a, 'null')).toBe(false)
    expect(matchesAssetSearch(a, 'dell')).toBe(false)
  })

  it('does not crash when model is null', () => {
    const a = makeAsset({ model: null })
    expect(matchesAssetSearch(a, '7420')).toBe(false)
  })

  it('does not crash when serial is null', () => {
    const a = makeAsset({ serial: null })
    expect(matchesAssetSearch(a, 'SN-001')).toBe(false)
  })

  it('does not crash when all optional fields are null and still matches on invCode', () => {
    const a: SearchableAsset = { invCode: '380/110007', brand: null, model: null, serial: null }
    expect(matchesAssetSearch(a, '380')).toBe(true)
    expect(matchesAssetSearch(a, 'samsung')).toBe(false)
  })
})
