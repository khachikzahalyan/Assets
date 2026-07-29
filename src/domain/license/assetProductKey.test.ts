/**
 * assetProductKey — shared «what key does this asset carry?» predicate tests.
 *
 * Owner rules: an OEM key is «вшит» (embedded) and already active — an asset
 * with a bound in_use OEM key OR whose category assumes an embedded OEM key
 * (hasOemLicense cap, non-disposed) must never be offered as an activation
 * target. A MANUALLY-keyed asset (bound non-OEM in_use license) IS a target —
 * activation is a key swap that frees the old license.
 */
import { describe, it, expect } from 'vitest'
import {
  collectKeyBoundAssetIds,
  assetHasProductKey,
  resolveAssetKeyState,
  isKeyActivationTarget,
} from './assetProductKey'
import type { LicenseBindingFacts, LicenseKeySourceFacts, AssetKeyState } from './assetProductKey'
import { ASSET_STATUS } from '../asset/types'

function lic(overrides: Partial<LicenseBindingFacts> = {}): LicenseBindingFacts {
  return {
    assignmentType: 'device',
    lifecycleStatus: 'active',
    assignedToAssetId: 'ast_1',
    ...overrides,
  }
}

function keyLic(overrides: Partial<LicenseKeySourceFacts> = {}): LicenseKeySourceFacts {
  return {
    id: 'lic_1',
    type: 'Retail',
    assignmentType: 'device',
    lifecycleStatus: 'active',
    assignedToAssetId: 'ast_1',
    ...overrides,
  }
}

const ACTIVE = { id: 'ast_1', statusId: ASSET_STATUS.assigned }
const DISPOSED = { id: 'ast_1', statusId: ASSET_STATUS.disposed }

const OEM_CAP = { hasSpecs: true, hasOemLicense: true }    // Windows-family device (Ноутбук, ПК, Сервер)
const NO_OEM_CAP = { hasSpecs: true, hasOemLicense: false } // device-class without OEM assumption (e.g. MacBook)
const NON_DEVICE = { hasSpecs: false, hasOemLicense: false } // monitor / printer / furniture

const NONE_STATE: AssetKeyState = { source: 'none', licenseId: null }
const MANUAL_STATE: AssetKeyState = { source: 'manual', licenseId: 'lic_manual' }
const OEM_DOC_STATE: AssetKeyState = { source: 'oem', licenseId: 'lic_oem' }
const OEM_CAP_STATE: AssetKeyState = { source: 'oem', licenseId: null }

describe('collectKeyBoundAssetIds', () => {
  it('includes assets bound to a device+active license of ANY type (incl. keyless OEM docs)', () => {
    const ids = collectKeyBoundAssetIds([
      lic({ assignedToAssetId: 'ast_oem' }),
      lic({ assignedToAssetId: 'ast_retail' }),
    ])
    expect(ids.has('ast_oem')).toBe(true)
    expect(ids.has('ast_retail')).toBe(true)
  })

  it('excludes unassigned, retired and employee-assigned licenses', () => {
    const ids = collectKeyBoundAssetIds([
      lic({ assignmentType: 'unassigned', assignedToAssetId: null }),
      lic({ lifecycleStatus: 'retired', assignedToAssetId: 'ast_retired' }),
      lic({ assignmentType: 'employee', assignedToAssetId: null }),
    ])
    expect(ids.size).toBe(0)
  })
})

describe('assetHasProductKey', () => {
  it('true when a bound in_use license references the asset (even without OEM cap)', () => {
    const bound = new Set(['ast_1'])
    expect(assetHasProductKey(ACTIVE, bound, NO_OEM_CAP)).toBe(true)
  })

  it('true for a cap-assumed OEM asset — hasOemLicense category, active, NO license doc', () => {
    expect(assetHasProductKey(ACTIVE, new Set(), OEM_CAP)).toBe(true)
  })

  it('false for a keyless asset — no bound license, no OEM assumption', () => {
    expect(assetHasProductKey(ACTIVE, new Set(), NO_OEM_CAP)).toBe(false)
  })

  it('false for a disposed OEM-cap asset with no bound license (assumption suppressed — detail-page parity)', () => {
    expect(assetHasProductKey(DISPOSED, new Set(), OEM_CAP)).toBe(false)
  })
})

