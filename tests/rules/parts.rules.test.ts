import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { authedDb, makeTestEnv, seedDoc, seedUser } from './helpers'

/**
 * Emulator-backed Firestore rules tests for /parts, /part_movements and the
 * /employees identity lock. Require the Firestore emulator (run via
 * `npm run test:rules`). Excluded from the default `vitest run`.
 *
 * These lock down three hardening invariants added after an end-to-end audit:
 *   1. /part_movements create rejects any key outside the whitelist — the exact
 *      regression that made GPU/model-SKU creation with stock fail in prod when
 *      the movement doc carried a stray `actorName`.
 *   2. /parts create+update reject negative onHand / broken (no negative stock).
 *   3. /employees update can never change firstName / lastName (identity lock),
 *      while email / position stay editable.
 */

const SUPER = 'super1'
const TECH = 'tech1'
const EMP = 'emp1'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await makeTestEnv()
})

beforeEach(async () => {
  await env.clearFirestore()
  await seedUser(env, SUPER, 'super_admin')
  await seedUser(env, TECH, 'tech_admin')
  await seedUser(env, EMP, 'employee')
  // Part category referenced by /parts create (rule does an exists() check).
  await seedDoc(env, 'part_categories/cat1', { name: 'RAM' })
})

afterAll(async () => {
  await env.cleanup()
})

// Whitelisted keys for a valid /part_movements create (mirrors firestore.rules).
function movementDoc(uid: string, role: string) {
  return {
    type: 'receive',
    skuId: 'sku1',
    qty: 3,
    broken: false,
    assetId: null,
    assetInvCode: null,
    serviceReplace: false,
    note: null,
    reason: 'Поставка',
    actorUid: uid,
    actorRole: role,
    at: serverTimestamp(),
  }
}

describe('/part_movements create — whitelist (bug #1 regression guard)', () => {
  it('allows a movement with only whitelisted keys', async () => {
    const db = authedDb(env, TECH)
    await assertSucceeds(setDoc(doc(db, 'part_movements/m_ok'), movementDoc(TECH, 'tech_admin')))
  })

  it('REJECTS a movement carrying a stray actorName (the GPU-add prod failure)', async () => {
    const db = authedDb(env, TECH)
    await assertFails(
      setDoc(doc(db, 'part_movements/m_bad'), {
        ...movementDoc(TECH, 'tech_admin'),
        actorName: 'Tech Admin',
      }),
    )
  })

  it('rejects an employee (non-admin) writing a movement', async () => {
    const db = authedDb(env, EMP)
    await assertFails(setDoc(doc(db, 'part_movements/m_emp'), movementDoc(EMP, 'employee')))
  })

  it('is append-only: update and delete are denied', async () => {
    await seedDoc(env, 'part_movements/m_seed', {
      type: 'receive', skuId: 'sku1', qty: 1, broken: false, assetId: null,
      assetInvCode: null, serviceReplace: false, note: null, reason: 'x',
      actorUid: TECH, actorRole: 'tech_admin', at: serverTimestamp(),
    })
    const db = authedDb(env, SUPER)
    await assertFails(updateDoc(doc(db, 'part_movements/m_seed'), { qty: 99 }))
  })
})

describe('/parts create+update — non-negative stock', () => {
  function partDoc(uid: string, onHand: number, broken = 0) {
    return {
      name: 'Kingston 8GB',
      category: 'cat1',
      unit: 'pcs',
      onHand,
      broken,
      lowStockThreshold: 5,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: uid,
      updatedBy: uid,
    }
  }

  it('allows create with onHand >= 0', async () => {
    const db = authedDb(env, TECH)
    await assertSucceeds(setDoc(doc(db, 'parts/p_ok'), partDoc(TECH, 4)))
  })

  it('REJECTS create with negative onHand', async () => {
    const db = authedDb(env, TECH)
    await assertFails(setDoc(doc(db, 'parts/p_neg'), partDoc(TECH, -1)))
  })

  it('REJECTS create with negative broken', async () => {
    const db = authedDb(env, TECH)
    await assertFails(setDoc(doc(db, 'parts/p_negb'), partDoc(TECH, 2, -1)))
  })

  it('REJECTS an update that drives onHand negative', async () => {
    await seedDoc(env, 'parts/p_u', {
      name: 'Kingston 8GB', category: 'cat1', unit: 'pcs', onHand: 1, broken: 0,
      lowStockThreshold: 5, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      createdBy: TECH, updatedBy: TECH,
    })
    const db = authedDb(env, TECH)
    await assertFails(updateDoc(doc(db, 'parts/p_u'), { onHand: -3, updatedBy: TECH }))
  })
})

describe('/employees update — identity lock', () => {
  beforeEach(async () => {
    await seedDoc(env, 'employees/e1', {
      firstName: 'Poxos',
      lastName: 'Poxosyan',
      email: 'poxos@ams.test',
      position: 'Ops',
      departmentId: null,
      status: 'active',
    })
  })

  it('allows editing email / position', async () => {
    const db = authedDb(env, SUPER)
    await assertSucceeds(
      updateDoc(doc(db, 'employees/e1'), { email: 'poxos.new@ams.test', position: 'Lead' }),
    )
  })

  it('REJECTS changing firstName', async () => {
    const db = authedDb(env, SUPER)
    await assertFails(updateDoc(doc(db, 'employees/e1'), { firstName: 'Petros' }))
  })

  it('REJECTS changing lastName', async () => {
    const db = authedDb(env, SUPER)
    await assertFails(updateDoc(doc(db, 'employees/e1'), { lastName: 'Petrosyan' }))
  })
})
