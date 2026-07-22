/**
 * Port (interface) for the parts-warehouse category catalog.
 * Implementations: firestorePartCategoryRepository (production),
 *                  inMemoryPartCategoryRepository (tests/dev).
 *
 * CONTRACT: every mutating method MUST run inside withAudit(entityType: 'part_category')
 * in the implementing adapter so the doc write and exactly one audit_log entry land
 * in the same Firestore transaction.
 *
 * NO delete method — deletion is forbidden by Firestore rules (`allow delete: if false`).
 * Deactivation is `update(id, { active: false }, actor)`.
 *
 * NO Firebase, NO React — pure domain port.
 */

import type { Actor } from '@/domain/asset/AssetRepository'
import type { AuditedResult } from '@/domain/audit'
import type { PartCategoryBehavior, PartCategoryDef, PartCategoryVariant } from './partCategory-types'

export interface CreatePartCategoryInput {
  /** Optional slug id; generated from the en name when absent. */
  id?: string
  name: { ru: string; en: string; hy: string }
  icon: string
  tintToken: string
  order: number
  /** Set once at creation — immutable data class. */
  behavior: PartCategoryBehavior
  slotKind: string
  storageType?: 'SSD' | 'HDD' | 'M.2' | null
  variants?: PartCategoryVariant[] | null
  generations?: PartCategoryVariant[] | null
}

/**
 * `behavior` is deliberately absent — it is an immutable data class.
 * Firestore rules enforce `request.resource.data.behavior == resource.data.behavior`
 * on every update.
 */
export interface UpdatePartCategoryInput {
  name?: { ru: string; en: string; hy: string }
  icon?: string
  tintToken?: string
  order?: number
  active?: boolean
  variants?: PartCategoryVariant[] | null
  generations?: PartCategoryVariant[] | null
}

/**
 * Read/write port for part_categories.
 *
 * All mutating methods must run inside withAudit(entityType: 'part_category') in the
 * implementing adapter. Actions: 'created' for create, 'updated' for update (including
 * deactivation — before/after capture the `active` flip, mirroring how CategoryRepository
 * audits deactivation).
 */
export interface PartCategoryRepository {
  /**
   * Returns ALL category definitions including inactive ones (management UI filters
   * on `active`; warehouse UI filters externally). Ordered by `order` ascending.
   */
  listAll(): Promise<PartCategoryDef[]>

  /**
   * Creates a new part category and writes a 'created' audit_log entry in the same
   * transaction. Returns the persisted PartCategoryDef and the audit entry id.
   */
  create(input: CreatePartCategoryInput, actor: Actor): Promise<AuditedResult<PartCategoryDef>>

  /**
   * Updates mutable fields of an existing part category and writes an 'updated'
   * audit_log entry in the same transaction. Returns the updated PartCategoryDef
   * and the audit entry id.
   *
   * To deactivate: `update(id, { active: false }, actor)`.
   */
  update(id: string, patch: UpdatePartCategoryInput, actor: Actor): Promise<AuditedResult<PartCategoryDef>>
}
