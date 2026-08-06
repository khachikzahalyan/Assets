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

/**
 * Maximum number of part_movements journal entries fetched from Firestore
 * per loadReferenceData() call (applied as a server-side limit in the adapter).
 *
 * Rationale (P0 quota fix, 2026-08-05): the journal grows without bound as
 * installs/uninstalls accumulate. Without a limit, every Parts page load burns
 * O(journal size) reads and quickly exhausts the Spark plan's 50 k daily read
 * quota. A cap of 1 000 covers several years of typical usage per device while
 * keeping each page load well under 1 k billed reads.
 *
 * Impact on display: journal-derived display niceties — running «Осталось N шт»
 * labels, the header «installed» counter, replace-stats — silently cover only
 * the most recent CAP movements once the journal exceeds it. These are display
 * niceties only; the authoritative onHand/broken stock is the SKU doc snapshot
 * (P1.1 decision) and is never affected by the cap.
 */
export const PARTS_MOVEMENTS_CAP = 1_000

import { LAPTOP_CATEGORY_IDS, SERVER_CATEGORY_IDS } from '@/domain/asset/categoryCapabilities'
import type { AssetSpecs } from '@/domain/asset/types'
import type { PartCategory, PartStock, UpgradeSlot } from './types'
import { SlotKindMismatchError } from './errors'

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
 * Resolve which upgradeCurrent index a replace-install must overwrite.
 * SINGLE source of truth for BOTH write adapters (Firestore + in-memory) so a
 * `action:'replace'` can never silently degrade into an append.
 *
 * Rules:
 *   1. Explicit valid `requestedIndex` → guard the slot's kind against
 *      slotKindForSku (throws SlotKindMismatchError on mismatch), return it.
 *   2. null / out-of-range index → resolve the same way the UI does, via
 *      currentPartsForSkuCategory over the SAME array the txn will mutate:
 *        · exactly ONE occupied slot → replace it (the only sane target);
 *        · ZERO occupied slots      → return null = append as a TRUE add
 *                                     (nothing exists to replace);
 *        · TWO OR MORE occupied     → throw — the target is ambiguous and
 *                                     guessing would reintroduce the
 *                                     silent-append bug.
 */
export function resolveReplaceTargetIndex(
  upgradeCurrent: ReadonlyArray<UpgradeSlot>,
  skuCat: PartCategory,
  assetFamily: AssetFamily,
  requestedIndex: number | null,
): number | null {
  const expectedKind = slotKindForSku(skuCat, assetFamily)

  if (
    requestedIndex !== null &&
    requestedIndex >= 0 &&
    requestedIndex < upgradeCurrent.length
  ) {
    const slot = upgradeCurrent[requestedIndex]!
    if (expectedKind && slot.kind !== expectedKind) {
      throw new SlotKindMismatchError(requestedIndex, expectedKind, slot.kind)
    }
    return requestedIndex
  }

  // Fallback: index missing/invalid — resolve from the occupied slots of the
  // SKU's kind (currentPartsForSkuCategory already filters by resolved kind,
  // so the kind guard is inherent here).
  const occupied = currentPartsForSkuCategory(upgradeCurrent, skuCat, assetFamily)
    .filter(c => !c.isEmpty)
  if (occupied.length === 1) return occupied[0]!.idx
  if (occupied.length === 0) return null // nothing to replace → true add
  throw new Error(
    `installPart: replace target ambiguous — ${occupied.length} occupied '${expectedKind}' slots; replaceUcIndex is required`,
  )
}

/**
 * Detect the storage subtype token in a single-disk spec label. NVMe is folded
 * to 'M.2' to match this system's SKU_TO_STORAGE_TYPE mapping (nvme → 'M.2').
 * Returns null when no known token is present.
 */
const STORAGE_TYPE_MATCHERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(^|[\s,/])M\.2(?=[\s,/]|$)/i, 'M.2'],
  [/(^|[\s,/])NVMe(?=[\s,/]|$)/i, 'M.2'],
  [/(^|[\s,/])SAS(?=[\s,/]|$)/i, 'SAS'],
  [/(^|[\s,/])SSD(?=[\s,/]|$)/i, 'SSD'],
  [/(^|[\s,/])HDD(?=[\s,/]|$)/i, 'HDD'],
]

function detectStorageType(label: string): string | null {
  for (const [re, type] of STORAGE_TYPE_MATCHERS) if (re.test(label)) return type
  return null
}

/**
 * A storage slot must represent ONE physical disk. The create form serializes
 * multiple disks into a single `ssd` spec joined by " + " (e.g.
 * "SSD 512 ГБ + HDD 1 ТБ"), and older part installs also persisted that combined
 * string into one upgradeCurrent slot. Split any such storage slot into one slot
 * per disk so each drive is shown and replaced independently (SSD / HDD / M.2 are
 * distinct parts). Non-storage slots and single-disk storage slots pass through
 * unchanged. Applied to BOTH the synthesized base and the stored explicit slots so
 * assets built under the old combined behaviour self-heal on read.
 */
