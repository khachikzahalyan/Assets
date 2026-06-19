/**
 * maskSecrets.test-d.ts
 *
 * Type-level tests for the MaskedKey branded type.
 * Run with: npx vitest run --typecheck src/lib/audit/maskSecrets.test-d.ts
 */
import { expectTypeOf } from 'vitest'
import { maskLicenseKey, type MaskedKey } from './maskSecrets'

// maskLicenseKey returns MaskedKey, not a plain string.
expectTypeOf(maskLicenseKey('XCVF-7TR5-9HJK-5592')).toEqualTypeOf<MaskedKey>()

// A raw string is NOT assignable to MaskedKey.
const raw = 'XCVF-7TR5'
// @ts-expect-error — raw string must not be assignable to MaskedKey
const bad: MaskedKey = raw
void bad
