import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, getDocs, collection } from 'firebase/firestore'
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
        at: serverTimestamp(),
      }),
    )
  })

  it('denies create when actorUid does NOT match the caller (spoof attempt)', async () => {
    const db = authedDb(env, ASSET)
    await assertFails(
      setDoc(doc(db, 'audit_logs', 'spoof1'), {
        entityType: 'asset', entityId: 'a3', action: 'created',
        actorUid: 'someone-else', actorRole: 'asset_admin', at: serverTimestamp(),
      }),
    )
  })

  it('denies create when actorRole is escalated above the caller\'s real role', async () => {
    const db = authedDb(env, EMP) // EMP is an employee
    await assertFails(
      setDoc(doc(db, 'audit_logs', 'spoof2'), {
        entityType: 'asset', entityId: 'a4', action: 'created',
        actorUid: EMP, actorRole: 'super_admin', at: serverTimestamp(),
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

  it('denies create with an extra non-schema field (hasOnly)', async () => {
    const db = authedDb(env, ASSET)
    await assertFails(
      setDoc(doc(db, 'audit_logs', 'extra1'), {
        entityType: 'asset', entityId: 'a6', action: 'created',
        actorUid: ASSET, actorRole: 'asset_admin', at: serverTimestamp(),
        maliciousExtra: 'pwned',
      }),
    )
  })
  it('denies create with a client-backdated at (must equal request.time)', async () => {
    const db = authedDb(env, ASSET)
    await assertFails(
      setDoc(doc(db, 'audit_logs', 'backdate1'), {
        entityType: 'asset', entityId: 'a7', action: 'created',
        actorUid: ASSET, actorRole: 'asset_admin', at: new Date(2020, 0, 1),
      }),
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

  it('an admin CAN read any asset (including unassigned); unauthenticated CANNOT', async () => {
    // NOTE: this test was updated in Task 11 — the asset read rule was narrowed so an
    // employee can only read assets assigned to them. Using ASSET (asset_admin) as the
    // signed-in reader here, because EMP cannot read an asset with no assignment.
    await seedDoc(env, 'assets/r1', { name: 'A' })
    await assertSucceeds(getDoc(doc(authedDb(env, ASSET), 'assets', 'r1')))
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

  it('a signed-in user CAN self-claim a no-role record for their OWN uid', async () => {
    await env.clearFirestore()
    await assertSucceeds(
      setDoc(doc(authedDb(env, 'fresh1'), 'users', 'fresh1'), {
        email: 'fresh1@ams.test', displayName: 'Fresh', status: 'no-role',
      }),
    )
  })

  it('self-claim that includes a role key is DENIED (no self-escalation on create)', async () => {
    await env.clearFirestore()
    await assertFails(
      setDoc(doc(authedDb(env, 'fresh2'), 'users', 'fresh2'), {
        email: 'fresh2@ams.test', displayName: 'F2', status: 'no-role', role: 'super_admin',
      }),
    )
  })

  it('a user CANNOT self-claim a record for a DIFFERENT uid', async () => {
    await env.clearFirestore()
    await assertFails(
      setDoc(doc(authedDb(env, 'fresh3'), 'users', 'otherUid'), {
        email: 'x@ams.test', displayName: 'X', status: 'no-role',
      }),
    )
  })

  it('a no-role self-update that introduces a role is DENIED', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pend1'), {
        email: 'p@ams.test', displayName: 'P', status: 'no-role',
      })
    })
    await assertFails(
      updateDoc(doc(authedDb(env, 'pend1'), 'users', 'pend1'), { role: 'asset_admin', status: 'active' }),
    )
  })

  it('super_admin CAN promote a no-role user (set role + status active)', async () => {
    await seedUser(env, SUPER, 'super_admin')
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pend2'), {
        email: 'p2@ams.test', displayName: 'P2', status: 'no-role',
      })
    })
    await assertSucceeds(
      updateDoc(doc(authedDb(env, SUPER), 'users', 'pend2'), { role: 'asset_admin', status: 'active' }),
    )
  })

  it('super_admin CANNOT set an invalid/legacy role value (enum guard)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'pend3'), { email: 'p3@ams.test', displayName: 'P3', status: 'no-role' })
    })
    await assertFails(
      updateDoc(doc(authedDb(env, SUPER), 'users', 'pend3'), { role: 'admin', status: 'active' }),
    )
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

