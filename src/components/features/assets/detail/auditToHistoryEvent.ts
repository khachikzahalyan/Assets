import type { AuditLog } from '@/domain/audit'
import type { AssetReferenceData, EmployeeRow } from '@/domain/asset'
import type { HistoryEventVM } from './detailFormat'
import type { AssetAssignment } from '@/domain/asset'
import { describeAssignment } from './detailFormat'

// ---------------------------------------------------------------------------
// Actor resolution context — allows the page to inject current-user identity
// and an optional uid→name resolver for admin users in the /users collection.
// ---------------------------------------------------------------------------

export interface ActorCtx {
  /** UID of the currently signed-in user. */
  currentUid?: string
  /**
   * Optional resolver for UIDs not found in `ref.employees`.
   * The page may pass a lookup into a users map if available.
   * Falls back to «Администратор» when this returns undefined.
   */
  resolveUid?: (uid: string) => string | undefined
}

function resolveEmployeeName(id: string | null | undefined, employees: EmployeeRow[]): string | undefined {
  if (!id) return undefined
  const emp = employees.find(e => e.id === id)
  if (!emp) return undefined
  return [emp.firstName, emp.lastName].filter(Boolean).join(' ') || undefined
}

function resolveAssignmentDesc(
  data: Record<string, unknown> | null,
  ref: AssetReferenceData,
): string | undefined {
  if (!data) return undefined
  const mode = data['mode'] as string | undefined
  if (!mode) return undefined

  const employeeId  = data['employeeId']  as string | undefined
  const branchId    = data['branchId']    as string | undefined
  const deptId      = data['departmentId'] as string | undefined
  const isTemporary = data['isTemporary'] as boolean | undefined
  const tempKind    = data['tempKind']    as 'audit' | 'intern' | 'staff' | null | undefined

  const employeeName = resolveEmployeeName(employeeId, ref.employees)
  const branchName   = ref.branches.find(b => b.id === branchId)?.name
  const deptName     = ref.departments.find(d => d.id === deptId)?.name

  const assignment: AssetAssignment = {
    mode:         mode as AssetAssignment['mode'],
    isTemporary:  isTemporary ?? false,
    tempKind:     tempKind ?? null,
    ...(employeeId  !== undefined ? { employeeId  } : {}),
    ...(branchId    !== undefined ? { branchId    } : {}),
    ...(deptId      !== undefined ? { departmentId: deptId } : {}),
  }

  const resolvedNames: { employeeName?: string; branchName?: string; deptName?: string } = {}
  if (employeeName !== undefined) resolvedNames.employeeName = employeeName
  if (branchName   !== undefined) resolvedNames.branchName   = branchName
  if (deptName     !== undefined) resolvedNames.deptName     = deptName

  return describeAssignment(
    assignment,
    resolvedNames,
    { warehouse: 'Склад', kindAudit: 'Аудитор', kindIntern: 'Стажёр', temporary: 'Временно' },
  )
}

/**
 * Resolves the description for one side (before/after) of a transfer audit entry.
 *
 * The transfer audit payload nests the assignment under `log.before.assignment`
 * and `log.after.assignment`. A `null` nested assignment means the asset was
 * on the warehouse — render as «Склад».
 *
 * @param side - the nested assignment object (may be null = warehouse, or a
 *               Record<string,unknown> with at least a `mode` field)
 */
function descForAssignmentSide(
  side: Record<string, unknown> | null | undefined,
  ref: AssetReferenceData,
): string {
  if (side === null || side === undefined) return 'Склад'
  return resolveAssignmentDesc(side, ref) ?? 'Склад'
}

export function auditToHistoryEvent(log: AuditLog, ref: AssetReferenceData, actorCtx?: ActorCtx): HistoryEventVM {
  // Actor resolution order:
  // 1. current signed-in user  → «Вы»
  // 2. employee in ref.employees
  // 3. custom resolveUid callback (e.g. /users collection lookup)
  // 4. graceful fallback        → «Администратор»  (never raw uid)
  let actorName: string
  if (actorCtx?.currentUid && log.actorUid === actorCtx.currentUid) {
    actorName = 'Вы'
  } else {
    const fromEmployees = resolveEmployeeName(log.actorUid, ref.employees)
    if (fromEmployees !== undefined) {
      actorName = fromEmployees
    } else {
      actorName = actorCtx?.resolveUid?.(log.actorUid) ?? 'Администратор'
    }
  }

  const base = { id: log.id, date: log.at, actor: actorName }

  switch (log.action) {
    case 'created':
      return { ...base, icon: 'plus', kind: 'created', action: 'Создан в системе' }

    case 'assigned':
    case 'transferred': {
      const before = resolveAssignmentDesc(log.before, ref)
      const after  = resolveAssignmentDesc(log.after,  ref)
      return {
        ...base,
        icon:   'arrow-right-left',
        action: 'Передача',
        ...(before !== undefined ? { before } : {}),
        ...(after  !== undefined ? { after  } : {}),
      }
    }

    case 'returned':
      return { ...base, icon: 'arrow-right-left', action: 'Возврат на склад' }

    case 'disposed': {
      const afterText = log.comment ?? 'Списано'
      return { ...base, icon: 'archive-x', action: 'Списан', after: afterText }
    }

    case 'sent_to_repair':
      return {
        ...base,
        icon:   'hammer',
        action: 'Отправлен в ремонт',
        ...(log.comment ? { after: log.comment } : {}),
      }

    case 'repair_completed':
      return { ...base, icon: 'check-circle', action: 'Возвращён из ремонта' }

    case 'status_changed': {
      const beforeData = log.before as Record<string, unknown> | null
      const afterData  = log.after  as Record<string, unknown> | null
      const statusId   = afterData?.['statusId'] as string | undefined

      // Detect transfer: at least one side carries an `assignment` key.
      // Non-transfer lifecycle changes (write-off / repair / return) have NO assignment key.
      const isTransfer = (
        (beforeData !== null && beforeData !== undefined && 'assignment' in beforeData) ||
        (afterData  !== null && afterData  !== undefined && 'assignment' in afterData)
      )

      if (isTransfer) {
        const beforeAssignment = beforeData?.['assignment'] as Record<string, unknown> | null | undefined
        const afterAssignment  = afterData?.['assignment']  as Record<string, unknown> | null | undefined
        const before = descForAssignmentSide(beforeAssignment, ref)
        const after  = descForAssignmentSide(afterAssignment,  ref)
        return { ...base, icon: 'arrow-right-left', action: 'Передача', before, after }
      }

      // Lifecycle status change — no assignment delta
      if (statusId === 'st_disposed')  return { ...base, icon: 'archive-x',       action: 'Списан'              }
      if (statusId === 'st_repair')    return { ...base, icon: 'hammer',           action: 'Отправлен в ремонт'  }
      if (statusId === 'st_warehouse') return { ...base, icon: 'arrow-right-left', action: 'Возврат на склад'    }
      return { ...base, icon: 'arrow-right-left', action: 'Передача' }
    }

    case 'upgrade_added': {
      const afterVal = log.after
        ? String(
            (log.after as Record<string, unknown>)['value'] ??
            (log.after as Record<string, unknown>)['component'] ??
            '',
          )
        : undefined
      return {
        ...base,
        icon:   'wrench',
        action: 'Апгрейд',
        ...(afterVal !== undefined && afterVal !== '' ? { after: afterVal } : {}),
      }
    }

    default:
      return { ...base, icon: 'circle', action: log.action }
  }
}
