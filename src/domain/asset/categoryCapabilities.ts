// src/domain/asset/categoryCapabilities.ts
//
// Authoritative, static capability taxonomy for AMS asset categories.
//
// Capabilities (does a category show a specs panel? an OEM-license section? a
// serial field? a furniture "Тип" field?) are INTRINSIC taxonomy config — a
// "Компьютер" always has specs + OEM license — NOT per-tenant business data, so a
// static table is the correct home (taxonomy config, not mock business data).
//
// This module is pure (no Firebase / React imports). It is the single derivation
// point consumed by both AssetCreateForm and AssetDetailPage via the re-exported
// `categoryCapabilities` alias in CategoryPicker.tsx.

import type { CategoryRow } from './types'

/**
 * Form capability flags derived from a category. Field set MUST stay identical to
 * the original interface that lived in CategoryPicker.tsx so nothing downstream
 * breaks.
 */
export interface CategoryCapabilities {
  hasBrandModel: boolean
  hasTypeField: boolean
  requiresSerial: boolean
  hasSpecs: boolean
  hasOemLicense: boolean
  isServer: boolean
  isLaptop: boolean
  isNetwork: boolean
  /** True ONLY for desktop computers and laptops — GPU field shown/stored only for these. */
  hasGpu: boolean
}

/**
 * Category ids whose RAM may be ECC (servers only). Re-homed here (the domain) so
 * the capability taxonomy is self-contained; specSuggestions.ts re-exports these.
 */
export const SERVER_CATEGORY_IDS: ReadonlySet<string> = new Set([
  'cat_server', 'cat_rack_server', 'cat_blade_server', 'cat_tower_server', 'cat_mainframe',
])

/** Category ids that support a work-mode toggle / count as laptops. */
export const LAPTOP_CATEGORY_IDS: ReadonlySet<string> = new Set([
  'cat_laptop', 'cat_ultrabook', 'cat_gaming_laptop',
  'cat_macbook_air', 'cat_macbook_pro', 'cat_thinkpad', 'cat_chromebook',
])

/**
 * Desktop/all-in-one computer families (NON-server, NON-laptop) that carry specs +
 * OEM license. Combined with LAPTOP_CATEGORY_IDS and SERVER_CATEGORY_IDS these form
 * the "full spec + OEM" set.
 */
const COMPUTER_CATEGORY_IDS: ReadonlySet<string> = new Set([
  'cat_computer', 'cat_desktop', 'cat_workstation', 'cat_mini_pc', 'cat_aio',
])

/**
 * Pure helper — returns true when a category id belongs to the GPU-capable families
 * (desktop computers and laptops). Safe to call with null/undefined (returns false).
 * Consumed by detailFormat.buildSpecsLines to gate the GPU spec tile.
 */
export function categoryHasGpu(id: string | null | undefined): boolean {
  return !!id && (COMPUTER_CATEGORY_IDS.has(id) || LAPTOP_CATEGORY_IDS.has(id))
}

/** Apple laptops: specs YES, but OS comes with the machine → OEM license NO. */
const APPLE_LAPTOP_IDS: ReadonlySet<string> = new Set([
  'cat_macbook_air', 'cat_macbook_pro',
])

/** Per-category capability overrides resolved from the static taxonomy. */
type CapabilityEntry = Partial<{
  hasSpecs: boolean
  hasOemLicense: boolean
  requiresSerial: boolean
  hasTypeField: boolean
}>

/**
 * Authoritative id+group source list. Mirrors `ALL_CATEGORY_SOURCE` (and therefore
 * `CORE_CATEGORY_SEED`) in scripts/seed/referenceData.ts. Embedded here rather than
 * imported so the domain layer stays pure and self-contained (scripts/ is outside
 * the app's tsconfig scope). Keep this list in sync with the seed source.
 */
