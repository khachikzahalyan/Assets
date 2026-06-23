import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { authedDb, unauthedDb, makeTestEnv, seedDoc, seedUser } from './helpers'

/**
 * Emulator-backed Firestore rules tests for /licenses and /server_licenses.
 * Require the Firestore emulator (run via `npm run test:rules`).
 * Excluded from the default `vitest run`.
 *
 * Secrets posture (post Cloud-Functions removal):
 *   /licenses/{id}/secrets       — super_admin OR tech_admin may read+write.
 *   /server_licenses/{id}/secrets — super_admin ONLY may read+write.
 *   asset_admin, employee, and unauthenticated callers are denied in both cases.
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

// ---------------------------------------------------------------------------
// /licenses — write access
// ---------------------------------------------------------------------------

describe('/licenses write', () => {
  it('super_admin CAN write a license', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(env, SUPER), 'licenses', 'lic1'), {
        name: 'Windows 11 Pro', assignmentType: 'device', lifecycleStatus: 'active',
      }),
    )
  })

  it('tech_admin CAN write a license', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(env, TECH), 'licenses', 'lic2'), {
        name: 'Office 365', assignmentType: 'unassigned', lifecycleStatus: 'active',
      }),
    )
  })

  it('asset_admin CANNOT write a license', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, ASSET), 'licenses', 'lic3'), {
        name: 'AutoCAD', assignmentType: 'unassigned', lifecycleStatus: 'active',
      }),
    )
  })

  it('employee CANNOT write a license', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, EMP), 'licenses', 'lic4'), {
        name: 'Adobe CC', assignmentType: 'unassigned', lifecycleStatus: 'active',
      }),
    )
  })

  it('super_admin CANNOT write a license doc carrying a raw `key` field', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, SUPER), 'licenses', 'lic_key'), {
        name: 'Windows 11 Pro', assignmentType: 'device', lifecycleStatus: 'active',
        key: 'XCVF-7TR5-9HJK-5592',
      }),
    )
  })

  it('tech_admin CANNOT write a license doc carrying a raw `key` field', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, TECH), 'licenses', 'lic_key2'), {
        name: 'Office 365', assignmentType: 'unassigned', lifecycleStatus: 'active',
        key: 'AAAA-BBBB-CCCC-1234',
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// /licenses — read access
// ---------------------------------------------------------------------------

describe('/licenses read', () => {
  beforeEach(async () => {
    await seedDoc(env, 'licenses/lic_seed', {
      name: 'Windows 11 Pro', assignmentType: 'device', lifecycleStatus: 'active',
    })
  })

  it('super_admin CAN read a license', async () => {
    await assertSucceeds(getDoc(doc(authedDb(env, SUPER), 'licenses', 'lic_seed')))
  })

  it('asset_admin CAN read a license', async () => {
    await assertSucceeds(getDoc(doc(authedDb(env, ASSET), 'licenses', 'lic_seed')))
  })

  it('tech_admin CAN read a license', async () => {
    await assertSucceeds(getDoc(doc(authedDb(env, TECH), 'licenses', 'lic_seed')))
  })

  it('employee CANNOT read a license', async () => {
    await assertFails(getDoc(doc(authedDb(env, EMP), 'licenses', 'lic_seed')))
  })

  it('unauthenticated CANNOT read a license', async () => {
    await assertFails(getDoc(doc(unauthedDb(env), 'licenses', 'lic_seed')))
  })
})

// ---------------------------------------------------------------------------
// /licenses/{id}/secrets — super_admin + tech_admin allowed; others denied
// ---------------------------------------------------------------------------

describe('/licenses/{id}/secrets', () => {
  beforeEach(async () => {
    await seedDoc(env, 'licenses/lic_secret', {
      name: 'Windows 11 Pro', assignmentType: 'device', lifecycleStatus: 'active',
    })
    await seedDoc(env, 'licenses/lic_secret/secrets/current', {
      key: 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX',
    })
  })

  // ---- reads ----

  it('super_admin CAN read the secrets sub-document', async () => {
    await assertSucceeds(
      getDoc(doc(authedDb(env, SUPER), 'licenses', 'lic_secret', 'secrets', 'current')),
    )
  })

  it('tech_admin CAN read the secrets sub-document', async () => {
    await assertSucceeds(
      getDoc(doc(authedDb(env, TECH), 'licenses', 'lic_secret', 'secrets', 'current')),
    )
  })

  it('asset_admin CANNOT read the secrets sub-document', async () => {
    await assertFails(
      getDoc(doc(authedDb(env, ASSET), 'licenses', 'lic_secret', 'secrets', 'current')),
    )
  })

  it('employee CANNOT read the secrets sub-document', async () => {
    await assertFails(
      getDoc(doc(authedDb(env, EMP), 'licenses', 'lic_secret', 'secrets', 'current')),
    )
  })

  it('unauthenticated CANNOT read the secrets sub-document', async () => {
    await assertFails(
      getDoc(doc(unauthedDb(env), 'licenses', 'lic_secret', 'secrets', 'current')),
    )
  })

  // ---- writes ----

  it('super_admin CAN write to the secrets sub-document', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(env, SUPER), 'licenses', 'lic_secret', 'secrets', 'current'), {
        key: 'NEW-KEY-SUPER',
      }),
    )
  })

  it('tech_admin CAN write to the secrets sub-document', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(env, TECH), 'licenses', 'lic_secret', 'secrets', 'current'), {
        key: 'NEW-KEY-TECH',
      }),
    )
  })

  it('asset_admin CANNOT write to the secrets sub-document', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, ASSET), 'licenses', 'lic_secret', 'secrets', 'current'), {
        key: 'SHOULD-FAIL',
      }),
    )
  })

  it('employee CANNOT write to the secrets sub-document', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, EMP), 'licenses', 'lic_secret', 'secrets', 'current'), {
        key: 'SHOULD-FAIL',
      }),
    )
  })

  it('unauthenticated CANNOT write to the secrets sub-document', async () => {
    await assertFails(
      setDoc(doc(unauthedDb(env), 'licenses', 'lic_secret', 'secrets', 'current'), {
        key: 'SHOULD-FAIL',
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// /server_licenses — write access
// ---------------------------------------------------------------------------

describe('/server_licenses write', () => {
  it('super_admin CAN write a server license', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(env, SUPER), 'server_licenses', 'srv1'), {
        name: 'Windows Server 2022', lifecycleStatus: 'active',
      }),
    )
  })

  it('tech_admin CANNOT write a server license', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, TECH), 'server_licenses', 'srv2'), {
        name: 'SQL Server 2022', lifecycleStatus: 'active',
      }),
    )
  })

  it('asset_admin CANNOT write a server license', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, ASSET), 'server_licenses', 'srv3'), {
        name: 'SQL Server 2022', lifecycleStatus: 'active',
      }),
    )
  })

  it('super_admin CANNOT write a server license doc carrying a raw `key` field', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, SUPER), 'server_licenses', 'srv_key'), {
        name: 'Windows Server 2022', lifecycleStatus: 'active',
        key: 'XCVF-7TR5-9HJK-5592',
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// /server_licenses — read access
// ---------------------------------------------------------------------------

describe('/server_licenses read', () => {
  beforeEach(async () => {
    await seedDoc(env, 'server_licenses/srv_seed', {
      name: 'Windows Server 2022', lifecycleStatus: 'active',
    })
  })

  it('super_admin CAN read a server license', async () => {
    await assertSucceeds(getDoc(doc(authedDb(env, SUPER), 'server_licenses', 'srv_seed')))
  })

  it('asset_admin CAN read a server license', async () => {
    await assertSucceeds(getDoc(doc(authedDb(env, ASSET), 'server_licenses', 'srv_seed')))
  })

  it('tech_admin CAN read a server license', async () => {
    await assertSucceeds(getDoc(doc(authedDb(env, TECH), 'server_licenses', 'srv_seed')))
  })

  it('employee CANNOT read a server license', async () => {
    await assertFails(getDoc(doc(authedDb(env, EMP), 'server_licenses', 'srv_seed')))
  })
})

// ---------------------------------------------------------------------------
// /server_licenses/{id}/secrets — super_admin ONLY; all others denied
// ---------------------------------------------------------------------------

describe('/server_licenses/{id}/secrets', () => {
  beforeEach(async () => {
    await seedDoc(env, 'server_licenses/srv_secret', {
      name: 'Windows Server 2022', lifecycleStatus: 'active',
    })
    await seedDoc(env, 'server_licenses/srv_secret/secrets/current', {
      key: 'YYYYY-YYYYY-YYYYY-YYYYY-YYYYY',
    })
  })

  // ---- reads ----

  it('super_admin CAN read the secrets sub-document', async () => {
    await assertSucceeds(
      getDoc(doc(authedDb(env, SUPER), 'server_licenses', 'srv_secret', 'secrets', 'current')),
    )
  })

  it('tech_admin CANNOT read the secrets sub-document', async () => {
    await assertFails(
      getDoc(doc(authedDb(env, TECH), 'server_licenses', 'srv_secret', 'secrets', 'current')),
    )
  })

  it('asset_admin CANNOT read the secrets sub-document', async () => {
    await assertFails(
      getDoc(doc(authedDb(env, ASSET), 'server_licenses', 'srv_secret', 'secrets', 'current')),
    )
  })

  it('employee CANNOT read the secrets sub-document', async () => {
    await assertFails(
      getDoc(doc(authedDb(env, EMP), 'server_licenses', 'srv_secret', 'secrets', 'current')),
    )
  })

  it('unauthenticated CANNOT read the secrets sub-document', async () => {
    await assertFails(
      getDoc(doc(unauthedDb(env), 'server_licenses', 'srv_secret', 'secrets', 'current')),
    )
  })

  // ---- writes ----

  it('super_admin CAN write to the secrets sub-document', async () => {
    await assertSucceeds(
      setDoc(doc(authedDb(env, SUPER), 'server_licenses', 'srv_secret', 'secrets', 'current'), {
        key: 'NEW-SRV-KEY',
      }),
    )
  })

  it('tech_admin CANNOT write to the secrets sub-document', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, TECH), 'server_licenses', 'srv_secret', 'secrets', 'current'), {
        key: 'SHOULD-FAIL',
      }),
    )
  })

  it('asset_admin CANNOT write to the secrets sub-document', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, ASSET), 'server_licenses', 'srv_secret', 'secrets', 'current'), {
        key: 'SHOULD-FAIL',
      }),
    )
  })

  it('employee CANNOT write to the secrets sub-document', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, EMP), 'server_licenses', 'srv_secret', 'secrets', 'current'), {
        key: 'SHOULD-FAIL',
      }),
    )
  })

  it('unauthenticated CANNOT write to the secrets sub-document', async () => {
    await assertFails(
      setDoc(doc(unauthedDb(env), 'server_licenses', 'srv_secret', 'secrets', 'current'), {
        key: 'SHOULD-FAIL',
      }),
    )
  })
})
