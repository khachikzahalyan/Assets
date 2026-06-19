import {
  collection, doc, getDoc, getDocs, serverTimestamp,
  type Firestore, type Transaction,
} from 'firebase/firestore'
import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import type {
  ServerLicense,
  CreateServerLicenseInput,
} from '@/domain/license'
import type { ServerLicenseRepository, ServerLicenseListQuery } from '@/domain/license'
import { firestoreAuditContext, withAudit } from '@/lib/audit'
import { maskLicenseKey, sanitizeLicenseAuditPayload } from '@/lib/audit'

const COL = 'server_licenses'

function toIso(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date(0).toISOString()
}

function toServerLicense(id: string, d: Record<string, unknown>): ServerLicense {
  return {
    id,
    name: String(d.name ?? ''),
    vendor: (d.vendor as string | null) ?? null,
    type: (d.type as ServerLicense['type']) ?? 'Server',
    environment: (d.environment as string | null) ?? null,
    host: (d.host as string | null) ?? null,
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

export class FirestoreServerLicenseRepository implements ServerLicenseRepository {
  constructor(private readonly db: Firestore) {}
  private get audit() { return firestoreAuditContext(this.db) }

  // ---- Reads -----------------------------------------------------------------

  async getLicense(id: string): Promise<ServerLicense | null> {
    const snap = await getDoc(doc(this.db, COL, id))
    return snap.exists() ? toServerLicense(snap.id, snap.data() as Record<string, unknown>) : null
  }

  async listLicenses(q?: ServerLicenseListQuery): Promise<ServerLicense[]> {
    const snap = await getDocs(collection(this.db, COL))
    let results = snap.docs.map(d => toServerLicense(d.id, d.data() as Record<string, unknown>))

    if (q?.search) {
      const term = q.search.trim().toLowerCase()
      results = results.filter(l =>
        [l.name, l.vendor].filter(Boolean).join(' ').toLowerCase().includes(term),
      )
    }

    return results.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }

  // ---- Mutations -------------------------------------------------------------

  async createLicense(
    input: CreateServerLicenseInput,
    actor: Actor,
  ): Promise<AuditedResult<ServerLicense>> {
    const ref = doc(collection(this.db, COL))
    const id = ref.id

    const docData: Record<string, unknown> = stripUndefinedFs({
      name: input.name,
      vendor: input.vendor ?? null,
      type: input.type,
      environment: input.environment ?? null,
      host: input.host ?? null,
      expiresAt: input.expiresAt ?? null,
      createdBy: actor.uid,
      updatedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    const afterPayload: Record<string, unknown> = {
      id,
      name: input.name,
      ...(input.rawKey ? { key: maskLicenseKey(input.rawKey) } : {}),
    }
    const safeSpec = sanitizeLicenseAuditPayload({
      entityType: 'server_license' as const,
      entityId: id,
      action: 'created' as const,
      actorUid: actor.uid,
      actorRole: actor.role,
      before: null,
      after: afterPayload,
    })

    const r = await withAudit(this.audit, safeSpec, async (txn) => {
      ;(txn as unknown as Transaction).set(ref, docData)
      if (input.rawKey) {
        const secretRef = doc(this.db, COL, id, 'secrets', 'current')
        ;(txn as unknown as Transaction).set(secretRef, {
          key: input.rawKey,
          updatedAt: serverTimestamp(),
          updatedBy: actor.uid,
        })
      }
      return { value: undefined as unknown as void }
    })

    const created = await this.getLicense(id)
    if (!created) throw new Error('ServerLicense create succeeded but readback failed')
    return { value: created, auditId: r.auditId }
  }

  async updateLicense(
    id: string,
    patch: Partial<Pick<ServerLicense, 'name' | 'vendor' | 'environment' | 'host' | 'expiresAt'>>,
    actor: Actor,
  ): Promise<AuditedResult<ServerLicense>> {
    const existing = await this.getLicense(id)
    if (!existing) throw new Error(`ServerLicense not found: ${id}`)

    const ref = doc(this.db, COL, id)
    const fields = stripUndefinedFs({
      ...patch,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    })

    const safeSpec = sanitizeLicenseAuditPayload({
      entityType: 'server_license' as const,
      entityId: id,
      action: 'updated' as const,
      actorUid: actor.uid,
      actorRole: actor.role,
      before: {
        name: existing.name,
        vendor: existing.vendor,
        environment: existing.environment,
        host: existing.host,
        expiresAt: existing.expiresAt,
      } as Record<string, unknown>,
      after: {
        name: patch.name ?? existing.name,
        vendor: patch.vendor !== undefined ? patch.vendor : existing.vendor,
        environment: patch.environment !== undefined ? patch.environment : existing.environment,
        host: patch.host !== undefined ? patch.host : existing.host,
        expiresAt: patch.expiresAt !== undefined ? patch.expiresAt : existing.expiresAt,
      } as Record<string, unknown>,
    })

    const r = await withAudit(this.audit, safeSpec, async (txn) => {
      ;(txn as unknown as Transaction).set(ref, fields, { merge: true })
      return { value: undefined as unknown as void }
    })

    const next = await this.getLicense(id)
    if (!next) throw new Error('ServerLicense update succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }

  async rotateKey(
    id: string,
    rawKey: string,
    actor: Actor,
  ): Promise<AuditedResult<ServerLicense>> {
    const existing = await this.getLicense(id)
    if (!existing) throw new Error(`ServerLicense not found: ${id}`)

    const ref = doc(this.db, COL, id)
    const secretRef = doc(this.db, COL, id, 'secrets', 'current')
    const patch: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    }

    const safeSpec = sanitizeLicenseAuditPayload({
      entityType: 'server_license' as const,
      entityId: id,
      action: 'key_rotated' as const,
      actorUid: actor.uid,
      actorRole: actor.role,
      before: null,
      after: { id, key: maskLicenseKey(rawKey) } as Record<string, unknown>,
    })

    const r = await withAudit(this.audit, safeSpec, async (txn) => {
      ;(txn as unknown as Transaction).set(ref, patch, { merge: true })
      ;(txn as unknown as Transaction).set(secretRef, {
        key: rawKey,
        updatedAt: serverTimestamp(),
        updatedBy: actor.uid,
      })
      return { value: undefined as unknown as void }
    })

    const next = await this.getLicense(id)
    if (!next) throw new Error('ServerLicense rotateKey succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }
}
