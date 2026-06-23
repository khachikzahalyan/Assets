// scripts/backfill-category-caps.ts
//
// Non-destructive backfill: adds hasSpecs / hasOemLicense / requiresSerial /
// hasTypeField to every existing categories/* document in Firestore.
//
// AUDIT DECISION (intentional, documented): this backfill does NOT go through
// the app's withAudit() helper and writes NO audit_logs rows. The four capability
// flags are taxonomy config (not domain business data); provenance is preserved
// via updatedBy:'system' + a fresh updatedAt Timestamp, consistent with the seeder's
// documented no-audit decision in scripts/seed/buildSeed.ts.
//
// Idempotency: merge:true ensures re-running this script writes the same values
// without touching name/group/prefix/lucideIcon/createdAt or any other field.
//
// Usage:
//   npm run backfill:category-caps
//   tsx scripts/backfill-category-caps.ts [--project <id>] [--dry-run]
import { initAdmin, Timestamp } from './seed/adminApp'
import { deriveCategoryFlags } from '../src/domain/asset/categoryCapabilities'

async function main() {
  const args = process.argv.slice(2)
  let project: string | undefined
  let dryRun = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project') project = args[++i]
    else if (args[i] === '--dry-run') dryRun = true
  }

  const { db, projectId } = initAdmin(project)
  console.log(`backfill-category-caps -> project="${projectId}"${dryRun ? ' (DRY-RUN)' : ''}`)

  const snap = await db.collection('categories').get()
  if (snap.empty) {
    console.log('No categories found — nothing to backfill.')
    return
  }

  let count = 0
  const now = Timestamp.now()

  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    const rawGroup = typeof data.group === 'string' ? data.group : 'devices'
    const group: 'devices' | 'network' | 'furniture' =
      rawGroup === 'network' ? 'network' : rawGroup === 'furniture' ? 'furniture' : 'devices'
    const flags = deriveCategoryFlags(docSnap.id, group)

    const patch = {
      hasSpecs:      flags.hasSpecs,
      hasOemLicense: flags.hasOemLicense,
      requiresSerial: flags.requiresSerial,
      hasTypeField:  flags.hasTypeField,
      updatedBy: 'system',
      updatedAt: now,
    }

    console.log(
      `${docSnap.id}: hasSpecs=${flags.hasSpecs} hasOemLicense=${flags.hasOemLicense}` +
      ` requiresSerial=${flags.requiresSerial} hasTypeField=${flags.hasTypeField}`,
    )

    if (!dryRun) {
      await docSnap.ref.set(patch, { merge: true })
    }
    count++
  }

  console.log(`\nDone. ${dryRun ? '[DRY-RUN] would have patched' : 'Patched'} ${count} category doc(s).`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
