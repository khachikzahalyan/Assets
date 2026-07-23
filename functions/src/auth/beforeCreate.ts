import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore'
import { beforeUserCreated, HttpsError } from 'firebase-functions/v2/identity'
import { logger } from 'firebase-functions/v2'

/**
 * AMS — beforeCreate auth blocking trigger.
 *
 * Gate order (fail-closed throughout — if /settings/auth is unreadable, ALL
 * sign-ups are rejected):
 *
 *  1. /settings/auth unreadable / missing → DENY (fail closed).
 *  2. email ∈ seedSuperAdmins → ALLOW (exact, case-insensitive + trimmed).
 *  3. email already registered in the system → ALLOW. Two sub-checks run in
 *     parallel (fail-closed on read error):
 *       a. /users where email == X (approved admin accounts)
 *       b. /employees where email == X (employees invited by an admin)
 *     Both queries are issued in two variants — trimmed-as-is and
 *     lowercase-trimmed — to handle emails stored without normalisation.
 *  4. domain ∈ allowedEmailDomains → ALLOW (optional corporate-domain path).
 *  5. Otherwise → DENY.
 *
 * There is NO hardcoded email or domain anywhere in this file.
 */

// Initialize the Admin SDK exactly once.
if (getApps().length === 0) {
  initializeApp()
}

// ─── pure helpers ─────────────────────────────────────────────────────────────

/**
 * Pure, unit-testable domain check. Returns true iff `email` has a domain that
 * appears (case-insensitive) in `domains`. Fails closed: a missing/empty email
 * or an empty domains list yields false.
 */
export function isDomainAllowed(email: string | undefined, domains: string[]): boolean {
  if (!email || domains.length === 0) return false
  const at = email.lastIndexOf('@')
  if (at < 0 || at === email.length - 1) return false
  const domain = email.slice(at + 1).toLowerCase()
  return domains.some((d) => d.toLowerCase() === domain)
}

/**
 * Pure, unit-testable seed-admin check. Returns true iff `email` exactly
 * matches (case-insensitive, whitespace-trimmed) any entry in `seedEmails`.
 * A missing/empty email or empty list always yields false.
 */
export function isSeedAdmin(email: string | undefined, seedEmails: string[]): boolean {
  if (!email || seedEmails.length === 0) return false
  const normalized = email.trim().toLowerCase()
  return seedEmails.some((e) => e.trim().toLowerCase() === normalized)
}

/** Shape of the /settings/auth settings doc fields we care about here. */
export interface GateSettings {
  allowedEmailDomains: string[]
  seedSuperAdmins: string[]
}

/**
 * Result of the pre-decision lookup — whether the email was found in the
 * /users or /employees collections. Produced by I/O; consumed by the pure
 * decision function.
 */
export interface SystemLookup {
  inUsers: boolean
  inEmployees: boolean
}

/**
 * Pure decision function — no I/O, no side-effects, fully unit-testable.
 *
 * Returns `{ allow: true }` when the email passes any gate, or
 * `{ allow: false; reason: string }` when all gates reject.
 *
 * Gate order:
 *   1. Seed bypass (exact, case-insensitive).
 *   2. Already registered in /users or /employees.
 *   3. Domain allow-list (optional corporate path).
 *   4. Deny.
 */
export function decideSignIn(
  email: string | undefined,
  settings: GateSettings,
  lookup: SystemLookup = { inUsers: false, inEmployees: false },
): { allow: true } | { allow: false; reason: string } {
  if (isSeedAdmin(email, settings.seedSuperAdmins)) {
    return { allow: true }
  }
  if (lookup.inUsers || lookup.inEmployees) {
    return { allow: true }
  }
  if (isDomainAllowed(email, settings.allowedEmailDomains)) {
    return { allow: true }
  }
  return { allow: false, reason: 'Email not registered in the system' }
}

// ─── I/O helpers ──────────────────────────────────────────────────────────────

