import {
  GoogleAuthProvider, signInWithPopup, sendSignInLinkToEmail,
  signInWithEmailLink, isSignInWithEmailLink, signOut as fbSignOut,
  onAuthStateChanged, type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { Role } from '@/config/roles'

const EMAIL_KEY = 'ams:emailForSignIn'
const ROLE_IDS_SET = new Set<Role>(['super_admin', 'asset_admin', 'tech_admin', 'employee'])

/** Server-trusted role lookup: reads users/{uid}.role. Returns null if no doc or invalid role. */
export async function fetchUserRole(uid: string): Promise<Role | null> {
  const snap = await getDoc(doc(db(), 'users', uid))
  if (!snap.exists()) return null
  const role = (snap.data() as { role?: string }).role
  return role && ROLE_IDS_SET.has(role as Role) ? (role as Role) : null
}

/** Admin sign-in. Domain enforcement happens server-side in the beforeCreate function;
 *  this is the client entry point. */
export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  await signInWithPopup(auth(), provider)
}

function actionCodeSettings() {
  return { url: window.location.origin + '/login', handleCodeInApp: true }
}

/** Employee passwordless: send the magic link, remember the email locally for completion. */
export async function sendEmployeeLink(email: string): Promise<void> {
  await sendSignInLinkToEmail(auth(), email, actionCodeSettings())
  window.localStorage.setItem(EMAIL_KEY, email)
}

/** On app load: if the current URL is an email sign-in link, complete it. Returns true if signed in.
 *  `promptMessage` is shown if the email is missing from localStorage; the caller (UI layer)
 *  supplies a t()-translated string so this lib stays i18n-free. */
export async function completeEmailLinkIfPresent(promptMessage?: string): Promise<boolean> {
  if (!isSignInWithEmailLink(auth(), window.location.href)) return false
  let email = window.localStorage.getItem(EMAIL_KEY)
  if (!email) email = window.prompt(promptMessage ?? '') ?? ''
  if (!email) return false
  await signInWithEmailLink(auth(), email, window.location.href)
  window.localStorage.removeItem(EMAIL_KEY)
  return true
}

export async function signOutUser(): Promise<void> {
  await fbSignOut(auth())
}

/** Subscribe to Firebase auth state changes. Returns the unsubscribe function. */
export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth(), callback)
}

export { claimPendingUser, type ClaimInput } from './claimPendingUser'
