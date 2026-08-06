// scripts/seed-assets.ts
// Populates the `assets` collection with realistic test data for dev/QA.
// NON-DESTRUCTIVE: never deletes or overwrites existing docs; always fresh auto-ids.
// Writes 3 docs per asset: assets/{id}, inv_codes/{lockId}, barcodes/{barcode}.
// Audit_logs intentionally skipped (seed data, not a domain event).
//
// Flags:
//   --dry-run           print what would be written; commit nothing
//   --project <id>      override project resolution (default: .firebaserc / ADC)
//   --count <n>         assets per group (default: 10)
//
// Usage:
//   npx tsx scripts/seed-assets.ts --dry-run
//   npx tsx scripts/seed-assets.ts
//   npx tsx scripts/seed-assets.ts --count 5 --dry-run
import { initAdmin, Timestamp } from './seed/adminApp'
import { generateBarcodeCandidate } from '../src/domain/asset/barcode'
import { invCodeLockId } from '../src/domain/asset/errors'

// ---------------------------------------------------------------------------
// CLI flag parsing
// ---------------------------------------------------------------------------

interface Flags {
  dryRun: boolean
  project?: string
  count: number
}

function parseFlags(argv: string[]): Flags {
  const f: Flags = { dryRun: false, count: 10 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') f.dryRun = true
    else if (a === '--project') f.project = argv[++i]
    else if (a === '--count') {
      const n = parseInt(argv[++i] ?? '', 10)
      if (!isNaN(n) && n > 0) f.count = n
    }
  }
  return f
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomAlnum(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function pick<T>(arr: T[]): T {
  // Callers always pass non-empty pools; index is always in range.
  return arr[Math.floor(Math.random() * arr.length)]!
}

// ---------------------------------------------------------------------------
// Data pools keyed by category id, with group-level fallbacks
// ---------------------------------------------------------------------------

type BrandModel = { brand: string; model: string }

const DEVICE_POOLS: Record<string, BrandModel[]> = {
  cat_laptop: [
    { brand: 'Dell', model: 'Latitude 5440' },
    { brand: 'Lenovo', model: 'ThinkPad T14' },
    { brand: 'HP', model: 'EliteBook 840 G10' },
    { brand: 'ASUS', model: 'ExpertBook B5' },
    { brand: 'Acer', model: 'TravelMate P4' },
  ],
  cat_computer: [
    { brand: 'Dell', model: 'OptiPlex 7010' },
    { brand: 'HP', model: 'ProDesk 400 G9' },
    { brand: 'Lenovo', model: 'ThinkCentre M70q' },
    { brand: 'ASUS', model: 'ExpertCenter D7' },
  ],
  cat_desktop: [
    { brand: 'Dell', model: 'OptiPlex 7010' },
    { brand: 'HP', model: 'ProDesk 400 G9' },
    { brand: 'Lenovo', model: 'ThinkCentre M70q' },
    { brand: 'ASUS', model: 'ExpertCenter D7' },
  ],
  cat_monitor: [
    { brand: 'Dell', model: 'U2723QE' },
    { brand: 'LG', model: '27UP850-W' },
    { brand: 'Samsung', model: 'S24R350' },
    { brand: 'HP', model: 'E24 G5' },
    { brand: 'Acer', model: 'B247Y' },
  ],
  cat_phone: [
    { brand: 'Samsung', model: 'Galaxy A54' },
    { brand: 'Apple', model: 'iPhone 13' },
    { brand: 'Xiaomi', model: 'Redmi Note 12' },
    { brand: 'Google', model: 'Pixel 7a' },
  ],
  cat_tablet: [
    { brand: 'Apple', model: 'iPad 10.2' },
    { brand: 'Samsung', model: 'Galaxy Tab A8' },
    { brand: 'Lenovo', model: 'Tab M10' },
    { brand: 'Huawei', model: 'MatePad 11' },
  ],
  cat_printer: [
    { brand: 'HP', model: 'LaserJet Pro M404dn' },
    { brand: 'Canon', model: 'i-SENSYS LBP223dw' },
    { brand: 'Brother', model: 'HL-L2350DW' },
    { brand: 'Epson', model: 'WF-C5290' },
  ],
  cat_keyboard: [
    { brand: 'Logitech', model: 'MK270' },
    { brand: 'Microsoft', model: 'Wired 600' },
    { brand: 'HP', model: '125' },
    { brand: 'A4Tech', model: 'KR-85' },
  ],
  cat_mouse: [
    { brand: 'Logitech', model: 'M185' },
    { brand: 'Microsoft', model: 'Basic Optical' },
    { brand: 'HP', model: 'X200' },
    { brand: 'A4Tech', model: 'OP-720' },
  ],
  cat_headset: [
    { brand: 'Jabra', model: 'Evolve 20' },
    { brand: 'Logitech', model: 'H340' },
    { brand: 'HP', model: 'G2' },
    { brand: 'Poly', model: 'Blackwire 3220' },
  ],
  cat_dock: [
    { brand: 'Dell', model: 'WD19S' },
    { brand: 'Lenovo', model: 'USB-C Dock Gen2' },
    { brand: 'HP', model: 'USB-C G5' },
    { brand: 'Anker', model: '575' },
  ],
}

const NETWORK_POOLS: Record<string, BrandModel[]> = {
  cat_server: [
    { brand: 'Dell', model: 'PowerEdge R750' },
    { brand: 'HPE', model: 'ProLiant DL380 Gen10' },
    { brand: 'Lenovo', model: 'ThinkSystem SR650' },
  ],
  cat_rack_server: [
    { brand: 'Dell', model: 'PowerEdge R750' },
    { brand: 'HPE', model: 'ProLiant DL380 Gen10' },
    { brand: 'Lenovo', model: 'ThinkSystem SR650' },
  ],
  cat_tower_server: [
    { brand: 'Dell', model: 'PowerEdge T550' },
    { brand: 'HPE', model: 'ProLiant ML110 Gen10' },
    { brand: 'Lenovo', model: 'ThinkSystem ST250' },
  ],
  cat_router: [
    { brand: 'MikroTik', model: 'hEX RB750Gr3' },
    { brand: 'Cisco', model: 'RV340' },
    { brand: 'TP-Link', model: 'ER605' },
    { brand: 'Keenetic', model: 'Giga' },
  ],
  cat_switch: [
    { brand: 'Cisco', model: 'Catalyst 1000' },
    { brand: 'MikroTik', model: 'CRS326' },
    { brand: 'TP-Link', model: 'TL-SG1016D' },
    { brand: 'D-Link', model: 'DGS-1210' },
  ],
  cat_firewall: [
    { brand: 'Fortinet', model: 'FortiGate 40F' },
    { brand: 'Cisco', model: 'ASA 5506-X' },
    { brand: 'Palo Alto', model: 'PA-410' },
    { brand: 'MikroTik', model: 'hAP ax3' },
  ],
  cat_ap: [
    { brand: 'Ubiquiti', model: 'UniFi U6-Lite' },
    { brand: 'MikroTik', model: 'cAP ax' },
    { brand: 'TP-Link', model: 'EAP225' },
    { brand: 'Aruba', model: 'Instant On AP15' },
  ],
  cat_access_point: [
    { brand: 'Ubiquiti', model: 'UniFi U6-Lite' },
    { brand: 'MikroTik', model: 'cAP ax' },
    { brand: 'TP-Link', model: 'EAP225' },
    { brand: 'Aruba', model: 'Instant On AP15' },
  ],
  cat_nas: [
    { brand: 'Synology', model: 'DS220+' },
    { brand: 'QNAP', model: 'TS-231P3' },
    { brand: 'Western Digital', model: 'My Cloud EX2' },
    { brand: 'Asustor', model: 'AS5304T' },
  ],
  cat_ups: [
    { brand: 'APC', model: 'Back-UPS BX650' },
    { brand: 'Eaton', model: '5E 850' },
    { brand: 'CyberPower', model: 'CP1500' },
    { brand: 'Ippon', model: 'Back Power Pro' },
  ],
}

const FURNITURE_POOLS: Record<string, string[]> = {
  cat_desk:          ['Стол офисный', 'Стол рабочий 140×70', 'Стол прямой'],
  cat_standing_desk: ['Стол с регулировкой высоты', 'Стол стоячий'],
  cat_chair:         ['Стул офисный', 'Стул посетителя', 'Стул на металлокаркасе'],
  cat_office_chair:  ['Стул офисный', 'Стул посетителя', 'Стул на металлокаркасе'],
  cat_visitor_chair: ['Стул посетителя', 'Стул на металлокаркасе'],
  cat_exec_chair:    ['Кресло руководителя', 'Кресло-сетка', 'Кресло эргономичное'],
  cat_mesh_chair:    ['Кресло-сетка', 'Кресло эргономичное'],
  cat_ergo_chair:    ['Кресло эргономичное', 'Кресло руководителя'],
  cat_armchair:      ['Кресло руководителя', 'Кресло-сетка', 'Кресло эргономичное'],
  cat_cabinet:       ['Шкаф для документов', 'Шкаф гардеробный', 'Шкаф металлический'],
  cat_file_cabinet:  ['Шкаф для документов', 'Шкаф металлический'],
  cat_sofa:          ['Диван 2-местный', 'Диван офисный'],
  cat_meet_tbl:      ['Стол переговоров 6-местный', 'Стол переговорный'],
  cat_conf_table:    ['Стол переговоров 6-местный', 'Стол переговорный'],
  cat_safe:          ['Сейф офисный', 'Сейф мебельный'],
  cat_bookshelf:     ['Стеллаж 5 полок', 'Стеллаж металлический'],
}

const CPU_POOL = [
  'Intel Core i5-1240P',
  'Intel Core i7-1260P',
  'Intel Core i5-13500',
  'AMD Ryzen 5 5600G',
  'AMD Ryzen 7 5800H',
  'Intel Xeon Silver 4310',
]
const RAM_POOL = ['8 ГБ', '16 ГБ', '32 ГБ', '64 ГБ']
const SSD_POOL = ['256 ГБ', '512 ГБ', '1 ТБ', '2 ТБ']

const DEVICE_FALLBACK_BRANDS = ['Logitech', 'HP', 'Dell', 'A4Tech', 'Xiaomi']
const NETWORK_FALLBACK_BRANDS = ['MikroTik', 'Cisco', 'TP-Link', 'Ubiquiti']

// ---------------------------------------------------------------------------
// Category doc shape (read from Firestore)
// ---------------------------------------------------------------------------

interface CatDoc {
  id: string
  prefix: string
  group: 'devices' | 'network' | 'furniture'
  requiresSerial: boolean
  hasSpecs: boolean
  hasTypeField: boolean
  name: string  // for furniture fallback type
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const flags = parseFlags(process.argv.slice(2))
  const { db, projectId } = initAdmin(flags.project)

  console.log(`AMS asset seeder -> project="${projectId}"`)
  console.log(`mode: ${flags.dryRun ? 'DRY-RUN (nothing written)' : 'REAL WRITE'}`)
  console.log(`count per group: ${flags.count}`)
  console.log()

  // ── 1. Read categories ────────────────────────────────────────────────────
  const catSnap = await db.collection('categories').get()
  const byGroup: Record<'devices' | 'network' | 'furniture', CatDoc[]> = {
    devices: [], network: [], furniture: [],
  }

  for (const d of catSnap.docs) {
    const data = d.data()
    const rawGroup = String(data.group ?? data.categoryGroupId ?? 'devices')
    // Normalise group: anything not network/furniture is treated as devices
    const group: 'devices' | 'network' | 'furniture' =
      rawGroup === 'network' || rawGroup === 'furniture' ? rawGroup : 'devices'

    // Derive flags with sensible defaults per group
    const requiresSerial = typeof data.requiresSerial === 'boolean'
      ? data.requiresSerial
      : group !== 'furniture'
    const hasSpecs = typeof data.hasSpecs === 'boolean'
      ? data.hasSpecs
      : false
    const hasTypeField = typeof data.hasTypeField === 'boolean'
      ? data.hasTypeField
      : group === 'furniture'

    const prefix = String(data.prefix ?? d.id.toUpperCase().slice(0, 3))

    byGroup[group].push({
      id: d.id,
      prefix,
      group,
      requiresSerial,
      hasSpecs,
      hasTypeField,
      name: String(data.name ?? ''),
    })
  }

  for (const g of ['devices', 'network', 'furniture'] as const) {
    console.log(`  ${g}: ${byGroup[g].length} categories found`)
  }
  console.log()

  // ── 2. Read existing assets (once) for collision avoidance ────────────────
  const existingSnap = await db.collection('assets').get()
  const maxSeqByPrefix = new Map<string, number>()
  const usedSerials = new Set<string>()
  const usedBarcodes = new Set<string>()

  for (const d of existingSnap.docs) {
    const data = d.data()
    const invCode = String(data.invCode ?? '')
    const slashIdx = invCode.lastIndexOf('/')
    if (slashIdx !== -1) {
      const prefix = invCode.slice(0, slashIdx)
      const seq = parseInt(invCode.slice(slashIdx + 1), 10)
      if (!isNaN(seq)) {
        const cur = maxSeqByPrefix.get(prefix) ?? 0
        if (seq > cur) maxSeqByPrefix.set(prefix, seq)
      }
    }
    if (data.serial) usedSerials.add(String(data.serial))
    if (data.barcode) usedBarcodes.add(String(data.barcode))
  }

  // ── 3. Read branches ──────────────────────────────────────────────────────
  const branchSnap = await db.collection('branches').get()
  const allBranchIds: string[] = branchSnap.docs.map(d => d.id)
  if (allBranchIds.length === 0) {
    console.warn('No branches found — falling back to br_main for all assets')
    allBranchIds.push('br_main')
  }

  function pickBranch(): string {
    if (Math.random() < 0.6) return 'br_main'
    return pick(allBranchIds)
  }

  // ── 4. Generate assets ────────────────────────────────────────────────────

  // Sequences are bumped per-prefix within this run too (not just from DB)
  const runSeq = new Map(maxSeqByPrefix)

  interface PendingAsset {
    assetId: string
    assetData: Record<string, unknown>
    invCode: string
    barcode: string
  }

  const pending: Record<'devices' | 'network' | 'furniture', PendingAsset[]> = {
    devices: [], network: [], furniture: [],
  }

  const groups: Array<'devices' | 'network' | 'furniture'> = ['devices', 'network', 'furniture']

  for (const group of groups) {
    const cats = byGroup[group]
    if (cats.length === 0) {
      console.warn(`  [SKIP] group "${group}" has 0 categories in Firestore`)
      continue
    }

    for (let i = 0; i < flags.count; i++) {
      // cats is non-empty (guarded above); modulo index is always in range.
      const cat = cats[i % cats.length]!

      // inv code
      const seq = (runSeq.get(cat.prefix) ?? 0) + 1
      runSeq.set(cat.prefix, seq)
      const invCode = `${cat.prefix}/${String(seq).padStart(5, '0')}`

      // barcode — loop until unique
      let barcode = generateBarcodeCandidate()
      let attempts = 0
      while (usedBarcodes.has(barcode)) {
        barcode = generateBarcodeCandidate()
        if (++attempts > 50) throw new Error('Could not allocate unique barcode')
      }
      usedBarcodes.add(barcode)

      // serial
      let serial: string | null = null
      if (cat.requiresSerial) {
        const brandSlug = (() => {
          if (group === 'devices') {
            const pool = DEVICE_POOLS[cat.id]
            return pool ? pick(pool).brand.toLowerCase().replace(/[^a-z0-9]/g, '') : 'dev'
          }
          const pool = NETWORK_POOLS[cat.id]
          return pool ? pick(pool).brand.toLowerCase().replace(/[^a-z0-9]/g, '') : 'net'
        })()
        let candidate = `${brandSlug}-${randomAlnum(8).toUpperCase()}`
        let sat = 0
        while (usedSerials.has(candidate)) {
          candidate = `${brandSlug}-${randomAlnum(8).toUpperCase()}`
          if (++sat > 50) throw new Error('Could not allocate unique serial')
        }
        usedSerials.add(candidate)
        serial = candidate
      }

      // brand / model / type / specs
      let brand: string | null = null
      let model: string | null = null
      let type: string | null = null
      let currentSpecs: Record<string, string> | null = null

      if (group === 'devices') {
        const pool = DEVICE_POOLS[cat.id]
        const bm = pool
          ? pick(pool)
          : { brand: pick(DEVICE_FALLBACK_BRANDS), model: `Model ${randomAlnum(4).toUpperCase()}` }
        brand = bm.brand
        model = bm.model
        if (cat.hasSpecs) {
          currentSpecs = { cpu: pick(CPU_POOL), ram: pick(RAM_POOL), ssd: pick(SSD_POOL) }
        }
      } else if (group === 'network') {
        const pool = NETWORK_POOLS[cat.id]
        const bm = pool
          ? pick(pool)
          : { brand: pick(NETWORK_FALLBACK_BRANDS), model: `NET-${randomAlnum(4).toUpperCase()}` }
        brand = bm.brand
        model = bm.model
        if (cat.hasSpecs) {
          currentSpecs = { cpu: pick(CPU_POOL), ram: pick(RAM_POOL), ssd: pick(SSD_POOL) }
        }
      } else {
        // furniture
        const typePool = FURNITURE_POOLS[cat.id]
        type = typePool ? pick(typePool) : (cat.name || 'Мебель офисная')
        brand = null
        model = null
      }

      const now = Timestamp.now()
      const assetRef = db.collection('assets').doc()

      const assetData: Record<string, unknown> = {
        categoryId: cat.id,
        brand,
        model,
        type,
        invCode,
        serial,
        barcode,
        statusId: 'st_warehouse',
        assignment: null,
        branchId: pickBranch(),
        deptId: null,
        currentSpecs,
        condition: 'used',
        purchaseDate: null,
        warrantyEndsAt: null,
        createdBy: 'seed-assets-script',
        updatedBy: 'seed-assets-script',
        createdAt: now,
        updatedAt: now,
      }

      pending[group].push({ assetId: assetRef.id, assetData, invCode, barcode })
    }
  }

  // ── 5. Print summary ──────────────────────────────────────────────────────
  let totalPending = 0
  for (const group of groups) {
    const n = pending[group].length
    totalPending += n
    if (n > 0) {
      console.log(`  ${group}: ${n} assets to write (${n * 3} Firestore docs)`)
      // Print 1-2 sample rows per group
      for (const p of pending[group].slice(0, 2)) {
        const d = p.assetData
        const label = d.brand ? `${d.brand} ${d.model}` : String(d.type)
        console.log(`    • ${p.invCode} | ${pending[group].find(x => x === p)?.assetData.categoryId} | ${label} | barcode=${p.barcode}`)
      }
    }
  }
  console.log()
  console.log(`Total assets: ${totalPending} (${totalPending * 3} Firestore docs in ${Math.ceil(totalPending * 3 / 400)} batch(es))`)

  if (flags.dryRun) {
    console.log('\n(dry-run — nothing written)')
    return
  }

  // ── 6. Write in batches (≤ 400 ops each) ─────────────────────────────────
  const allPending: PendingAsset[] = [
    ...pending.devices,
    ...pending.network,
    ...pending.furniture,
  ]

  const OPS_PER_ASSET = 3  // assets + inv_codes + barcodes
  const MAX_OPS = 400

  let batchIndex = 0
  let batch = db.batch()
  let opsInBatch = 0
  let written = 0

  async function flushBatch() {
    if (opsInBatch === 0) return
    await batch.commit()
    batchIndex++
    batch = db.batch()
    opsInBatch = 0
  }

  for (const p of allPending) {
    if (opsInBatch + OPS_PER_ASSET > MAX_OPS) {
      await flushBatch()
    }

    const assetRef = db.collection('assets').doc(p.assetId)
    const lockId = invCodeLockId(p.invCode)
    const invRef = db.collection('inv_codes').doc(lockId)
    const bcRef = db.collection('barcodes').doc(p.barcode)
    const now = Timestamp.now()

    // create() (not set()) so the batch ABORTS if any doc already exists — the
    // asset id is a fresh auto-id (never collides), and this prevents silently
    // clobbering a pre-existing inv_codes/barcodes uniqueness lock (which would
    // repoint the ledger and corrupt uniqueness enforcement).
    batch.create(assetRef, p.assetData)
    batch.create(invRef, { assetId: p.assetId, invCode: p.invCode, createdAt: now })
    batch.create(bcRef, { assetId: p.assetId, createdAt: now })

    opsInBatch += OPS_PER_ASSET
    written++
  }

  await flushBatch()

  console.log(`\nDone. Wrote ${written} assets across ${batchIndex} batch commit(s).`)
  console.log(`  devices: ${pending.devices.length}`)
  console.log(`  network: ${pending.network.length}`)
  console.log(`  furniture: ${pending.furniture.length}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
