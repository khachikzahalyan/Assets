// scripts/deleteAsset.ts
//
// GUARDED, DESTRUCTIVE teardown for a SINGLE matched asset and all data that
// hangs off it. Mirrors scripts/clearAssets.ts safety conventions exactly.
//
//  SAFETY RAILS
//  1. DRY-RUN BY DEFAULT — no writes without --confirm.
//  2. --expect-project <id> asserts the resolved project id; abort on mismatch.
//  3. 3-second Ctrl-C window before touching a non-emulator project.
//  4. Batched deletes (BATCH_LIMIT 400, Firestore cap 500).
//  5. Scoped — only the matched asset's own data; nothing else is touched.
//
//  WHAT IT DELETES (for each matched asset):
//    assets/{id}/upgrades   subcollection
//    part_movements         where assetId == id
//    assignments            where assetId == id
//    audit_logs             entityId==id (asset/upgrade/part entries)
//                           + entityId in [assignmentIds] (assignment entries)
//                           + entityId in [movementIds]   (part_movement entries)
//    assets/{id}            the doc itself (last)
//
//  ROLLBACK: IRREVERSIBLE. Export Firestore first if unsure:
//    gcloud firestore export gs://<bucket>/$(date -u +%Y%m%dT%H%M%SZ)/ \
//      --collection-ids=assets,assignments,part_movements,audit_logs
//
//  Usage:
//    npm run delete:asset -- --invCode 9012I310
//    npm run delete:asset -- --serial LKNALSNC
//    npm run delete:asset -- --invCode 9012I310 --serial LKNALSNC --expect-project asset-ams --confirm
//
import { initAdmin } from './seed/adminApp'
import type { CollectionReference, Query, QueryDocumentSnapshot } from 'firebase-admin/firestore'

const BATCH_LIMIT = 400

interface Flags {
  confirm: boolean; project?: string; expectProject?: string
  invCode?: string; serial?: string
}

function parseFlags(argv: string[]): Flags {
  const f: Flags = { confirm: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--confirm' || a === '--yes') f.confirm = true
    else if (a === '--project')        f.project        = argv[++i]
    else if (a === '--expect-project') f.expectProject  = argv[++i]
    else if (a === '--invCode')        f.invCode        = argv[++i]
    else if (a === '--serial')         f.serial         = argv[++i]
  }
  return f
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Delete every doc matching a query in batches; count only when apply=false. */
async function deleteByQuery(label: string, makeQ: () => Query, apply: boolean): Promise<number> {
  if (!apply) {
    const n = (await makeQ().count().get()).data().count
    console.log(`  [dry-run] ${label}: would delete ${n}`)
    return n
  }
  let deleted = 0
  for (;;) {
    const snap = await makeQ().limit(BATCH_LIMIT).get()
    if (snap.empty) break
    const batch = snap.query.firestore.batch()
    for (const d of snap.docs) batch.delete(d.ref)
    await batch.commit()
    deleted += snap.size
    if (snap.size < BATCH_LIMIT) break
  }
  console.log(`  ${label}: deleted ${deleted}`)
  return deleted
}

/** Delete every doc in a CollectionReference (used for subcollections). */
async function deleteCollection(label: string, col: CollectionReference, apply: boolean): Promise<number> {
  if (!apply) {
    const n = (await col.count().get()).data().count
    console.log(`  [dry-run] ${label}: would delete ${n}`)
    return n
  }
  let deleted = 0
  let last: QueryDocumentSnapshot | undefined
  for (;;) {
    let q: Query = col.orderBy('__name__').limit(BATCH_LIMIT)
    if (last) q = q.startAfter(last)
    const page = await q.get()
    if (page.empty) break
    const batch = page.docs[0]!.ref.firestore.batch()
    for (const d of page.docs) batch.delete(d.ref)
    await batch.commit()
    deleted += page.size
    last = page.docs[page.docs.length - 1]
    if (page.size < BATCH_LIMIT) break
  }
  console.log(`  ${label}: deleted ${deleted}`)
  return deleted
}

/**
 * Delete audit_logs where entityId is in ids[], chunked by 30 (Firestore `in` limit).
 * ids may include the asset id itself, assignment ids, and part_movement ids.
 */
async function deleteAuditByEntityIds(
  label: string,
  db: FirebaseFirestore.Firestore,
  ids: string[],
  apply: boolean,
): Promise<number> {
  if (ids.length === 0) return 0
  let total = 0
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30)
    total += await deleteByQuery(
      label,
      () => db.collection('audit_logs').where('entityId', 'in', chunk),
      apply,
    )
  }
  return total
}

/** Fetch only doc ids from a query (no field data transferred). */
async function fetchIds(q: Query): Promise<string[]> {
  return (await q.select().get()).docs.map((d) => d.id)
}

interface AssetMatch {
  id: string; invCode: string; serial: string | null; brand: string | null; model: string | null
}

