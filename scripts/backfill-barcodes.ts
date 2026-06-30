// scripts/backfill-barcodes.ts
//
// One-time, idempotent backfill: assigns a unique 9-digit numeric `barcode` to
// every assets/* document that lacks one. Legacy assets created before the
// `barcode` field existed have barcode=null/absent, so their printed label shows
// no barcode. New assets already get a barcode at creation — this only fills old ones.
//
// AUDIT DECISION (intentional, documented): this backfill does NOT go through the
// app's withAudit() helper and writes NO audit_logs rows, consistent with the
// sibling backfill (scripts/backfill-category-caps.ts) and the seeder's documented
// no-audit decision. Provenance is preserved via updatedBy:'system' + a fresh
// updatedAt Timestamp.
//
// Idempotency: only assets where barcode is missing/empty are touched. Re-running
// the script after a successful run is a no-op (all assets already have a barcode).
// merge:true ensures no other field is disturbed.
//
// Usage:
//   npm run backfill:barcodes
//   npm run backfill:barcodes -- --dry-run
//   npm run backfill:barcodes -- --project <id>
//   tsx scripts/backfill-barcodes.ts [--project <id>] [--dry-run]
import { initAdmin, Timestamp } from './seed/adminApp'
import { generateBarcodeCandidate } from '../src/domain/asset/barcode'

const MAX_TRIES = 20

async function main() {
  const args = process.argv.slice(2)
  let project: string | undefined
  let dryRun = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project') project = args[++i]
    else if (args[i] === '--dry-run') dryRun = true
  }

  const { db, projectId } = initAdmin(project)
  console.log(`backfill-barcodes -> project="${projectId}"${dryRun ? ' (DRY-RUN)' : ''}`)

  const snap = await db.collection('assets').get()
  if (snap.empty) {
    console.log('No assets found — nothing to backfill.')
    return
  }

  // FIRST pass: collect all existing non-empty barcodes so generated codes never
  // collide with already-assigned ones.
  const taken = new Set<string>()
  for (const docSnap of snap.docs) {
    const barcode = docSnap.data().barcode
    if (typeof barcode === 'string' && barcode.trim() !== '') {
      taken.add(barcode.trim())
    }
  }

  // SECOND pass: fill assets missing a barcode.
  let count = 0
  let skipped = 0
  const now = Timestamp.now()

  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    const barcode = data.barcode
    if (typeof barcode === 'string' && barcode.trim() !== '') {
      skipped++
      continue
    }

    let candidate = generateBarcodeCandidate()
    let tries = 1
    while (taken.has(candidate)) {
      if (tries >= MAX_TRIES) {
        throw new Error(
          `Could not allocate a unique barcode for asset ${docSnap.id} after ${MAX_TRIES} attempts.`,
        )
      }
      candidate = generateBarcodeCandidate()
      tries++
    }
    taken.add(candidate)

    const invCode = typeof data.invCode === 'string' ? data.invCode : '(none)'
    console.log(`${docSnap.id}: barcode=${candidate} (invCode=${invCode})`)

    if (!dryRun) {
      await docSnap.ref.set(
        { barcode: candidate, updatedBy: 'system', updatedAt: now },
        { merge: true },
      )
    }
    count++
  }

  console.log(
    `\nDone. ${dryRun ? '[DRY-RUN] would have backfilled' : 'Backfilled'} ${count} asset(s);` +
    ` skipped ${skipped} already having a barcode.`,
  )
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
