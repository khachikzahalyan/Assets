import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { authedDb, unauthedDb, makeTestEnv, seedDoc, seedUser } from './helpers'

/**
 * Emulator-backed Firestore rules tests. Require the Firestore emulator
 * (run via `npm run test:rules`). Excluded from the default `vitest run`.
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

describe('audit_logs immutability (marquee invariant)', () => {
  beforeEach(async () => {
    await seedDoc(env, 'audit_logs/x', {
      entityType: 'asset',
      entityId: 'a1',
      action: 'created',
      actorUid: SUPER,
      actorRole: 'super_admin',
      before: null,
      after: { name: 'X' },
    })
  })

  const actors: Array<[string, string | null]> = [
    ['super_admin', SUPER],
    ['asset_admin', ASSET],
    ['tech_admin', TECH],
    ['employee', EMP],
    ['unauthenticated', null],
  ]

  for (const [label, uid] of actors) {
    it(`${label} CANNOT update audit_logs`, async () => {
      const db = uid ? authedDb(env, uid) : unauthedDb(env)
      await assertFails(updateDoc(doc(db, 'audit_logs', 'x'), { action: 'tampered' }))
    })

    it(`${label} CANNOT delete audit_logs`, async () => {
      const db = uid ? authedDb(env, uid) : unauthedDb(env)
      await assertFails(deleteDoc(doc(db, 'audit_logs', 'x')))
    })
  }

  it('a signed-in user with a matching actorUid/actorRole CAN create an audit_logs entry', async () => {
    const db = authedDb(env, ASSET)
    await assertSucceeds(
      setDoc(doc(db, 'audit_logs', 'new1'), {
        entityType: 'asset',
        entityId: 'a2',
        action: 'updated',
        actorUid: ASSET,
        actorRole: 'asset_admin',
        at: new Date(),
      }),
    )
  })

  it('denies create when actorUid does NOT match the caller (spoof attempt)', async () => {
    const db = authedDb(env, ASSET)
    await assertFails(
      setDoc(doc(db, 'audit_logs', 'spoof1'), {
        entityType: 'asset', entityId: 'a3', action: 'created',
        actorUid: 'someone-else', actorRole: 'asset_admin', at: new Date(),
      }),
    )
  })

  it('denies create when actorRole is escalated above the caller\'s real role', async () => {
    const db = authedDb(env, EMP) // EMP is an employee
    await assertFails(
      setDoc(doc(db, 'audit_logs', 'spoof2'), {
        entityType: 'asset', entityId: 'a4', action: 'created',
        actorUid: EMP, actorRole: 'super_admin', at: new Date(),
      }),
    )
  })

  it('denies create when required keys are missing (no at)', async () => {
    const db = authedDb(env, ASSET)
    await assertFails(
      setDoc(doc(db, 'audit_logs', 'missing1'), {
        entityType: 'asset', entityId: 'a5', action: 'created',
        actorUid: ASSET, actorRole: 'asset_admin',
      }),
    )
  })

  it('an unauthenticated user CANNOT create an audit_logs entry', async () => {
    const db = unauthedDb(env)
    await assertFails(
      setDoc(doc(db, 'audit_logs', 'new2'), { entityType: 'asset', action: 'updated' }),
    )
  })
})

describe('audit_logs employee-scoped read', () => {
  it('employee CAN read an assignment audit row whose after.assignedToEmployeeId matches their uid', async () => {
    await seedDoc(env, 'audit_logs/scoped1', {
      entityType: 'assignment',
      entityId: 'g1',
      action: 'created',
      actorUid: ASSET,
      actorRole: 'asset_admin',
      before: null,
      after: { assignedToEmployeeId: EMP },
    })
    await assertSucceeds(getDoc(doc(authedDb(env, EMP), 'audit_logs', 'scoped1')))
  })

  it('a DIFFERENT employee CANNOT read an assignment audit row scoped to another employee', async () => {
    await seedUser(env, 'emp2', 'employee')
    await seedDoc(env, 'audit_logs/scoped2', {
      entityType: 'assignment',
      entityId: 'g1',
      action: 'created',
      actorUid: ASSET,
      actorRole: 'asset_admin',
      before: null,
      after: { assignedToEmployeeId: EMP },
    })
    await assertFails(getDoc(doc(authedDb(env, 'emp2'), 'audit_logs', 'scoped2')))
  })

  it('an assignment audit row with after == null does not crash and is denied for a non-matching employee', async () => {
    await seedDoc(env, 'audit_logs/scoped3', {
      entityType: 'assignment',
      entityId: 'g1',
      action: 'ended',
      actorUid: ASSET,
      actorRole: 'asset_admin',
      before: { assignedToEmployeeId: EMP },
      after: null,
    })
    // Null-guard exercise: the deref must be short-circuited, not error out.
    await assertFails(getDoc(doc(authedDb(env, EMP), 'audit_logs', 'scoped3')))
  })
})

describe('role matrix', () => {
  it('tech_admin CANNOT write categories; super_admin CAN', async () => {
    await assertFails(setDoc(doc(authedDb(env, TECH), 'categories', 'c1'), { name: 'C' }))
    await assertSucceeds(setDoc(doc(authedDb(env, SUPER), 'categories', 'c2'), { name: 'C' }))
  })

  it('asset_admin CAN write assets; employee CANNOT; tech_admin CANNOT', async () => {
    await assertSucceeds(setDoc(doc(authedDb(env, ASSET), 'assets', 'a1'), { name: 'A' }))
    await assertFails(setDoc(doc(authedDb(env, EMP), 'assets', 'a2'), { name: 'A' }))
    // assets write = super | asset_admin only — tech_admin must FAIL
    await assertFails(setDoc(doc(authedDb(env, TECH), 'assets', 'a3'), { name: 'A' }))
  })

  it('super_admin CAN write asset_statuses; asset_admin CANNOT', async () => {
    await assertSucceeds(setDoc(doc(authedDb(env, SUPER), 'asset_statuses', 's1'), { name: 'S' }))
    await assertFails(setDoc(doc(authedDb(env, ASSET), 'asset_statuses', 's2'), { name: 'S' }))
  })

  it('any signed-in user CAN read assets; unauthenticated CANNOT', async () => {
    await seedDoc(env, 'assets/r1', { name: 'A' })
    await assertSucceeds(getDoc(doc(authedDb(env, EMP), 'assets', 'r1')))
    await assertFails(getDoc(doc(unauthedDb(env), 'assets', 'r1')))
  })

  it('super_admin CAN write departments; asset_admin CANNOT; tech_admin CANNOT', async () => {
    await assertSucceeds(setDoc(doc(authedDb(env, SUPER), 'departments', 'd1'), { name: 'D' }))
    await assertFails(setDoc(doc(authedDb(env, ASSET), 'departments', 'd2'), { name: 'D' }))
    await assertFails(setDoc(doc(authedDb(env, TECH), 'departments', 'd3'), { name: 'D' }))
  })

  it('any signed-in user CAN read departments; unauthenticated CANNOT', async () => {
    await seedDoc(env, 'departments/r1', { name: 'D' })
    await assertSucceeds(getDoc(doc(authedDb(env, EMP), 'departments', 'r1')))
    await assertFails(getDoc(doc(unauthedDb(env), 'departments', 'r1')))
  })
})

describe('users', () => {
  beforeEach(async () => {
    // EMP already has a users doc from the global seed (role employee, status active)
  })

  it('a user CANNOT change their own role', async () => {
    await assertFails(
      updateDoc(doc(authedDb(env, EMP), 'users', EMP), { role: 'super_admin' }),
    )
  })

  it('a user CAN change a non-role, non-status field on their own doc', async () => {
    await assertSucceeds(
      updateDoc(doc(authedDb(env, EMP), 'users', EMP), { preferredLocale: 'hy' }),
    )
  })

  it('a user CANNOT change their own status (self status-block); a benign field still succeeds', async () => {
    // EMP is seeded with role 'employee', status 'active'.
    await assertFails(
      updateDoc(doc(authedDb(env, EMP), 'users', EMP), { status: 'terminated' }),
    )
    await assertSucceeds(
      updateDoc(doc(authedDb(env, EMP), 'users', EMP), { preferredLocale: 'en' }),
    )
  })

  it('an employee CANNOT create a users doc (create is super-only)', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, EMP), 'users', 'newUid'), {
        email: 'newUid@ams.test',
        displayName: 'newUid',
        role: 'employee',
        status: 'active',
      }),
    )
  })

  it('an employee CANNOT delete a users doc (delete is super-only)', async () => {
    await assertFails(deleteDoc(doc(authedDb(env, EMP), 'users', ASSET)))
  })

  it('super_admin CAN set another user role', async () => {
    await assertSucceeds(
      updateDoc(doc(authedDb(env, SUPER), 'users', EMP), { role: 'asset_admin' }),
    )
  })

  it('a user CANNOT read another user doc; super_admin CAN read any', async () => {
    await assertFails(getDoc(doc(authedDb(env, EMP), 'users', ASSET)))
    await assertSucceeds(getDoc(doc(authedDb(env, SUPER), 'users', ASSET)))
  })

  it('a user CAN read their own doc', async () => {
    await assertSucceeds(getDoc(doc(authedDb(env, EMP), 'users', EMP)))
  })
})

describe('settings', () => {
  beforeEach(async () => {
    await seedDoc(env, 'settings/auth', { allowedEmailDomains: ['ams.test'] })
  })

  it('non-super CANNOT read settings; super CAN read', async () => {
    await assertFails(getDoc(doc(authedDb(env, ASSET), 'settings', 'auth')))
    await assertSucceeds(getDoc(doc(authedDb(env, SUPER), 'settings', 'auth')))
  })

  it('super CAN write settings; non-super CANNOT', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(env, SUPER), 'settings', 'auth'), { allowedEmailDomains: ['x.test'] }),
    )
    await assertFails(
      setDoc(doc(authedDb(env, EMP), 'settings', 'auth'), { allowedEmailDomains: ['x.test'] }),
    )
  })
})

describe('assignments', () => {
  it('asset_admin CAN create; employee CANNOT', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(env, ASSET), 'assignments', 'g1'), {
        assetId: 'a1',
        assignedToEmployeeId: EMP,
        endedAt: null,
        transferComment: null,
      }),
    )
    await assertFails(
      setDoc(doc(authedDb(env, EMP), 'assignments', 'g2'), { assetId: 'a1' }),
    )
  })

  it('update touching only endedAt/transferComment SUCCEEDS; other fields FAIL', async () => {
    await seedDoc(env, 'assignments/g3', {
      assetId: 'a1',
      assignedToEmployeeId: EMP,
      endedAt: null,
      transferComment: null,
    })
    await assertSucceeds(
      updateDoc(doc(authedDb(env, ASSET), 'assignments', 'g3'), {
        endedAt: 'now',
        transferComment: 'returned',
      }),
    )
    await assertFails(
      updateDoc(doc(authedDb(env, ASSET), 'assignments', 'g3'), { assetId: 'a2' }),
    )
  })

  it('delete by anyone FAILS', async () => {
    await seedDoc(env, 'assignments/g4', { assetId: 'a1', assignedToEmployeeId: EMP })
    await assertFails(deleteDoc(doc(authedDb(env, SUPER), 'assignments', 'g4')))
    await assertFails(deleteDoc(doc(authedDb(env, ASSET), 'assignments', 'g4')))
  })
})

describe('assets/{id}/upgrades sub-collection (append-only, tech/super only)', () => {
  beforeEach(async () => {
    await seedDoc(env, 'assets/asset_up', { invCode: '450/1', statusId: 'st_warehouse' })
  })

  it('tech_admin CAN create an upgrade event', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(env, TECH), 'assets', 'asset_up', 'upgrades', 'u1'),
        { component: 'RAM', before: '8', after: '16', changedBy: TECH, changedAt: new Date() }),
    )
  })
  it('super_admin CAN create an upgrade event', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(env, SUPER), 'assets', 'asset_up', 'upgrades', 'u2'),
        { component: 'SSD', before: null, after: '1TB', changedBy: SUPER, changedAt: new Date() }),
    )
  })
  it('asset_admin CANNOT create an upgrade event (tech attribute)', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, ASSET), 'assets', 'asset_up', 'upgrades', 'u3'),
        { component: 'CPU', before: 'i5', after: 'i7', changedBy: ASSET, changedAt: new Date() }),
    )
  })
  it('any signed-in user CAN read upgrade events', async () => {
    await seedDoc(env, 'assets/asset_up/upgrades/seed', { component: 'GPU', after: 'RTX', changedBy: TECH, changedAt: new Date() })
    await assertSucceeds(getDoc(doc(authedDb(env, EMP), 'assets', 'asset_up', 'upgrades', 'seed')))
  })
  it('nobody can update or delete an upgrade event (append-only)', async () => {
    await seedDoc(env, 'assets/asset_up/upgrades/locked', { component: 'RAM', after: '32', changedBy: TECH, changedAt: new Date() })
    await assertFails(updateDoc(doc(authedDb(env, SUPER), 'assets', 'asset_up', 'upgrades', 'locked'), { after: '64' }))
    await assertFails(deleteDoc(doc(authedDb(env, SUPER), 'assets', 'asset_up', 'upgrades', 'locked')))
  })
})
