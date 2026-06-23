import type { Asset } from '@/domain/asset'
import type { EmployeeRow } from '@/domain/asset'
import { temporaryHoldStatus } from '@/domain/asset'
import { assigneeKind, isTemporaryAssignment } from './assetFormat'

export interface AssigneeCellProps {
  asset: Asset
  employeeMap: Map<string, EmployeeRow>
  deptMap: Map<string, string>      // id -> name
  branchMap: Map<string, string>    // id -> name
  // translated labels:
  onShelf: string        // "На складе"
  onShelfSub: string     // "Ожидает выдачи"
  deptLabel: string      // "Отдел"
  branchLabel: string    // "Филиал"
  tempLabel: string      // "Временно"
  kindAuditLabel: string  // "Аудитор"
  kindInternLabel: string // "Стажёр"
}

export function AssigneeCell({
  asset,
  employeeMap,
  deptMap,
  branchMap,
  onShelf,
  onShelfSub,
  deptLabel,
  branchLabel,
  tempLabel,
  kindAuditLabel,
  kindInternLabel,
}: AssigneeCellProps) {
  const kind = assigneeKind(asset)

  // ── employee ────────────────────────────────────────────────────────────────
  if (kind === 'employee') {
    const emp = asset.assignment?.employeeId
      ? employeeMap.get(asset.assignment.employeeId)
      : undefined
    // Temporary holders tagged as auditor/intern surface the role label
    // (Аудитор / Стажёр) instead of a personal name, matching the prototype.
    const tempKind = asset.assignment?.tempKind
    const roleLabel =
      tempKind === 'audit' ? kindAuditLabel : tempKind === 'intern' ? kindInternLabel : null
    const name = roleLabel
      ? roleLabel
      : emp
        ? [emp.lastName, emp.firstName].filter(Boolean).join(' ') || '—'
        : '—'

    let subEl: React.ReactNode = null
    if (isTemporaryAssignment(asset)) {
      subEl = (
        <div className="text-[13px] text-amber-300 font-medium leading-tight mt-0.5">
          {tempLabel}
        </div>
      )
    } else if (asset.assignment?.departmentId) {
      const deptName = deptMap.get(asset.assignment.departmentId)
      if (deptName) {
        subEl = (
          <div className="text-[13px] text-text-tertiary truncate leading-tight mt-0.5">
            {deptName}
          </div>
        )
      }
    }

    return (
      <div className="min-w-0">
        <div className="text-[15px] font-semibold truncate leading-tight text-text-primary">
          {name}
        </div>
        {subEl}
      </div>
    )
  }

  // ── temporary (mode === 'temporary') — anonymous Стажёр/Аудит hold ────────────
  if (kind === 'temporary') {
    const tempKind = asset.assignment?.tempKind
    const name =
      tempKind === 'audit' ? kindAuditLabel : tempKind === 'intern' ? kindInternLabel : tempLabel
    const hold = temporaryHoldStatus(asset.assignment, new Date())
    const expiresAt = asset.assignment?.expiresAt
    let subText = tempLabel
    if (expiresAt) {
      const [y, m, d] = expiresAt.split('T')[0]!.split('-')
      subText = `${tempLabel} · ${d}.${m}.${y?.slice(2) ?? ''}`
    }
    const subCls =
      hold === 'overdue'
        ? 'text-rose-400'
        : hold === 'dueSoon'
          ? 'text-amber-300'
          : 'text-amber-300/80'
    return (
      <div className="min-w-0">
        <div className="text-[15px] font-semibold truncate leading-tight text-text-primary">
          {name}
        </div>
        <div className={`text-[13px] font-medium leading-tight mt-0.5 truncate ${subCls}`}>
          {subText}
        </div>
      </div>
    )
  }

  // ── department ──────────────────────────────────────────────────────────────
  if (kind === 'department') {
    const name = asset.assignment?.departmentId
      ? deptMap.get(asset.assignment.departmentId) ?? '—'
      : '—'
    return (
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-text-primary truncate leading-tight">
          {name}
        </div>
        <div className="text-[13px] text-text-tertiary leading-tight mt-0.5">
          {deptLabel}
        </div>
      </div>
    )
  }

  // ── branch ──────────────────────────────────────────────────────────────────
  if (kind === 'branch') {
    const name = asset.assignment?.branchId
      ? branchMap.get(asset.assignment.branchId) ?? '—'
      : '—'
    return (
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-text-primary truncate leading-tight">
          {name}
        </div>
        <div className="text-[13px] text-text-tertiary leading-tight mt-0.5">
          {branchLabel}
        </div>
      </div>
    )
  }

  // ── warehouse / none ────────────────────────────────────────────────────────
  return (
    <div className="min-w-0">
      <div className="text-[15px] font-semibold text-text-primary leading-tight">
        {onShelf}
      </div>
      <div className="text-[13px] text-text-tertiary leading-tight mt-0.5">
        {onShelfSub}
      </div>
    </div>
  )
}
