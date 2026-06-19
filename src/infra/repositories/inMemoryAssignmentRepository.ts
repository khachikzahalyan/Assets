import type { Asset, Actor } from '@/domain/asset'
import type { Assignment, AssignInput, AssignmentRepository } from '@/domain/assignment'
import { withAudit, type AuditContext } from '@/lib/audit'
import type { AuditedResult } from '@/domain/audit'

export interface MailEntry { to: string[]; message: { subject: string; text: string; html: string } }

/** In-memory adapter for tests/dev. Mutates the shared assets array + mail sink. */
export class InMemoryAssignmentRepository implements AssignmentRepository {
  private seq = 0
  private readonly history: Assignment[] = []

  constructor(
    private readonly assets: Asset[],
    private readonly mail: MailEntry[],
    private readonly audit: AuditContext,
  ) {}

  async getActiveAssignment(assetId: string): Promise<Assignment | null> {
    return this.history.find(a => a.assetId === assetId && a.endedAt === null) ?? null
  }

  async listAssignments(assetId: string): Promise<Assignment[]> {
    return this.history
      .filter(a => a.assetId === assetId)
      .sort((a, b) => {
        const timeCmp = b.startedAt.localeCompare(a.startedAt)
        if (timeCmp !== 0) return timeCmp
        // Stable tie-breaker by id (as_1, as_2 … are lexically ordered)
        return b.id.localeCompare(a.id)
      })
  }

  async listAssignmentsForEmployee(employeeId: string): Promise<Assignment[]> {
    return this.history
      .filter(a => a.assignedToEmployeeId === employeeId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  async assign(input: AssignInput, actor: Actor): Promise<AuditedResult<Assignment>> {
    const idx = this.assets.findIndex(a => a.id === input.assetId)
    if (idx < 0) throw new Error(`Asset not found: ${input.assetId}`)
    if (this.assets[idx]!.statusId !== 'st_warehouse') {
      throw new Error(`Asset not assignable (status ${this.assets[idx]!.statusId})`)
    }
    if (input.mode === 'employee' && !input.employeeId) throw new Error('employeeId required')
    if (input.mode === 'branch' && !input.branchId) throw new Error('branchId required')

    const now = new Date().toISOString()
    const assignment: Assignment = {
      id: `as_${++this.seq}`,
      assetId: input.assetId,
      mode: input.mode,
      assignedToEmployeeId: input.mode === 'employee' ? input.employeeId! : null,
      assignedToBranchId: input.mode === 'branch' ? input.branchId! : null,
      startedAt: now, endedAt: null,
      actStoragePath: input.actStoragePath ?? null,
      transferComment: input.transferComment ?? null,
      createdBy: actor.uid, createdAt: now,
    }

    const r = await withAudit(this.audit,
      {
        entityType: 'assignment', entityId: assignment.id, action: 'assigned',
        actorUid: actor.uid, actorRole: actor.role,
        after: {
          assetId: input.assetId, mode: input.mode,
          assignedToEmployeeId: assignment.assignedToEmployeeId,
          assignedToBranchId: assignment.assignedToBranchId,
        },
        comment: input.transferComment ?? null,
      },
      async () => {
        this.history.push(assignment)
        this.assets[idx] = {
          ...this.assets[idx]!,
          statusId: 'st_assigned',
          assignment: input.mode === 'employee'
            ? { mode: 'employee', employeeId: input.employeeId! }
            : { mode: 'branch', branchId: input.branchId! },
          updatedAt: now,
        }
        if (input.mode === 'employee' && input.employeeEmail) {
          this.mail.push({
            to: [input.employeeEmail],
            message: {
              subject: `Asset assigned: ${input.invCode ?? input.assetId}`,
              text: `Asset ${input.invCode ?? input.assetId} assigned to ${input.employeeName ?? ''}`.trim(),
              html: `<p>Asset <strong>${input.invCode ?? input.assetId}</strong> assigned to ${input.employeeName ?? ''}</p>`,
            },
          })
        }
        return { value: assignment }
      })
    return r
  }

  async returnAsset(assetId: string, actor: Actor): Promise<AuditedResult<Assignment>> {
    const idx = this.assets.findIndex(a => a.id === assetId)
    if (idx < 0) throw new Error(`Asset not found: ${assetId}`)
    const active = this.history.find(a => a.assetId === assetId && a.endedAt === null)
    if (!active) throw new Error(`No active assignment for asset: ${assetId}`)

    const now = new Date().toISOString()
    const r = await withAudit(this.audit,
      {
        entityType: 'assignment', entityId: active.id, action: 'returned',
        actorUid: actor.uid, actorRole: actor.role,
        before: { assetId, mode: active.mode },
        after: { assetId, endedAt: now },
      },
      async () => {
        active.endedAt = now
        this.assets[idx] = { ...this.assets[idx]!, statusId: 'st_warehouse', assignment: null, updatedAt: now }
        return { value: active }
      })
    return r
  }
}
