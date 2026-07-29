import {
  doc, setDoc, serverTimestamp,
  collection, query as fsQuery, where, limit, getDocs,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Role } from '@/config/roles'

const ROLE_IDS = new Set<Role>(['super_admin', 'asset_admin', 'tech_admin', 'employee'])

export interface PreassignedClaim {
  role: Role
  employeeId: string
}

/**
 * $0 (no Cloud Functions) fallback for the invited-employee → role flow.
 *
 * When a super_admin grants a role to a person BEFORE their first sign-in, the
 * role is stored on employees/{id}.preassignedRole and is normally applied by the
 * `beforeCreate` blocking function. On the Spark plan (functions undeployed)
 * nothing applies it, so the invitee would land in `no-role` and need a manual
 * re-grant. This closes that gap client-side.
 *
 * It finds the ACTIVE employees record whose email matches the signed-in user
 * and, if that record carries a valid preassignedRole, writes users/{uid} with
 * that role + the HR link (status: active). Security is enforced by the /users
 * rules, which only permit this self-write when the written role EQUALS the
 * matched employee's preassignedRole AND that employee's email matches the
 * caller's auth token — so a user can only ever claim the exact role a
 * super_admin already intended for them. No self-escalation to an arbitrary role.
 *
 * Returns the applied { role, employeeId }, or null when there's nothing to apply.
 * Best-effort: any failure returns null and the caller degrades to the no-role
 * pending path.
 */
export async function claimPreassignedRole(
  uid: string,
  email: string | null,
  displayName: string | null,
): Promise<PreassignedClaim | null> {
  const trimmed = (email ?? '').trim()
  if (!trimmed) return null
  try {
    const lower = trimmed.toLowerCase()
    const snaps = await Promise.all([
      getDocs(fsQuery(collection(db(), 'employees'), where('email', '==', trimmed), limit(1))),
      ...(lower !== trimmed
        ? [getDocs(fsQuery(collection(db(), 'employees'), where('email', '==', lower), limit(1)))]
        : []),
    ])
    const match = snaps.flatMap(s => s.docs).find(d => {
      const data = d.data() as { status?: string; preassignedRole?: string }
      // Allowlist: only a genuinely ACTIVE employee record backs a claim (mirrors
      // the /users rule); a non-active/unknown status is never eligible.
      return data.status === 'active' && !!data.preassignedRole
    })
    if (!match) return null

    const preassigned = (match.data() as { preassignedRole?: string }).preassignedRole
    if (!preassigned || !ROLE_IDS.has(preassigned as Role)) return null
    const role = preassigned as Role

    await setDoc(
      doc(db(), 'users', uid),
      {
        email: trimmed,
        displayName: (displayName && displayName.trim()) || trimmed,
        role,
        employeeId: match.id,
        status: 'active',
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    // Best-effort audit — the users write above is committed, so the audit rule's
    // actorRole == role() check now resolves to the freshly-granted role.
    try {
      await setDoc(doc(collection(db(), 'audit_logs')), {
        entityType: 'user',
        entityId: uid,
        action: 'role_assigned',
        actorUid: uid,
        actorRole: role,
        before: null,
        after: { role, employeeId: match.id, via: 'preassigned-selfclaim' },
        at: serverTimestamp(),
      })
    } catch {
      // Audit is best-effort; the role grant itself already succeeded.
    }

    return { role, employeeId: match.id }
  } catch {
    return null
  }
}
