import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore'
import { authedDb, makeTestEnv, seedDoc, seedUser } from './helpers'

/**
 * Emulator-backed rules tests for the $0 invited-employee → role self-claim on
 * /users. Require the Firestore emulator (`npm run test:rules`); excluded from
 * the default `vitest run`.
 *
 * Invariant: a user may write their OWN users/{uid} with a role ONLY IF the role
 * equals the preassignedRole of the ACTIVE employees record whose email matches
 * their auth token. Any other self-role-write must fail (no self-escalation).
 */

const SUPER = 'super1'
const INV_UID = 'invUid'
const INV_EMAIL = 'invitee@ams.test'
const EMP_ID = 'emp_invited'

let env: RulesTestEnvironment

/** Authenticated context carrying a VERIFIED email token (rules require email_verified). */
function authedWithEmail(uid: string, email: string, emailVerified = true) {
  return env.authenticatedContext(uid, { email, email_verified: emailVerified }).firestore()
}

beforeAll(async () => {
  env = await makeTestEnv()
})

beforeEach(async () => {
  await env.clearFirestore()
  await seedUser(env, SUPER, 'super_admin')
  // A super_admin has preassigned tech_admin to an invited person (no account yet).
  await seedDoc(env, `employees/${EMP_ID}`, {
    firstName: 'Inv', lastName: 'Itee', email: INV_EMAIL,
    status: 'active', preassignedRole: 'tech_admin',
  })
})

afterAll(async () => {
  await env.cleanup()
})

function claimDoc(role: string, employeeId: string, email: string) {
  return {
    email,
    displayName: 'Inv Itee',
    role,
    employeeId,
    status: 'active',
    updatedAt: serverTimestamp(),
  }
}

describe('/users preassigned-role self-claim', () => {
  it('ALLOWS claiming exactly the preassigned role for the matching employee', async () => {
    const db = authedWithEmail(INV_UID, INV_EMAIL)
    await assertSucceeds(setDoc(doc(db, `users/${INV_UID}`), claimDoc('tech_admin', EMP_ID, INV_EMAIL)))
  })

  it('REJECTS claiming a DIFFERENT (higher) role than preassigned', async () => {
    const db = authedWithEmail(INV_UID, INV_EMAIL)
    await assertFails(setDoc(doc(db, `users/${INV_UID}`), claimDoc('super_admin', EMP_ID, INV_EMAIL)))
  })

  it("REJECTS pointing at an employee whose email != caller's token", async () => {
    // Caller signs in with a different email than the employee record carries.
    const db = authedWithEmail(INV_UID, 'someone.else@ams.test')
    await assertFails(setDoc(doc(db, `users/${INV_UID}`), claimDoc('tech_admin', EMP_ID, 'someone.else@ams.test')))
  })

  it('REJECTS when the employee is terminated', async () => {
    await seedDoc(env, `employees/${EMP_ID}`, {
      firstName: 'Inv', lastName: 'Itee', email: INV_EMAIL,
      status: 'terminated', preassignedRole: 'tech_admin',
    })
    const db = authedWithEmail(INV_UID, INV_EMAIL)
    await assertFails(setDoc(doc(db, `users/${INV_UID}`), claimDoc('tech_admin', EMP_ID, INV_EMAIL)))
  })

  it('REJECTS when the employee has no preassignedRole', async () => {
    await seedDoc(env, `employees/${EMP_ID}`, {
      firstName: 'Inv', lastName: 'Itee', email: INV_EMAIL, status: 'active',
    })
    const db = authedWithEmail(INV_UID, INV_EMAIL)
    await assertFails(setDoc(doc(db, `users/${INV_UID}`), claimDoc('tech_admin', EMP_ID, INV_EMAIL)))
  })

  it('REJECTS writing to ANOTHER user\'s doc', async () => {
    const db = authedWithEmail(INV_UID, INV_EMAIL)
    await assertFails(setDoc(doc(db, 'users/otherUid'), claimDoc('tech_admin', EMP_ID, INV_EMAIL)))
  })

  it('REJECTS an UNVERIFIED email token (defense vs. password providers)', async () => {
    const db = authedWithEmail(INV_UID, INV_EMAIL, false)
    await assertFails(setDoc(doc(db, `users/${INV_UID}`), claimDoc('tech_admin', EMP_ID, INV_EMAIL)))
  })

  it('REJECTS re-claiming to override an EXISTING role (stale-preassign revert)', async () => {
    // Simulate: user already has a real role (e.g. was granted then later demoted;
    // preassignedRole still says tech_admin). The claim must NOT revert it.
    await seedDoc(env, `users/${INV_UID}`, {
      email: INV_EMAIL, displayName: 'Inv Itee', role: 'employee',
      employeeId: EMP_ID, status: 'active',
    })
    const db = authedWithEmail(INV_UID, INV_EMAIL)
    await assertFails(setDoc(doc(db, `users/${INV_UID}`), claimDoc('tech_admin', EMP_ID, INV_EMAIL)))
  })

  it('ALLOWS upgrading a prior NO-ROLE record to the preassigned role', async () => {
    await seedDoc(env, `users/${INV_UID}`, {
      email: INV_EMAIL, displayName: 'Inv Itee', status: 'no-role',
    })
    const db = authedWithEmail(INV_UID, INV_EMAIL)
    await assertSucceeds(setDoc(doc(db, `users/${INV_UID}`), claimDoc('tech_admin', EMP_ID, INV_EMAIL)))
  })
})

describe('/users offboarding revocation (archiveEmployee)', () => {
  const ASSET = 'asset1'
  const TECH = 'tech1'
  const TARGET = 'firedUid'

  beforeEach(async () => {
    await env.clearFirestore()
    await seedUser(env, SUPER, 'super_admin')
    await seedUser(env, ASSET, 'asset_admin')
    await seedUser(env, TECH, 'tech_admin')
  })

  it('ALLOWS an asset_admin to revoke a non-super account (drop role + terminate)', async () => {
    await seedUser(env, TARGET, 'employee')
    const db = authedDb(env, ASSET)
    await assertSucceeds(updateDoc(doc(db, `users/${TARGET}`), { role: deleteField(), status: 'terminated' }))
  })

  it('REJECTS revoking a super_admin account', async () => {
    await seedUser(env, TARGET, 'super_admin')
    const db = authedDb(env, ASSET)
    await assertFails(updateDoc(doc(db, `users/${TARGET}`), { role: deleteField(), status: 'terminated' }))
  })

  it('REJECTS a tech_admin using the revocation path', async () => {
    await seedUser(env, TARGET, 'employee')
    const db = authedDb(env, TECH)
    await assertFails(updateDoc(doc(db, `users/${TARGET}`), { role: deleteField(), status: 'terminated' }))
  })

  it('REJECTS granting a role via the revocation path (must be de-escalation only)', async () => {
    await seedUser(env, TARGET, 'employee')
    const db = authedDb(env, ASSET)
    // Keeps a role instead of removing it → revokesAccount() fails, and asset_admin
    // is not super, so the whole update is denied.
    await assertFails(updateDoc(doc(db, `users/${TARGET}`), { role: 'super_admin', status: 'terminated' }))
  })
})
