import { describe, it, expect } from 'vitest'
import {
  addYearsISO, addMonthsISO, oneYearFrom, formatDateRU,
  formatLocalISO, parseLocalISO, warrantyBeforePurchase, todayISO,
} from './warranty'

describe('warranty date helpers', () => {
  it('addYearsISO adds whole calendar years (not n*365 days)', () => {
    // A simple +1yr: leap-year drift would give 2025-02-28/03-01 if done by days.
    expect(addYearsISO('2024-03-01', 1)).toBe('2025-03-01')
    expect(addYearsISO('2026-06-21', 1)).toBe('2027-06-21')
  })

  it('addYearsISO handles Feb 29 by rolling to Mar 1 (JS Date semantics)', () => {
    // 2024 is leap; +1yr lands on a non-leap year. setFullYear rolls 02-29 -> 03-01.
    expect(addYearsISO('2024-02-29', 1)).toBe('2025-03-01')
  })

  it('addMonthsISO adds whole months using setMonth', () => {
    expect(addMonthsISO('2026-01-15', 1)).toBe('2026-02-15')
    expect(addMonthsISO('2026-12-15', 1)).toBe('2027-01-15')
  })

  it('addMonthsISO rolls month-end overflow per JS Date', () => {
    // Jan 31 + 1 month -> Mar 3 (Feb has 28 days in 2026) — setMonth overflow.
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-03-03')
  })

  it('oneYearFrom equals +1 year', () => {
    expect(oneYearFrom('2026-06-21')).toBe('2027-06-21')
  })

  it('formatLocalISO / parseLocalISO round-trip', () => {
    const d = parseLocalISO('2026-06-21')!
    expect(formatLocalISO(d)).toBe('2026-06-21')
  })

  it('parseLocalISO returns null on bad input', () => {
    expect(parseLocalISO('')).toBeNull()
    expect(parseLocalISO('not-a-date')).toBeNull()
    expect(parseLocalISO(null)).toBeNull()
  })

  it('formatDateRU renders DD.MM.YYYY and blank for empty', () => {
    expect(formatDateRU('2026-06-21')).toBe('21.06.2026')
    expect(formatDateRU('')).toBe('')
  })

  it('todayISO returns a YYYY-MM-DD string', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('warrantyBeforePurchase detects an invalid window', () => {
    expect(warrantyBeforePurchase('2026-06-21', '2026-06-20')).toBe(true)
    expect(warrantyBeforePurchase('2026-06-21', '2027-06-21')).toBe(false)
    expect(warrantyBeforePurchase(null, '2027-06-21')).toBe(false)
    expect(warrantyBeforePurchase('2026-06-21', null)).toBe(false)
  })
})
