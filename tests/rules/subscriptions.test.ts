import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where } from 'firebase/firestore'
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

// ---------------------------------------------------------------------------
// /subscriptions — employee self-scope read (new rule: assignedEmployeeIds)
//
// Active (non-terminated) employee may GET a doc containing their uid or
// their linked employeeId in assignedEmployeeIds. Unconstrained list queries
// and list queries constrained to another employee's id remain denied.
// Terminated users lose the self-scope entirely.
// ---------------------------------------------------------------------------

// UIDs used for self-scope tests (kept distinct from the top-level constants
// so beforeEach re-seeding does not collide with these custom users).
const EMP_LINKED = 'empLinked'   // has users/{uid}.employeeId = 'emp_1'
const EMP_LEGACY = 'empLegacy'   // no employeeId field; employee doc id == uid
const EMP_TERM   = 'empTerm'     // terminated — must be denied even with matching id
const ASSET_ADM  = 'assetAdmSS'  // asset_admin — must be denied (self-scope read is super|tech+self only)

describe('/subscriptions self-scope read (employee assignedEmployeeIds)', () => {
  beforeEach(async () => {
    // Linked employee: users doc carries employeeId field pointing at 'emp_1'.
    await seedUser(env, EMP_LINKED, 'employee', { employeeId: 'emp_1' })
    // Legacy employee: no employeeId field — myEmployeeId() falls back to uid.
    await seedUser(env, EMP_LEGACY, 'employee')
    // Terminated employee: same employeeId 'emp_1' but status = 'terminated'.
    await seedUser(env, EMP_TERM, 'employee', { employeeId: 'emp_1', status: 'terminated' })
    // asset_admin — denied for self-scope (rule is super|tech + self only).
    await seedUser(env, ASSET_ADM, 'asset_admin')

    // Subscription assigned to emp_1 (covers EMP_LINKED's employeeId).
    await seedDoc(env, 'subscriptions/sub_emp1', {
      name: 'Figma', seatsTotal: 5, assignedEmployeeIds: ['emp_1'],
    })
    // Subscription assigned to EMP_LEGACY's uid directly.
    await seedDoc(env, 'subscriptions/sub_legacy', {
      name: 'Zoom', seatsTotal: 3, assignedEmployeeIds: [EMP_LEGACY],
    })
    // Subscription that does NOT contain either employee.
    await seedDoc(env, 'subscriptions/sub_other', {
      name: 'Slack', seatsTotal: 10, assignedEmployeeIds: ['emp_other'],
    })
  })

  // ---- GET: linked employee (employeeId field) --------------------------------

  it('linked employee GETs a subscription containing their employeeId → ALLOW', async () => {
    await assertSucceeds(
      getDoc(doc(authedDb(env, EMP_LINKED), 'subscriptions', 'sub_emp1')),
    )
  })

  it('linked employee GETs a subscription NOT containing them → DENY', async () => {
    await assertFails(
      getDoc(doc(authedDb(env, EMP_LINKED), 'subscriptions', 'sub_other')),
    )
  })

  // ---- GET: legacy employee (no employeeId, uid == employee doc id) ----------

  it('legacy employee GETs a subscription containing their uid → ALLOW', async () => {
    await assertSucceeds(
      getDoc(doc(authedDb(env, EMP_LEGACY), 'subscriptions', 'sub_legacy')),
    )
  })

  it('legacy employee GETs a subscription NOT containing their uid → DENY', async () => {
    await assertFails(
      getDoc(doc(authedDb(env, EMP_LEGACY), 'subscriptions', 'sub_other')),
    )
  })

  // ---- LIST: constrained query (array-contains) ------------------------------

  it('employee LIST query constrained to their own employeeId → ALLOW', async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(authedDb(env, EMP_LINKED), 'subscriptions'),
          where('assignedEmployeeIds', 'array-contains', 'emp_1'),
        ),
      ),
    )
  })

  it('employee LIST query constrained to ANOTHER employee id → DENY', async () => {
    await assertFails(
      getDocs(
        query(
          collection(authedDb(env, EMP_LINKED), 'subscriptions'),
          where('assignedEmployeeIds', 'array-contains', 'emp_other'),
        ),
      ),
    )
  })

  it('employee UNCONSTRAINED list (getDocs collection) → DENY', async () => {
    await assertFails(
      getDocs(collection(authedDb(env, EMP_LINKED), 'subscriptions')),
    )
  })

  // ---- Terminated employee ---------------------------------------------------

  it('terminated employee with matching employeeId GETs subscription → DENY', async () => {
    await assertFails(
      getDoc(doc(authedDb(env, EMP_TERM), 'subscriptions', 'sub_emp1')),
    )
  })

  // ---- asset_admin -----------------------------------------------------------

  it('asset_admin CANNOT read a subscription (not in super|tech+self-scope)', async () => {
    await assertFails(
      getDoc(doc(authedDb(env, ASSET_ADM), 'subscriptions', 'sub_emp1')),
    )
  })

  // ---- tech_admin + super_admin regression -----------------------------------

  it('tech_admin CAN still read any subscription (regression)', async () => {
    await assertSucceeds(
      getDoc(doc(authedDb(env, TECH), 'subscriptions', 'sub_other')),
    )
  })

  it('super_admin CAN still read any subscription (regression)', async () => {
    await assertSucceeds(
      getDoc(doc(authedDb(env, SUPER), 'subscriptions', 'sub_other')),
    )
  })

  // ---- Employee CANNOT write (unchanged write rules) -------------------------

  it('employee CANNOT create a subscription (write rules unchanged)', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, EMP_LINKED), 'subscriptions', 'sub_new'), {
        name: 'Unauthorized', seatsTotal: 1, assignedEmployeeIds: [],
      }),
    )
  })

  // ---- Regression: role lookup failure (missing users/{uid}) -------------------

  it('signed-in caller with NO users/{uid} doc cannot read a subscription they are listed in', async () => {
    // Seed a subscription containing this uid, but DO NOT seed the users/{uid} doc.
    const orphanUid = 'orphan_no_user_doc'
    await seedDoc(env, 'subscriptions/sub_orphan', {
      name: 'Orphan Sub', seatsTotal: 2, assignedEmployeeIds: [orphanUid],
    })
    // Attempting to read with an authenticated context but missing users doc → role() fails → deny.
    await assertFails(
      getDoc(doc(authedDb(env, orphanUid), 'subscriptions', 'sub_orphan')),
    )
  })

  // ---- Regression: missing field (assignedEmployeeIds absent) ------------------

  it('employee GET on a subscription doc lacking assignedEmployeeIds field is denied', async () => {
    // Seed a subscription WITHOUT assignedEmployeeIds field (field missing entirely).
    await seedDoc(env, 'subscriptions/sub_missing_field', {
      name: 'Malformed Sub', seatsTotal: 1,
      // assignedEmployeeIds intentionally omitted
    })
    // Employee GET on a doc missing the field → self-scope check fails → deny (fail-closed).
    await assertFails(
      getDoc(doc(authedDb(env, EMP_LINKED), 'subscriptions', 'sub_missing_field')),
    )
  })
})
