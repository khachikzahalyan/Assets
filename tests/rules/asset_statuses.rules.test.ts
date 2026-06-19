import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection } from 'firebase/firestore'
import { authedDb, unauthedDb, makeTestEnv, seedDoc, seedUser } from './helpers'

/**
 * Emulator-backed Firestore rules tests for /asset_statuses system-protection
 * guards. Require the Firestore emulator (run via `npm run test:rules`).
 * Excluded from the default `vitest run`.
 *
 * Invariant mirrored at the DB layer (matches the repository's system-protection):
 *   - the 4 canonical statuses (isSystem:true) cannot be deleted,
 *   - cannot have isSystem/isFinal mutated,
 *   - no client (even super_admin) can mint a NEW isSystem:true status.
 * Display fields (name/color/sortOrder) on system docs stay editable.
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
  // re-seed user role docs after each clear
  await seedUser(env, SUPER, 'super_admin')
  await seedUser(env, ASSET, 'asset_admin')
  await seedUser(env, TECH, 'tech_admin')
  await seedUser(env, EMP, 'employee')
})

afterAll(async () => {
  await env.cleanup()
})

describe('asset_statuses create', () => {
  it('super_admin CAN create a non-system status (isSystem:false)', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(env, SUPER), 'asset_statuses', 'st_new'), {
        name: 'Reserved', color: 'blue', isFinal: false, isSystem: false, sortOrder: 5,
      }),
    )
  })

  it('super_admin CAN create a status that omits isSystem (treated as non-system)', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(env, SUPER), 'asset_statuses', 'st_omit'), {
        name: 'Reserved', color: 'blue', isFinal: false, sortOrder: 6,
      }),
    )
  })

  it('super_admin CANNOT create an isSystem:true status (cannot mint system statuses)', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, SUPER), 'asset_statuses', 'st_sys_mint'), {
        name: 'Warehouse', color: 'gray', isFinal: false, isSystem: true, sortOrder: 0,
      }),
    )
  })

  it('asset_admin CANNOT create a status', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, ASSET), 'asset_statuses', 'st_aa'), {
        name: 'X', color: 'gray', isFinal: false, isSystem: false, sortOrder: 9,
      }),
    )
  })

  it('tech_admin CANNOT create a status', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, TECH), 'asset_statuses', 'st_ta'), {
        name: 'X', color: 'gray', isFinal: false, isSystem: false, sortOrder: 9,
      }),
    )
  })

  it('employee CANNOT create a status', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, EMP), 'asset_statuses', 'st_emp'), {
        name: 'X', color: 'gray', isFinal: false, isSystem: false, sortOrder: 9,
      }),
    )
  })
})

describe('asset_statuses read', () => {
  beforeEach(async () => {
    await seedDoc(env, 'asset_statuses/st_warehouse', {
      name: 'Warehouse', color: 'gray', isFinal: false, isSystem: true, sortOrder: 0,
    })
  })

  it('super_admin CAN read', async () => {
    await assertSucceeds(getDoc(doc(authedDb(env, SUPER), 'asset_statuses', 'st_warehouse')))
  })

  it('employee (any signed-in) CAN read', async () => {
    await assertSucceeds(getDoc(doc(authedDb(env, EMP), 'asset_statuses', 'st_warehouse')))
  })

  it('any signed-in user CAN list', async () => {
    await assertSucceeds(getDocs(collection(authedDb(env, EMP), 'asset_statuses')))
  })

  it('unauthenticated CANNOT read', async () => {
    await assertFails(getDoc(doc(unauthedDb(env), 'asset_statuses', 'st_warehouse')))
  })
})

describe('asset_statuses delete', () => {
  beforeEach(async () => {
    await seedDoc(env, 'asset_statuses/st_warehouse', {
      name: 'Warehouse', color: 'gray', isFinal: false, isSystem: true, sortOrder: 0,
    })
    await seedDoc(env, 'asset_statuses/st_custom_lost', {
      name: 'Lost', color: 'amber', isFinal: true, isSystem: false, sortOrder: 4,
    })
  })

  it('super_admin CANNOT delete a system (isSystem:true) status', async () => {
    await assertFails(deleteDoc(doc(authedDb(env, SUPER), 'asset_statuses', 'st_warehouse')))
  })

  it('super_admin CAN delete a non-system (isSystem:false) status', async () => {
    await assertSucceeds(deleteDoc(doc(authedDb(env, SUPER), 'asset_statuses', 'st_custom_lost')))
  })

  it('asset_admin CANNOT delete a non-system status', async () => {
    await assertFails(deleteDoc(doc(authedDb(env, ASSET), 'asset_statuses', 'st_custom_lost')))
  })

  it('employee CANNOT delete a non-system status', async () => {
    await assertFails(deleteDoc(doc(authedDb(env, EMP), 'asset_statuses', 'st_custom_lost')))
  })
})

describe('asset_statuses update (system-doc field freeze)', () => {
  beforeEach(async () => {
    // System fixture: isFinal:false. Used for most update assertions.
    await seedDoc(env, 'asset_statuses/st_warehouse', {
      name: 'Warehouse', color: 'gray', isFinal: false, isSystem: true, sortOrder: 0,
    })
    // System fixture with isFinal:true, to test flipping true->false.
    await seedDoc(env, 'asset_statuses/st_written_off', {
      name: 'Written Off', color: 'red', isFinal: true, isSystem: true, sortOrder: 3,
    })
    // Non-system fixture.
    await seedDoc(env, 'asset_statuses/st_custom_lost', {
      name: 'Lost', color: 'amber', isFinal: true, isSystem: false, sortOrder: 4,
    })
  })

  it('super_admin CAN update a system doc display fields (name/color/sortOrder) keeping isSystem+isFinal', async () => {
    // Partial updateDoc merges with existing; request.resource.data still has
    // isSystem:true and the unchanged isFinal, so the rule passes.
    await assertSucceeds(
      updateDoc(doc(authedDb(env, SUPER), 'asset_statuses', 'st_warehouse'), {
        name: 'Stock', color: 'slate', sortOrder: 1,
      }),
    )
  })

  it('super_admin CANNOT flip a system doc isFinal false->true', async () => {
    await assertFails(
      updateDoc(doc(authedDb(env, SUPER), 'asset_statuses', 'st_warehouse'), { isFinal: true }),
    )
  })

  it('super_admin CANNOT flip a system doc isFinal true->false', async () => {
    await assertFails(
      updateDoc(doc(authedDb(env, SUPER), 'asset_statuses', 'st_written_off'), { isFinal: false }),
    )
  })

  it('super_admin CANNOT flip a system doc isSystem->false (demotion blocked)', async () => {
    await assertFails(
      updateDoc(doc(authedDb(env, SUPER), 'asset_statuses', 'st_warehouse'), { isSystem: false }),
    )
  })

  it('super_admin CANNOT promote a non-system status to isSystem:true (promotion blocked)', async () => {
    // Seed a non-system doc to target. The update attempts to set isSystem:true,
    // which the rule blocks via the immutability clamp regardless of the actor's role.
    await seedDoc(env, 'asset_statuses/st_promotable', {
      name: 'Repair', color: 'orange', isFinal: false, isSystem: false, sortOrder: 5,
    })
    await assertFails(
      updateDoc(doc(authedDb(env, SUPER), 'asset_statuses', 'st_promotable'), { isSystem: true }),
    )
  })

  it('super_admin CAN update a non-system doc freely (incl. isFinal)', async () => {
    await assertSucceeds(
      updateDoc(doc(authedDb(env, SUPER), 'asset_statuses', 'st_custom_lost'), {
        name: 'Misplaced', isFinal: false,
      }),
    )
  })

  it('asset_admin CANNOT update a status', async () => {
    await assertFails(
      updateDoc(doc(authedDb(env, ASSET), 'asset_statuses', 'st_custom_lost'), { name: 'X' }),
    )
  })

  it('tech_admin CANNOT update a status', async () => {
    await assertFails(
      updateDoc(doc(authedDb(env, TECH), 'asset_statuses', 'st_custom_lost'), { name: 'X' }),
    )
  })

  it('employee CANNOT update a status', async () => {
    await assertFails(
      updateDoc(doc(authedDb(env, EMP), 'asset_statuses', 'st_custom_lost'), { name: 'X' }),
    )
  })
})
