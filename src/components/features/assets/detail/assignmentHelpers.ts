import type { Asset, AssetReferenceData } from '@/domain/asset'

export interface ResolvedAssignment {
  mode: 'warehouse' | 'employee' | 'department' | 'branch' | 'temporary'
  primaryLabel: string
  secondaryLabel: string | null
  tempKind: string | null
  expiresAt: string | null
}

export function resolveAssignment(
  ass: Asset['assignment'],
  refData: AssetReferenceData,
): ResolvedAssignment {
  if (!ass || ass.mode === 'warehouse') {
    return { mode: 'warehouse', primaryLabel: '', secondaryLabel: null, tempKind: null, expiresAt: null }
  }
  if (ass.mode === 'employee') {
    const emp = refData.employees.find(e => e.id === ass.employeeId)
    const dept = emp?.departmentId ? refData.departments.find(d => d.id === emp!.departmentId) : undefined
    const empName = emp ? [emp.firstName, emp.lastName].filter(Boolean).join(' ') : '—'
    const subline = [emp?.position, dept?.name].filter(Boolean).join(' · ')
    return { mode: 'employee', primaryLabel: empName, secondaryLabel: subline || null, tempKind: null, expiresAt: null }
  }
  if (ass.mode === 'department') {
    const dept = refData.departments.find(d => d.id === ass.departmentId)
    return { mode: 'department', primaryLabel: dept?.name ?? '—', secondaryLabel: null, tempKind: null, expiresAt: null }
  }
  if (ass.mode === 'branch') {
    const br = refData.branches.find(b => b.id === ass.branchId)
    return { mode: 'branch', primaryLabel: br?.name ?? '—', secondaryLabel: null, tempKind: null, expiresAt: null }
  }
  if (ass.mode === 'temporary') {
    return { mode: 'temporary', primaryLabel: '', secondaryLabel: null, tempKind: ass.tempKind ?? null, expiresAt: ass.expiresAt ?? null }
  }
  return { mode: 'warehouse', primaryLabel: '', secondaryLabel: null, tempKind: null, expiresAt: null }
}
