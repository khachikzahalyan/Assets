import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface ClaimInput {
  uid: string
  email: string | null
  displayName: string | null
}

/**
 * Best-effort, idempotent self-claim of a `no-role` users/{uid} record.
 * Merge-write with NO `role` key — the rules forbid a non-super introducing role,
 * so this can only ever create/refresh a pending record. ALL failures are
 * swallowed: this must NEVER block or crash AccessPendingPage.
 */
export async function claimPendingUser(input: ClaimInput): Promise<void> {
  try {
    await setDoc(
      doc(db(), 'users', input.uid),
      {
        email: input.email ?? '',
        displayName: (input.displayName && input.displayName.trim()) || input.email || input.uid,
        status: 'no-role',
        createdAt: serverTimestamp(),
      },
      { merge: true },
    )
  } catch {
    // Intentionally swallowed — onboarding must not depend on this write.
  }
}
