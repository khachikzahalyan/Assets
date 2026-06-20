// scripts/seed.ts
// CLI: idempotent, NON-DESTRUCTIVE seeder. The Admin SDK bypasses Firestore rules,
// which is what makes bootstrapping the super_admin-only reference catalogs possible.
//
// Modes:
//   (default)  create-if-absent — read each doc; write only when it is missing.
//   --force    re-write reference docs with merge:true (preserves extra fields).
//   --dry-run  print what WOULD be written; never touches Firestore.
// The seeder NEVER deletes a document, and never overwrites assets/employees/users.
//
// Flags: --force --dry-run --demo --all-categories --project <id> --domains a,b
//        --main-branch <id> --demo-confirm --all-categories-confirm
import { initAdmin, Timestamp } from './seed/adminApp'
import { buildSeedDocs, type SeedDoc } from './seed/buildSeed'

interface Flags {
  force: boolean; dryRun: boolean; demo: boolean; allCategories: boolean
  demoConfirm: boolean; allCategoriesConfirm: boolean
  project?: string; domains?: string[]; mainBranch?: string
}
function parseFlags(argv: string[]): Flags {
  const f: Flags = {
    force: false, dryRun: false, demo: false, allCategories: false,
    demoConfirm: false, allCategoriesConfirm: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--force') f.force = true
    else if (a === '--dry-run') f.dryRun = true
    else if (a === '--demo') f.demo = true
    else if (a === '--all-categories') f.allCategories = true
    else if (a === '--demo-confirm') f.demoConfirm = true
    else if (a === '--all-categories-confirm') f.allCategoriesConfirm = true
    else if (a === '--project') f.project = argv[++i]
    else if (a === '--main-branch') f.mainBranch = argv[++i]
    else if (a === '--domains') f.domains = (argv[++i] ?? '').split(',').map(s => s.trim()).filter(Boolean)
  }
  return f
}

/** ISO -> Admin Timestamp inside the data payload (createdAt/updatedAt fields). */
function withTimestamps(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data }
  for (const k of ['createdAt', 'updatedAt']) {
    if (typeof out[k] === 'string') out[k] = Timestamp.fromDate(new Date(out[k] as string))
  }
  return out
}

async function main() {
  const flags = parseFlags(process.argv.slice(2))
  const { db, projectId } = initAdmin(flags.project)
  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST

  // FIX 2: protect a REAL project from demo PII and the --all-categories name-collision hazard.
  if (flags.demo && !usingEmulator && !flags.demoConfirm) {
    console.error(
      '--demo writes sample assets/employees (synthetic PII) into Firestore; ' +
      'on a real project re-run with --demo-confirm, or target the emulator ' +
      '(set FIRESTORE_EMULATOR_HOST).')
    process.exit(1)
  }
  if (flags.allCategories && !usingEmulator && !flags.allCategoriesConfirm) {
    console.error(
      'WARNING: the full 131-category set (--all-categories) contains DUPLICATE category ' +
      'names (e.g. "Компьютер", "Точка доступа") that will collide with the app\'s ' +
      'unique-name rule (isNameTaken) when those categories are later edited in the UI. ' +
      'On a real project re-run with --all-categories-confirm to proceed.')
    process.exit(1)
  }

  // FIX 3: was the domain list EXPLICITLY provided? (CLI flag or non-empty env var).
  const domainsExplicit = flags.domains !== undefined
    || (process.env.SEED_ALLOWED_DOMAINS?.trim().length ?? 0) > 0

  const domains = flags.domains
    ?? (process.env.SEED_ALLOWED_DOMAINS
      ? process.env.SEED_ALLOWED_DOMAINS.split(',').map(s => s.trim()).filter(Boolean)
      : undefined)

  const docs: SeedDoc[] = buildSeedDocs({
    nowIso: new Date().toISOString(),
    allowedEmailDomains: domains,
    allCategories: flags.allCategories,
    demo: flags.demo,
    mainBranchId: flags.mainBranch,
  })

  console.log(`AMS seeder -> project="${projectId}"${usingEmulator ? ' (EMULATOR)' : ''}`)
  console.log(`mode: ${flags.dryRun ? 'DRY-RUN' : flags.force ? 'FORCE (overwrite reference docs)' : 'create-if-absent'}`)
  if (!domains || domains.length === 0) {
    console.warn('')
    console.warn('  ============================================================')
    console.warn('  WARNING: settings/auth.allowedEmailDomains will be EMPTY.')
    console.warn('  The beforeCreate Cloud Function FAILS CLOSED — with an empty')
    console.warn('  domain list, ALL sign-ups are blocked. Nobody can sign in')
    console.warn('  (including the first super_admin) until allowed domains are')
    console.warn('  set, either via the in-app Settings screen or by re-running')
    console.warn('  this seeder with --domains <yourcompany.example>.')
    console.warn('  ============================================================')
    console.warn('')
  }

  let created = 0, skipped = 0, overwritten = 0
  for (const d of docs) {
    const ref = db.collection(d.collection).doc(d.id)
    const data = withTimestamps(d.data)
    // FIX 3: never clobber an existing settings/auth when domains were NOT explicitly
    // provided. Under --force the doc would otherwise be merged with allowedEmailDomains:[]
    // over an operator-configured list. Force it to create-if-absent in that case so the
    // doc still exists on a fresh project but live config is preserved on a refresh run.
    const isAuthDoc = d.collection === 'settings' && d.id === 'auth'
    const effectiveForce = isAuthDoc && !domainsExplicit ? false : flags.force
    if (flags.dryRun) { console.log(`  would write ${d.collection}/${d.id}`); continue }
    const snap = await ref.get()
    if (snap.exists && !effectiveForce) { skipped++; continue }
    await ref.set(data, { merge: effectiveForce }) // merge on force (preserve extra fields), full set on create
    if (snap.exists) overwritten++; else created++
  }

  console.log(`\nDone. created=${created} overwritten=${overwritten} skipped=${skipped} total=${docs.length}`)
  if (flags.dryRun) console.log('(dry-run — nothing written)')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
