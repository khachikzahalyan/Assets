// scripts/migrate-category-groups.ts
//
// One-off, IDEMPOTENT migration for the two-level category taxonomy (Task 3):
//   1. Seeds the 3 top-level groups into `categoryGroups` (create-if-missing).
//      The seeded ids EQUAL the behavior literal (devices/network/furniture), so
//      existing `categories` link to a parent simply by `categoryGroupId = group`.
//   2. Backfills `categoryGroupId` on every `categories` doc that lacks it (or whose
//      value differs from its `group`), setting `categoryGroupId = group`.
//
// The `assets` collection is NEVER touched — assets reference categories by id and a
// category's behavior (`group`) is unchanged, so no asset data needs migrating.
//
//  SAFETY RAILS (mirrors scripts/deleteAsset.ts conventions)
//  1. DRY-RUN BY DEFAULT — no writes without --confirm.
//  2. --expect-project <id> asserts the resolved project id; abort on mismatch.
//  3. Batched writes (BATCH_LIMIT 400, Firestore cap 500).
//  4. Idempotent — a second --confirm run reports 0 changes.
//
//  AUDIT DECISION (intentional, documented — same rationale as
//  scripts/backfill-category-caps.ts and scripts/seed/buildSeed.ts): this migration
//  does NOT go through the app's withAudit() helper and writes NO audit_logs rows.
//  The audit_logs security rules require actorUid == request.auth.uid, which is
//  impossible for an unauthenticated Admin-SDK script; group seeding + categoryGroupId
//  are taxonomy config, not domain business data. Provenance is preserved via
//  updatedBy:'system' + a fresh updatedAt Timestamp.
//
//  ROLLBACK: low-risk and additive (creates 3 docs + sets one FK field). To reverse,
//  delete the 3 categoryGroups docs and unset categoryGroupId on categories. Export
//  first if unsure:
//    gcloud firestore export gs://<bucket>/$(date -u +%Y%m%dT%H%M%SZ)/ \
//      --collection-ids=categories,categoryGroups
//
//  Usage:
//    npm run migrate:category-groups                                  # dry-run
//    npm run migrate:category-groups -- --expect-project asset-ams --confirm
//
import { initAdmin, Timestamp } from './seed/adminApp'
import { CATEGORY_GROUP_SEED } from './seed/referenceData'
import { isCategoryGroupBehavior } from '../src/domain/category/categoryGroup-types'

const BATCH_LIMIT = 400

interface Flags { confirm: boolean; project?: string; expectProject?: string }

function parseFlags(argv: string[]): Flags {
  const f: Flags = { confirm: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--confirm' || a === '--yes') f.confirm = true
    else if (a === '--project')        f.project       = argv[++i]
    else if (a === '--expect-project') f.expectProject = argv[++i]
  }
  return f
}

async function main() {
  const flags = parseFlags(process.argv.slice(2))
  const { db, projectId } = initAdmin(flags.project)
  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST
  const apply = flags.confirm

  console.log('======================================================================')
  console.log(' AMS migrate-category-groups — seed categoryGroups + backfill FK')
  console.log('======================================================================')
  console.log(`Target project : ${projectId}${usingEmulator ? ' (EMULATOR)' : ''}`)
  console.log(`Mode           : ${apply ? 'APPLY (will WRITE)' : 'DRY-RUN (no writes)'}`)

  if (flags.expectProject && flags.expectProject !== projectId) {
    console.error(`\nABORT: --expect-project "${flags.expectProject}" != resolved "${projectId}". Refusing to run.`)
    process.exit(1)
  }

  const now = Timestamp.now()

  // 1. Upsert the 3 top-level groups (create-if-missing — never clobber an edited group).
  console.log('\n--- categoryGroups (create-if-missing) ---')
  let groupsCreated = 0, groupsSkipped = 0
  for (const g of CATEGORY_GROUP_SEED) {
    const ref = db.collection('categoryGroups').doc(g.id)
    const snap = await ref.get()
    if (snap.exists) {
      console.log(`  skip (exists): categoryGroups/${g.id}`)
      groupsSkipped++
      continue
    }
    console.log(`  ${apply ? 'create' : '[dry-run] would create'}: categoryGroups/${g.id} (${g.name})`)
    if (apply) {
      await ref.set({
        name: g.name, behavior: g.behavior, lucideIcon: g.lucideIcon,
        color: g.color, order: g.order,
        createdBy: 'system', updatedBy: 'system', createdAt: now, updatedAt: now,
      })
    }
    groupsCreated++
  }

  // 2. Backfill categoryGroupId on categories (categoryGroupId = group). assets untouched.
  console.log('\n--- categories (backfill categoryGroupId = group) ---')
  const snap = await db.collection('categories').get()
  let catsUpdated = 0, catsSkipped = 0
  let batch = db.batch()
  let inBatch = 0
  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    const rawGroup = typeof data.group === 'string' ? data.group : 'devices'
    // Coerce an unexpected/missing group to a valid behavior (defensive; the design
    // guarantees every category already has group ∈ {devices,network,furniture}).
    const group = isCategoryGroupBehavior(rawGroup) ? rawGroup : 'devices'

    if (data.categoryGroupId === group) { catsSkipped++; continue }

    console.log(`  ${apply ? 'set' : '[dry-run] would set'}: categories/${docSnap.id} categoryGroupId=${group}` +
      (typeof data.categoryGroupId === 'string' ? ` (was "${data.categoryGroupId}")` : ''))
    if (apply) {
      batch.set(docSnap.ref, { categoryGroupId: group, updatedBy: 'system', updatedAt: now }, { merge: true })
      inBatch++
      if (inBatch >= BATCH_LIMIT) {
        await batch.commit()
        console.log(`  committed batch of ${inBatch}`)
        batch = db.batch()
        inBatch = 0
      }
    }
    catsUpdated++
  }
  if (apply && inBatch > 0) {
    await batch.commit()
    console.log(`  committed final batch of ${inBatch}`)
  }

  console.log('\n----------------------------------------------------------------------')
  console.log(apply ? 'SUMMARY — APPLIED' : 'SUMMARY — DRY RUN (nothing written)')
  console.log('----------------------------------------------------------------------')
  console.log(`  groups     ${apply ? 'created' : 'would create'} ${groupsCreated}, skipped ${groupsSkipped}`)
  console.log(`  categories ${apply ? 'updated' : 'would update'} ${catsUpdated}, skipped ${catsSkipped} (of ${snap.size})`)

  if (!apply) {
    console.log('\n(DRY RUN — nothing written. To apply:)')
    console.log(`  npm run migrate:category-groups -- --expect-project ${projectId} --confirm`)
  } else {
    console.log('\nDone. Re-running this migration will report 0 changes (idempotent).')
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
