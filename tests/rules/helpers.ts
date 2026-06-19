import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  type RulesTestContext,
} from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'

/**
 * Emulator-backed rules test harness.
 *
 * NOTE: these tests require the Firestore + Storage emulators (a JVM). They run
 * in CI and on the owner's machine via `npm run test:rules`, NOT in the default
 * `vitest run` (which is configured to exclude tests/rules/**). Importing this
 * file without a running emulator will fail at initializeTestEnvironment().
 */

const PROJECT_ID = 'ams-rules-test'
const ROOT = resolve(__dirname, '..', '..')

// Ports must match firebase.json -> emulators.
const FIRESTORE_HOST = '127.0.0.1'
const FIRESTORE_PORT = 8080
const STORAGE_HOST = '127.0.0.1'
const STORAGE_PORT = 9199

export async function makeTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(ROOT, 'firestore.rules'), 'utf8'),
      host: FIRESTORE_HOST,
      port: FIRESTORE_PORT,
    },
    storage: {
      rules: readFileSync(resolve(ROOT, 'storage.rules'), 'utf8'),
      host: STORAGE_HOST,
      port: STORAGE_PORT,
    },
  })
}

export type Role = 'super_admin' | 'asset_admin' | 'tech_admin' | 'employee'

/** Authenticated Firestore context for a given uid. */
export function authedDb(env: RulesTestEnvironment, uid: string) {
  return env.authenticatedContext(uid).firestore()
}

/** Unauthenticated Firestore context. */
export function unauthedDb(env: RulesTestEnvironment) {
  return env.unauthenticatedContext().firestore()
}

/** Authenticated Storage context for a given uid. */
export function authedStorage(env: RulesTestEnvironment, uid: string) {
  return env.authenticatedContext(uid).storage()
}

/** Unauthenticated Storage context. */
export function unauthedStorage(env: RulesTestEnvironment) {
  return env.unauthenticatedContext().storage()
}

/**
 * Seed a users/{uid} doc with a role, bypassing security rules. Tests rely on
 * the rules reading this doc via get() to resolve the caller's role.
 */
export async function seedUser(
  env: RulesTestEnvironment,
  uid: string,
  role: Role,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx: RulesTestContext) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', uid), {
      email: `${uid}@ams.test`,
      displayName: uid,
      role,
      status: 'active',
      ...extra,
    })
  })
}

/** Seed an arbitrary document bypassing security rules (for read/update/delete setup). */
export async function seedDoc(
  env: RulesTestEnvironment,
  path: string,
  data: Record<string, unknown>,
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx: RulesTestContext) => {
    const db = ctx.firestore()
    // path is "collection/id" or deeper "a/b/c/d"
    await setDoc(doc(db, path), data)
  })
}
