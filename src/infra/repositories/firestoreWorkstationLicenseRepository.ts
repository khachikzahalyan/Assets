import {
  collection, doc, getDoc, getDocs, query as fsQuery, where, serverTimestamp,
  runTransaction,
  type Firestore, type Transaction,
} from 'firebase/firestore'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import type {
  WorkstationLicense,
  CreateWorkstationLicenseInput,
  AssignWorkstationLicenseInput,
  AssignmentType,
} from '@/domain/license'
import type { WorkstationLicenseRepository, WorkstationLicenseListQuery } from '@/domain/license'
import { firestoreAuditContext, withAudit, buildAuditDocData } from '@/lib/audit'
import { sanitizeLicenseAuditPayload } from '@/lib/audit'

const COL = 'licenses'

function toIso(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date(0).toISOString()
}

function toWorkstationLicense(id: string, d: Record<string, unknown>): WorkstationLicense {
  return {
    id,
    name: String(d.name ?? ''),
    vendor: (d.vendor as string | null) ?? null,
    type: (d.type as WorkstationLicense['type']) ?? 'Default',
    isReusable: Boolean(d.isReusable),
    assignmentType: (d.assignmentType as AssignmentType) ?? 'unassigned',
    assignedToAssetId: (d.assignedToAssetId as string | null) ?? null,
    assignedToEmployeeId: (d.assignedToEmployeeId as string | null) ?? null,
    assignedAt: (d.assignedAt as string | null) ?? null,
    assignedBy: (d.assignedBy as string | null) ?? null,
    lifecycleStatus: (d.lifecycleStatus as WorkstationLicense['lifecycleStatus']) ?? 'active',
    retiredAt: (d.retiredAt as string | null) ?? null,
    retiredWithAssetId: (d.retiredWithAssetId as string | null) ?? null,
    decoupledFromAssetId: (d.decoupledFromAssetId as string | null) ?? null,
    expiresAt: (d.expiresAt as string | null) ?? null,
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
    createdBy: String(d.createdBy ?? ''),
    updatedBy: String(d.updatedBy ?? ''),
  }
}

function stripUndefinedFs(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
}

function resolveAssignment(
  assign: CreateWorkstationLicenseInput['assign'],
): Pick<WorkstationLicense, 'assignmentType' | 'assignedToAssetId' | 'assignedToEmployeeId'> {
  if (!assign || assign.to === 'unassigned') {
    return { assignmentType: 'unassigned', assignedToAssetId: null, assignedToEmployeeId: null }
  }
  if (assign.to === 'device') {
    return { assignmentType: 'device', assignedToAssetId: assign.assetId, assignedToEmployeeId: null }
  }
  // employee
  return { assignmentType: 'employee', assignedToEmployeeId: assign.employeeId, assignedToAssetId: null }
}

function applyAssignInput(
  input: AssignWorkstationLicenseInput,
): Pick<WorkstationLicense, 'assignmentType' | 'assignedToAssetId' | 'assignedToEmployeeId'> {
  if (input.to === 'unassigned') {
    return { assignmentType: 'unassigned', assignedToAssetId: null, assignedToEmployeeId: null }
  }
  if (input.to === 'device') {
    if (!input.assetId) throw new Error('assign-device/missing-assetId')
    return { assignmentType: 'device', assignedToAssetId: input.assetId, assignedToEmployeeId: null }
  }
  // employee
  if (!input.employeeId) throw new Error('assign-employee/missing-employeeId')
  return { assignmentType: 'employee', assignedToEmployeeId: input.employeeId, assignedToAssetId: null }
}

export class FirestoreWorkstationLicenseRepository implements WorkstationLicenseRepository {
  constructor(private readonly db: Firestore) {}
  private get audit() { return firestoreAuditContext(this.db) }

  // ---- Reads -----------------------------------------------------------------

  async getLicense(id: string): Promise<WorkstationLicense | null> {
    const snap = await getDoc(doc(this.db, COL, id))
    return snap.exists() ? toWorkstationLicense(snap.id, snap.data() as Record<string, unknown>) : null
  }

