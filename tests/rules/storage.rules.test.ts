import { afterAll, beforeAll, describe, it } from 'vitest'
import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { ref, uploadString, getDownloadURL } from 'firebase/storage'
import { authedStorage, unauthedStorage, makeTestEnv } from './helpers'

/**
 * Emulator-backed Storage rules tests. The baseline is deny-by-default: every
 * read and write fails for everyone, authenticated or not. Granular acts/* rules
 * ship with the assignment feature in a later plan.
 */

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await makeTestEnv()
})

afterAll(async () => {
  await env.cleanup()
})

describe('storage deny-by-default baseline', () => {
  it('authenticated user CANNOT write any path', async () => {
    const s = authedStorage(env, 'user1')
    await assertFails(uploadString(ref(s, 'acts/a1/file.pdf'), 'data', 'raw'))
  })

  it('authenticated user CANNOT read any path', async () => {
    const s = authedStorage(env, 'user1')
    await assertFails(getDownloadURL(ref(s, 'acts/a1/file.pdf')))
  })

  it('unauthenticated user CANNOT write any path', async () => {
    const s = unauthedStorage(env)
    await assertFails(uploadString(ref(s, 'acts/a1/file.pdf'), 'data', 'raw'))
  })

  it('unauthenticated user CANNOT read any path', async () => {
    const s = unauthedStorage(env)
    await assertFails(getDownloadURL(ref(s, 'acts/a1/file.pdf')))
  })

  it('authenticated user CANNOT write an arbitrary root path', async () => {
    const s = authedStorage(env, 'user1')
    await assertFails(uploadString(ref(s, 'anything/else.txt'), 'data', 'raw'))
  })
})
