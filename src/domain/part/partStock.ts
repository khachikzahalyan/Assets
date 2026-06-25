// src/domain/part/partStock.ts
//
// Pure stock-derivation + slot-resolution helpers for the parts warehouse.
// NO Firebase, NO localStorage, NO React — these run identically in adapters
// (production + in-memory) and in unit tests.
//
// Ported directly from the prototype's deterministic logic:
//   · stock math      → Warehouse/prototypes/parts.html lines 3086-3108 (skuStockMap)
//   · slot resolution → Warehouse/prototypes/_shared/mock-data.js lines 1360-1428
//   · family/service  → mock-data.js lines 337-360
//
// assetFamilyOf REUSES the production asset-domain category id sets
// (LAPTOP_CATEGORY_IDS, SERVER_CATEGORY_IDS from categoryCapabilities.ts) so the
// taxonomy can never drift between the asset module and the parts module.

import { LAPTOP_CATEGORY_IDS, SERVER_CATEGORY_IDS } from '@/domain/asset/categoryCapabilities'
import type { AssetSpecs } from '@/domain/asset/types'
import type { PartCategory, PartStock, UpgradeSlot } from './types'

export type AssetFamily = 'laptop' | 'desktop' | 'server' | null

/**
 * Desktop / all-in-one family ids (NON-laptop, NON-server upgradeables). Mirrors the
 * prototype CATEGORY_FAMILY desktop entries (mock-data.js 351-352). Kept local because
 * the production `COMPUTER_CATEGORY_IDS` set in categoryCapabilities.ts is not exported;
 * the two lists are identical and must stay in sync.
 */
export const DESKTOP_CATEGORY_IDS: ReadonlySet<string> = new Set([
  'cat_desktop', 'cat_computer', 'cat_workstation', 'cat_mini_pc', 'cat_aio',
])

/**
 * Resolve an asset category id to its hardware family. Reuses the asset domain's
 * authoritative id sets; returns null for non-upgradeable categories.
 * Port of mock-data.js `familyOf` (356) over CATEGORY_FAMILY (347-355).
 */
export function assetFamilyOf(categoryId: string): AssetFamily {
  if (LAPTOP_CATEGORY_IDS.has(categoryId)) return 'laptop'
  if (SERVER_CATEGORY_IDS.has(categoryId)) return 'server'
  if (DESKTOP_CATEGORY_IDS.has(categoryId)) return 'desktop'
  return null
}

/**
 * Service-only devices (laptops + All-in-One) route component swaps through an external
 * service centre: the change is RECORDED but warehouse stock NEVER changes. In-house
 * devices (desktops sans AIO + servers) consume stock normally.
 * Port of mock-data.js `isServiceOnly` (360).
 */
export function isServiceOnly(categoryId: string): boolean {
  return assetFamilyOf(categoryId) === 'laptop' || categoryId === 'cat_aio'
}

/**
 * Derive per-SKU stock snapshots from the full movement journal.
 * Port of parts.html `skuStockMap` (3086-3108).
 *   · serviceReplace movements are SKIPPED entirely (never affect stock).
 *   · receive   → +onHand
 *   · install   → −onHand
 *   · uninstall → broken ? +broken : +onHand
 *   · negatives clamped to 0 defensively.
 * Sums commute, so chronological order does not matter.
 */
export function deriveStock(
  movements: ReadonlyArray<{
    type: string
    skuId: string
    qty?: number
    broken?: boolean
    serviceReplace?: boolean
  }>,
): Record<string, PartStock> {
  const map: Record<string, PartStock> = {}
  const ensure = (sid: string): PartStock => {
    const existing = map[sid]
    if (existing) return existing
    const fresh: PartStock = { onHand: 0, broken: 0 }
    map[sid] = fresh
    return fresh
  }
  for (const m of movements) {
    if (!m.skuId) continue
    if (m.serviceReplace) continue // service movements never affect warehouse stock
    const q = m.qty ?? 1
    const e = ensure(m.skuId)
    if (m.type === 'receive') e.onHand += q
    else if (m.type === 'install') e.onHand -= q
    else if (m.type === 'uninstall') {
      if (m.broken) e.broken += q
      else e.onHand += q
    }
  }
  for (const sid of Object.keys(map)) {
    const e = map[sid]!
    if (e.onHand < 0) e.onHand = 0
    if (e.broken < 0) e.broken = 0
  }
  return map
}

/** Working stock displayed in the UI. Port of spec §3: max(0, onHand − broken). */
export function workingStock(s: PartStock): number {
  return Math.max(0, s.onHand - s.broken)
}

/**
 * SKU-category → upgradeCurrent slot kind (excluding the family-dependent psu case).
 * Port of mock-data.js SKU_TO_SLOT_KIND (1367-1373).
 */
const SKU_TO_SLOT_KIND: Partial<Record<PartCategory, string>> = {
  ram: 'ram',
  ssd: 'storage',
  hdd: 'storage',
  nvme: 'storage',
  cooler: 'cooler',
}

const SKU_TO_STORAGE_TYPE: Partial<Record<PartCategory, 'SSD' | 'HDD' | 'M.2'>> = {
  ssd: 'SSD',
  hdd: 'HDD',
  nvme: 'M.2',
}

