// scripts/seed/buildSeed.ts
// Pure builder — NO Firebase imports. Emits the full seed doc set.
//
// AUDIT DECISION (intentional, documented): seed writes do NOT go through the app's
// withAudit() helper, and the seeder writes NO audit_logs rows. Reference catalogs at
// bootstrap predate any actor; the audit_logs security rules require
// actorUid == request.auth.uid, which is impossible for an unauthenticated Admin-SDK
// script. Provenance is preserved instead via the createdBy/updatedBy: 'system'
// sentinel plus real createdAt/updatedAt timestamps (the runner converts the ISO
// strings emitted here into Admin SDK Timestamps before writing).
import {
  STATUS_SEED, BRANCH_SEED, DEPARTMENT_SEED, CORE_CATEGORY_SEED,
  buildAllCategorySeed, PART_SEED, type CategorySeed,
} from './referenceData'

export interface SeedDoc { collection: string; id: string; data: Record<string, unknown> }

export interface BuildSeedOptions {
  /** ISO timestamp written into createdAt/updatedAt (the writer converts to Timestamp). */
  nowIso: string
  allowedEmailDomains?: string[]
  allCategories?: boolean
  demo?: boolean
  mainBranchId?: string
}

const SYSTEM = 'system'

export function buildSeedDocs(opts: BuildSeedOptions): SeedDoc[] {
  const now = opts.nowIso
  const stamp = { createdBy: SYSTEM, updatedBy: SYSTEM, createdAt: now, updatedAt: now }
  const docs: SeedDoc[] = []

  for (const s of STATUS_SEED) {
    docs.push({ collection: 'asset_statuses', id: s.id, data: {
      name: s.name, color: s.color, isFinal: s.isFinal, isSystem: s.isSystem,
      sortOrder: s.sortOrder, ...stamp } })
  }
  for (const b of BRANCH_SEED) {
    docs.push({ collection: 'branches', id: b.id, data: {
      name: b.name, type: b.type, city: b.city, address: b.address, ...stamp } })
  }
  for (const d of DEPARTMENT_SEED) {
    docs.push({ collection: 'departments', id: d.id, data: { name: d.name, ...stamp } })
  }
  const cats: CategorySeed[] = opts.allCategories ? buildAllCategorySeed() : CORE_CATEGORY_SEED
  for (const c of cats) {
    docs.push({ collection: 'categories', id: c.id, data: {
      name: c.name, group: c.group, prefix: c.prefix,
      hasSpecs: c.hasSpecs, hasOemLicense: c.hasOemLicense,
      requiresSerial: c.requiresSerial, hasTypeField: c.hasTypeField,
      lucideIcon: c.lucideIcon, ...stamp } })
  }

  // Parts catalog (replaceable-component SKUs). Doc carries ONLY the keys the
  // firestore.rules parts/{id} keys().hasOnly([...]) whitelist allows; optional
  // variantId/variantLabel/ddr are included only when present (psu/cooler omit them).
  for (const p of PART_SEED) {
    const data: Record<string, unknown> = {
      name: p.name, category: p.category, unit: p.unit,
      onHand: p.onHand, broken: p.broken, lowStockThreshold: p.lowStockThreshold,
      ...stamp,
    }
    if (p.variantId !== undefined) data.variantId = p.variantId
    if (p.variantLabel !== undefined) data.variantLabel = p.variantLabel
    if (p.ddr !== undefined) data.ddr = p.ddr
    docs.push({ collection: 'parts', id: p.id, data })
  }

  docs.push({ collection: 'settings', id: 'auth', data: {
    allowedEmailDomains: opts.allowedEmailDomains ?? [], updatedBy: SYSTEM, updatedAt: now } })
  docs.push({ collection: 'settings', id: 'defaults', data: {
    mainBranchId: opts.mainBranchId ?? 'br_main', defaultLocale: 'ru', updatedBy: SYSTEM, updatedAt: now } })

  if (opts.demo) docs.push(...buildDemoDocs(now))
  return docs
}

function buildDemoDocs(now: string): SeedDoc[] {
  const stamp = { createdBy: SYSTEM, updatedBy: SYSTEM, createdAt: now, updatedAt: now }
  return [
    // demo_emp_1 id is intentionally synthetic (NOT a real Firebase Auth uid); demo data is
    // barred from real projects (see FIX 2 guard in seed.ts — requires --demo-confirm off-emulator).
    { collection: 'employees', id: 'demo_emp_1', data: {
      firstName: 'Демо', lastName: 'Сотрудник', email: 'demo.employee@example.com',
      departmentId: 'dep_it', branchId: 'br_main', status: 'active', ...stamp } },
    { collection: 'assets', id: 'demo_asset_1', data: {
      invCode: 'LAP/00001', brand: 'Dell', model: 'Latitude 5440', serial: 'DEMO-SN-001',
      categoryId: 'cat_laptop', statusId: 'st_warehouse', branchId: 'br_main',
      assignment: null, ...stamp } },
  ]
}
