import type { AssetAssignment, AssetStatusId } from './types'
import { ASSET_STATUS } from './types'

/**
 * Create-mode status derives purely from the Quick Assignment action.
 * null assignment => warehouse; any assignment => assigned. In Repair / Disposed
 * are reachable only via edit-mode changeStatus.
 */
export function deriveCreateStatus(assignment: AssetAssignment | null): AssetStatusId {
  return assignment === null ? ASSET_STATUS.warehouse : ASSET_STATUS.assigned
}
