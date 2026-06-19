import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import type {
  WorkstationLicense,
  CreateWorkstationLicenseInput,
  AssignWorkstationLicenseInput,
  AssignmentType,
} from '@/domain/license'
import type { WorkstationLicenseRepository, WorkstationLicenseListQuery } from '@/domain/license'
import {
  withAudit,
  type AuditContext,
} from '@/lib/audit'
import { sanitizeLicenseAuditPayload } from '@/lib/audit'

export class InMemoryWorkstationLicenseRepository implements WorkstationLicenseRepository {
  private docs = new Map<string, WorkstationLicense>()
  private secrets = new Map<string, string>() // licenseId -> RAW key, never in docs
  private seq = 0

  constructor(
    private readonly ctx: AuditContext,
  ) {}

  // ---- Helpers ---------------------------------------------------------------

  private nextId(): string {
    return `lic_${++this.seq}`
  }

  private resolveAssignment(
    assign: CreateWorkstationLicenseInput['assign'],
  ): Pick<WorkstationLicense, 'assignmentType' | 'assignedToAssetId' | 'assignedToEmployeeId'> {
    if (!assign || assign.to === 'unassigned') {
      return { assignmentType: 'unassigned', assignedToAssetId: null, assignedToEmployeeId: null }
    }
    if (assign.to === 'device') {
      return {
        assignmentType: 'device',
        assignedToAssetId: assign.assetId,
        assignedToEmployeeId: null,
      }
    }
    // employee
    return {
      assignmentType: 'employee',
      assignedToEmployeeId: assign.employeeId,
      assignedToAssetId: null,
    }
  }

  private applyAssignInput(
    input: AssignWorkstationLicenseInput,
  ): Pick<WorkstationLicense, 'assignmentType' | 'assignedToAssetId' | 'assignedToEmployeeId'> {
    if (input.to === 'unassigned') {
      return { assignmentType: 'unassigned', assignedToAssetId: null, assignedToEmployeeId: null }
    }
    if (input.to === 'device') {
      if (!input.assetId) throw new Error('assign-device/missing-assetId')
      return {
        assignmentType: 'device',
        assignedToAssetId: input.assetId,
        assignedToEmployeeId: null,
      }
    }
    // employee
    if (!input.employeeId) throw new Error('assign-employee/missing-employeeId')
    return {
      assignmentType: 'employee',
      assignedToEmployeeId: input.employeeId,
      assignedToAssetId: null,
    }
  }

  private cloneDoc(doc: WorkstationLicense): WorkstationLicense {
    return { ...doc }
  }

  // ---- Reads -----------------------------------------------------------------

  async getLicense(id: string): Promise<WorkstationLicense | null> {
    const doc = this.docs.get(id)
    return doc ? this.cloneDoc(doc) : null
  }

  async listLicenses(q?: WorkstationLicenseListQuery): Promise<WorkstationLicense[]> {
    let results = Array.from(this.docs.values()).map(d => this.cloneDoc(d))

    if (q?.assignmentType && q.assignmentType !== 'all') {
      const at: AssignmentType = q.assignmentType
      results = results.filter(l => l.assignmentType === at)
    }
    if (q?.lifecycleStatus && q.lifecycleStatus !== 'all') {
      const ls = q.lifecycleStatus
      results = results.filter(l => l.lifecycleStatus === ls)
    }
    if (q?.search) {
      const term = q.search.trim().toLowerCase()
      results = results.filter(l =>
        [l.name, l.vendor].filter(Boolean).join(' ').toLowerCase().includes(term),
      )
    }

    return results.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }

  async listForAsset(assetId: string): Promise<WorkstationLicense[]> {
    return Array.from(this.docs.values())
      .filter(
        l =>
          l.assignmentType === 'device' &&
          l.assignedToAssetId === assetId &&
          l.lifecycleStatus === 'active',
      )
      .map(d => this.cloneDoc(d))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }

  async listAssignablePool(): Promise<WorkstationLicense[]> {
    return Array.from(this.docs.values())
      .filter(l => l.lifecycleStatus === 'active' && l.assignmentType === 'unassigned')
      .map(d => this.cloneDoc(d))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }

  // ---- Mutations -------------------------------------------------------------

