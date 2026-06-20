// scripts/seed/adminApp.ts
// The ONLY module that imports firebase-admin. Resolves credentials + project.
//
// Credential resolution order (most specific first):
//   1. FIRESTORE_EMULATOR_HOST set  -> talk to the local emulator (no real creds)
//   2. GOOGLE_APPLICATION_CREDENTIALS -> a service-account JSON file (cert)
//   3. applicationDefault()          -> ADC (gcloud auth application-default login)
// Project id resolution: --project flag -> GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT ->
// .firebaserc default (the 'ams-REPLACE-ME' placeholder is ignored).
// NEVER hardcode a real project id or any credential.
import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { readFileSync } from 'node:fs'

export interface AdminCtx { db: Firestore; auth: Auth; projectId: string }

/** Resolve the project id from flag -> env -> .firebaserc default. */
export function resolveProjectId(flagProject?: string): string {
  if (flagProject) return flagProject
  const env = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT
  if (env) return env
  try {
    const rc = JSON.parse(readFileSync(new URL('../../.firebaserc', import.meta.url), 'utf8'))
    const def = rc?.projects?.default
    if (def && def !== 'ams-REPLACE-ME') return def
  } catch { /* ignore */ }
  throw new Error(
    'No project id. Pass --project <id>, set GOOGLE_CLOUD_PROJECT, or set .firebaserc default.')
}

export function initAdmin(flagProject?: string): AdminCtx {
  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST
  const projectId = usingEmulator
    ? (flagProject || process.env.GOOGLE_CLOUD_PROJECT || 'demo-ams')
    : resolveProjectId(flagProject)

  if (getApps().length === 0) {
    if (usingEmulator) {
      initializeApp({ projectId })
    } else {
      const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
      const credential = saPath
        ? cert(JSON.parse(readFileSync(saPath, 'utf8')))
        : applicationDefault()
      initializeApp({ credential, projectId })
    }
  }
  return { db: getFirestore(), auth: getAuth(), projectId }
}

export { Timestamp }
