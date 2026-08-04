import { describe, expect, test } from 'vitest'
import { cn } from './utils'

// Guard for the AMS custom font-size scale (text-9 … text-22, display-*).
// Default tailwind-merge classifies unknown text-<n> values into the
// text-COLOR group, so a later color class silently drops the size token.
describe('cn custom font-size tokens', () => {
  test('keeps a custom size next to a text color', () => {
    expect(cn('text-11', 'text-accent')).toBe('text-11 text-accent')
  })

  test('keeps a half-step size next to a text color', () => {
    expect(cn('text-13.5', 'text-text-secondary')).toBe('text-13.5 text-text-secondary')
  })

  test('keeps a display size next to a text color', () => {
    expect(cn('text-display-md', 'text-warning')).toBe('text-display-md text-warning')
  })

  test('later size still overrides earlier size', () => {
    expect(cn('text-11', 'text-13')).toBe('text-13')
  })

  test('variant-prefixed sizes survive color merges', () => {
    expect(cn('text-11 lg:text-11.5', 'text-success')).toBe('text-11 lg:text-11.5 text-success')
  })

  test('color still overrides color', () => {
    expect(cn('text-accent', 'text-error')).toBe('text-error')
  })
})
