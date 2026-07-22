/**
 * Domain errors for asset operations.
 * Thrown by repository adapters; caught and mapped to user-facing toasts in page handlers.
 * The UI already maps thrown error messages by regex — keep message prefixes stable.
 */

/**
 * Thrown when an inventory code is already in use by another asset.
 * Message prefix "Inventory code already in use:" is matched by /inv/i in AssetCreatePage.
 */
export class DuplicateInvCodeError extends Error {
  constructor(public readonly invCode: string) {
    super(`Inventory code already in use: ${invCode}`)
    this.name = 'DuplicateInvCodeError'
  }
}

/**
 * Thrown by updateAsset when opts.expectedUpdatedAt is supplied and the stored
 * updatedAt differs — meaning another write landed between the caller's read and write.
 */
export class ConcurrentEditError extends Error {
  constructor(public readonly assetId: string) {
    super(`Concurrent edit detected: ${assetId}`)
    this.name = 'ConcurrentEditError'
  }
}

/** Thrown when createAssetsBatch receives more than MAX_BATCH_SIZE inputs. */
export class BatchTooLargeError extends Error {
  constructor(count: number, max: number) {
    super(`Batch too large: ${count} inputs exceed the maximum of ${max}`)
    this.name = 'BatchTooLargeError'
  }
}

/**
 * Thrown when a batch input carries an oemLicense field.
 * Group-mode registration never sends licenses; fail fast rather than silently ignore.
 */
export class BatchLicenseUnsupportedError extends Error {
  constructor() {
    super('oemLicense is not supported in batch create — register licenses individually after the batch')
    this.name = 'BatchLicenseUnsupportedError'
  }
}

/**
 * Returns the Firestore document id used as the uniqueness lock for an inventory code.
 * encodeURIComponent is used because '/' is illegal in Firestore document ids but '%2F' is allowed.
 */
export function invCodeLockId(invCode: string): string {
  return encodeURIComponent(invCode.trim())
}
