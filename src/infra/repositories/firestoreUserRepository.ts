import {
  collection, doc, getDoc, getDocs, query as fsQuery, where, serverTimestamp,
  type Firestore,
} from 'firebase/firestore'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import {
  isUserStatus, type User, type PendingUser, type UserRepository, type AssignRoleInput,
  type UserListQuery,
} from '@/domain/user'
import { RoleLockoutError } from '@/domain/user'
import { firestoreAuditContext, withAudit } from '@/lib/audit'
import { FirestoreEmployeeRepository } from './firestoreEmployeeRepository'

function toIso(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v
  if (typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return null
}

function toUser(id: string, d: Record<string, unknown>): User {
  const status = typeof d.status === 'string' && isUserStatus(d.status) ? d.status : 'no-role'
  return {
    id,
    email: String(d.email ?? ''),
    displayName: String(d.displayName ?? ''),
    role: (d.role as User['role']) ?? null,
    status,
    createdAt: toIso(d.createdAt),
  }
}

export class FirestoreUserRepository implements UserRepository {
  constructor(private readonly db: Firestore) {}
  private get audit() { return firestoreAuditContext(this.db) }

  async listPendingUsers(): Promise<PendingUser[]> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'users'), where('status', '==', 'no-role'),
    ))
    return snap.docs
      .map(d => toUser(d.id, d.data() as Record<string, unknown>))
      .filter((u): u is PendingUser => u.status === 'no-role')
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }

  async listUsers(query?: UserListQuery): Promise<User[]> {
    const constraints = []
    if (query?.role === 'no-role') constraints.push(where('role', '==', null))
    else if (query?.role) constraints.push(where('role', '==', query.role))
    if (query?.status) constraints.push(where('status', '==', query.status))
    const snap = await getDocs(fsQuery(collection(this.db, 'users'), ...constraints))
    return snap.docs
      .map(d => toUser(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }

  /** Count active super_admins (server read), excluding one uid. */
  private async countSuperAdmins(exceptUid: string): Promise<number> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'users'),
      where('role', '==', 'super_admin'),
      where('status', '==', 'active'),
    ))
    return snap.docs.filter(d => d.id !== exceptUid).length
  }

  async assignRole(input: AssignRoleInput, actor: Actor): Promise<AuditedResult<User>> {
    const ref = doc(this.db, 'users', input.uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) throw new Error(`User not found: ${input.uid}`)
    const before = toUser(snap.id, snap.data() as Record<string, unknown>)

    const isDemotingASuper = before.role === 'super_admin' && input.role !== 'super_admin'
    if (isDemotingASuper) {
      if (input.uid === actor.uid) throw new RoleLockoutError('self-demotion')
      if ((await this.countSuperAdmins(input.uid)) === 0) throw new RoleLockoutError('last-super-admin')
    }

    // STEP 1 — create the employee doc FIRST (its own withAudit unit → one
    // 'employee'/'created' row). If this fails (e.g. empty email), we bail out
    // BEFORE granting the role, so the user stays pending and retryable. The
    // harmful "promoted but no employee doc" partial state cannot occur.
    if (input.role === 'employee' && input.employee?.mode === 'create') {
      const create = input.employee.create
      if (!create) throw new Error('employee.create payload required when mode === "create"')
      const email = typeof create.email === 'string' ? create.email.trim() : ''
      if (!email) throw new Error('employee email required')
      const empRepo = new FirestoreEmployeeRepository(this.db)
      if (!(await empRepo.getEmployee(input.uid))) {
        await empRepo.createEmployee(
          { id: input.uid, firstName: create.firstName, lastName: create.lastName, email },
          actor,
        )
      }
    }

    // STEP 2 — grant the role (its own withAudit unit → one 'user'/'role_assigned' row).
    const r = await withAudit(this.audit,
      {
        entityType: 'user', entityId: input.uid, action: 'role_assigned',
        actorUid: actor.uid, actorRole: actor.role,
        before: { role: before.role, status: before.status },
        after: { role: input.role, status: 'active' },
      },
      async (txn) => {
        txn.set(
          ref, { role: input.role, status: 'active', updatedAt: serverTimestamp() }, { merge: true },
        )
        return { value: undefined as unknown as void }
      },
    )

    const after = await getDoc(ref)
    if (!after.exists()) throw new Error('User role assign succeeded but readback failed')
    return { value: toUser(after.id, after.data() as Record<string, unknown>), auditId: r.auditId }
  }
}
