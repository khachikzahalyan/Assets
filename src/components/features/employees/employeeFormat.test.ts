import { describe, it, expect } from 'vitest'
import { formatLocalPhone, normalizePhone, formatDateRu } from './employeeFormat'

describe('formatLocalPhone', () => {
  it('formats a full 9-digit Armenian number', () => {
    expect(formatLocalPhone('099123456')).toBe('099 12 34 56')
  })
  it('formats when leading zero is missing', () => {
    expect(formatLocalPhone('99123456')).toBe('099 12 34 56')
  })
  it('strips E.164 country code +374', () => {
    expect(formatLocalPhone('+37499123456')).toBe('099 12 34 56')
  })
  it('returns raw digits when fewer than 9 digits', () => {
    expect(formatLocalPhone('099123')).toBe('099123')
  })
  it('returns empty string for null/undefined', () => {
    expect(formatLocalPhone(null)).toBe('')
    expect(formatLocalPhone(undefined)).toBe('')
    expect(formatLocalPhone('')).toBe('')
  })
  it('strips non-digit characters', () => {
    expect(formatLocalPhone('099-12-34-56')).toBe('099 12 34 56')
  })
})

describe('normalizePhone', () => {
  it('strips +374, enforces leading 0, caps 9 digits', () => {
    expect(normalizePhone('+37499120000')).toBe('099120000')
    expect(normalizePhone('99 12 00 00')).toBe('099120000')
    expect(normalizePhone('099120000')).toBe('099120000')
    expect(normalizePhone('')).toBe('')
    expect(normalizePhone(null)).toBe('')
  })
})

describe('formatLocalPhone delegates to normalizePhone', () => {
  it('formats full 9-digit as 0XX XX XX XX', () => {
    expect(formatLocalPhone('099120000')).toBe('099 12 00 00')
    expect(formatLocalPhone('+37499120000')).toBe('099 12 00 00')
  })
  it('returns partial unformatted', () => {
    expect(formatLocalPhone('0991')).toBe('0991')
  })
})

describe('formatDateRu', () => {
  it('formats DD mmm YYYY (local)', () => {
    expect(formatDateRu(new Date(2026, 4, 12))).toBe('12 май 2026')
    expect(formatDateRu(new Date(2026, 0, 3))).toBe('03 янв 2026')
  })
})