/**
 * Returns true if `email` exists in `collectionPath` (case-insensitive,
 * trimmed). Issues up to two Firestore queries in parallel when the trimmed
 * and the lowercase-trimmed variants differ, so emails stored in either
 * casing are found reliably.
 *
 * Throws on Firestore read error — callers must treat that as fail-closed.
 */
async function emailExistsInCollection(
  db: Firestore,
  collectionPath: string,
  email: string,
): Promise<boolean> {
  const trimmed = email.trim()
  const lower = trimmed.toLowerCase()

  const queries: Array<Promise<FirebaseFirestore.QuerySnapshot>> = [
    db.collection(collectionPath).where('email', '==', trimmed).limit(5).get(),
  ]
  // Only add the second query if the lowercase variant differs from as-typed
  if (lower !== trimmed) {
    queries.push(
      db.collection(collectionPath).where('email', '==', lower).limit(5).get(),
    )
  }

  const results = await Promise.all(queries)
  return results.some((snap) => !snap.empty)
}

/**
 * Returns the doc id of the first ACTIVE employee matching `email`, or null.
 * (status field missing = legacy = treated as active; status === 'terminated'
 * = denied individually.)
 *
 * This prevents terminated employees from bypassing the beforeCreate gate via
 * the employees lookup while still allowing active employees through. The id
 * is used to auto-provision the employee's user account (see the trigger).
 *
 * Throws on Firestore read error — callers must treat that as fail-closed.
 */
async function findActiveEmployeeIdByEmail(
  db: Firestore,
  email: string,
): Promise<string | null> {
  const trimmed = email.trim()
  const lower = trimmed.toLowerCase()

  const queries: Array<Promise<FirebaseFirestore.QuerySnapshot>> = [
    db.collection('employees').where('email', '==', trimmed).limit(5).get(),
  ]
  if (lower !== trimmed) {
    queries.push(
      db.collection('employees').where('email', '==', lower).limit(5).get(),
    )
  }

  const results = await Promise.all(queries)
  for (const snap of results) {
    for (const docSnap of snap.docs) {
      const data = docSnap.data() as Record<string, unknown>
      // Missing/undefined status = legacy doc = treat as active (backward compat)
      if (data['status'] !== 'terminated') return docSnap.id
    }
  }
  return null
}

/**
 * Which gate allowed the sign-up. 'employee' additionally carries the matched
 * employees/{id} — the trigger uses it to auto-provision the account with the
 * default 'employee' role (owner rule: someone added on /employees signs in
 * as a plain employee with no manual pending-queue step).
 */
export interface AllowResult {
  path: 'seed' | 'registered' | 'employee' | 'domain'
  employeeId: string | null
}

/**
 * Reads gate settings from /settings/auth and queries /users + /employees to
 * decide whether `email` is allowed. Throws HttpsError on any failure.
 * Delegated to a standalone function so it can be tested with mocked Firestore.
 */
export async function assertEmailAllowed(
  email: string | undefined,
  db: Firestore,
): Promise<AllowResult> {
  const snap = await db.doc('settings/auth').get()

  // Fail closed: if the doc doesn't exist we cannot know what is allowed.
  if (!snap.exists) {
    logger.warn(
      'beforeCreate: /settings/auth document does not exist — rejecting all sign-ups (fail closed).',
    )
    throw new HttpsError('permission-denied', 'Email not registered in the system')
  }

  const data = snap.data()

  const rawDomains = data?.allowedEmailDomains
  const domains: string[] = Array.isArray(rawDomains)
    ? rawDomains.filter((d): d is string => typeof d === 'string')
    : []

  const rawSeed = data?.seedSuperAdmins
  const seedEmails: string[] = Array.isArray(rawSeed)
    ? rawSeed.filter((e): e is string => typeof e === 'string')
    : []

  // Shortcut: seed bypass requires no collection lookup.
  if (isSeedAdmin(email, seedEmails)) {
    return { path: 'seed', employeeId: null }
  }

  // Perform system-registration lookup (fail-closed on error).
  let lookup: SystemLookup = { inUsers: false, inEmployees: false }
  let employeeId: string | null = null
  if (email) {
    try {
      const [inUsers, foundEmployeeId] = await Promise.all([
        emailExistsInCollection(db, 'users', email),
        // employees leg: only active employees pass — terminated employees are denied
        findActiveEmployeeIdByEmail(db, email),
      ])
      lookup = { inUsers, inEmployees: foundEmployeeId !== null }
      employeeId = foundEmployeeId
    } catch (err) {
      logger.error('beforeCreate: failed to query /users or /employees — rejecting (fail closed).', err)
      throw new HttpsError('permission-denied', 'Email not registered in the system')
    }
  }

  const decision = decideSignIn(email, { allowedEmailDomains: domains, seedSuperAdmins: seedEmails }, lookup)
  if (!decision.allow) {
    throw new HttpsError('permission-denied', decision.reason)
  }

  // Path priority mirrors decideSignIn's gate order: an email that is BOTH in
  // /users and /employees is 'registered' (existing account — do not touch).
  if (lookup.inUsers) return { path: 'registered', employeeId: null }
  if (employeeId !== null) return { path: 'employee', employeeId }
  return { path: 'domain', employeeId: null }
}

