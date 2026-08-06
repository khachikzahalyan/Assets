export type CatalogErrorCode = 'entity_in_use' | 'system_protected' | 'prefix_locked'

abstract class CatalogError extends Error {
  abstract readonly code: CatalogErrorCode
}

export class EntityInUseError extends CatalogError {
  override readonly code = 'entity_in_use' as const
  constructor(readonly entityType: string, readonly entityId: string, readonly count: number) {
    super(`${entityType} ${entityId} is referenced by ${count} record(s)`)
    this.name = 'EntityInUseError'
  }
}

export class SystemEntityProtectedError extends CatalogError {
  override readonly code = 'system_protected' as const
  constructor(readonly entityType: string, readonly entityId: string) {
    super(`${entityType} ${entityId} is a protected system entity`)
    this.name = 'SystemEntityProtectedError'
  }
}

export class PrefixLockedError extends CatalogError {
  override readonly code = 'prefix_locked' as const
  constructor(readonly entityId: string, readonly count: number) {
    super(`category ${entityId} prefix is locked: ${count} asset(s) reference it`)
    this.name = 'PrefixLockedError'
  }
}

export function isCatalogError(e: unknown): e is CatalogError {
  return e instanceof CatalogError
}

/**
 * Returns true when `e` represents a Firestore quota-exhausted (resource-exhausted)
 * error. No firebase/firestore import — structural check only so this predicate is
 * safe to call from the domain layer and from React error boundaries.
 *
 * Matches:
 *   · Firebase FirebaseError objects whose `code` property equals
 *     `'resource-exhausted'` (the v9 SDK sets this verbatim on quota failures).
 *   · Any Error whose message matches the /quota exceeded|resource.?exhausted/i
 *     pattern (covers wrapped errors and plain Error("Quota exceeded.") toasts).
 */
export function isQuotaExceededError(e: unknown): boolean {
  if (e !== null && typeof e === 'object' && 'code' in e) {
    if ((e as { code: unknown }).code === 'resource-exhausted') return true
  }
  if (e instanceof Error) {
    return /quota exceeded|resource.?exhausted/i.test(e.message)
  }
  return false
}
