import type { AssetAssignment, AssetStatusId } from './types'

/**
 * PURE transfer-rules helper for the Asset Detail screen.
 *
 * No firebase / react imports. Given a chosen {@link TransferTarget}, it derives the
 * complete patch the repository layer needs: target status, the persisted
 * `asset.assignment`, the asset's `branchId`, and its `deptId`.
 *
 * Branch invariant: ONLY `mode: 'branch'` relocates the asset — every other mode forces
 * the asset back to the head-office branch ({@link HEAD_OFFICE_BRANCH_ID}). This keeps
 * employee/department/temporary holdings rooted at HQ while a branch transfer is the sole
 * physical relocation.
 *
 * Warehouse invariant: `mode: 'warehouse'` is an unassigned-on-shelf INTENT — the persisted
 * `assignment` becomes `null` (there is no stored assignment object with mode 'warehouse').
 *
 * Temporary invariant: `mode: 'temporary'` references a KIND (audit / intern), never an
 * employee. It always carries `isTemporary: true` and an `expiresAt`.
 */

/** The canonical head-office branch id. Every non-branch transfer roots the asset here. */
export const HEAD_OFFICE_BRANCH_ID = 'br_main'

/** Default work mode for assignments that don't specify one. */
export const WORK_MODE_DEFAULT = 'office' as const

/** A transfer choice made on the Asset Detail screen, before it is turned into a patch. */
export type TransferTarget =
  | { mode: 'warehouse' }
  | { mode: 'employee'; employeeId: string; workMode?: 'office' | 'remote' }
  | { mode: 'branch'; branchId: string }
  | { mode: 'department'; departmentId: string }
  | { mode: 'temporary'; tempKind: 'audit' | 'intern'; expiresAt: string; workMode?: 'office' | 'remote' }

/** The full set of fields a transfer must write onto the asset. */
export interface TransferPatch {
  toStatusId: AssetStatusId
  assignment: AssetAssignment | null
  branchId: string
  deptId: string | null
}

/**
 * Builds the {@link TransferPatch} for a chosen {@link TransferTarget}.
 *
 * - `warehouse`  → unassigned (assignment null), status warehouse, branch HQ, no dept.
 * - `employee`   → assigned to person; dept is the employee's department (pass `employeeDeptId`),
 *                  branch forced to HQ.
 * - `branch`     → relocated: branchId = chosen branch (the only relocating mode), no dept.
 * - `department` → attributed to a department; branch HQ, dept = departmentId.
 * - `temporary`  → temporary hold by KIND (audit/intern) with isTemporary + expiresAt;
 *                  branch HQ, no dept.
 *
 * @param target          the chosen transfer.
 * @param employeeDeptId  the employee's department id (used only for `mode: 'employee'`);
 *                        null when unknown / employee has no department.
 */
export function buildTransferPatch(
  target: TransferTarget,
  employeeDeptId: string | null = null,
): TransferPatch {
  switch (target.mode) {
    case 'warehouse':
      return {
        toStatusId: 'st_warehouse',
        assignment: null,
        branchId: HEAD_OFFICE_BRANCH_ID,
        deptId: null,
      }
    case 'employee':
      return {
        toStatusId: 'st_assigned',
        assignment: {
          mode: 'employee',
          employeeId: target.employeeId,
          ...(target.workMode ? { workMode: target.workMode } : {}),
        },
        branchId: HEAD_OFFICE_BRANCH_ID,
        deptId: employeeDeptId,
      }
    case 'branch':
      return {
        toStatusId: 'st_assigned',
        assignment: { mode: 'branch', branchId: target.branchId },
        branchId: target.branchId,
        deptId: null,
      }
    case 'department':
      return {
        toStatusId: 'st_assigned',
        assignment: { mode: 'department', departmentId: target.departmentId },
        branchId: HEAD_OFFICE_BRANCH_ID,
        deptId: target.departmentId,
      }
    case 'temporary':
      return {
        toStatusId: 'st_assigned',
        assignment: {
          mode: 'temporary',
          tempKind: target.tempKind,
          expiresAt: target.expiresAt,
          isTemporary: true,
          ...(target.workMode ? { workMode: target.workMode } : {}),
        },
        branchId: HEAD_OFFICE_BRANCH_ID,
        deptId: null,
      }
  }
}
