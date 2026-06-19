import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import type {
  ServerLicense,
  CreateServerLicenseInput,
} from '@/domain/license'
import type { ServerLicenseRepository, ServerLicenseListQuery } from '@/domain/license'
import {
  withAudit,
  type AuditContext,
} from '@/lib/audit'
import { maskLicenseKey, sanitizeLicenseAuditPayload } from '@/lib/audit'

export class InMemoryServerLicenseRepository implements ServerLicenseRepository {
  private docs = new Map<string, ServerLicense>()
  private secrets = new Map<string, string>() // licenseId -> RAW key, never in docs
  private seq = 0

  constructor(
    private readonly ctx: AuditContext,
  ) {}

  // ---- Helpers ---------------------------------------------------------------

  private nextId(): string {
    return `srv_${++this.seq}`
  }

  private cloneDoc(doc: ServerLicense): ServerLicense {
    return { ...doc }
  }

  // ---- Reads -----------------------------------------------------------------

  async getLicense(id: string): Promise<ServerLicense | null> {
    const doc = this.docs.get(id)
    return doc ? this.cloneDoc(doc) : null
  }

  async listLicenses(q?: ServerLicenseListQuery): Promise<ServerLicense[]> {
    let results = Array.from(this.docs.values()).map(d => this.cloneDoc(d))

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
    const id = this.nextId()
    const now = new Date().toISOString()

    const doc: ServerLicense = {
      id,
      name: input.name,
      vendor: input.vendor ?? null,
      type: input.type,
      environment: input.environment ?? null,
      host: input.host ?? null,
      expiresAt: input.expiresAt ?? null,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.uid,
      updatedBy: actor.uid,
    }

    // Build audit after payload — key is masked if present, never raw
    const afterPayload: Record<string, unknown> = {
      id,
      name: doc.name,
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

    return withAudit(this.ctx, safeSpec, async () => {
      this.docs.set(id, doc)
      if (input.rawKey) {
        this.secrets.set(id, input.rawKey)
      }
      return { value: this.cloneDoc(doc) }
    })
  }

  async updateLicense(
    id: string,
    patch: Partial<Pick<ServerLicense, 'name' | 'vendor' | 'environment' | 'host' | 'expiresAt'>>,
    actor: Actor,
  ): Promise<AuditedResult<ServerLicense>> {
    const existing = this.docs.get(id)
    if (!existing) throw new Error(`ServerLicense not found: ${id}`)

    const now = new Date().toISOString()
    const updated: ServerLicense = {
      ...existing,
      ...stripUndefined(patch),
      updatedAt: now,
      updatedBy: actor.uid,
    }

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
        name: updated.name,
        vendor: updated.vendor,
        environment: updated.environment,
        host: updated.host,
        expiresAt: updated.expiresAt,
      } as Record<string, unknown>,
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
  ): Promise<AuditedResult<ServerLicense>> {
    const existing = this.docs.get(id)
    if (!existing) throw new Error(`ServerLicense not found: ${id}`)

    const now = new Date().toISOString()
    const updated: ServerLicense = {
      ...existing,
      updatedAt: now,
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

    return withAudit(this.ctx, safeSpec, async () => {
      this.secrets.set(id, rawKey)
      this.docs.set(id, updated)
      return { value: this.cloneDoc(updated) }
    })
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined),
  ) as Partial<T>
}