const CATEGORY_SOURCE: ReadonlyArray<{ id: string; group: 'devices' | 'network' | 'furniture' }> = [
  // devices — computers / laptops
  { id: 'cat_computer', group: 'devices' },
  { id: 'cat_workstation', group: 'devices' },
  { id: 'cat_mini_pc', group: 'devices' },
  { id: 'cat_aio', group: 'devices' },
  { id: 'cat_laptop', group: 'devices' },
  { id: 'cat_ultrabook', group: 'devices' },
  { id: 'cat_gaming_laptop', group: 'devices' },
  { id: 'cat_macbook_air', group: 'devices' },
  { id: 'cat_macbook_pro', group: 'devices' },
  { id: 'cat_thinkpad', group: 'devices' },
  { id: 'cat_chromebook', group: 'devices' },
  { id: 'cat_desktop', group: 'devices' },
  // devices — external storage
  { id: 'cat_ext_hdd', group: 'devices' },
  { id: 'cat_ext_ssd', group: 'devices' },
  { id: 'cat_usb_flash', group: 'devices' },
  { id: 'cat_sd_card', group: 'devices' },
  // devices — display + AV
  { id: 'cat_monitor', group: 'devices' },
  { id: 'cat_ext_display', group: 'devices' },
  { id: 'cat_projector', group: 'devices' },
  { id: 'cat_smart_board', group: 'devices' },
  { id: 'cat_video_wall', group: 'devices' },
  { id: 'cat_webcam', group: 'devices' },
  { id: 'cat_ip_camera', group: 'devices' },
  { id: 'cat_camcorder', group: 'devices' },
  { id: 'cat_dslr', group: 'devices' },
  { id: 'cat_vcs', group: 'devices' },
  { id: 'cat_tv_panel', group: 'devices' },
  // devices — print + scan
  { id: 'cat_printer', group: 'devices' },
  { id: 'cat_mfp', group: 'devices' },
  { id: 'cat_label_printer', group: 'devices' },
  { id: 'cat_3d_printer', group: 'devices' },
  { id: 'cat_plotter', group: 'devices' },
  { id: 'cat_scanner', group: 'devices' },
  { id: 'cat_doc_scanner', group: 'devices' },
  { id: 'cat_shredder', group: 'devices' },
  { id: 'cat_laminator', group: 'devices' },
  { id: 'cat_binder', group: 'devices' },
  // devices — input
  { id: 'cat_keyboard', group: 'devices' },
  { id: 'cat_mouse', group: 'devices' },
  { id: 'cat_trackball', group: 'devices' },
  { id: 'cat_graphic_tablet', group: 'devices' },
  { id: 'cat_stylus', group: 'devices' },
  // devices — audio
  { id: 'cat_headset', group: 'devices' },
  { id: 'cat_headphones', group: 'devices' },
  { id: 'cat_speakers', group: 'devices' },
  { id: 'cat_microphone', group: 'devices' },
  { id: 'cat_conf_phone', group: 'devices' },
  { id: 'cat_audio_mixer', group: 'devices' },
  // devices — mobile + telephony
  { id: 'cat_phone', group: 'devices' },
  { id: 'cat_iphone', group: 'devices' },
  { id: 'cat_tablet', group: 'devices' },
  { id: 'cat_ipad', group: 'devices' },
  { id: 'cat_ip_phone', group: 'devices' },
  { id: 'cat_desk_phone', group: 'devices' },
  { id: 'cat_walkie_talkie', group: 'devices' },
  // devices — docking + accessories
  { id: 'cat_dock', group: 'devices' },
  { id: 'cat_kvm', group: 'devices' },
  { id: 'cat_hub', group: 'devices' },
  { id: 'cat_adapter', group: 'devices' },
  { id: 'cat_charger', group: 'devices' },
  { id: 'cat_powerbank', group: 'devices' },
  // devices — POS / specialized
  { id: 'cat_pos', group: 'devices' },
  { id: 'cat_card_reader', group: 'devices' },
  { id: 'cat_barcode', group: 'devices' },
  { id: 'cat_cash_drawer', group: 'devices' },
  { id: 'cat_receipt_printer', group: 'devices' },
  { id: 'cat_id_reader', group: 'devices' },
  { id: 'cat_fingerprint', group: 'devices' },
  { id: 'cat_signature_pad', group: 'devices' },
  // network — servers
  { id: 'cat_server', group: 'network' },
  { id: 'cat_rack_server', group: 'network' },
  { id: 'cat_blade_server', group: 'network' },
  { id: 'cat_tower_server', group: 'network' },
  { id: 'cat_mainframe', group: 'network' },
  // network — storage
  { id: 'cat_nas', group: 'network' },
  { id: 'cat_san', group: 'network' },
  { id: 'cat_tape_drive', group: 'network' },
  // network — gear
  { id: 'cat_router', group: 'network' },
  { id: 'cat_switch', group: 'network' },
  { id: 'cat_firewall', group: 'network' },
  { id: 'cat_ap', group: 'network' },
  { id: 'cat_access_point', group: 'network' },
  { id: 'cat_modem', group: 'network' },
  { id: 'cat_modem_4g', group: 'network' },
  { id: 'cat_repeater', group: 'network' },
  { id: 'cat_patch_panel', group: 'network' },
  { id: 'cat_load_balancer', group: 'network' },
  // network — power
  { id: 'cat_ups', group: 'network' },
  { id: 'cat_pdu', group: 'network' },
  { id: 'cat_surge', group: 'network' },
  { id: 'cat_generator', group: 'network' },
  // furniture
  { id: 'cat_desk', group: 'furniture' },
  { id: 'cat_standing_desk', group: 'furniture' },
  { id: 'cat_conf_table', group: 'furniture' },
  { id: 'cat_meet_tbl', group: 'furniture' },
  { id: 'cat_reception_desk', group: 'furniture' },
  { id: 'cat_l_desk', group: 'furniture' },
  { id: 'cat_corner_desk', group: 'furniture' },
  { id: 'cat_hot_desk', group: 'furniture' },
  { id: 'cat_side_table', group: 'furniture' },
  { id: 'cat_coffee_table', group: 'furniture' },
  { id: 'cat_chair', group: 'furniture' },
  { id: 'cat_office_chair', group: 'furniture' },
  { id: 'cat_exec_chair', group: 'furniture' },
  { id: 'cat_mesh_chair', group: 'furniture' },
  { id: 'cat_ergo_chair', group: 'furniture' },
  { id: 'cat_visitor_chair', group: 'furniture' },
  { id: 'cat_bar_stool', group: 'furniture' },
  { id: 'cat_lounge_chair', group: 'furniture' },
  { id: 'cat_sofa', group: 'furniture' },
  { id: 'cat_armchair', group: 'furniture' },
  { id: 'cat_bench', group: 'furniture' },
  { id: 'cat_cabinet', group: 'furniture' },
  { id: 'cat_file_cabinet', group: 'furniture' },
  { id: 'cat_locker', group: 'furniture' },
  { id: 'cat_bookshelf', group: 'furniture' },
  { id: 'cat_drawer_unit', group: 'furniture' },
  { id: 'cat_pedestal', group: 'furniture' },
  { id: 'cat_safe', group: 'furniture' },
  { id: 'cat_whiteboard', group: 'furniture' },
  { id: 'cat_corkboard', group: 'furniture' },
  { id: 'cat_flipchart', group: 'furniture' },
  { id: 'cat_coatrack', group: 'furniture' },
  { id: 'cat_umbrella_stand', group: 'furniture' },
  { id: 'cat_plant_stand', group: 'furniture' },
  { id: 'cat_trash_bin', group: 'furniture' },
  { id: 'cat_paper_bin', group: 'furniture' },
  { id: 'cat_mirror', group: 'furniture' },
  { id: 'cat_partition', group: 'furniture' },
  { id: 'cat_curtains', group: 'furniture' },
  { id: 'cat_carpet', group: 'furniture' },
]