  async listLicenses(q?: WorkstationLicenseListQuery): Promise<WorkstationLicense[]> {
    const snap = await getDocs(collection(this.db, COL))
    let results = snap.docs.map(d => toWorkstationLicense(d.id, d.data() as Record<string, unknown>))

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
    const snap = await getDocs(fsQuery(
      collection(this.db, COL),
      where('assignmentType', '==', 'device'),
      where('assignedToAssetId', '==', assetId),
      where('lifecycleStatus', '==', 'active'),
    ))
    return snap.docs
      .map(d => toWorkstationLicense(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }

  async listAssignablePool(): Promise<WorkstationLicense[]> {
    const snap = await getDocs(fsQuery(
      collection(this.db, COL),
      where('lifecycleStatus', '==', 'active'),
      where('assignmentType', '==', 'unassigned'),
    ))
    return snap.docs
      .map(d => toWorkstationLicense(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }

  async listDecoupledFromAsset(assetId: string): Promise<WorkstationLicense[]> {
    const snap = await getDocs(fsQuery(
      collection(this.db, COL),
      where('decoupledFromAssetId', '==', assetId),
    ))
    return snap.docs
      .map(d => toWorkstationLicense(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }

  // ---- Mutations -------------------------------------------------------------

  async createLicense(
    input: CreateWorkstationLicenseInput,
    actor: Actor,
  ): Promise<AuditedResult<WorkstationLicense>> {
    const ref = doc(collection(this.db, COL))
    const id = ref.id

    const isReusable = input.isReusable ?? (input.type === 'OEM' ? false : true)
    const assignmentFields = resolveAssignment(input.assign)

    const docData: Record<string, unknown> = stripUndefinedFs({
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
      decoupledFromAssetId: null,
      createdBy: actor.uid,
      updatedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    const afterPayload: Record<string, unknown> = {
      id,
      name: input.name,
      assignmentType: assignmentFields.assignmentType,
      lifecycleStatus: 'active',
      ...(input.rawKey ? { key: input.rawKey } : {}),
    }
    const safeSpec = sanitizeLicenseAuditPayload({
      entityType: 'license' as const,
      entityId: id,
      action: 'created' as const,
      actorUid: actor.uid,
      actorRole: actor.role, actorName: actor.displayName ?? null,
      before: null,
      after: afterPayload,
    })

    const r = await withAudit(this.audit, safeSpec, async (txn) => {
      ;(txn as unknown as Transaction).set(ref, docData)
      return { value: undefined as unknown as void }
    })

    const created = await this.getLicense(id)
    if (!created) throw new Error('License create succeeded but readback failed')
    return { value: created, auditId: r.auditId }
  }

  async assignLicense(
    id: string,
    input: AssignWorkstationLicenseInput,
    actor: Actor,
  ): Promise<AuditedResult<WorkstationLicense>> {
    const existing = await this.getLicense(id)
    if (!existing) throw new Error(`WorkstationLicense not found: ${id}`)

    const beforeAssignment = {
      assignmentType: existing.assignmentType,
      assignedToAssetId: existing.assignedToAssetId ?? null,
      assignedToEmployeeId: existing.assignedToEmployeeId ?? null,
    }

    const assignmentFields = applyAssignInput(input)
    const ref = doc(this.db, COL, id)

    const isAssigning = assignmentFields.assignmentType !== 'unassigned'
    const patch: Record<string, unknown> = stripUndefinedFs({
      ...assignmentFields,
      assignedAt: isAssigning ? serverTimestamp() : null,
      assignedBy: isAssigning ? actor.uid : null,
      decoupledFromAssetId: null,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    })

    const afterAssignment = {
      assignmentType: assignmentFields.assignmentType,
      assignedToAssetId: assignmentFields.assignedToAssetId ?? null,
      assignedToEmployeeId: assignmentFields.assignedToEmployeeId ?? null,
    }

    const safeSpec = sanitizeLicenseAuditPayload({
      entityType: 'license' as const,
      entityId: id,
      action: 'assigned' as const,
      actorUid: actor.uid,
      actorRole: actor.role, actorName: actor.displayName ?? null,
      before: beforeAssignment as Record<string, unknown>,
      after: afterAssignment as Record<string, unknown>,
    })

    const r = await withAudit(this.audit, safeSpec, async (txn) => {
      ;(txn as unknown as Transaction).set(ref, patch, { merge: true })
      return { value: undefined as unknown as void }
    })

    const next = await this.getLicense(id)
    if (!next) throw new Error('License assign succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }

  async swapDeviceKey(
    newLicenseId: string,
    oldLicenseId: string,
    assetId: string,
    actor: Actor,
  ): Promise<AuditedResult<WorkstationLicense>> {
    if (newLicenseId === oldLicenseId) throw new Error('swap/same-license')
    const oldLic = await this.getLicense(oldLicenseId)
    if (!oldLic) throw new Error(`WorkstationLicense not found: ${oldLicenseId}`)
    const newLic = await this.getLicense(newLicenseId)
    if (!newLic) throw new Error(`WorkstationLicense not found: ${newLicenseId}`)
    // An embedded OEM key cannot be swapped off its device (owner rule).
    if (oldLic.type === 'OEM') throw new Error('swap/old-license-is-oem')
    if (oldLic.assignmentType !== 'device' || oldLic.assignedToAssetId !== assetId) {
      throw new Error('swap/old-license-not-bound-to-asset')
    }

    // The two audit specs mirror the standalone decoupleLicense / assignLicense
    // payloads exactly — the swap must be indistinguishable in the audit trail
    // apart from being atomic. Keys never appear here (assignment fields only),
    // but both specs still pass through the sanitizer (belt-and-braces).
    const decoupleSpec = sanitizeLicenseAuditPayload({
      entityType: 'license' as const,
      entityId: oldLicenseId,
      action: 'license_decoupled' as const,
      actorUid: actor.uid,
      actorRole: actor.role, actorName: actor.displayName ?? null,
      before: {
        assignmentType: oldLic.assignmentType,
        assignedToAssetId: oldLic.assignedToAssetId ?? null,
        assignedToEmployeeId: oldLic.assignedToEmployeeId ?? null,
      } as Record<string, unknown>,
      after: { assignmentType: 'unassigned' },
    })
    const assignSpec = sanitizeLicenseAuditPayload({
      entityType: 'license' as const,
      entityId: newLicenseId,
      action: 'assigned' as const,
      actorUid: actor.uid,
      actorRole: actor.role, actorName: actor.displayName ?? null,
      before: {
        assignmentType: newLic.assignmentType,
        assignedToAssetId: newLic.assignedToAssetId ?? null,
        assignedToEmployeeId: newLic.assignedToEmployeeId ?? null,
      } as Record<string, unknown>,
      after: {
        assignmentType: 'device',
        assignedToAssetId: assetId,
        assignedToEmployeeId: null,
      } as Record<string, unknown>,
    })

    const oldRef = doc(this.db, COL, oldLicenseId)
    const newRef = doc(this.db, COL, newLicenseId)
    let assignAuditId = ''
    // One transaction: both license patches + both audit entries commit or none
    // do (the atomic-batch pattern from firestoreAssetRepository.createAssetsBatch).
    await runTransaction(this.db, async (txn) => {
      const at = serverTimestamp()
      txn.set(oldRef, {
        assignmentType: 'unassigned',
        assignedToAssetId: null,
        assignedToEmployeeId: null,
        assignedAt: null,
        assignedBy: null,
        decoupledFromAssetId: assetId,
        updatedAt: at,
        updatedBy: actor.uid,
      }, { merge: true })
      txn.set(newRef, {
        assignmentType: 'device',
        assignedToAssetId: assetId,
        assignedToEmployeeId: null,
        assignedAt: at,
        assignedBy: actor.uid,
        decoupledFromAssetId: null,
        updatedAt: at,
        updatedBy: actor.uid,
      }, { merge: true })
      const decoupleAuditRef = doc(collection(this.db, 'audit_logs'))
      txn.set(decoupleAuditRef, buildAuditDocData(
        decoupleSpec, decoupleSpec.before ?? null, decoupleSpec.after ?? null, at,
      ))
      const assignAuditRef = doc(collection(this.db, 'audit_logs'))
      assignAuditId = assignAuditRef.id
      txn.set(assignAuditRef, buildAuditDocData(
        assignSpec, assignSpec.before ?? null, assignSpec.after ?? null, at,
      ))
    })

    const next = await this.getLicense(newLicenseId)
    if (!next) throw new Error('License swap succeeded but readback failed')
    return { value: next, auditId: assignAuditId }
  }

  async decoupleLicense(
    id: string,
    actor: Actor,
  ): Promise<AuditedResult<WorkstationLicense>> {
    const existing = await this.getLicense(id)
    if (!existing) throw new Error(`WorkstationLicense not found: ${id}`)

    const before = {
      assignmentType: existing.assignmentType,
      assignedToAssetId: existing.assignedToAssetId ?? null,
      assignedToEmployeeId: existing.assignedToEmployeeId ?? null,
    }

    const decoupledFromAssetId = existing.assignedToAssetId ?? null

    const ref = doc(this.db, COL, id)
    const patch: Record<string, unknown> = {
      assignmentType: 'unassigned',
      assignedToAssetId: null,
      assignedToEmployeeId: null,
      assignedAt: null,
      assignedBy: null,
      decoupledFromAssetId,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    }

    const safeSpec = sanitizeLicenseAuditPayload({
      entityType: 'license' as const,
      entityId: id,
      action: 'license_decoupled' as const,
      actorUid: actor.uid,
      actorRole: actor.role, actorName: actor.displayName ?? null,
      before: before as Record<string, unknown>,
      after: { assignmentType: 'unassigned' },
    })

    const r = await withAudit(this.audit, safeSpec, async (txn) => {
      ;(txn as unknown as Transaction).set(ref, patch, { merge: true })
      return { value: undefined as unknown as void }
    })

    const next = await this.getLicense(id)
    if (!next) throw new Error('License decouple succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }

  async retireLicense(
    id: string,
    assetId: string,
    actor: Actor,
  ): Promise<AuditedResult<WorkstationLicense>> {
    const existing = await this.getLicense(id)
    if (!existing) throw new Error(`WorkstationLicense not found: ${id}`)

    const before = {
      assignmentType: existing.assignmentType,
      assignedToAssetId: existing.assignedToAssetId ?? null,
      assignedToEmployeeId: existing.assignedToEmployeeId ?? null,
      lifecycleStatus: existing.lifecycleStatus,
    }

    const ref = doc(this.db, COL, id)
    const patch: Record<string, unknown> = {
      lifecycleStatus: 'retired',
      retiredAt: serverTimestamp(),
      retiredWithAssetId: assetId,
      assignmentType: 'unassigned',
      assignedToAssetId: null,
      assignedToEmployeeId: null,
      assignedAt: null,
      assignedBy: null,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    }

    const safeSpec = sanitizeLicenseAuditPayload({
      entityType: 'license' as const,
      entityId: id,
      action: 'license_retired_with_asset' as const,
      actorUid: actor.uid,
      actorRole: actor.role, actorName: actor.displayName ?? null,
      before: before as Record<string, unknown>,
      after: { lifecycleStatus: 'retired', retiredWithAssetId: assetId },
    })

    const r = await withAudit(this.audit, safeSpec, async (txn) => {
      ;(txn as unknown as Transaction).set(ref, patch, { merge: true })
      return { value: undefined as unknown as void }
    })

    const next = await this.getLicense(id)
    if (!next) throw new Error('License retire succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }

  // Secret persistence is owned by the setLicenseKey Cloud Function; this method only records
  // the rotation + masked audit. Callers persist the raw key via the callable.
  async rotateKey(
    id: string,
    rawKey: string,
    actor: Actor,
  ): Promise<AuditedResult<WorkstationLicense>> {
    const existing = await this.getLicense(id)
    if (!existing) throw new Error(`WorkstationLicense not found: ${id}`)

    const ref = doc(this.db, COL, id)
    const patch: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    }

    const safeSpec = sanitizeLicenseAuditPayload({
      entityType: 'license' as const,
      entityId: id,
      action: 'key_rotated' as const,
      actorUid: actor.uid,
      actorRole: actor.role, actorName: actor.displayName ?? null,
      before: null,
      after: { id, key: rawKey } as Record<string, unknown>,
    })

    const r = await withAudit(this.audit, safeSpec, async (txn) => {
      ;(txn as unknown as Transaction).set(ref, patch, { merge: true })
      return { value: undefined as unknown as void }
    })

    const next = await this.getLicense(id)
    if (!next) throw new Error('License rotateKey succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }
}
