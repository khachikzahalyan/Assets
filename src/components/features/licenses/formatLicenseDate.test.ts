/**
 * Unit tests for the formatLicenseDate utility.
 *
 * Assertions compare against the same `toLocaleDateString` call rather than
 * hardcoded locale strings, so the tests remain green across Node/jsdom
 * versions that may format dates differently.
 */

import { describe, it, expect } from 'vitest'
import { formatLicenseDate } from './formatLicenseDate'

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}

describe('formatLicenseDate', () => {
  // ── Invalid input ─────────────────────────────────────────────────────────

  it('returns the input unchanged when the iso string is not a valid date', () => {
    // Arrange
    const invalid = 'not-a-date'

    // Act
    const result = formatLicenseDate(invalid, 'ru-RU')

    // Assert
    expect(result).toBe(invalid)
  })

  it('returns the input unchanged for an empty string', () => {
    // Arrange / Act / Assert
    expect(formatLicenseDate('', 'ru-RU')).toBe('')
  })

  // ── Valid input — locale-aware formatting ──────────────────────────────────

  it('returns the same string as toLocaleDateString(ru-RU) for a fixed ISO date', () => {
    // Arrange
    const ISO = '2024-03-15T00:00:00.000Z'
    const d = new Date(ISO)
    const expected = d.toLocaleDateString('ru-RU', DATE_OPTIONS)

    // Act
    const result = formatLicenseDate(ISO, 'ru-RU')

    // Assert
    expect(result).toBe(expected)
  })

  it('returns the same string as toLocaleDateString(en-US) for the same ISO date', () => {
    // Arrange
    const ISO = '2024-03-15T00:00:00.000Z'
    const d = new Date(ISO)
    const expected = d.toLocaleDateString('en-US', DATE_OPTIONS)

    // Act
    const result = formatLicenseDate(ISO, 'en-US')

    // Assert
    expect(result).toBe(expected)
  })

  it('produces different output for ru-RU vs en-US on the same date', () => {
    // Arrange — use a date where day/month/year order differs between locales
    const ISO = '2024-11-05T12:00:00.000Z'
    const d = new Date(ISO)
    const ruResult = d.toLocaleDateString('ru-RU', DATE_OPTIONS)
    const enResult = d.toLocaleDateString('en-US', DATE_OPTIONS)

    // Act
    expect(formatLicenseDate(ISO, 'ru-RU')).toBe(ruResult)
    expect(formatLicenseDate(ISO, 'en-US')).toBe(enResult)

    // Assert — ru-RU and en-US must produce distinct orderings for this date
    // (this validates that the locale argument is actually forwarded to toLocaleDateString)
    expect(ruResult).not.toBe(enResult)
  })
})
