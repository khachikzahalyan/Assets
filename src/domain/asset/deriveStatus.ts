import type { AssetAssignment, AssetStatusId } from './types'

/**
 * Create-mode status derives purely from the Quick Assignment action.
 * null assignment => warehouse; any assignment => assigned. In Repair / Disposed
 * are reachable only via edit-mode changeStatus.
 */
export function deriveCreateStatus(assignment: AssetAssignment | null): AssetStatusId {
  return assignment === null ? 'st_warehouse' : 'st_assigned'
}
