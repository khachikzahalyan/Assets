import { describe, it, expect } from 'vitest'
import { validateActFile, ACT_MAX_BYTES, ACT_CONTENT_TYPES, actStoragePath } from './actScanStorage'

describe('act scan validation', () => {
  it('accepts a 1MB pdf', () => {
    expect(validateActFile({ size: 1_000_000, type: 'application/pdf' })).toBeNull()
  })
  it('rejects an oversized file', () => {
    expect(validateActFile({ size: ACT_MAX_BYTES + 1, type: 'application/pdf' })).toBe('too-large')
  })
  it('rejects a disallowed type', () => {
    expect(validateActFile({ size: 100, type: 'text/plain' })).toBe('bad-type')
  })
  it('allows jpeg and png', () => {
    expect(ACT_CONTENT_TYPES).toContain('image/jpeg')
    expect(ACT_CONTENT_TYPES).toContain('image/png')
  })
  it('actStoragePath builds acts/{assetId}/{fileName}', () => {
    expect(actStoragePath('a_1', 'scan.pdf')).toBe('acts/a_1/scan.pdf')
  })
})
