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
