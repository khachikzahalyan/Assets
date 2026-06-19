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