/**
 * Resolve a SKU category to the asset's slot kind. `psu` → 'battery' on the laptop
 * family, else 'psu'. Port of mock-data.js `slotKindForSku` (1376-1381).
 * Returns null for categories with no asset slot (e.g. 'gpu' is not slot-mapped here).
 */
export function slotKindForSku(skuCat: PartCategory, assetFamily: AssetFamily): string | null {
  if (skuCat === 'psu') {
    return assetFamily === 'laptop' ? 'battery' : 'psu'
  }
  return SKU_TO_SLOT_KIND[skuCat] ?? null
}

/**
 * Storage-type tag for a storage SKU category. Port of mock-data.js
 * `storageTypeForSku` (1383-1385).
 */
export function storageTypeForSku(skuCat: PartCategory): 'SSD' | 'HDD' | 'M.2' | null {
  return SKU_TO_STORAGE_TYPE[skuCat] ?? null
}

/**
 * Single-slot vs multi-slot resolution. Port of mock-data.js `slotIsSingle` (1392-1398).
 *   · battery        → always 1 (laptops only)
 *   · cooler / psu   → 1 on non-servers, N on servers
 *   · ram / storage  → always N
 */
export function slotIsSingle(slotKind: string, assetFamily: AssetFamily): boolean {
  if (slotKind === 'battery') return true
  if (slotKind === 'cooler' || slotKind === 'psu') {
    return assetFamily !== 'server'
  }
  return false
}

/**
 * Human-readable slot label for a given slot kind.
 * Port of mock-data.js `SLOT_LABEL` + `slotLabelFor` (1400-1409).
 */
const SLOT_LABEL: Record<string, string> = {
  ram:     'ОЗУ',
  storage: 'Накопитель',
  cooler:  'Кулер',
  psu:     'Блок питания',
  battery: 'Аккумулятор',
}

export function slotLabelFor(slotKind: string): string {
  return SLOT_LABEL[slotKind] ?? slotKind
}

/** One occupied/empty slot candidate for a given SKU category on an asset. */
export interface SlotCandidate {
  idx: number
  slot: UpgradeSlot
  isEmpty: boolean
}

/**
 * Current parts on an asset that compete for the SKU category's slot. Returns
 * [{ idx, slot, isEmpty }] where idx is the index into upgradeCurrent.
 * Port of mock-data.js `currentPartsForSkuCategory` (1417-1428).
 *
 * IMPORTANT: storage cats (ssd/hdd/nvme) share one physical bay pool, so we filter by
 * resolved slotKind ONLY — NOT by storageType. Empty-spec entries still count (a real
 * but empty factory slot).
 */
export function currentPartsForSkuCategory(
  upgradeCurrent: ReadonlyArray<UpgradeSlot> | null | undefined,
  skuCat: PartCategory,
  assetFamily: AssetFamily,
): SlotCandidate[] {
  if (!Array.isArray(upgradeCurrent)) return []
  const slotKind = slotKindForSku(skuCat, assetFamily)
  if (!slotKind) return []
  const out: SlotCandidate[] = []
  for (let i = 0; i < upgradeCurrent.length; i++) {
    const s = upgradeCurrent[i]!
    if (s.kind !== slotKind) continue
    out.push({ idx: i, slot: s, isEmpty: !s.spec || s.spec === '' })
  }
  return out
}

/**
 * Synthesize the installed-component slots for an asset from its create-form
 * specs (`currentSpecs`: ram / ssd / gpu) plus factory defaults (cooler, and
 * psu for desktop/server or battery for laptop).
 *
 * Used by the Parts «Установлено» tab so a device that was created in the
 * Assets section — and therefore has `currentSpecs` but no explicit
 * `upgradeCurrent` array yet — still shows its real components (RAM, storage,
 * GPU + factory cooler/PSU) exactly like the asset-detail Tech-Specs tiles.
 *
 * Mirrors the prototype's baselineUpgradesFor (factory config by family) but
 * uses the asset's ACTUAL entered specs instead of mock values. Returns [] for
 * non-upgradeable categories. Factory slots carry `spec: ''` (rendered as
 * «Заводской» / «Конфиг.»); spec'd slots carry the entered value.
 */
export function synthesizeInstalledSlots(
  categoryId: string,
  specs: AssetSpecs | null | undefined,
): UpgradeSlot[] {
  const family = assetFamilyOf(categoryId)
  if (family === null) return []

  const slots: UpgradeSlot[] = []
  // PSU — desktop/server only (factory); laptops carry a battery instead.
  if (family === 'desktop' || family === 'server') {
    slots.push({ kind: 'psu', spec: '' })
  }
  // RAM — from the entered create-form spec.
  if (specs?.ram) slots.push({ kind: 'ram', spec: specs.ram })
  // Storage — the create form captures a single drive in `ssd`.
  if (specs?.ssd) slots.push({ kind: 'storage', spec: specs.ssd, storageType: 'SSD' })
  // GPU — from the entered create-form spec.
  if (specs?.gpu) slots.push({ kind: 'gpu', spec: specs.gpu })
  // Cooler — factory default for every computer-class family.
  slots.push({ kind: 'cooler', spec: '' })
  // Battery — laptops only (factory).
  if (family === 'laptop') slots.push({ kind: 'battery', spec: '' })

  return slots
}
