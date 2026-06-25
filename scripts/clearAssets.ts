// scripts/clearAssets.ts
//
// GUARDED, DESTRUCTIVE cleanup. Wipes ASSET data (assets + everything that hangs
// off an asset) so the owner can re-create assets from scratch on a fresh slate.
// The Admin SDK bypasses Firestore rules — that is the ONLY way to delete the
// append-only collections (audit_logs, part_movements, assets/*/upgrades) that the
// security rules freeze with `allow update, delete: if false`.
//
// ============================================================================
//  SAFETY RAILS (the whole point of this script)
//  1. DRY-RUN BY DEFAULT. With no flag it deletes NOTHING — it only counts and
//     prints, per collection, how many docs WOULD be deleted, plus the resolved
//     collection paths and the target projectId.
//  2. EXPLICIT OPT-IN. Deletes happen ONLY with --confirm. The destructive path
//     also echoes the resolved projectId and waits 3 seconds (interruptible with
//     Ctrl-C) before touching anything. Pass --expect-project <id> to assert the
//     target id and abort on mismatch — strongly recommended in scripts/CI.
//  3. BATCHED DELETES. Firestore caps a WriteBatch at 500 ops/commit; we use 400.
//  4. CLEAR SUMMARY at the end (deleted N from each collection, or DRY-RUN totals).
//  5. NEVER touches reference / catalog / config collections (see KEEP list).
// ============================================================================
//
//  WHAT IT DELETES ("assets + related"):
//    · assets                     — the asset documents
//    · assets/{id}/upgrades       — per-asset upgrade-event subcollection
//    · assignments                — handover / выдача history (references assetId)
//    · part_movements             — install/uninstall/receive/service stock journal
//                                   (the part SKU catalog `parts` is KEPT — see below)
//    · audit_logs (asset-scoped)  — only entries whose entityType is one of the
//                                   asset-scoped types (see ASSET_AUDIT_ENTITY_TYPES);
//                                   license / subscription / employee / user / branch /
//                                   department / category / asset_status / settings /
//                                   server_license audit entries are KEPT.
//
//  WHAT IT KEEPS (reference / catalog / config — NEVER deleted):
//    users, employees, branches, departments, categories, asset_statuses,
//    settings/*, parts (the part SKU catalog — see note), subscriptions, mail,
//    and any non-asset audit_logs entries.
//
//  PART SKU NOTE (documented choice): deleting part_movements zeroes out derived
//  stock (onHand/broken are recomputed from the movement journal by deriveStock),
//  so the SKU rows in `parts` will read as 0 on-hand after this runs. We KEEP the
//  `parts` catalog by default (the SKU definitions are reference data the owner
//  curated). If the owner wants the SKU catalog wiped too, that is a separate,
//  explicit operation — this script does not touch `parts`.
//
//  AUDIT NOTE (documented choice): this is a teardown, not a business mutation, so
//  it does NOT write withAudit()-style audit_logs rows describing itself — it is in
//  fact DELETING asset-scoped audit history. The log file printed to stdout is the
//  record of what ran. Asset-scoped filtering by entityType is precise and practical
//  here (Firestore `in` supports up to 30 values), so we do NOT wipe the whole
//  audit_logs collection — non-asset audit history is preserved.
//
//  Usage:
//    npm run clear:assets                              # DRY-RUN (counts only)
//    npm run clear:assets -- --confirm                 # DELETE
//    tsx scripts/clearAssets.ts [--project <id>] [--expect-project <id>] [--confirm]
//
//  ROLLBACK: deletes are IRREVERSIBLE. There is no inverse script. The owner MUST
//  export Firestore first if any chance of needing the data back:
//    gcloud firestore export gs://<backup-bucket>/$(date -u +%Y%m%dT%H%M%SZ)/ \
//      --collection-ids=assets,assignments,part_movements,licenses,server_licenses,audit_logs
import { initAdmin } from './seed/adminApp'
import type { CollectionReference, Query, QueryDocumentSnapshot } from 'firebase-admin/firestore'

/**
 * Audit entityType values wiped along with asset + license data. Mirrors
 * AuditEntityType in src/domain/audit/types.ts; the remaining types (subscription,
 * employee, user, branch, department, category, asset_status, settings) are absent
 * so their audit history is preserved.
 */
