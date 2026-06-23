import { db } from '@/lib/firebase'
import { FirestoreUserRepository } from './firestoreUserRepository'
import type { UserRepository } from '@/domain/user'
import { FirestorePartRepository } from './firestorePartRepository'
import type { PartRepository, PartWriteRepository } from '@/domain/part/PartRepository'

/** Production default UserRepository, wired to the Firestore singleton. */
export function createDefaultUserRepository(): UserRepository {
  return new FirestoreUserRepository(db())
}

/**
 * Production default PartRepository + PartWriteRepository, wired to the Firestore singleton.
 * Both read and write interfaces are implemented by FirestorePartRepository.
 */
export function createDefaultPartRepository(): PartRepository & PartWriteRepository {
  return new FirestorePartRepository(db())
}
