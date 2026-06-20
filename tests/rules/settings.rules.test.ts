import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { authedDb, unauthedDb, makeTestEnv, seedDoc, seedUser } from './helpers'

/**
 * Emulator-backed Firestore rules tests for /settings/auth and /settings/{doc}.
 * Require the Firestore emulator (run via `npm run test:rules`).
 * Excluded from the default `vitest run`.
 *
 * Security invariants under test:
 *   - Only super_admin may read or write any /settings doc.
 *   - /settings/auth writes MUST supply allowedEmailDomains as a list (or omit it);
 *     a scalar value is DENIED by the specific /settings/auth block.
 *   - The generic /settings/{doc} wildcard block excludes `auth` on write so the
 *     list-guard in the specific block cannot be bypassed.
 *   - Other /settings docs (e.g. `defaults`) are writable by super_admin without a
 *     list constraint.
 */

const SUPER = 'super1'
const ASSET = 'asset1'
const TECH = 'tech1'
const EMP = 'emp1'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await makeTestEnv()
  await seedUser(env, SUPER, 'super_admin')
  await seedUser(env, ASSET, 'asset_admin')
  await seedUser(env, TECH, 'tech_admin')
  await seedUser(env, EMP, 'employee')
})

beforeEach(async () => {
  await env.clearFirestore()
  // Re-seed user role docs after each clear (clearFirestore wipes users too).
  await seedUser(env, SUPER, 'super_admin')
  await seedUser(env, ASSET, 'asset_admin')
  await seedUser(env, TECH, 'tech_admin')
  await seedUser(env, EMP, 'employee')
})

afterAll(async () => {
  await env.cleanup()
})

// ---------------------------------------------------------------------------
// /settings/auth — READ
// ---------------------------------------------------------------------------
describe('settings/auth read', () => {
  beforeEach(async () => {
    await seedDoc(env, 'settings/auth', { allowedEmailDomains: ['ams.test'] })
  })

  it('super_admin CAN read settings/auth', async () => {
    await assertSucceeds(getDoc(doc(authedDb(env, SUPER), 'settings', 'auth')))
  })

  it('asset_admin CANNOT read settings/auth', async () => {
    await assertFails(getDoc(doc(authedDb(env, ASSET), 'settings', 'auth')))
  })

  it('tech_admin CANNOT read settings/auth', async () => {
    await assertFails(getDoc(doc(authedDb(env, TECH), 'settings', 'auth')))
  })

  it('employee CANNOT read settings/auth', async () => {
    await assertFails(getDoc(doc(authedDb(env, EMP), 'settings', 'auth')))
  })

  it('unauthenticated CANNOT read settings/auth', async () => {
    await assertFails(getDoc(doc(unauthedDb(env), 'settings', 'auth')))
  })
})

// ---------------------------------------------------------------------------
// /settings/auth — WRITE (create / update via setDoc)
// ---------------------------------------------------------------------------
describe('settings/auth write', () => {
  it('super_admin CAN write a non-empty list', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(env, SUPER), 'settings', 'auth'), {
        allowedEmailDomains: ['a.com'],
      }),
    )
  })

  it('super_admin CAN write an empty list (still a list)', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(env, SUPER), 'settings', 'auth'), {
        allowedEmailDomains: [],
      }),
    )
  })

  it('super_admin CAN write a doc that omits allowedEmailDomains entirely', async () => {
    // The list-guard uses `!('allowedEmailDomains' in data) || data.allowedEmailDomains is list`,
    // so an absent field satisfies the guard.
    await assertSucceeds(
      setDoc(doc(authedDb(env, SUPER), 'settings', 'auth'), {
        updatedBy: SUPER,
      }),
    )
  })

  it('super_admin CANNOT write a scalar string as allowedEmailDomains (not a list)', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, SUPER), 'settings', 'auth'), {
        allowedEmailDomains: 'a.com',
      }),
    )
  })

  it('asset_admin CANNOT write settings/auth', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, ASSET), 'settings', 'auth'), {
        allowedEmailDomains: ['a.com'],
      }),
    )
  })

  it('tech_admin CANNOT write settings/auth', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, TECH), 'settings', 'auth'), {
        allowedEmailDomains: ['a.com'],
      }),
    )
  })

  it('employee CANNOT write settings/auth', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, EMP), 'settings', 'auth'), {
        allowedEmailDomains: ['a.com'],
      }),
    )
  })

  it('unauthenticated CANNOT write settings/auth', async () => {
    await assertFails(
      setDoc(doc(unauthedDb(env), 'settings', 'auth'), {
        allowedEmailDomains: ['a.com'],
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// /settings/{doc} wildcard — generic settings doc
// ---------------------------------------------------------------------------
describe('settings/defaults (generic wildcard block)', () => {
  it('super_admin CAN write a generic settings doc without a list constraint', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(env, SUPER), 'settings', 'defaults'), {
        mainBranchId: 'br1',
      }),
    )
  })

  it('employee CANNOT read a generic settings doc', async () => {
    await seedDoc(env, 'settings/defaults', { mainBranchId: 'br1' })
    await assertFails(getDoc(doc(authedDb(env, EMP), 'settings', 'defaults')))
  })

  it('asset_admin CANNOT write a generic settings doc', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, ASSET), 'settings', 'defaults'), {
        mainBranchId: 'br1',
      }),
    )
  })
})