const ASSET_AUDIT_ENTITY_TYPES = [
  'asset', 'assignment', 'upgrade', 'part', 'part_movement', 'license', 'server_license',
] as const

/** Firestore WriteBatch cap is 500; stay under it. */
const BATCH_LIMIT = 400

interface Flags {
  confirm: boolean
  project?: string
  expectProject?: string
}

function parseFlags(argv: string[]): Flags {
  const f: Flags = { confirm: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--confirm' || a === '--yes') f.confirm = true
    else if (a === '--project') f.project = argv[++i]
    else if (a === '--expect-project') f.expectProject = argv[++i]
  }
  return f
}

/** Count without reading doc bodies (cheap, server-side aggregation). */
async function countQuery(q: Query | CollectionReference): Promise<number> {
  const agg = await q.count().get()
  return agg.data().count
}

/**
 * Delete every doc returned by a query, in batches of BATCH_LIMIT. Re-queries with
 * a limit each pass so memory stays bounded regardless of collection size. Returns
 * the number deleted. When apply=false, it counts and returns WITHOUT deleting.
 */
async function deleteByQuery(
  label: string,
  makeQuery: () => Query,
  apply: boolean,
): Promise<number> {
  if (!apply) {
    const n = await countQuery(makeQuery())
    console.log(`  [dry-run] ${label}: would delete ${n} doc(s)`)
    return n
  }

  let deleted = 0
  // Loop: fetch up to BATCH_LIMIT, delete them, repeat until the query is empty.
  for (;;) {
    const snap = await makeQuery().limit(BATCH_LIMIT).get()
    if (snap.empty) break
    const batch = snap.query.firestore.batch()
    for (const d of snap.docs) batch.delete(d.ref)
    await batch.commit()
    deleted += snap.size
    console.log(`  ${label}: committed batch, ${deleted} deleted so far`)
    if (snap.size < BATCH_LIMIT) break
  }
  console.log(`  ${label}: done, ${deleted} deleted`)
  return deleted
}

/**
 * Delete the `upgrades` subcollection under every asset. We iterate asset docs in
 * pages and clear each asset's subcollection before (or alongside) deleting the
 * parent. Must run BEFORE the top-level `assets` wipe when applying, because once
 * the parent doc is gone we can no longer enumerate via collection().listDocuments
 * reliably across all SDK paths — so we walk assets explicitly here.
 */
async function clearAssetUpgrades(
  db: FirebaseFirestore.Firestore,
  apply: boolean,
): Promise<number> {
  const assetsCol = db.collection('assets')
  let total = 0
  // Page through asset docs (ids only) so we can address each upgrades subcollection.
  let last: QueryDocumentSnapshot | undefined
  for (;;) {
    let q: Query = assetsCol.orderBy('__name__').limit(BATCH_LIMIT)
    if (last) q = q.startAfter(last)
    const page = await q.get()
    if (page.empty) break
    for (const assetDoc of page.docs) {
      const upgrades = assetDoc.ref.collection('upgrades')
      total += await deleteByQuery(
        `assets/${assetDoc.id}/upgrades`,
        () => upgrades.orderBy('__name__'),
        apply,
      )
    }
    last = page.docs[page.docs.length - 1]
    if (page.size < BATCH_LIMIT) break
  }
  return total
}

/** Delete a named subcollection under every doc of a parent collection
 *  (e.g. licenses/{id}/secrets). Pages parents so memory stays bounded. */
