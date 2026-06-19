import type { Actor } from '@/domain/asset'
import type { AuditedResult } from '@/domain/audit'
import type { ServerLicense, CreateServerLicenseInput } from './ServerLicense'

/** Filters for the server-license list. */
export interface ServerLicenseListQuery {
  search?: string
}

/**
 * The ONLY server-license port. Super-admin write only.
 *
 * There are NO assignment methods — server licenses are never assigned to a
 * person or an asset, by construction.
 *
 * Secret read/write/reveal are PRIVATE members of the implementations and are
 * deliberately NOT on this interface. Every mutating method writes exactly one
 * audit entry and returns an {@link AuditedResult}.
 */
export interface ServerLicenseRepository {
  listLicenses(q?: ServerLicenseListQuery): Promise<ServerLicense[]>
  getLicense(id: string): Promise<ServerLicense | null>
  createLicense(input: CreateServerLicenseInput, actor: Actor): Promise<AuditedResult<ServerLicense>>
  updateLicense(
    id: string,
    patch: Partial<Pick<ServerLicense, 'name' | 'vendor' | 'environment' | 'host' | 'expiresAt'>>,
    actor: Actor,
  ): Promise<AuditedResult<ServerLicense>>
  rotateKey(id: string, rawKey: string, actor: Actor): Promise<AuditedResult<ServerLicense>>
}