describe('/mail queue', () => {
  it('asset_admin can create a mail doc', async () => {
    const db = authedDb(env, ASSET)
    await assertSucceeds(setDoc(doc(db, 'mail', 'm1'), {
      to: ['e@x.com'], message: { subject: 's', text: 't', html: '<p>h</p>' },
    }))
  })
  it('super_admin can create a mail doc', async () => {
    const db = authedDb(env, SUPER)
    await assertSucceeds(setDoc(doc(db, 'mail', 'm2'), {
      to: ['e@x.com'], message: { subject: 's', text: 't', html: '<p>h</p>' },
    }))
  })
  it('tech_admin CANNOT create mail', async () => {
    const db = authedDb(env, TECH)
    await assertFails(setDoc(doc(db, 'mail', 'm3'), {
      to: ['e@x.com'], message: { subject: 's', text: 't', html: '<p>h</p>' },
    }))
  })
  it('employee CANNOT create mail', async () => {
    const db = authedDb(env, EMP)
    await assertFails(setDoc(doc(db, 'mail', 'm4'), {
      to: ['e@x.com'], message: { subject: 's', text: 't', html: '<p>h</p>' },
    }))
  })
  it('nobody can read mail', async () => {
    await seedDoc(env, 'mail/m5', { to: ['e@x.com'], message: { subject: 's', text: 't', html: '<p>h</p>' } })
    await assertFails(getDoc(doc(authedDb(env, SUPER), 'mail', 'm5')))
    await assertFails(getDoc(doc(authedDb(env, ASSET), 'mail', 'm5')))
  })
})

