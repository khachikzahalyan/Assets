import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore'
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

describe('/users self-service employeeId linking', () => {
  const CALLER = 'linkUid'
  const CALLER_EMAIL = 'linkUid@ams.test'
  // An employees record whose email matches the caller's own token.
  const OWN_EMP = 'emp_own'
  // A foreign employees record the attacker tries to smuggle in.
  const FOREIGN_EMP = 'emp_foreign'
  const FOREIGN_EMAIL = 'victim@ams.test'

  beforeEach(async () => {
    await env.clearFirestore()
    await seedUser(env, SUPER, 'super_admin')
    // The caller is an ordinary employee-role account.
    await seedUser(env, CALLER, 'employee', { email: CALLER_EMAIL })
    // Own record — email equals the caller's token email.
    await seedDoc(env, `employees/${OWN_EMP}`, {
      firstName: 'Link', lastName: 'Self', email: CALLER_EMAIL, status: 'active',
    })
    // Foreign record — belongs to someone else.
    await seedDoc(env, `employees/${FOREIGN_EMP}`, {
      firstName: 'Vic', lastName: 'Tim', email: FOREIGN_EMAIL, status: 'active',
    })
  })

  it('DENIES linking a foreign employees doc (email != caller token) — the attack', async () => {
    const db = authedWithEmail(CALLER, CALLER_EMAIL)
    await assertFails(updateDoc(doc(db, `users/${CALLER}`),
      { employeeId: FOREIGN_EMP, updatedAt: serverTimestamp() }))
  })

  it('ALLOWS linking an employees doc whose email equals the caller token', async () => {
    const db = authedWithEmail(CALLER, CALLER_EMAIL)
    await assertSucceeds(updateDoc(doc(db, `users/${CALLER}`),
      { employeeId: OWN_EMP, updatedAt: serverTimestamp() }))
  })

  it('ALLOWS case-insensitive email match', async () => {
    await seedDoc(env, 'employees/emp_case', {
      firstName: 'Case', lastName: 'Test', email: 'Case.Test@ams.test', status: 'active',
    })
    const db = authedWithEmail(CALLER, 'case.test@ams.test')
    await assertSucceeds(updateDoc(doc(db, `users/${CALLER}`),
      { employeeId: 'emp_case', updatedAt: serverTimestamp() }))
  })

  it('ALLOWS unlink (employeeId: null)', async () => {
    await seedUser(env, CALLER, 'employee', { email: CALLER_EMAIL, employeeId: OWN_EMP })
    const db = authedWithEmail(CALLER, CALLER_EMAIL)
    await assertSucceeds(updateDoc(doc(db, `users/${CALLER}`),
      { employeeId: null, updatedAt: serverTimestamp() }))
  })

  it('DENIES linking a terminated employees doc even when the email matches', async () => {
    await seedDoc(env, `employees/${OWN_EMP}`, {
      firstName: 'Link', lastName: 'Self', email: CALLER_EMAIL, status: 'terminated',
    })
    const db = authedWithEmail(CALLER, CALLER_EMAIL)
    await assertFails(updateDoc(doc(db, `users/${CALLER}`),
      { employeeId: OWN_EMP, updatedAt: serverTimestamp() }))
  })

  it('DENIES linking with an UNVERIFIED token email even when the email matches', async () => {
    const db = authedWithEmail(CALLER, CALLER_EMAIL, false)
    await assertFails(updateDoc(doc(db, `users/${CALLER}`),
      { employeeId: OWN_EMP, updatedAt: serverTimestamp() }))
  })

  it('DENIES CREATE of a no-role doc smuggling a foreign employeeId (second vector)', async () => {
    const FRESH = 'freshUid'
    const db = authedWithEmail(FRESH, `${FRESH}@ams.test`)
    await assertFails(setDoc(doc(db, `users/${FRESH}`), {
      email: `${FRESH}@ams.test`, displayName: 'Fresh',
      status: 'no-role', createdAt: serverTimestamp(), employeeId: FOREIGN_EMP,
    }))
  })

  it('ALLOWS CREATE of a plain no-role doc WITHOUT employeeId (claimPendingUser regression)', async () => {
    const FRESH = 'freshUid2'
    const db = authedWithEmail(FRESH, `${FRESH}@ams.test`)
    await assertSucceeds(setDoc(doc(db, `users/${FRESH}`), {
      email: `${FRESH}@ams.test`, displayName: 'Fresh',
      status: 'no-role', createdAt: serverTimestamp(),
    }))
  })

  it('DENIES a regular user changing their own role or status (regression)', async () => {
    const db = authedWithEmail(CALLER, CALLER_EMAIL)
    await assertFails(updateDoc(doc(db, `users/${CALLER}`), { role: 'super_admin' }))
    await assertFails(updateDoc(doc(db, `users/${CALLER}`), { status: 'terminated' }))
  })

  it('ALLOWS a self-update NOT touching employeeId (untouched-key regression)', async () => {
    const db = authedWithEmail(CALLER, CALLER_EMAIL)
    await assertSucceeds(updateDoc(doc(db, `users/${CALLER}`), { displayName: 'New Name' }))
  })

  it('ALLOWS a non-admin to getDoc the employees doc whose email differs only by case (Change 2)', async () => {
    await seedDoc(env, 'employees/emp_case_read', {
      firstName: 'Case', lastName: 'Read', email: 'Case.Read@ams.test', status: 'active',
    })
    const db = authedWithEmail(CALLER, 'case.read@ams.test')
    await assertSucceeds(getDoc(doc(db, 'employees/emp_case_read')))
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

  it('REJECTS a revocation that ALSO plants a foreign employeeId (linkage bypass)', async () => {
    await seedUser(env, TARGET, 'employee')
    // A foreign HR record the attacker tries to smuggle onto the victim in the
    // same revocation write, bypassing selfEmployeeIdOk().
    await seedDoc(env, 'employees/emp_foreign', {
      firstName: 'Vic', lastName: 'Tim', email: 'victim@ams.test', status: 'active',
    })
    const db = authedDb(env, ASSET)
    // revokesAccount() must reject any write touching employeeId; asset_admin is not
    // super, so the whole update is denied.
    await assertFails(updateDoc(doc(db, `users/${TARGET}`),
      { role: deleteField(), status: 'terminated', employeeId: 'emp_foreign' }))
  })
})

describe('/users isSelfEmployee terminated-account gate', () => {
  const EMPLOYEE_UID = 'termUid'
  const EMP_LINK = 'emp_x'

  beforeEach(async () => {
    await env.clearFirestore()
    // Linked HR record for the caller.
    await seedDoc(env, `employees/${EMP_LINK}`, {
      firstName: 'Term', lastName: 'Inated', email: `${EMPLOYEE_UID}@ams.test`, status: 'active',
    })
    // An asset assigned to the caller's employeeId — self-scoped read target.
    await seedDoc(env, 'assets/a1', {
      name: 'Laptop', assignment: { mode: 'employee', employeeId: EMP_LINK },
    })
  })

  it('DENIES a TERMINATED account the self-scoped asset read', async () => {
    await seedUser(env, EMPLOYEE_UID, 'employee', { status: 'terminated', employeeId: EMP_LINK })
    const db = authedDb(env, EMPLOYEE_UID)
    await assertFails(getDoc(doc(db, 'assets/a1')))
  })

  it('ALLOWS the SAME read once the account is flipped back to active (gate keys on status)', async () => {
    await seedUser(env, EMPLOYEE_UID, 'employee', { status: 'active', employeeId: EMP_LINK })
    const db = authedDb(env, EMPLOYEE_UID)
    await assertSucceeds(getDoc(doc(db, 'assets/a1')))
  })

  it('ALLOWS an active linked employee to read their OWN employees doc via isSelfEmployee', async () => {
    await seedUser(env, EMPLOYEE_UID, 'employee', { status: 'active', employeeId: EMP_LINK })
    const db = authedDb(env, EMPLOYEE_UID)
    await assertSucceeds(getDoc(doc(db, `employees/${EMP_LINK}`)))
  })
})
