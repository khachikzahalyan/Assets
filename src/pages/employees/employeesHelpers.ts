import type { Employee, SortValue, EmployeeListQuery } from '@/domain/employee'
import { buildTransferPatch } from '@/domain/asset'
import type { TransferPatch, TransferTarget } from '@/domain/asset'
import type { Destination } from '@/components/features/employees/DestPicker'

export const PAGE_SIZE = 10

export const DEFAULT_QUERY: Required<EmployeeListQuery> = {
  status: 'active',
  branchId: 'all',
  departmentId: 'all',
  search: '',
  sort: 'updated_desc',
}

/**
 * Map a DestPicker Destination to the asset-cache transfer patch.
 * Pure helper — no hooks, no side effects.
 */
export function destToPatch(dest: Destination, employees: Employee[]): TransferPatch {
  if (dest.kind === 'warehouse') return buildTransferPatch({ mode: 'warehouse' })
  if (dest.kind === 'temporary') {
    return buildTransferPatch({
      mode: 'temporary',
      tempKind: dest.tempKind,
      expiresAt: dest.expiresAt,
    })
  }
  const empDeptId =
    dest.kind === 'employee'
      ? (employees.find(e => e.id === dest.id)?.departmentId ?? null)
      : null
  const target: TransferTarget =
    dest.kind === 'employee'
      ? { mode: 'employee', employeeId: dest.id }
      : dest.kind === 'department'
        ? { mode: 'department', departmentId: dest.id }
        : { mode: 'branch', branchId: dest.id }
  return buildTransferPatch(target, empDeptId)
}

export function sortEmployees(
  employees: Employee[],
  sort: SortValue,
  deptNameOf: (e: Employee) => string,
  assetCountOf: (id: string) => number,
): Employee[] {
  const copy = [...employees]
  switch (sort) {
    case 'updated_desc':
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    case 'updated_asc':
      return copy.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    case 'name_asc':
      return copy.sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'ru'),
      )
    case 'name_desc':
      return copy.sort((a, b) =>
        `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`, 'ru'),
      )
    case 'dept_asc':
      return copy.sort((a, b) =>
        deptNameOf(a).localeCompare(deptNameOf(b), 'ru'),
      )
    case 'assets_desc':
      return copy.sort((a, b) => assetCountOf(b.id) - assetCountOf(a.id))
    default:
      return copy
  }
}

/** Normalize phone to digits only for search matching */
export function normalizePhone(p: string | null): string {
  if (!p) return ''
  return p.replace(/\D/g, '')
}
