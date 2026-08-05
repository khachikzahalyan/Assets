/**
 * Collection-name constants, UPGRADEABLE_CATEGORY_IDS set, and pure
 * Firestore-doc → domain-type converters for the parts warehouse adapter.
 *
 * No side-effects; no Firebase SDK calls. Safe to import from any module.
 */

import type { Part, PartMovement, UpgradeSlot } from '@/domain/part/types'
import { DESKTOP_CATEGORY_IDS } from '@/domain/part/partStock'
import { SERVER_CATEGORY_IDS, LAPTOP_CATEGORY_IDS } from '@/domain/asset/categoryCapabilities'

// ---- Collection names -------------------------------------------------------

export const COL_PARTS = 'parts'
export const COL_MOVEMENTS = 'part_movements'
export const COL_ASSETS = 'assets'
export const COL_CATEGORIES = 'categories'

// ---- Upgradeable category ids (must match assetFamilyOf non-null set) -------
// These are the LAPTOP + DESKTOP + SERVER category ids as defined in partStock.ts
// and categoryCapabilities.ts. We query all assets and filter client-side because
// Firestore doesn't support OR across multiple categoryId values efficiently at MVP scale.
// Phase 2 note: consider a `isUpgradeable` field on the category doc for a server-side filter.

/** All upgradeable category ids = laptop + desktop + server. */
export const UPGRADEABLE_CATEGORY_IDS: ReadonlySet<string> = new Set([
  ...LAPTOP_CATEGORY_IDS,
  ...DESKTOP_CATEGORY_IDS,
  ...SERVER_CATEGORY_IDS,
])

// ---- Converters -------------------------------------------------------------

/**
 * Converts a Firestore Timestamp or string to ISO string.
 * Fallback is the CURRENT time (not epoch) because part movement records
 * without a timestamp should default to "now" for display ordering.
 * Do NOT replace with the canonical firestoreUtils.toIso — different intent.
 */
export function toIsoOrNow(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date().toISOString()
}

export function toPart(id: string, d: Record<string, unknown>): Part {
  return {
    id,
    name: String(d['name'] ?? ''),
    category: d['category'] as Part['category'],
    variantId: (d['variantId'] as string | null) ?? null,
    variantLabel: (d['variantLabel'] as string | null) ?? null,
    ddr: (d['ddr'] as string | null) ?? null,
    unit: String(d['unit'] ?? 'шт'),
    onHand: Number(d['onHand'] ?? 0),
    broken: Number(d['broken'] ?? 0),
    lowStockThreshold: Number(d['lowStockThreshold'] ?? 5),
    createdAt: toIsoOrNow(d['createdAt']),
    updatedAt: toIsoOrNow(d['updatedAt']),
    createdBy: String(d['createdBy'] ?? ''),
    updatedBy: String(d['updatedBy'] ?? ''),
  }
}

export function toMovement(id: string, d: Record<string, unknown>): PartMovement {
  return {
    id,
    type: d['type'] as PartMovement['type'],
    skuId: String(d['skuId'] ?? ''),
    qty: Number(d['qty'] ?? 0),
    broken: Boolean(d['broken']),
    assetId: (d['assetId'] as string | null) ?? null,
    assetInvCode: (d['assetInvCode'] as string | null) ?? null,
    serviceReplace: Boolean(d['serviceReplace']),
    ...(d['kindId'] !== undefined ? { kindId: (d['kindId'] as string | null) ?? null } : {}),
    ...(d['kindLabel'] !== undefined ? { kindLabel: (d['kindLabel'] as string | null) ?? null } : {}),
    note: (d['note'] as string | null) ?? null,
    reason: (d['reason'] as string | null) ?? null,
    actorUid: String(d['actorUid'] ?? ''),
    actorRole: d['actorRole'] as PartMovement['actorRole'],
    at: toIsoOrNow(d['at']),
    // Replace-install denormalisation (optional — conditional-spread keeps
    // exactOptionalPropertyTypes happy and old docs shape-identical).
    ...(typeof d['replacedSpec'] === 'string' && d['replacedSpec'] !== ''
      ? { replacedSpec: d['replacedSpec'] }
      : {}),
    ...(d['replacedStorageType'] !== undefined
      ? { replacedStorageType: (d['replacedStorageType'] as string | null) ?? null }
      : {}),
    ...(typeof d['replacedSlotIndex'] === 'number'
      ? { replacedSlotIndex: d['replacedSlotIndex'] }
      : {}),
    ...(d['oldDisposal'] === 'kept' || d['oldDisposal'] === 'broken'
      ? { oldDisposal: d['oldDisposal'] }
      : {}),
    // service movements only: display name of the field technician who performed the work.
    ...(typeof d['serviceActorName'] === 'string' && d['serviceActorName'] !== ''
      ? { serviceActorName: d['serviceActorName'] }
      : {}),
  }
}

export function toUpgradeSlots(raw: unknown): UpgradeSlot[] {
  if (!Array.isArray(raw)) return []
  return (raw as unknown[]).map((s): UpgradeSlot => {
    const o = s as Record<string, unknown>
    return {
      kind: String(o['kind'] ?? ''),
      spec: String(o['spec'] ?? ''),
      storageType: (o['storageType'] as string | null) ?? null,
      installedAt: (o['installedAt'] as string | null) ?? null,
      replaced: Boolean(o['replaced']),
    }
  })
}
