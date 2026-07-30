import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { authedStorage, unauthedStorage, makeTestEnv, seedUser, seedDoc } from './helpers'

const SUPER = 'super1', ASSET = 'asset1', TECH = 'tech1', EMP = 'emp1', OTHER = 'other1'
let env: RulesTestEnvironment

beforeAll(async () => { env = await makeTestEnv() })
afterAll(async () => { await env.cleanup() })
beforeEach(async () => {
  await env.clearFirestore()
  await seedUser(env, SUPER, 'super_admin')
  await seedUser(env, ASSET, 'asset_admin')
  await seedUser(env, TECH, 'tech_admin')
  await seedUser(env, EMP, 'employee')
  await seedUser(env, OTHER, 'employee')
})

const PDF = new Uint8Array([1, 2, 3])
function up(s: ReturnType<typeof authedStorage>, path: string, type = 'application/pdf') {
  return uploadBytes(ref(s, path), PDF, { contentType: type })
}

describe('acts/* write', () => {
  it('asset_admin can upload a pdf', async () => {
    await assertSucceeds(up(authedStorage(env, ASSET), 'acts/a1/scan.pdf'))
  })
  it('super_admin can upload a png', async () => {
    await assertSucceeds(up(authedStorage(env, SUPER), 'acts/a1/scan.png', 'image/png'))
  })
  it('tech_admin CANNOT upload', async () => {
    await assertFails(up(authedStorage(env, TECH), 'acts/a1/scan.pdf'))
  })
  it('employee CANNOT upload', async () => {
    await assertFails(up(authedStorage(env, EMP), 'acts/a1/scan.pdf'))
  })
  it('rejects a disallowed content type', async () => {
    await assertFails(up(authedStorage(env, ASSET), 'acts/a1/scan.txt', 'text/plain'))
  })
  it('rejects an upload larger than 10 MB even for asset_admin', async () => {
    const BIG = new Uint8Array(10 * 1024 * 1024 + 1)
    await assertFails(
      uploadBytes(ref(authedStorage(env, ASSET), 'acts/a1/big.pdf'), BIG, { contentType: 'application/pdf' })
    )
  })
})

describe('acts/* read', () => {
  beforeEach(async () => {
    await seedDoc(env, 'assets/a1', { invCode: '450/1', statusId: 'st_assigned', assignment: { mode: 'employee', employeeId: EMP } })
    await up(authedStorage(env, ASSET), 'acts/a1/scan.pdf')
  })
  it('admin can read', async () => {
    await assertSucceeds(getDownloadURL(ref(authedStorage(env, SUPER), 'acts/a1/scan.pdf')))
  })
  it('the assigned employee can read', async () => {
    await assertSucceeds(getDownloadURL(ref(authedStorage(env, EMP), 'acts/a1/scan.pdf')))
  })
  it('a different employee CANNOT read', async () => {
    await assertFails(getDownloadURL(ref(authedStorage(env, OTHER), 'acts/a1/scan.pdf')))
  })
  it('unauthenticated CANNOT read', async () => {
    await assertFails(getDownloadURL(ref(unauthedStorage(env), 'acts/a1/scan.pdf')))
  })
})

// The LINKED case: an invited/linked employee's HR doc id differs from their uid;
// the asset stores assignment.employeeId = <HR doc id>, and users/{uid}.employeeId
// points at it. Reading acts by uid ALONE (the old rule) broke this — the fix
// resolves the caller's employeeId via their users doc.
describe('acts/* read — linked employee (uid != employeeId)', () => {
  const LINKED_UID = 'linkedUid1'
  const HR_ID = 'emp_hr_9'
  beforeEach(async () => {
    await seedUser(env, LINKED_UID, 'employee', { employeeId: HR_ID })
    await seedDoc(env, 'assets/a2', { invCode: '450/2', statusId: 'st_assigned', assignment: { mode: 'employee', employeeId: HR_ID } })
    await up(authedStorage(env, ASSET), 'acts/a2/scan.pdf')
  })
  it('the linked employee CAN read their own act scan', async () => {
    await assertSucceeds(getDownloadURL(ref(authedStorage(env, LINKED_UID), 'acts/a2/scan.pdf')))
  })
  it('an unrelated employee still CANNOT read', async () => {
    await assertFails(getDownloadURL(ref(authedStorage(env, OTHER), 'acts/a2/scan.pdf')))
  })
})