  async createLicense(
    input: CreateWorkstationLicenseInput,
    actor: Actor,
  ): Promise<AuditedResult<WorkstationLicense>> {
    const id = this.nextId()
    const now = new Date().toISOString()

    const isReusable = input.isReusable ?? (input.type === 'OEM' ? false : true)
    const assignmentFields = this.resolveAssignment(input.assign)

    const doc: WorkstationLicense = {
      id,
      name: input.name,
      vendor: input.vendor ?? null,
      type: input.type,
      isReusable,
      lifecycleStatus: 'active',
      expiresAt: input.expiresAt ?? null,
      assignmentType: assignmentFields.assignmentType,
      assignedToAssetId: assignmentFields.assignedToAssetId,
      assignedToEmployeeId: assignmentFields.assignedToEmployeeId,
      assignedAt: null,
      assignedBy: null,
      retiredAt: null,
      retiredWithAssetId: null,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.uid,
      updatedBy: actor.uid,
    }

    // Build audit after payload — sanitizeLicenseAuditPayload is the sole masking
    // step; pass the raw key so it is masked exactly once.
    const afterPayload: Record<string, unknown> = {
      id,
      name: doc.name,
      assignmentType: doc.assignmentType,
      lifecycleStatus: doc.lifecycleStatus,
      ...(input.rawKey ? { key: input.rawKey } : {}),
    }
    const safeSpec = sanitizeLicenseAuditPayload({
      entityType: 'license' as const,
      entityId: id,
      action: 'created' as const,
      actorUid: actor.uid,
      actorRole: actor.role,
      before: null,
      after: afterPayload,
    })

    return withAudit(this.ctx, safeSpec, async () => {
      this.docs.set(id, doc)
      if (input.rawKey) {
        this.secrets.set(id, input.rawKey)
      }
      return { value: this.cloneDoc(doc) }
    })
  }

  async assignLicense(
    id: string,
    input: AssignWorkstationLicenseInput,
    actor: Actor,
  ): Promise<AuditedResult<WorkstationLicense>> {
    const existing = this.docs.get(id)
    if (!existing) throw new Error(`WorkstationLicense not found: ${id}`)

    const beforeAssignment = {
      assignmentType: existing.assignmentType,
      assignedToAssetId: existing.assignedToAssetId ?? null,
      assignedToEmployeeId: existing.assignedToEmployeeId ?? null,
    }

    const assignmentFields = this.applyAssignInput(input)
    const now = new Date().toISOString()

    const updated: WorkstationLicense = {
      ...existing,
      ...assignmentFields,
      assignedAt: assignmentFields.assignmentType === 'unassigned' ? null : now,
      assignedBy: assignmentFields.assignmentType === 'unassigned' ? null : actor.uid,
      updatedAt: now,
      updatedBy: actor.uid,
    }

    const afterAssignment = {
      assignmentType: updated.assignmentType,
      assignedToAssetId: updated.assignedToAssetId ?? null,
      assignedToEmployeeId: updated.assignedToEmployeeId ?? null,
    }

    const safeSpec = sanitizeLicenseAuditPayload({
      entityType: 'license' as const,
      entityId: id,
      action: 'assigned' as const,
      actorUid: actor.uid,
      actorRole: actor.role,
      before: beforeAssignment as Record<string, unknown>,
      after: afterAssignment as Record<string, unknown>,
    })

    return withAudit(this.ctx, safeSpec, async () => {
      this.docs.set(id, updated)
      return { value: this.cloneDoc(updated) }
    })
  }

  async decoupleLicense(
    id: string,
    actor: Actor,
  ): Promise<AuditedResult<WorkstationLicense>> {
    const existing = this.docs.get(id)
    if (!existing) throw new Error(`WorkstationLicense not found: ${id}`)

    const before = {
      assignmentType: existing.assignmentType,
      assignedToAssetId: existing.assignedToAssetId ?? null,
      assignedToEmployeeId: existing.assignedToEmployeeId ?? null,
    }
    const now = new Date().toISOString()

    const updated: WorkstationLicense = {
      ...existing,
      assignmentType: 'unassigned',
      assignedToAssetId: null,
      assignedToEmployeeId: null,
      assignedAt: null,
      assignedBy: null,
      updatedAt: now,
      updatedBy: actor.uid,
    }

    const safeSpec = sanitizeLicenseAuditPayload({
      entityType: 'license' as const,
      entityId: id,
      action: 'license_decoupled' as const,
      actorUid: actor.uid,
      actorRole: actor.role,
      before: before as Record<string, unknown>,
      after: { assignmentType: 'unassigned' },
    })

    return withAudit(this.ctx, safeSpec, async () => {
      this.docs.set(id, updated)
      return { value: this.cloneDoc(updated) }
    })
  }

  async rotateKey(
    id: string,
    rawKey: string,
    actor: Actor,
  ): Promise<AuditedResult<WorkstationLicense>> {
    const existing = this.docs.get(id)
    if (!existing) throw new Error(`WorkstationLicense not found: ${id}`)

    const now = new Date().toISOString()
    const updated: WorkstationLicense = {
      ...existing,
      updatedAt: now,
      updatedBy: actor.uid,
    }

    const safeSpec = sanitizeLicenseAuditPayload({
      entityType: 'license' as const,
      entityId: id,
      action: 'key_rotated' as const,
      actorUid: actor.uid,
      actorRole: actor.role,
      before: null,
      after: { id, key: rawKey } as Record<string, unknown>,
    })

    return withAudit(this.ctx, safeSpec, async () => {
      this.secrets.set(id, rawKey)
      this.docs.set(id, updated)
      return { value: this.cloneDoc(updated) }
    })
  }
}
