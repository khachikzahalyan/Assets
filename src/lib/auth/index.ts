import {
  GoogleAuthProvider, signInWithPopup, sendSignInLinkToEmail,
  signInWithEmailLink, isSignInWithEmailLink, signOut as fbSignOut,
  onAuthStateChanged, type User,
} from 'firebase/auth'
import {
  doc, getDoc, setDoc, serverTimestamp,
  collection, query as fsQuery, where, limit, getDocs,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { Role } from '@/config/roles'

const EMAIL_KEY = 'ams:emailForSignIn'
const ROLE_IDS_SET = new Set<Role>(['super_admin', 'asset_admin', 'tech_admin', 'employee'])

/** Server-trusted role lookup: reads users/{uid}.role. Returns null if no doc or invalid role. */
export async function fetchUserRole(uid: string): Promise<Role | null> {
  return (await fetchUserProfile(uid)).role
}

export interface UserProfile {
  role: Role | null
  /** Link to the employees/{id} HR record — set by server auto-provisioning
   *  when the account was invited via /employees, OR self-healed at sign-in
   *  when a matching HR record exists. May be non-null for admin accounts that
   *  personally hold assets (admin added as employee with same email). Null
   *  for accounts with no matching employees doc (legacy uid-path fallback). */
  employeeId: string | null
}

/** Server-trusted profile lookup — role + employeeId in ONE users/{uid} read. */
export async function fetchUserProfile(uid: string): Promise<UserProfile> {
  const snap = await getDoc(doc(db(), 'users', uid))
  if (!snap.exists()) return { role: null, employeeId: null }
  const data = snap.data() as { role?: string; employeeId?: string }
  const role = typeof data.role === 'string' && ROLE_IDS_SET.has(data.role as Role) ? (data.role as Role) : null
  const employeeId = typeof data.employeeId === 'string' && data.employeeId !== '' ? data.employeeId : null
  return { role, employeeId }
}

/**
 * Client-side self-heal for the account↔employee link. The beforeCreate trigger
 * sets users/{uid}.employeeId at sign-in, but until Cloud Functions are deployed
 * an employee added on /employees BEFORE first sign-in has no link — so their
 * HR record id differs from their uid and "My assets" (which the rules scope by
 * users/{uid}.employeeId) comes up empty.
 *
 * When the account has no employeeId, this finds the employees doc whose email
 * matches the signed-in user and writes users/{uid}.employeeId (merge, adds no
 * role/status — allowed by the self-update rule). Returns the resolved id, or
 * null if no matching active employee record exists.
 *
 * Best-effort: any failure is swallowed and returns null — self-service just
 * degrades to the uid path.
 */
export async function linkEmployeeByEmail(uid: string, email: string | null): Promise<string | null> {
  const trimmed = (email ?? '').trim()
  if (!trimmed) return null
  try {
    const lower = trimmed.toLowerCase()
    // Two queries (original-case + lowercase fallback). The rules allow a
    // non-admin to read only the employees doc whose email (case-insensitively)
    // equals their token email — so one of the two queries may be permission-
    // denied for a mixed-case mailbox. Use allSettled so a single rejected
    // query does NOT sink the whole link: keep whatever fulfilled results match.
    const settled = await Promise.allSettled([
      getDocs(fsQuery(collection(db(), 'employees'), where('email', '==', trimmed), limit(1))),
      ...(lower !== trimmed
        ? [getDocs(fsQuery(collection(db(), 'employees'), where('email', '==', lower), limit(1)))]
        : []),
    ])
    const match = settled
      .flatMap(r => (r.status === 'fulfilled' ? r.value.docs : []))
      .find(d => (d.data() as { status?: string }).status !== 'terminated')
    if (!match) return null
    // Persist the link so the server-side rules (myEmployeeId) permit the
    // employee to read their assigned assets/assignments/acts.
    await setDoc(doc(db(), 'users', uid), { employeeId: match.id, updatedAt: serverTimestamp() }, { merge: true })
    return match.id
  } catch {
    return null
  }
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
export { claimPreassignedRole, type PreassignedClaim } from './claimPreassignedRole'
export { mapGoogleSignInError, type GoogleSignInErrorKind } from './mapGoogleSignInError'
