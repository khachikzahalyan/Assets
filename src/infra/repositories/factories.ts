import { db } from '@/lib/firebase'
import { FirestoreUserRepository } from './firestoreUserRepository'
import type { UserRepository } from '@/domain/user'

/** Production default UserRepository, wired to the Firestore singleton. */
export function createDefaultUserRepository(): UserRepository {
  return new FirestoreUserRepository(db())
}
