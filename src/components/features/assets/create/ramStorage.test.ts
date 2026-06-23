import { describe, it, expect } from 'vitest'
import {
  parseRamValue, serializeRam, parseStorageValue, serializeStorage,
  nextInvCode, nextInvFromBatch, pluralAssets,
} from './ramStorage'

describe('RAM parse/serialize', () => {
  it('round-trips a multi-slot DDR4 value', () => {
    const p = parseRamValue('16 ГБ + 32 ГБ DDR4')
    expect(p.ddrType).toBe('DDR4')
    expect(p.ecc).toBe(false)
    expect(p.slots.map(s => s.size)).toEqual(['16 ГБ', '32 ГБ'])
    expect(serializeRam(p.slots, p.ddrType, p.ecc)).toBe('16 ГБ + 32 ГБ DDR4')
  })

  it('parses trailing ECC independent of DDR generation', () => {
    const p = parseRamValue('64 ГБ DDR4 ECC')
    expect(p.ecc).toBe(true)
    expect(p.ddrType).toBe('DDR4')
    expect(serializeRam(p.slots, p.ddrType, p.ecc)).toBe('64 ГБ DDR4 ECC')
  })

  it('empty value yields a single empty slot, serializes to empty string', () => {
    const p = parseRamValue('')
    expect(p.slots).toHaveLength(1)
    expect(serializeRam(p.slots, p.ddrType, p.ecc)).toBe('')
  })
})

describe('Storage parse/serialize', () => {
  it('round-trips type+size rows', () => {
    const rows = parseStorageValue('SSD 256 ГБ + HDD 1 ТБ')
    expect(rows.map(r => ({ type: r.type, size: r.size }))).toEqual([
      { type: 'SSD', size: '256 ГБ' },
      { type: 'HDD', size: '1 ТБ' },
    ])
    expect(serializeStorage(rows)).toBe('SSD 256 ГБ + HDD 1 ТБ')
  })

  it('empty value yields one default SSD row', () => {
    const rows = parseStorageValue('')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.type).toBe('SSD')
    expect(rows[0]!.size).toBe('')
  })
})

describe('nextInvCode', () => {
  it('preserves zero-padding', () => {
    expect(nextInvCode('460/00007')).toBe('460/00008')
    expect(nextInvCode('LAP-099')).toBe('LAP-100')
  })
  it('returns input unchanged when no numeric tail', () => {
    expect(nextInvCode('ABC')).toBe('ABC')
  })
  it('nextInvFromBatch seeds from the largest suffix', () => {
    const rows = [{ invCode: '460/00007' }, { invCode: '460/00010' }, { invCode: '460/00008' }]
    expect(nextInvFromBatch(rows, '460/00007')).toBe('460/00011')
  })
})

describe('pluralAssets', () => {
  it('declines the noun correctly', () => {
    expect(pluralAssets(1)).toBe('актив')
    expect(pluralAssets(2)).toBe('актива')
    expect(pluralAssets(5)).toBe('активов')
    expect(pluralAssets(11)).toBe('активов')
    expect(pluralAssets(21)).toBe('актив')
  })
})