/**
 * Builds the concrete, keyed capability record from the source list. Rules mirror
 * the prototype `_d` / `_n` / `_f` taxonomy:
 *  - Computer / laptop / server families → specs + OEM + serial.
 *  - Apple laptops → specs + serial, OEM license NO.
 *  - All other devices + non-server network → serial only.
 *  - Furniture → type field, no serial / specs / OEM.
 */
function buildCapabilityTaxonomy(): Record<string, CapabilityEntry> {
  const out: Record<string, CapabilityEntry> = {}
  for (const { id, group } of CATEGORY_SOURCE) {
    if (group === 'furniture') {
      out[id] = { hasTypeField: true, requiresSerial: false, hasSpecs: false, hasOemLicense: false }
      continue
    }
    const isFullSpec =
      COMPUTER_CATEGORY_IDS.has(id) || LAPTOP_CATEGORY_IDS.has(id) || SERVER_CATEGORY_IDS.has(id)
    if (isFullSpec) {
      out[id] = {
        hasSpecs: true,
        hasOemLicense: !APPLE_LAPTOP_IDS.has(id), // Apple laptops: specs yes, OEM no
        requiresSerial: true,
      }
      continue
    }
    // all other devices + non-server network gear
    out[id] = { hasSpecs: false, hasOemLicense: false, requiresSerial: true }
  }
  return out
}

/**
 * Static, concrete capability table keyed by category id. Covers every id in the
 * source taxonomy (and therefore the seeded core set).
 */
export const CATEGORY_CAPABILITY_TAXONOMY: Record<string, CapabilityEntry> = buildCapabilityTaxonomy()