async function cascadeDelete(
  db: FirebaseFirestore.Firestore,
  asset: AssetMatch,
  apply: boolean,
): Promise<Record<string, number>> {
  const { id } = asset
  console.log(`\n--- asset ${asset.invCode} (id=${id}) ---`)
  const s: Record<string, number> = {}

  // 1. Subcollection first (while parent doc still addressable).
  s['assets/*/upgrades'] = await deleteCollection(
    `assets/${id}/upgrades`,
    db.collection('assets').doc(id).collection('upgrades'),
    apply,
  )

  // 2. Collect related ids BEFORE deleting (needed to target audit_logs).
  const movementIds  = await fetchIds(db.collection('part_movements').where('assetId', '==', id))
  const assignmentIds = await fetchIds(db.collection('assignments').where('assetId', '==', id))

  // 3. part_movements.
  s['part_movements'] = await deleteByQuery(
    `part_movements (assetId=${id})`,
    () => db.collection('part_movements').where('assetId', '==', id),
    apply,
  )

  // 4. assignments.
  s['assignments'] = await deleteByQuery(
    `assignments (assetId=${id})`,
    () => db.collection('assignments').where('assetId', '==', id),
    apply,
  )

  // 5. audit_logs (three groups):
  //    a) entityId==assetId  → entityType 'asset', 'upgrade', 'part' all use assetId as entityId
  //    b) entityId in assignmentIds  → entityType 'assignment' uses the assignment doc id
  //    c) entityId in movementIds    → entityType 'part_movement' uses the movement doc id
  const allAuditIds = [id, ...assignmentIds, ...movementIds]
  s['audit_logs'] = await deleteAuditByEntityIds(
    `audit_logs (${allAuditIds.length} entity id(s))`,
    db,
    allAuditIds,
    apply,
  )

  // 6. Asset doc itself — last.
  if (!apply) {
    console.log(`  [dry-run] assets/${id}: would delete 1`)
    s[`assets/${id}`] = 1
  } else {
    await db.collection('assets').doc(id).delete()
    console.log(`  assets/${id}: deleted`)
    s[`assets/${id}`] = 1
  }

  return s
}

async function main() {
  const flags = parseFlags(process.argv.slice(2))

  if (!flags.invCode && !flags.serial) {
    console.log('At least one of --invCode or --serial is required.\n')
    console.log('Usage:')
    console.log('  npm run delete:asset -- --invCode <code>')
    console.log('  npm run delete:asset -- --serial <sn>')
    console.log('  npm run delete:asset -- --invCode <code> --serial <sn> --expect-project <id> --confirm')
    process.exit(1)
  }

  const { db, projectId } = initAdmin(flags.project)
  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST
  const apply = flags.confirm

  console.log('======================================================================')
  console.log(' AMS deleteAsset — DESTRUCTIVE single-asset teardown')
  console.log(' IRREVERSIBLE. Export Firestore before proceeding if unsure.')
  console.log('======================================================================')
  console.log(`Target project : ${projectId}${usingEmulator ? ' (EMULATOR)' : ''}`)
  console.log(`Mode           : ${apply ? 'APPLY (will DELETE)' : 'DRY-RUN (no writes)'}`)
  if (flags.invCode) console.log(`Filter invCode : ${flags.invCode}`)
  if (flags.serial)  console.log(`Filter serial  : ${flags.serial}`)

  if (flags.expectProject && flags.expectProject !== projectId) {
    console.error(`\nABORT: --expect-project "${flags.expectProject}" != resolved "${projectId}". Refusing to run.`)
    process.exit(1)
  }

  // Find matching assets (invCode OR serial — union, deduplicated by doc id).
  const assetsCol = db.collection('assets')
  const matchedMap = new Map<string, AssetMatch>()
  const toMatch = (d: FirebaseFirestore.QueryDocumentSnapshot): AssetMatch => {
    const data = d.data() as Record<string, unknown>
    return {
      id: d.id,
      invCode: String(data['invCode'] ?? ''),
      serial: (data['serial'] as string | null) ?? null,
      brand: (data['brand'] as string | null) ?? null,
      model: (data['model'] as string | null) ?? null,
    }
  }
  if (flags.invCode) {
    for (const d of (await assetsCol.where('invCode', '==', flags.invCode).get()).docs) {
      matchedMap.set(d.id, toMatch(d))
    }
  }
  if (flags.serial) {
    for (const d of (await assetsCol.where('serial', '==', flags.serial).get()).docs) {
      matchedMap.set(d.id, toMatch(d))
    }
  }

  const matched = Array.from(matchedMap.values())
  console.log(`\nMatched ${matched.length} asset(s):`)
  if (matched.length === 0) {
    console.log('  (none found — nothing to delete)')
    process.exit(0)
  }
  for (const a of matched) {
    console.log(`  id=${a.id}  invCode=${a.invCode}  serial=${a.serial ?? '(none)'}  brand=${a.brand ?? ''}  model=${a.model ?? ''}`)
  }

  if (apply && !usingEmulator) {
    console.log(`\n!!! About to PERMANENTLY DELETE ${matched.length} asset(s) from project "${projectId}". !!!`)
    console.log('!!! IRREVERSIBLE. Press Ctrl-C within 3 seconds to abort. !!!')
    await sleep(3000)
  }

  // Cascade-delete each matched asset.
  const grand: Record<string, number> = {}
  for (const asset of matched) {
    const perAsset = await cascadeDelete(db, asset, apply)
    for (const [k, v] of Object.entries(perAsset)) grand[k] = (grand[k] ?? 0) + v
  }

  console.log('\n----------------------------------------------------------------------')
  console.log(apply ? 'SUMMARY — DELETED' : 'SUMMARY — DRY RUN (nothing deleted)')
  console.log('----------------------------------------------------------------------')
  let total = 0
  for (const [k, v] of Object.entries(grand)) {
    total += v
    console.log(`  ${k.padEnd(36)} ${apply ? 'deleted' : 'would delete'} ${v}`)
  }
  console.log(`  ${'TOTAL'.padEnd(36)} ${total}`)

  if (!apply) {
    const invPart = flags.invCode ? ` --invCode ${flags.invCode}` : ''
    const snPart  = flags.serial  ? ` --serial ${flags.serial}`   : ''
    console.log('\n(DRY RUN — nothing deleted. To apply:)')
    console.log(`  npm run delete:asset --${invPart}${snPart} --expect-project ${projectId} --confirm`)
  } else {
    console.log('\nDone. Asset(s) and all related data permanently removed.')
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