describe('resolveAssetKeyState', () => {
  it("bound in_use OEM doc → 'oem' with the license id", () => {
    const state = resolveAssetKeyState(ACTIVE, [keyLic({ id: 'lic_oem', type: 'OEM' })], NO_OEM_CAP)
    expect(state).toEqual({ source: 'oem', licenseId: 'lic_oem' })
  })

  it("bound in_use Retail (manual) doc → 'manual' with the license id", () => {
    const state = resolveAssetKeyState(ACTIVE, [keyLic({ id: 'lic_ret', type: 'Retail' })], NO_OEM_CAP)
    expect(state).toEqual({ source: 'manual', licenseId: 'lic_ret' })
  })

  it("bound manual doc SUPERSEDES the cap assumption — Retail key on an OEM-cap laptop is 'manual'", () => {
    const state = resolveAssetKeyState(ACTIVE, [keyLic({ id: 'lic_ret', type: 'Retail' })], OEM_CAP)
    expect(state).toEqual({ source: 'manual', licenseId: 'lic_ret' })
  })

  it('a bound OEM doc wins over a bound manual doc', () => {
    const state = resolveAssetKeyState(
      ACTIVE,
      [keyLic({ id: 'lic_ret', type: 'Retail' }), keyLic({ id: 'lic_oem', type: 'OEM' })],
      NO_OEM_CAP,
    )
    expect(state).toEqual({ source: 'oem', licenseId: 'lic_oem' })
  })

  it("no docs + OEM-cap category (active) → cap-assumed 'oem' with null licenseId", () => {
    expect(resolveAssetKeyState(ACTIVE, [], OEM_CAP)).toEqual({ source: 'oem', licenseId: null })
  })

  it("disposed OEM-cap asset with no docs → 'none' (assumption suppressed)", () => {
    expect(resolveAssetKeyState(DISPOSED, [], OEM_CAP)).toEqual({ source: 'none', licenseId: null })
  })

  it("keyless asset without OEM cap → 'none'", () => {
    expect(resolveAssetKeyState(ACTIVE, [], NO_OEM_CAP)).toEqual({ source: 'none', licenseId: null })
  })

  it('ignores unassigned, retired, employee-assigned and other-asset licenses', () => {
    const state = resolveAssetKeyState(ACTIVE, [
      keyLic({ id: 'l_un', assignmentType: 'unassigned', assignedToAssetId: null }),
      keyLic({ id: 'l_ret', lifecycleStatus: 'retired' }),
      keyLic({ id: 'l_emp', assignmentType: 'employee', assignedToAssetId: null }),
      keyLic({ id: 'l_other', assignedToAssetId: 'ast_other' }),
    ], NO_OEM_CAP)
    expect(state).toEqual({ source: 'none', licenseId: null })
  })
})

describe('isKeyActivationTarget', () => {
  it('an asset with a bound in_use OEM key is NOT a target (embedded key cannot be swapped)', () => {
    expect(isKeyActivationTarget(ACTIVE, OEM_DOC_STATE, OEM_CAP)).toBe(false)
    expect(isKeyActivationTarget(ACTIVE, OEM_DOC_STATE, NO_OEM_CAP)).toBe(false)
  })

  it('a cap-assumed-OEM asset (no license doc, hasOemLicense category, active) is NOT a target', () => {
    expect(isKeyActivationTarget(ACTIVE, OEM_CAP_STATE, OEM_CAP)).toBe(false)
  })

  it('a MANUAL-keyed asset IS a target — activation is a key swap that frees the old license', () => {
    expect(isKeyActivationTarget(ACTIVE, MANUAL_STATE, NO_OEM_CAP)).toBe(true)
    expect(isKeyActivationTarget(ACTIVE, MANUAL_STATE, OEM_CAP)).toBe(true)
  })

  it('a genuinely keyless device-class asset IS a target', () => {
    expect(isKeyActivationTarget(ACTIVE, NONE_STATE, NO_OEM_CAP)).toBe(true)
  })

  it('a disposed asset is never a target, even without any key data', () => {
    expect(isKeyActivationTarget(DISPOSED, NONE_STATE, NO_OEM_CAP)).toBe(false)
    expect(isKeyActivationTarget(DISPOSED, NONE_STATE, OEM_CAP)).toBe(false)
    expect(isKeyActivationTarget(DISPOSED, MANUAL_STATE, NO_OEM_CAP)).toBe(false)
  })

  it('a non-device-class asset (no hasSpecs) is never a target', () => {
    expect(isKeyActivationTarget(ACTIVE, NONE_STATE, NON_DEVICE)).toBe(false)
    expect(isKeyActivationTarget(ACTIVE, MANUAL_STATE, NON_DEVICE)).toBe(false)
  })
})