/**
 * Derives the four raw capability flags from the static taxonomy + group, with NO
 * doc-flag layer and NO name heuristic. This is the single shared code path used by:
 *   - `resolveCategoryCapabilities()` (for the taxonomy+group resolution step), and
 *   - `deriveCategoryFlags()` (the exported helper for scripts / seeding / backfill).
 *
 * Resolution order per flag:
 *   a. Static taxonomy entry for `id` (if present, each flag is fully specified).
 *   b. Group-based defaults for unknown ids:
 *      furniture → hasTypeField:true, requiresSerial:false, hasSpecs:false, hasOemLicense:false
 *      non-furniture → requiresSerial:true, all others false.
 *
 * NOTE: for the `requiresSerial` flag inside a known entry, `entry.requiresSerial` may
 * be `undefined` for entries that only set other flags. The `?? (group !== 'furniture')`
 * fallback handles that case consistently.
 */
function taxonomyOrGroupDefault(
  id: string,
  group: 'devices' | 'network' | 'furniture',
): { hasSpecs: boolean; hasOemLicense: boolean; requiresSerial: boolean; hasTypeField: boolean } {
  const entry = CATEGORY_CAPABILITY_TAXONOMY[id]
  if (entry !== undefined) {
    return {
      hasSpecs: entry.hasSpecs ?? false,
      hasOemLicense: entry.hasOemLicense ?? false,
      requiresSerial: entry.requiresSerial ?? (group !== 'furniture'),
      hasTypeField: entry.hasTypeField ?? false,
    }
  }
  // Unknown id — group-based fallback (same heuristics used by both script duplicates).
  if (group === 'furniture') {
    return { hasSpecs: false, hasOemLicense: false, requiresSerial: false, hasTypeField: true }
  }
  return { hasSpecs: false, hasOemLicense: false, requiresSerial: true, hasTypeField: false }
}

/**
 * Derives the four capability flags for a category id + group from the authoritative
 * static taxonomy, with NO doc-flag override and NO name heuristic. Used by:
 *   - scripts/seed/referenceData.ts (seed-time flag derivation)
 *   - scripts/backfill-category-caps.ts (Firestore backfill)
 *
 * For categories whose id is in CATEGORY_CAPABILITY_TAXONOMY the result is identical
 * to what `resolveCategoryCapabilities` returns on a CategoryRow with no explicit doc
 * flags (since both share `taxonomyOrGroupDefault` as their inner resolution path).
 */
export function deriveCategoryFlags(
  id: string,
  group: 'devices' | 'network' | 'furniture',
): { hasSpecs: boolean; hasOemLicense: boolean; requiresSerial: boolean; hasTypeField: boolean } {
  return taxonomyOrGroupDefault(id, group)
}

/**
 * Single derivation point for a category's form capabilities.
 *
 * Resolution order, applied PER FLAG (hasSpecs / hasOemLicense / requiresSerial /
 * hasTypeField):
 *   a. Explicit boolean on the Firestore doc (admin override wins).
 *   b. Static taxonomy + group defaults via `taxonomyOrGroupDefault` (shared with
 *      `deriveCategoryFlags` so the two can never drift).
 *   c. Name heuristic fallback for `hasSpecs` only (preserves legacy CategoryPicker
 *      behavior for unknown categories not in the taxonomy).
 */
export function resolveCategoryCapabilities(cat: CategoryRow): CategoryCapabilities {
  const isFurniture = cat.group === 'furniture'
  const isNetwork = cat.group === 'network'
  const isServer = SERVER_CATEGORY_IDS.has(cat.id)
  const isLaptop = LAPTOP_CATEGORY_IDS.has(cat.id)

  const base = taxonomyOrGroupDefault(cat.id, cat.group)

  // Per-flag resolver: explicit doc flag → taxonomy+group default → name heuristic.
  // The `base` object already encodes the taxonomy → group-default resolution, so we
  // only need one level of "override" here (doc flag, or fallback to base).
  const hasTypeField = cat.hasTypeField !== undefined ? cat.hasTypeField : base.hasTypeField
  const requiresSerial = cat.requiresSerial !== undefined ? cat.requiresSerial : base.requiresSerial
  const hasOemLicense = cat.hasOemLicense !== undefined ? cat.hasOemLicense : base.hasOemLicense

  // hasSpecs gets an extra name heuristic for unknown ids (preserves legacy behavior).
  const specHeuristic =
    !isFurniture && /laptop|desktop|computer|server|пк|ноут|сервер|компьютер/i.test(cat.name)
  const hasSpecs =
    cat.hasSpecs !== undefined ? cat.hasSpecs : (base.hasSpecs || specHeuristic || isServer)

  const hasBrandModel = !hasTypeField
  const hasGpu = COMPUTER_CATEGORY_IDS.has(cat.id) || LAPTOP_CATEGORY_IDS.has(cat.id)

  return { hasBrandModel, hasTypeField, requiresSerial, hasSpecs, hasOemLicense, isServer, isLaptop, isNetwork, hasGpu }
}