describe('/assignments writes (assign/return shape)', () => {
  it('asset_admin can create an assignment', async () => {
    const db = authedDb(env, ASSET)
    await assertSucceeds(setDoc(doc(db, 'assignments', 'as1'), {
      assetId: 'a1', mode: 'employee', assignedToEmployeeId: 'e1', assignedToBranchId: null,
      endedAt: null, actStoragePath: null, transferComment: null, createdBy: ASSET,
    }))
  })
  it('employee CANNOT create an assignment', async () => {
    const db = authedDb(env, EMP)
    await assertFails(setDoc(doc(db, 'assignments', 'as2'), {
      assetId: 'a1', mode: 'branch', assignedToBranchId: 'b1', endedAt: null,
    }))
  })
  it('update may change endedAt only; other fields rejected', async () => {
    await seedDoc(env, 'assignments/as3', {
      assetId: 'a1', mode: 'branch', assignedToBranchId: 'b1', endedAt: null, transferComment: null,
    })
    const db = authedDb(env, ASSET)
    await assertSucceeds(updateDoc(doc(db, 'assignments', 'as3'), { endedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(db, 'assignments', 'as3'), { assetId: 'a2' }))
  })
  it('assignment is never deletable', async () => {
    await seedDoc(env, 'assignments/as4', { assetId: 'a1', mode: 'branch', endedAt: null })
    await assertFails(deleteDoc(doc(authedDb(env, SUPER), 'assignments', 'as4')))
  })
})

describe('audit_logs employee read scoped by assignedToEmployeeId', () => {
  it('employee can read an assignment audit addressed to them', async () => {
    await seedDoc(env, 'audit_logs/ae1', {
      entityType: 'assignment', entityId: 'as1', action: 'assigned',
      actorUid: ASSET, actorRole: 'asset_admin', before: null,
      after: { assignedToEmployeeId: EMP }, at: new Date(),
    })
    await assertSucceeds(getDoc(doc(authedDb(env, EMP), 'audit_logs', 'ae1')))
  })
  it('employee CANNOT read an assignment audit addressed to someone else', async () => {
    await seedDoc(env, 'audit_logs/ae2', {
      entityType: 'assignment', entityId: 'as1', action: 'assigned',
      actorUid: ASSET, actorRole: 'asset_admin', before: null,
      after: { assignedToEmployeeId: 'other' }, at: new Date(),
    })
    await assertFails(getDoc(doc(authedDb(env, EMP), 'audit_logs', 'ae2')))
  })
})

// ---- Task 11 (extended): self-service read scope + /employees write rules ----

describe('/employees read + write scope', () => {
  it('super_admin can read any employee doc', async () => {
    await seedDoc(env, 'employees/uid_x', { firstName: 'A', lastName: 'B', email: 'x@x.com', status: 'active' })
    await assertSucceeds(getDoc(doc(authedDb(env, SUPER), 'employees', 'uid_x')))
  })

  it('asset_admin can read any employee doc', async () => {
    await seedDoc(env, 'employees/uid_x2', { firstName: 'A', lastName: 'B', email: 'x2@x.com', status: 'active' })
    await assertSucceeds(getDoc(doc(authedDb(env, ASSET), 'employees', 'uid_x2')))
  })

  it('tech_admin can read any employee doc', async () => {
    await seedDoc(env, 'employees/uid_x3', { firstName: 'A', lastName: 'B', email: 'x3@x.com', status: 'active' })
    await assertSucceeds(getDoc(doc(authedDb(env, TECH), 'employees', 'uid_x3')))
  })

  it('employee CAN read their OWN doc (employees/{EMP})', async () => {
    await seedDoc(env, 'employees/' + EMP, { firstName: 'Self', lastName: 'Emp', email: 's@x.com', status: 'active' })
    await assertSucceeds(getDoc(doc(authedDb(env, EMP), 'employees', EMP)))
  })

  it('employee CANNOT read another employee\'s doc', async () => {
    await seedDoc(env, 'employees/other_emp', { firstName: 'O', lastName: 'E', email: 'o@x.com', status: 'active' })
    await assertFails(getDoc(doc(authedDb(env, EMP), 'employees', 'other_emp')))
  })

  it('super_admin CAN create an employee with a non-empty email', async () => {
    await assertSucceeds(setDoc(doc(authedDb(env, SUPER), 'employees', 'uid_emp2'), {
      firstName: 'A', lastName: 'B', email: 'b@x.com', status: 'active',
      branchId: null, departmentId: null, position: null, terminatedAt: null,
    }))
  })

  it('asset_admin CAN create an employee with a non-empty email', async () => {
    await assertSucceeds(setDoc(doc(authedDb(env, ASSET), 'employees', 'uid_emp'), {
      firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', status: 'active',
      branchId: null, departmentId: null, position: null, terminatedAt: null,
    }))
  })

  it('create with missing email field FAILS', async () => {
    await assertFails(setDoc(doc(authedDb(env, ASSET), 'employees', 'uid_noemail'), {
      firstName: 'A', lastName: 'B', status: 'active',
    }))
  })

  it('create with empty email string FAILS', async () => {
    await assertFails(setDoc(doc(authedDb(env, ASSET), 'employees', 'uid_emptyemail'), {
      firstName: 'A', lastName: 'B', email: '', status: 'active',
    }))
  })

  it('asset_admin CAN update an employee with a non-empty email', async () => {
    await seedDoc(env, 'employees/uid_upd', { firstName: 'A', lastName: 'B', email: 'old@x.com', status: 'active' })
    await assertSucceeds(setDoc(doc(authedDb(env, ASSET), 'employees', 'uid_upd'), {
      firstName: 'A', lastName: 'B', email: 'new@x.com', status: 'active',
    }))
  })

  it('tech_admin CANNOT create an employee', async () => {
    await assertFails(setDoc(doc(authedDb(env, TECH), 'employees', 'uid_emp3'), {
      firstName: 'A', lastName: 'B', email: 'c@x.com', status: 'active',
    }))
  })

  it('employee CANNOT write an employee doc (not even own)', async () => {
    await assertFails(setDoc(doc(authedDb(env, EMP), 'employees', EMP), {
      firstName: 'X', lastName: 'Y', email: 'z@x.com', status: 'active',
    }))
  })

  it('delete FAILS for super_admin (soft-delete only via status field)', async () => {
    await seedDoc(env, 'employees/del_emp', { firstName: 'D', lastName: 'E', email: 'd@x.com', status: 'active' })
    await assertFails(deleteDoc(doc(authedDb(env, SUPER), 'employees', 'del_emp')))
  })

  it('delete FAILS for asset_admin', async () => {
    await seedDoc(env, 'employees/del_emp2', { firstName: 'D', lastName: 'E', email: 'd2@x.com', status: 'active' })
    await assertFails(deleteDoc(doc(authedDb(env, ASSET), 'employees', 'del_emp2')))
  })
})

describe('/assets read scope (employee self-service)', () => {
  it('admin (asset_admin) CAN read any asset regardless of assignment', async () => {
    await seedDoc(env, 'assets/asset_admin_read', { name: 'X', assignment: null })
    await assertSucceeds(getDoc(doc(authedDb(env, ASSET), 'assets', 'asset_admin_read')))
  })

  it('employee CAN read an asset with assignment.employeeId == their uid', async () => {
    await seedDoc(env, 'assets/asset_mine', {
      name: 'Laptop', assignment: { mode: 'employee', employeeId: EMP },
    })
    await assertSucceeds(getDoc(doc(authedDb(env, EMP), 'assets', 'asset_mine')))
  })

  it('employee CANNOT read an asset assigned to a different employee', async () => {
    await seedDoc(env, 'assets/asset_theirs', {
      name: 'Monitor', assignment: { mode: 'employee', employeeId: 'other_emp' },
    })
    await assertFails(getDoc(doc(authedDb(env, EMP), 'assets', 'asset_theirs')))
  })

  it('employee CANNOT read an asset with assignment == null (fail-closed; rule must not error)', async () => {
    await seedDoc(env, 'assets/asset_warehouse', { name: 'Keyboard', assignment: null })
    await assertFails(getDoc(doc(authedDb(env, EMP), 'assets', 'asset_warehouse')))
  })

  it('employee CANNOT read an asset assigned to a branch (assignedToEmployeeId absent)', async () => {
    await seedDoc(env, 'assets/asset_branch', {
      name: 'Printer', assignment: { mode: 'branch', branchId: 'br_1' },
    })
    // assignment != null but assignment.employeeId is absent (undefined) — rule evaluates
    // assignment.employeeId != null as false, short-circuits, denies. Must not throw.
    await assertFails(getDoc(doc(authedDb(env, EMP), 'assets', 'asset_branch')))
  })
})

describe('/assignments read scope (employee self-service)', () => {
  it('admin (super_admin) CAN read any assignment', async () => {
    await seedDoc(env, 'assignments/asc_super', {
      assetId: 'a1', mode: 'employee', assignedToEmployeeId: 'someone', endedAt: null,
    })
    await assertSucceeds(getDoc(doc(authedDb(env, SUPER), 'assignments', 'asc_super')))
  })

  it('employee CAN read an assignment where assignedToEmployeeId == their uid', async () => {
    await seedDoc(env, 'assignments/asc_mine', {
      assetId: 'a1', mode: 'employee', assignedToEmployeeId: EMP, endedAt: null,
    })
    await assertSucceeds(getDoc(doc(authedDb(env, EMP), 'assignments', 'asc_mine')))
  })

  it('employee CANNOT read an assignment addressed to a different employee', async () => {
    await seedDoc(env, 'assignments/asc_theirs', {
      assetId: 'a2', mode: 'employee', assignedToEmployeeId: 'other_emp', endedAt: null,
    })
    await assertFails(getDoc(doc(authedDb(env, EMP), 'assignments', 'asc_theirs')))
  })

  it('employee CANNOT read a branch-mode assignment (assignedToEmployeeId == null)', async () => {
    // null == uid is false — fail-closed, must not error.
    await seedDoc(env, 'assignments/asc_branch', {
      assetId: 'a3', mode: 'branch', assignedToBranchId: 'br_1', assignedToEmployeeId: null, endedAt: null,
    })
    await assertFails(getDoc(doc(authedDb(env, EMP), 'assignments', 'asc_branch')))
  })
})

describe('/employees list scope (security-review coverage gap)', () => {
  beforeEach(async () => {
    await seedDoc(env, 'employees/' + EMP, { firstName: 'Self', lastName: 'Emp', email: 's@x.com', status: 'active' })
    await seedDoc(env, 'employees/other', { firstName: 'O', lastName: 'E', email: 'o@x.com', status: 'active' })
  })

  it('employee CANNOT LIST the full /employees collection (only own doc is readable)', async () => {
    await assertFails(getDocs(collection(authedDb(env, EMP), 'employees')))
  })

  it('super_admin CAN LIST the full /employees collection', async () => {
    await assertSucceeds(getDocs(collection(authedDb(env, SUPER), 'employees')))
  })
})

describe('self-service loader collections (asset_statuses + categories)', () => {
  beforeEach(async () => {
    await seedDoc(env, 'asset_statuses/st1', { name: 'В наличии', color: 'green' })
    await seedDoc(env, 'categories/cat1', { name: 'Ноутбук', group: 'devices', lucideIcon: 'laptop' })
  })

  it('employee CAN LIST asset_statuses (self-service loader collection)', async () => {
    await assertSucceeds(getDocs(collection(authedDb(env, EMP), 'asset_statuses')))
  })

  it('employee CAN LIST categories (self-service loader collection)', async () => {
    await assertSucceeds(getDocs(collection(authedDb(env, EMP), 'categories')))
  })
})
