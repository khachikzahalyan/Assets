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
