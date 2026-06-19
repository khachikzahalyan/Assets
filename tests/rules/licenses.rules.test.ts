import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { authedDb, unauthedDb, makeTestEnv, seedDoc, seedUser } from './helpers'

/**
 * Emulator-backed Firestore rules tests for /licenses and /server_licenses.
 * Require the Firestore emulator (run via `npm run test:rules`).
 * Excluded from the default `vitest run`.
 *
 * Key invariant: /licenses/{id}/secrets and /server_licenses/{id}/secrets are
 * DENIED to ALL client SDK callers — including super_admin. Raw license keys
 * are only accessible via the revealLicenseKey Cloud Function (Admin SDK).
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
// /licenses/{id}/secrets — ALL client callers denied (read + write)
// ---------------------------------------------------------------------------

describe('/licenses/{id}/secrets — deny-all', () => {
  beforeEach(async () => {
    // Seed the parent license and its secrets doc with admin privileges so
    // we can test reads without hitting the parent rule.
    await seedDoc(env, 'licenses/lic_secret', {
      name: 'Windows 11 Pro', assignmentType: 'device', lifecycleStatus: 'active',
    })
    await seedDoc(env, 'licenses/lic_secret/secrets/current', {
      key: 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX',
    })
  })

  it('super_admin CANNOT read the secrets sub-document', async () => {
    await assertFails(
      getDoc(doc(authedDb(env, SUPER), 'licenses', 'lic_secret', 'secrets', 'current')),
    )
  })

  it('tech_admin CANNOT read the secrets sub-document', async () => {
    await assertFails(
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

  it('super_admin CANNOT write to the secrets sub-document', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, SUPER), 'licenses', 'lic_secret', 'secrets', 'current'), {
        key: 'NEW-KEY',
      }),
    )
  })

  it('tech_admin CANNOT write to the secrets sub-document', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, TECH), 'licenses', 'lic_secret', 'secrets', 'current'), {
        key: 'NEW-KEY',
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
// /server_licenses/{id}/secrets — ALL client callers denied (read + write)
// ---------------------------------------------------------------------------

describe('/server_licenses/{id}/secrets — deny-all', () => {
  beforeEach(async () => {
    await seedDoc(env, 'server_licenses/srv_secret', {
      name: 'Windows Server 2022', lifecycleStatus: 'active',
    })
    await seedDoc(env, 'server_licenses/srv_secret/secrets/current', {
      key: 'YYYYY-YYYYY-YYYYY-YYYYY-YYYYY',
    })
  })

  it('super_admin CANNOT read the secrets sub-document', async () => {
    await assertFails(
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

  it('super_admin CANNOT write to the secrets sub-document', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, SUPER), 'server_licenses', 'srv_secret', 'secrets', 'current'), {
        key: 'NEW-KEY',
      }),
    )
  })

  it('tech_admin CANNOT write to the secrets sub-document', async () => {
    await assertFails(
      setDoc(doc(authedDb(env, TECH), 'server_licenses', 'srv_secret', 'secrets', 'current'), {
        key: 'NEW-KEY',
      }),
    )
  })
})
