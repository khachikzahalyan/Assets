import { describe, it, expect } from 'vitest'
import { ASSET_STATUS_IDS, isAssetStatusId, parseInventoryCode } from './types'

describe('asset status enum', () => {
  it('has exactly the 4 canonical status ids', () => {
    expect(ASSET_STATUS_IDS).toEqual(['st_warehouse', 'st_assigned', 'st_repair', 'st_disposed'])
  })
  it('isAssetStatusId narrows correctly', () => {
    expect(isAssetStatusId('st_assigned')).toBe(true)
    expect(isAssetStatusId('st_unknown')).toBe(false)
  })
})

describe('parseInventoryCode', () => {
  it('splits PREFIX/NUMBER', () => {
    expect(parseInventoryCode('LAP/00031')).toEqual({ prefix: 'LAP', number: '00031' })
  })
  it('returns null for malformed codes', () => {
    expect(parseInventoryCode('LAP')).toBeNull()
    expect(parseInventoryCode('')).toBeNull()
  })
})
