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
import { initAdmin, Timestamp } from './seed/adminApp'
import { buildSeedDocs, type SeedDoc } from './seed/buildSeed'

interface Flags {
  force: boolean; dryRun: boolean; demo: boolean; allCategories: boolean
  project?: string; domains?: string[]
}
function parseFlags(argv: string[]): Flags {
  const f: Flags = { force: false, dryRun: false, demo: false, allCategories: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--force') f.force = true
    else if (a === '--dry-run') f.dryRun = true
    else if (a === '--demo') f.demo = true
    else if (a === '--all-categories') f.allCategories = true
    else if (a === '--project') f.project = argv[++i]
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

  const domains = flags.domains
    ?? (process.env.SEED_ALLOWED_DOMAINS
      ? process.env.SEED_ALLOWED_DOMAINS.split(',').map(s => s.trim()).filter(Boolean)
      : undefined)

  const docs: SeedDoc[] = buildSeedDocs({
    nowIso: new Date().toISOString(),
    allowedEmailDomains: domains,
    allCategories: flags.allCategories,
    demo: flags.demo,
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
    if (flags.dryRun) { console.log(`  would write ${d.collection}/${d.id}`); continue }
    const snap = await ref.get()
    if (snap.exists && !flags.force) { skipped++; continue }
    await ref.set(data, { merge: flags.force }) // merge on force (preserve extra fields), full set on create
    if (snap.exists) overwritten++; else created++
  }

  console.log(`\nDone. created=${created} overwritten=${overwritten} skipped=${skipped} total=${docs.length}`)
  if (flags.dryRun) console.log('(dry-run — nothing written)')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
