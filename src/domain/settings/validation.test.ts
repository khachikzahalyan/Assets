import { describe, it, expect } from 'vitest'
import { normalizeDomain, isValidDomain, dedupeDomains } from './validation'

describe('normalizeDomain', () => {
  it('lowercases, trims, strips @ / scheme / www / path', () => {
    expect(normalizeDomain('  @Example.COM ')).toBe('example.com')
    expect(normalizeDomain('https://www.Foo.io/login')).toBe('foo.io')
    expect(normalizeDomain('Sub.Bar.co.uk')).toBe('sub.bar.co.uk')
  })
})
describe('isValidDomain', () => {
  it('accepts real domains', () => {
    expect(isValidDomain('example.com')).toBe(true)
    expect(isValidDomain('sub.bar.co.uk')).toBe(true)
  })
  it('rejects junk', () => {
    for (const bad of ['', '   ', 'nope', 'a@b.com', 'foo .com', 'foo..com', '.com', 'foo.', 'http://x']) {
      expect(isValidDomain(bad)).toBe(false)
    }
  })
})
describe('dedupeDomains', () => {
  it('case-insensitive de-dupe, stable order', () => {
    expect(dedupeDomains(['a.com', 'A.com', 'b.com', 'a.com'])).toEqual(['a.com', 'b.com'])
  })
})
