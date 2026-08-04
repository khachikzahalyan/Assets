/**
 * Domain error for insufficient warehouse stock.
 *
 * Thrown by the installPart write path (Firestore adapter and in-memory adapter)
 * when an in-house install is attempted but the SKU's onHand snapshot is below
 * the requested quantity. serviceReplace operations are exempt — they never touch
 * warehouse stock and must NOT be blocked by this error.
 *
 * Pattern mirrors EntityInUseError from src/domain/shared/errors.ts.
 */
export class InsufficientStockError extends Error {
  override readonly name = 'InsufficientStockError'

  constructor(
    readonly skuId: string,
    readonly available: number,
    readonly requested: number,
  ) {
    super(
      `InsufficientStockError: SKU ${skuId} — available ${available}, requested ${requested}`,
    )
  }
}

export function isInsufficientStockError(e: unknown): e is InsufficientStockError {
  return e instanceof InsufficientStockError
}

/**
 * Thrown by the installPart replace path when the explicitly-requested
 * replaceUcIndex points at an upgradeCurrent slot whose `kind` does not match
 * the slot kind the SKU category resolves to (slotKindForSku). Defensive guard:
 * a RAM install must never overwrite a storage slot because of a stale index.
 */
export class SlotKindMismatchError extends Error {
  override readonly name = 'SlotKindMismatchError'

  constructor(
    readonly slotIndex: number,
    readonly expectedKind: string,
    readonly actualKind: string,
  ) {
    super(
      `SlotKindMismatchError: upgradeCurrent[${slotIndex}] has kind '${actualKind}', expected '${expectedKind}'`,
    )
  }
}

export function isSlotKindMismatchError(e: unknown): e is SlotKindMismatchError {
  return e instanceof SlotKindMismatchError
}

/**
 * Thrown by createModelSku when the resolved PartCategoryDef has
 * behavior !== 'models'. E.g. calling createModelSku with categoryId 'ram'
 * (behavior 'sized') must fail at the domain level before any Firestore write.
 */
export class InvalidCategoryBehaviorError extends Error {
  override readonly name = 'InvalidCategoryBehaviorError'

  constructor(
    readonly categoryId: string,
    readonly expected: string,
    readonly actual: string,
  ) {
    super(
      `InvalidCategoryBehaviorError: category '${categoryId}' has behavior '${actual}', expected '${expected}'`,
    )
  }
}

export function isInvalidCategoryBehaviorError(e: unknown): e is InvalidCategoryBehaviorError {
  return e instanceof InvalidCategoryBehaviorError
}
