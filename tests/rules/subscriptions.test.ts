import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { authedDb, unauthedDb, makeTestEnv, seedDoc, seedUser } from './helpers'

/**
 * Emulator-backed Firestore rules tests for /subscriptions.
 * Require the Firestore emulator (run via `npm run test:rules`).
 * Excluded from the default `vitest run`.
 *
 * Access matrix:
 *   Read:           super_admin, tech_admin — YES. asset_admin, employee — NO.
 *   Create/Update:  super_admin, tech_admin — YES (assignedEmployeeIds must be list).
 *                   asset_admin, employee — NO.
 *   Delete:         ALL denied (including super_admin).
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
  // Re-seed user role docs after each clear so role() lookups in rules succeed.
  await seedUser(env, SUPER, 'super_admin')
  await seedUser(env, ASSET, 'asset_admin')
  await seedUser(env, TECH, 'tech_admin')
  await seedUser(env, EMP, 'employee')
})

afterAll(async () => {
  await env.cleanup()
})

// ---------------------------------------------------------------------------
// /subscriptions — write (create) access
// ---------------------------------------------------------------------------

describe('/subscriptions create', () => {
  it('super_admin CAN create a subscription', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(env, SUPER), 'subscriptions', 'sub1'), {
        name: 'Microsoft 365', seatsTotal: 10, assignedEmployeeIds: [],
      }),
    )
  })

  it('tech_admin CAN create a subscription', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(env, TECH), 'subscriptions', 'sub2'), {
        name: 'Slack Pro', seatsTotal: 5, assignedEmployeeIds: [],
      }),
    )
  })

  it('asset_admin CANNOT create a subscription', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, ASSET), 'subscriptions', 'sub3'), {
        name: 'Figma', seatsTotal: 3, assignedEmployeeIds: [],
      }),
    )
  })

  it('employee CANNOT create a subscription', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, EMP), 'subscriptions', 'sub4'), {
        name: 'Zoom', seatsTotal: 2, assignedEmployeeIds: [],
      }),
    )
  })

  it('unauthenticated CANNOT create a subscription', async () => {
    await assertFails(
      setDoc(doc(unauthedDb(env), 'subscriptions', 'sub5'), {
        name: 'Adobe CC', seatsTotal: 1, assignedEmployeeIds: [],
      }),
    )
  })

  it('super_admin CANNOT create a subscription when assignedEmployeeIds is not a list', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, SUPER), 'subscriptions', 'sub6'), {
        name: 'Broken Shape', seatsTotal: 1, assignedEmployeeIds: 'not-a-list',
      }),
    )
  })

  it('tech_admin CANNOT create a subscription when assignedEmployeeIds is absent', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, TECH), 'subscriptions', 'sub7'), {
        name: 'Missing Field', seatsTotal: 1,
        // assignedEmployeeIds intentionally omitted
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// /subscriptions — write (update) access
// ---------------------------------------------------------------------------

describe('/subscriptions update', () => {
  beforeEach(async () => {
    await seedDoc(env, 'subscriptions/sub_seed', {
      name: 'Microsoft 365', seatsTotal: 10, assignedEmployeeIds: [],
    })
  })

  it('super_admin CAN update a subscription', async () => {
    await assertSucceeds(
      updateDoc(doc(authedDb(env, SUPER), 'subscriptions', 'sub_seed'), {
        assignedEmployeeIds: ['emp_a'],
      }),
    )
  })

  it('tech_admin CAN update a subscription', async () => {
    await assertSucceeds(
      updateDoc(doc(authedDb(env, TECH), 'subscriptions', 'sub_seed'), {
        assignedEmployeeIds: ['emp_b'],
      }),
    )
  })

  it('asset_admin CANNOT update a subscription', async () => {
    await assertFails(
      updateDoc(doc(authedDb(env, ASSET), 'subscriptions', 'sub_seed'), {
        assignedEmployeeIds: ['emp_c'],
      }),
    )
  })

  it('employee CANNOT update a subscription', async () => {
    await assertFails(
      updateDoc(doc(authedDb(env, EMP), 'subscriptions', 'sub_seed'), {
        assignedEmployeeIds: ['emp_d'],
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// /subscriptions — read access
// ---------------------------------------------------------------------------

describe('/subscriptions read', () => {
  beforeEach(async () => {
    await seedDoc(env, 'subscriptions/sub_readable', {
      name: 'Slack Pro', seatsTotal: 5, assignedEmployeeIds: [],
    })
  })

  it('super_admin CAN read a subscription', async () => {
    await assertSucceeds(getDoc(doc(authedDb(env, SUPER), 'subscriptions', 'sub_readable')))
  })

  it('asset_admin CANNOT read a subscription', async () => {
    await assertFails(getDoc(doc(authedDb(env, ASSET), 'subscriptions', 'sub_readable')))
  })

  it('tech_admin CAN read a subscription', async () => {
    await assertSucceeds(getDoc(doc(authedDb(env, TECH), 'subscriptions', 'sub_readable')))
  })

  it('employee CANNOT read a subscription', async () => {
    await assertFails(getDoc(doc(authedDb(env, EMP), 'subscriptions', 'sub_readable')))
  })

  it('unauthenticated CANNOT read a subscription', async () => {
    await assertFails(getDoc(doc(unauthedDb(env), 'subscriptions', 'sub_readable')))
  })
})

// ---------------------------------------------------------------------------
// /subscriptions — delete (denied for ALL)
// ---------------------------------------------------------------------------

describe('/subscriptions delete', () => {
  beforeEach(async () => {
    await seedDoc(env, 'subscriptions/sub_deletable', {
      name: 'Delete Me', seatsTotal: 1, assignedEmployeeIds: [],
    })
  })

  it('super_admin CANNOT delete a subscription', async () => {
    await assertFails(
      deleteDoc(doc(authedDb(env, SUPER), 'subscriptions', 'sub_deletable')),
    )
  })

  it('tech_admin CANNOT delete a subscription', async () => {
    await assertFails(
      deleteDoc(doc(authedDb(env, TECH), 'subscriptions', 'sub_deletable')),
    )
  })

  it('asset_admin CANNOT delete a subscription', async () => {
    await assertFails(
      deleteDoc(doc(authedDb(env, ASSET), 'subscriptions', 'sub_deletable')),
    )
  })

  it('employee CANNOT delete a subscription', async () => {
    await assertFails(
      deleteDoc(doc(authedDb(env, EMP), 'subscriptions', 'sub_deletable')),
    )
  })
})
