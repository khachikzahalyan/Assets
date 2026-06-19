/**
 * Firebase lazy accessors for AMS.
 *
 * All config values are read from Vite env vars (VITE_FIREBASE_*).
 * Never inline real credentials here — populate via .env.local (dev)
 * or Vercel project environment variables (production).
 *
 * DESIGN: service exports are zero-argument accessor functions rather than
 * eagerly-evaluated singletons. This means importing the module never calls
 * initializeApp or any service getter, so the import succeeds even when
 * VITE_FIREBASE_* env vars are absent (CI without .env.local, Vitest without
 * a full mock). The app is still initialised at most once thanks to the
 * getApps().length guard — the guard just runs on first accessor call instead
 * of at module load time.
 *
 * Call site usage (identical to before, just add parentheses):
 *   import { auth, db } from '@/lib/firebase'
 *   signInWithEmailLink(auth(), email, link)
 *   collection(db(), 'assets')
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'
import { getFunctions, type Functions } from 'firebase/functions'

const firebaseConfig = {
  apiKey:            import.meta.env['VITE_FIREBASE_API_KEY'],
  authDomain:        import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'],
  projectId:         import.meta.env['VITE_FIREBASE_PROJECT_ID'],
  storageBucket:     import.meta.env['VITE_FIREBASE_STORAGE_BUCKET'],
  messagingSenderId: import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID'],
  appId:             import.meta.env['VITE_FIREBASE_APP_ID'],
}

/**
 * Returns the Firebase app singleton, initialising it on first call.
 * Safe to call multiple times — guarded by getApps().length.
 */
function getFirebaseApp(): FirebaseApp {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
}

/** Lazy accessor — returns the Auth service singleton. */
export const app       = (): FirebaseApp      => getFirebaseApp()
export const auth      = (): Auth             => getAuth(getFirebaseApp())
export const db        = (): Firestore        => getFirestore(getFirebaseApp())
export const storage   = (): FirebaseStorage  => getStorage(getFirebaseApp())
export const functions = (): Functions        => getFunctions(getFirebaseApp())
