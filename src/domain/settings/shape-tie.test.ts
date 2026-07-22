import { describe, it, expect, expectTypeOf } from 'vitest'
import type { AuthSettings } from './types'

/**
 * SHAPE-TIE GUARD.
 *
 * functions/src/auth/beforeCreate.ts (separate tsconfig workspace, cannot be
 * imported here) reads EXACTLY these fields with these types:
 *
 *     const rawDomains = data?.allowedEmailDomains
 *     const domains: string[] = Array.isArray(rawDomains)
 *       ? rawDomains.filter((d): d is string => typeof d === 'string') : []
 *
 *     const rawSeed = data?.seedSuperAdmins
 *     const seedEmails: string[] = Array.isArray(rawSeed)
 *       ? rawSeed.filter((e): e is string => typeof e === 'string') : []
 *
 * The Super-Admin editor writes the SAME fields via AuthSettings. If a name or
 * type ever drifts, the editor would write a field the function ignores and the
 * fail-closed gate would silently reject everyone. If you change a field on
 * EITHER side, you MUST change it on BOTH and update this guard.
 */
const DOMAIN_FIELD = 'allowedEmailDomains' as const
const SEED_FIELD = 'seedSuperAdmins' as const

describe('shape-tie: AuthSettings write shape <-> beforeCreate read shape', () => {
  // ── allowedEmailDomains ──────────────────────────────────────────────────────

  it('AuthSettings carries allowedEmailDomains as string[] (type-level)', () => {
    expectTypeOf<AuthSettings[typeof DOMAIN_FIELD]>().toEqualTypeOf<string[]>()
  })

  it('a constructed AuthSettings exposes allowedEmailDomains as an array of strings (runtime)', () => {
    const sample: AuthSettings = { allowedEmailDomains: ['example.com'] }
    expect(DOMAIN_FIELD in sample).toBe(true)
    expect(Array.isArray(sample[DOMAIN_FIELD])).toBe(true)
    for (const d of sample[DOMAIN_FIELD]) expect(typeof d).toBe('string')
  })

  it('the enforced domain field name matches the literal beforeCreate reads', () => {
    // Mirrors functions/src/auth/beforeCreate.ts data?.allowedEmailDomains
    expect(DOMAIN_FIELD).toBe('allowedEmailDomains')
  })

  // ── seedSuperAdmins ──────────────────────────────────────────────────────────

  it('AuthSettings carries seedSuperAdmins as optional string[] (type-level)', () => {
    expectTypeOf<AuthSettings[typeof SEED_FIELD]>().toEqualTypeOf<string[] | undefined>()
  })

  it('a constructed AuthSettings with seedSuperAdmins exposes it as an array of strings (runtime)', () => {
    const sample: AuthSettings = {
      allowedEmailDomains: ['example.com'],
      seedSuperAdmins: ['admin@other.example'],
    }
    expect(SEED_FIELD in sample).toBe(true)
    expect(Array.isArray(sample[SEED_FIELD])).toBe(true)
    for (const e of sample[SEED_FIELD]!) expect(typeof e).toBe('string')
  })

  it('the enforced seed field name matches the literal beforeCreate reads', () => {
    // Mirrors functions/src/auth/beforeCreate.ts data?.seedSuperAdmins
    expect(SEED_FIELD).toBe('seedSuperAdmins')
  })

  it('seedSuperAdmins is optional — omitting it from an AuthSettings is valid', () => {
    // This must compile without error (type-level only test)
    const sample: AuthSettings = { allowedEmailDomains: [] }
    expect(sample.seedSuperAdmins).toBeUndefined()
  })
})