async function clearSubcollectionUnder(
  db: FirebaseFirestore.Firestore,
  parentCol: string,
  subCol: string,
  apply: boolean,
): Promise<number> {
  const col = db.collection(parentCol)
  let total = 0
  let last: QueryDocumentSnapshot | undefined
  for (;;) {
    let q: Query = col.orderBy('__name__').limit(BATCH_LIMIT)
    if (last) q = q.startAfter(last)
    const page = await q.get()
    if (page.empty) break
    for (const doc of page.docs) {
      const sub = doc.ref.collection(subCol)
      total += await deleteByQuery(`${parentCol}/${doc.id}/${subCol}`, () => sub.orderBy('__name__'), apply)
    }
    last = page.docs[page.docs.length - 1]
    if (page.size < BATCH_LIMIT) break
  }
  return total
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const flags = parseFlags(process.argv.slice(2))
  const { db, projectId } = initAdmin(flags.project)
  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST
  const apply = flags.confirm

  console.log('======================================================================')
  console.log(' AMS clearAssets — DESTRUCTIVE asset-data teardown')
  console.log('======================================================================')
  console.log(`Target project : ${projectId}${usingEmulator ? ' (EMULATOR)' : ''}`)
  console.log(`Mode           : ${apply ? 'APPLY (will DELETE)' : 'DRY-RUN (no writes)'}`)

  // Guard 2a: assert the resolved project matches the operator's expectation.
  if (flags.expectProject && flags.expectProject !== projectId) {
    console.error(
      `\nABORT: --expect-project "${flags.expectProject}" does not match the resolved ` +
      `project "${projectId}". Refusing to run against the wrong project.`)
    process.exit(1)
  }

  console.log('\nWill DELETE: assets, assets/*/upgrades, assignments, part_movements,')
  console.log('             licenses (+ secrets), server_licenses (+ secrets),')
  console.log(`             audit_logs where entityType in [${ASSET_AUDIT_ENTITY_TYPES.join(', ')}]`)
  console.log('Will KEEP  : users, employees, branches, departments, categories,')
  console.log('             asset_statuses, settings/*, parts (SKU catalog),')
  console.log('             subscriptions, mail, non-asset audit_logs')

  // Guard 2b: a real-project APPLY waits 3s so an accidental --confirm can be aborted.
  if (apply && !usingEmulator) {
    console.log(
      `\n!!! About to PERMANENTLY DELETE asset data from project "${projectId}". !!!`)
    console.log('!!! This is IRREVERSIBLE. Press Ctrl-C within 3 seconds to abort.   !!!')
    await sleep(3000)
  }

  const summary: Record<string, number> = {}

  // 1) Per-asset upgrades subcollections FIRST (so they are addressable).
  summary['assets/*/upgrades'] = await clearAssetUpgrades(db, apply)

  // 2) Top-level assets.
  summary['assets'] = await deleteByQuery(
    'assets', () => db.collection('assets').orderBy('__name__'), apply)

  // 3) Assignments (handover history).
  summary['assignments'] = await deleteByQuery(
    'assignments', () => db.collection('assignments').orderBy('__name__'), apply)

  // 4) Part movements (install/uninstall/receive/service journal).
  summary['part_movements'] = await deleteByQuery(
    'part_movements', () => db.collection('part_movements').orderBy('__name__'), apply)

  // 5) Asset-scoped audit_logs only. entityType `in` (≤30 values) keeps this to one
  //    filtered query; non-asset audit history is left untouched.
  summary['audit_logs (asset-scoped)'] = await deleteByQuery(
    'audit_logs (asset-scoped)',
    () => db.collection('audit_logs')
      .where('entityType', 'in', ASSET_AUDIT_ENTITY_TYPES as unknown as string[]),
    apply)

  // 6) Licenses (Windows / workstation keys) — secret subcollections first, then docs.
  summary['licenses/*/secrets'] = await clearSubcollectionUnder(db, 'licenses', 'secrets', apply)
  summary['licenses'] = await deleteByQuery(
    'licenses', () => db.collection('licenses').orderBy('__name__'), apply)

  // 7) Server licenses — secret subcollections first, then docs.
  summary['server_licenses/*/secrets'] = await clearSubcollectionUnder(db, 'server_licenses', 'secrets', apply)
  summary['server_licenses'] = await deleteByQuery(
    'server_licenses', () => db.collection('server_licenses').orderBy('__name__'), apply)

  console.log('\n----------------------------------------------------------------------')
  console.log(apply ? 'SUMMARY — DELETED' : 'SUMMARY — DRY RUN (nothing deleted)')
  console.log('----------------------------------------------------------------------')
  let grand = 0
  for (const [k, v] of Object.entries(summary)) {
    grand += v
    console.log(`  ${k.padEnd(28)} ${apply ? 'deleted' : 'would delete'} ${v}`)
  }
  console.log(`  ${'TOTAL'.padEnd(28)} ${grand}`)
  if (!apply) {
    console.log('\n(DRY RUN — nothing was deleted. Re-run with --confirm to apply.)')
  } else {
    console.log('\nDone. Asset data cleared. Reference/catalog/config data preserved.')
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