const VALID_ROLES = ['super_admin', 'asset_admin', 'tech_admin', 'employee']

/** Reads employees/{id}.preassignedRole; falls back to 'employee' when absent/invalid.
 *  This is the role a super_admin granted the PERSON on /roles before they ever
 *  signed in — the invited-employee flow. Throws are swallowed by the caller. */
async function readPreassignedRole(db: Firestore, employeeId: string): Promise<string> {
  const snap = await db.doc(`employees/${employeeId}`).get()
  const pre = snap.exists ? (snap.data()?.['preassignedRole'] as unknown) : null
  return typeof pre === 'string' && VALID_ROLES.includes(pre) ? pre : 'employee'
}

/**
 * Pre-provisions users/{uid} for an employee invited via /employees: the account
 * starts ACTIVE with the role a super_admin pre-assigned on /roles (default
 * 'employee') and a link to its HR record (employeeId) — no manual step in the
 * pending queue. Also writes the standard 'user'/'role_assigned' audit row
 * (actor = system) so the grant is visible in the audit journal.
 */
export async function provisionEmployeeUser(
  db: Firestore,
  input: { uid: string; email: string; displayName: string | null; employeeId: string; role?: string },
): Promise<void> {
  const role = input.role && VALID_ROLES.includes(input.role) ? input.role : 'employee'
  await db.doc(`users/${input.uid}`).set(
    {
      email: input.email,
      displayName: (input.displayName && input.displayName.trim()) || input.email || input.uid,
      role,
      status: 'active',
      employeeId: input.employeeId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  await db.collection('audit_logs').add({
    entityType: 'user',
    entityId: input.uid,
    action: 'role_assigned',
    actorUid: 'system',
    actorRole: 'system',
    actorName: 'AMS',
    before: null,
    after: { role, status: 'active', employeeId: input.employeeId },
    comment: 'auto-provisioned: email matched an active /employees record',
    at: FieldValue.serverTimestamp(),
  })
}

/** Auth blocking trigger fired before a new user account is created. */
export const beforecreated = beforeUserCreated(async (event) => {
  const db = getFirestore()
  const decision = await assertEmailAllowed(event.data?.email, db)

  // Invited-employee auto-provisioning — applies the pre-assigned role (default
  // 'employee'). Best-effort: if the write fails the user simply lands in the
  // pending queue (the old flow) instead of blocking account creation.
  if (decision.path === 'employee' && decision.employeeId && event.data) {
    try {
      const role = await readPreassignedRole(db, decision.employeeId)
      await provisionEmployeeUser(db, {
        uid: event.data.uid,
        email: event.data.email ?? '',
        displayName: event.data.displayName ?? null,
        employeeId: decision.employeeId,
        role,
      })
    } catch (err) {
      logger.error('beforeCreate: employee auto-provisioning failed — user will land in the pending queue.', err)
    }
  }
})
