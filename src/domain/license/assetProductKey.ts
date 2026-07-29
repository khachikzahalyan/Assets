/**
 * Shared «what product key does this asset carry?» predicate.
 *
 * Owner rules (confirmed):
 *  - An OEM key is «вшит» into the device and is already active — an asset with
 *    a bound in_use OEM license (or whose category ASSUMES an embedded OEM key,
 *    see below) can NEVER receive another key: it is excluded from activation.
 *  - An asset whose key was entered MANUALLY (a bound in_use non-OEM license —
 *    Retail/Volume/Default) IS a valid activation target: activating a free key
 *    onto it is a KEY SWAP — the old key is freed (becomes «Свободен»), never
 *    silently lost. The UI must show the old key before the swap commits.
 *  - An asset in a category with the hasOemLicense capability is ASSUMED to
 *    carry an embedded OEM key even when no license doc exists (legacy assets)
 *    — the exact `oemCapAssumed` rule the asset-detail page (TechSpecsCard/
 *    LicenseBlock) uses to render the assumed «Windows · OEM» card. A bound
 *    license doc SUPERSEDES the assumption (data decides, not the UI): a laptop
 *    with a manually-entered Retail key is 'manual' even in an OEM-cap category.
 *    The assumption is suppressed for a disposed asset (on write-off a reusable
 *    key is decoupled and an OEM key is retired), mirroring the detail page.
 *
 * This module is the single source of that semantics — UI must not re-derive
 * it with local heuristics.
 */
import { ASSET_STATUS } from '../asset/types'
import type { WorkstationLicense } from './WorkstationLicense'

/** The license fields the binding check needs (subset of WorkstationLicense). */
export type LicenseBindingFacts = Pick<
  WorkstationLicense,
  'assignmentType' | 'lifecycleStatus' | 'assignedToAssetId'
>

/** License fields the key-SOURCE resolution needs (binding facts + id + type). */
export type LicenseKeySourceFacts = Pick<
  WorkstationLicense,
  'id' | 'type' | 'assignmentType' | 'lifecycleStatus' | 'assignedToAssetId'
>

/** The asset fields the predicate needs (subset of Asset). */
export interface AssetKeyFacts {
  id: string
  statusId: string
}

/** Category capability facts the predicate needs (subset of CategoryCapabilities). */
export interface KeyCapabilityFacts {
  /** Device-class category (Server/Computer/Laptop) — the only license-attachable assets. */
  hasSpecs: boolean
  /** Windows-family category — assumed to ship with a firmware-embedded OEM key. */
  hasOemLicense: boolean
}

/** Where the asset's current product key comes from. */
export type AssetKeySource = 'none' | 'manual' | 'oem'

export interface AssetKeyState {
  source: AssetKeySource
  /**
   * The bound in_use license backing the key. Always set for 'manual';
   * set for doc-backed 'oem'; null for cap-assumed 'oem' and for 'none'.
   */
  licenseId: string | null
}

/**
 * Ids of assets with ANY bound in_use license — device-bound + active, any type
 * (including keyless OEM docs whose key is embedded, hence never entered).
 */
export function collectKeyBoundAssetIds(
  licenses: readonly LicenseBindingFacts[],
): Set<string> {
  const ids = new Set<string>()
  for (const l of licenses) {
    if (l.assignmentType === 'device' && l.lifecycleStatus === 'active' && l.assignedToAssetId) {
      ids.add(l.assignedToAssetId)
    }
  }
  return ids
}

/**
 * Resolves the asset's current key state — the single source of truth shared by
 * the activation-pool builder and the ActivateKeyModal swap UI.
 *
 * Precedence: bound OEM doc > bound non-OEM (manual) doc > cap-assumed OEM
 * (hasOemLicense category, non-disposed) > none. A bound doc supersedes the
 * cap assumption because the doc records what is actually installed.
 */
export function resolveAssetKeyState(
  asset: AssetKeyFacts,
  licenses: readonly LicenseKeySourceFacts[],
  caps: Pick<KeyCapabilityFacts, 'hasOemLicense'>,
): AssetKeyState {
  let manualId: string | null = null
  for (const l of licenses) {
    if (l.assignmentType !== 'device' || l.lifecycleStatus !== 'active' || l.assignedToAssetId !== asset.id) continue
    if (l.type === 'OEM') return { source: 'oem', licenseId: l.id }
    if (manualId === null) manualId = l.id
  }
  if (manualId !== null) return { source: 'manual', licenseId: manualId }
  if (caps.hasOemLicense && asset.statusId !== ASSET_STATUS.disposed) {
    return { source: 'oem', licenseId: null }
  }
  return { source: 'none', licenseId: null }
}

/**
 * True when the asset already carries a product key:
 *  (a) any bound in_use license references it (any type incl. OEM), OR
 *  (b) its category assumes an embedded OEM key (hasOemLicense capability) and
 *      the asset is not disposed — same `oemCapAssumed` condition as the
 *      asset-detail page.
 */
export function assetHasProductKey(
  asset: AssetKeyFacts,
  boundAssetIds: ReadonlySet<string>,
  caps: Pick<KeyCapabilityFacts, 'hasOemLicense'>,
): boolean {
  if (boundAssetIds.has(asset.id)) return true
  return caps.hasOemLicense && asset.statusId !== ASSET_STATUS.disposed
}

/**
 * True when the asset is a valid target for activating a free Windows key:
 * a device-class asset (hasSpecs — Server/Computer/Laptop, the only categories
 * licenses may attach to), not written off, and whose current key is NOT an
 * embedded OEM key. A 'manual' key state is a valid target — activation then
 * becomes a KEY SWAP that frees the old license.
 */
export function isKeyActivationTarget(
  asset: AssetKeyFacts,
  keyState: AssetKeyState,
  caps: KeyCapabilityFacts,
): boolean {
  if (!caps.hasSpecs) return false
  // A written-off device is never an activation target (even though the OEM
  // assumption no longer brands it — its lifecycle is over).
  if (asset.statusId === ASSET_STATUS.disposed) return false
  return keyState.source !== 'oem'
}