export function expandStorageSlots(slots: ReadonlyArray<UpgradeSlot>): UpgradeSlot[] {
  const out: UpgradeSlot[] = []
  for (const s of slots) {
    if (s.kind === 'storage' && typeof s.spec === 'string' && s.spec.includes('+')) {
      const disks = s.spec.split(/\s*\+\s*/).map(d => d.trim()).filter(Boolean)
      if (disks.length > 1) {
        for (const disk of disks) {
          const t = detectStorageType(disk)
          out.push({ ...s, spec: disk, ...(t ? { storageType: t } : {}) })
        }
        continue
      }
    }
    out.push({ ...s })
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

  // Storage is entered as one combined `ssd` string; split it into per-disk slots
  // so SSD / HDD / M.2 each show and replace independently.
  return expandStorageSlots(slots)
}

/**
 * Resolve an asset's live installed-component slots — the SINGLE source of truth
 * shared by the read projection, the install/uninstall write paths, AND the
 * asset-detail Tech-Specs tiles.
 *
 * Always starts from the full synthesized set (factory cooler/psu/battery +
 * ram/storage/gpu from `currentSpecs`), then OVERLAYS the explicit
 * `upgradeCurrent` (a prior install/uninstall) onto it by kind + rank — so a
 * replaced slot keeps its new spec + `replaced:true`, and any extra parts beyond
 * the factory count (a 2nd RAM stick, etc.) are appended.
 *
 * Why merge instead of "explicit-or-synthesize": before this fix, a single
 * replace persisted a 1-slot array, and a plain "prefer explicit" read would
 * keep showing just that slot forever. Merging onto the synthesized base means
 * the «Установлено» list can NEVER collapse — and assets already broken by the
 * old behaviour self-heal on the next read. Returns a fresh, mutable copy.
 */
export function resolveUpgradeCurrent(
  categoryId: string,
  specs: AssetSpecs | null | undefined,
  explicit: ReadonlyArray<UpgradeSlot> | null | undefined,
): UpgradeSlot[] {
  const base = synthesizeInstalledSlots(categoryId, specs)
  if (!Array.isArray(explicit) || explicit.length === 0) return base

  // Split any combined storage slot the same way the base is split, so per-disk
  // ranks line up on overlay (else a stored "SSD 512 + HDD 1 ТБ" slot would
  // recombine the base's two disks into one).
  const explicitSlots = expandStorageSlots(explicit)

  // Group explicit slots by kind so we can overlay them in order onto the base.
  const byKind = new Map<string, UpgradeSlot[]>()
  for (const s of explicitSlots) {
    const arr = byKind.get(s.kind)
    if (arr) arr.push(s)
    else byKind.set(s.kind, [s])
  }

  // Overlay: each base slot takes the matching stored slot's fields (stored wins
  // — it reflects the latest install/replace), tracked per-kind by rank.
  const rank = new Map<string, number>()
  const merged: UpgradeSlot[] = base.map(slot => {
    const r = rank.get(slot.kind) ?? 0
    rank.set(slot.kind, r + 1)
    const stored = byKind.get(slot.kind)?.[r]
    return stored ? { ...slot, ...stored } : { ...slot }
  })

  // Append extra stored parts of each kind beyond the synthesized factory count
  // (user-added parts the factory set doesn't account for).
  for (const [kind, arr] of byKind) {
    for (let i = rank.get(kind) ?? 0; i < arr.length; i++) merged.push({ ...arr[i]! })
  }

  // Single-slot kinds (laptop battery; non-server PSU/cooler) collapse to EXACTLY
  // ONE row: «Заменено» (spec cleared) once the part was ever replaced/installed,
  // else the factory row. Replacing 10× never yields 10 rows — the full history
  // lives in the «История» tab. Multi-slot kinds (RAM, storage, server PSU/cooler)
  // keep every row.
  const family = assetFamilyOf(categoryId)
  const out: UpgradeSlot[] = []
  const seenSingle = new Set<string>()
  for (const slot of merged) {
    if (!slotIsSingle(slot.kind, family)) { out.push(slot); continue }
    if (seenSingle.has(slot.kind)) continue
    seenSingle.add(slot.kind)
    const stored = byKind.get(slot.kind) ?? []
    const touched = stored.some(s => s.replaced === true || (typeof s.spec === 'string' && s.spec.trim() !== ''))
    if (!touched) { out.push({ kind: slot.kind, spec: '', replaced: false }); continue }
    const installedAt = stored.reduce<string | undefined>(
      (acc, s) => (s.installedAt && (!acc || s.installedAt > acc) ? s.installedAt : acc),
      undefined,
    )
    out.push({ kind: slot.kind, spec: '', replaced: true, ...(installedAt ? { installedAt } : {}) })
  }
  return out
}

// ---------------------------------------------------------------------------
// slotReplacementStats
// ---------------------------------------------------------------------------

export interface SlotReplacementStats { count: number; lastAt: string | null }

/**
 * How many times the given slot KIND was installed/replaced on an asset, plus the
 * most-recent install date — derived from the movement journal, since the collapsed
 * single-slot upgradeCurrent keeps no counter. Each install movement whose SKU resolves
 * to `slotKind` (via skuCategoryOf + slotKindForSku) counts once; the factory→first
 * install is replacement #1 (matches the «Заменено 1×» tile). serviceReplace installs
 * (e.g. laptop battery) are included.
 */
export function slotReplacementStats(
  movements: ReadonlyArray<{ type?: string; skuId?: string | null; assetId?: string | null; at?: string | null }>,
  skuCategoryOf: (skuId: string) => PartCategory | null,
  assetInternalId: string,
  slotKind: string,
  family: AssetFamily,
): SlotReplacementStats {
  const matches = movements.filter(m =>
    m.type === 'install' &&
    m.assetId === assetInternalId &&
    m.skuId &&
    slotKindForSku(skuCategoryOf(m.skuId) ?? '', family) === slotKind,
  )

  if (matches.length === 0) return { count: 0, lastAt: null }

  let lastAt: string | null = null
  for (const m of matches) {
    const at = m.at ?? null
    if (at && (!lastAt || at > lastAt)) lastAt = at
  }

  return { count: matches.length, lastAt }
}
