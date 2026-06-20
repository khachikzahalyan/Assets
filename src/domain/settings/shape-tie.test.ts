import { describe, it, expect, expectTypeOf } from 'vitest'
import type { AuthSettings } from './types'

/**
 * SHAPE-TIE GUARD.
 *
 * functions/src/auth/beforeCreate.ts (separate tsconfig workspace, cannot be
 * imported here) reads EXACTLY this field with this type:
 *
 *     const raw = data?.allowedEmailDomains
 *     const domains: string[] = Array.isArray(raw)
 *       ? raw.filter((d): d is string => typeof d === 'string') : []
 *
 * The Super-Admin editor writes the SAME field via AuthSettings. If this name or
 * type ever drifts, the editor would write a field the function ignores and the
 * fail-closed gate would silently reject everyone. If you change the field on
 * EITHER side, you MUST change it on BOTH and update this guard.
 */
const ENFORCED_FIELD = 'allowedEmailDomains' as const

describe('shape-tie: AuthSettings write shape <-> beforeCreate read shape', () => {
  it('AuthSettings carries allowedEmailDomains as string[] (type-level)', () => {
    expectTypeOf<AuthSettings[typeof ENFORCED_FIELD]>().toEqualTypeOf<string[]>()
  })

  it('a constructed AuthSettings exposes allowedEmailDomains as an array of strings (runtime)', () => {
    const sample: AuthSettings = { allowedEmailDomains: ['example.com'] }
    expect(ENFORCED_FIELD in sample).toBe(true)
    expect(Array.isArray(sample[ENFORCED_FIELD])).toBe(true)
    for (const d of sample[ENFORCED_FIELD]) expect(typeof d).toBe('string')
  })

  it('the enforced field name matches the literal beforeCreate reads', () => {
    // Mirrors functions/src/auth/beforeCreate.ts data?.allowedEmailDomains
    expect(ENFORCED_FIELD).toBe('allowedEmailDomains')
  })
})
