import {
  collection, getDocs, getDoc, doc, query as fsQuery, where, orderBy, limit,
  serverTimestamp, runTransaction, onSnapshot,
  type Firestore, type QueryConstraint, type Transaction,
} from 'firebase/firestore'
import type {
  Asset, AssetListQuery, AssetSort, CategoryRow, CategoryGroupRow, StatusRow, RefRow, EmployeeRow,
  AssetStatusId, AssetAssignment, AssetSpecs,
} from '@/domain/asset'
import type {
  AssetRepository, AssetReferenceData, AssetWriteRepository,
  CreateAssetInput, UpdateAssetInput, ChangeStatusOpts, Actor,
  SelfServiceRefData,
} from '@/domain/asset'
import type { UpgradeComponent, UpgradeEvent } from '@/domain/asset'
import { deriveCreateStatus, isSpecTracked, SPEC_KEY, ASSET_STATUS } from '@/domain/asset'
import {
  DuplicateInvCodeError, ConcurrentEditError, BatchTooLargeError, BatchLicenseUnsupportedError,
  invCodeLockId,
} from '@/domain/asset/errors'
import { generateBarcodeCandidate } from '@/domain/asset/barcode'
import { HEAD_OFFICE_BRANCH_ID } from '@/domain/asset/transferRules'
import { firestoreAuditContext, withAudit, buildAuditDocData } from '@/lib/audit'
import type { AuditedResult, AuditLog } from '@/domain/audit'
import type { WorkstationLicenseRepository } from '@/domain/license'

/** Maximum number of assets allowed in a single atomic batch. 4 writes per asset
 *  (asset doc + inv_codes lock + barcodes lock + audit_logs entry) and Firestore
 *  transactions are capped at 500 operations. 100 × 4 = 400 < 500 → safe headroom. */
const MAX_BATCH_SIZE = 100

const SERVER_SORT: Record<AssetSort, [string, 'asc' | 'desc']> = {
  updated_desc: ['updatedAt', 'desc'],
  updated_asc: ['updatedAt', 'asc'],
  name_asc: ['brand', 'asc'],
  name_desc: ['brand', 'desc'],
  inv_asc: ['invCode', 'asc'],
}

function toIso(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString()
  }
  return new Date(0).toISOString()
}

function toAsset(id: string, d: Record<string, unknown>): Asset {
  return {
    id,
    categoryId: String(d.categoryId ?? ''),
    brand: (d.brand as string | null) ?? null,
    model: (d.model as string | null) ?? null,
    type: (d.type as string | null) ?? null,
    invCode: String(d.invCode ?? ''),
    serial: (d.serial as string | null) ?? null,
    barcode: (d.barcode as string | null) ?? null,
    statusId: String(d.statusId ?? ''),
    assignment: (d.assignment as Asset['assignment']) ?? null,
    branchId: String(d.branchId ?? ''),
    deptId: (d.deptId as string | null) ?? null,
    updatedAt: toIso(d.updatedAt),
    currentSpecs: (d.currentSpecs as Asset['currentSpecs']) ?? null,
    condition: (d.condition as Asset['condition']) ?? null,
    purchaseDate: (d.purchaseDate as string | null) ?? null,
    warrantyEndsAt: (d.warrantyEndsAt as string | null) ?? null,
    ...(typeof d.priceAmount === 'number' ? { priceAmount: d.priceAmount } : {}),
  }
}

/**
 * Maps a raw Firestore categoryGroups document to a CategoryGroupRow.
 * Fail-safe: missing fields fall back to safe defaults.
 */
function mapCategoryGroup(d: Record<string, unknown>): Omit<CategoryGroupRow, 'id'> {
  return {
    name: String(d.name ?? ''),
    lucideIcon: String(d.lucideIcon ?? 'package'),
    order: Number(d.order ?? 0),
  }
}

/**
 * Maps a raw Firestore category document to a CategoryRow.
 *
 * Resolution: the four capability flags (hasSpecs, hasOemLicense, requiresSerial,
 * hasTypeField) are preserved ONLY when the doc carries an explicit boolean value.
 * When a flag is absent from the doc, the key is omitted entirely so that
 * `resolveCategoryCapabilities()` can fall through to the static taxonomy /
 * heuristic fallback. exactOptionalPropertyTypes is ON — never assign undefined;
 * use conditional spread so the key is absent when not present.
 *
 * categoryGroupId: resolved from the doc's own field, falling back to the behavior
 * group string for legacy docs that predate the taxonomy feature (Task 5 migration).
 *
 * Shared between loadSelfServiceRefData() and fetchReferenceData() to prevent drift.
 */
function mapCategory(d: Record<string, unknown>): Omit<CategoryRow, 'id'> {
  return {
    name: String(d.name ?? ''),
    categoryGroupId: String(d.categoryGroupId ?? d.group ?? 'devices'),
    group: (d.group as CategoryRow['group']) ?? 'devices',
    lucideIcon: String(d.lucideIcon ?? 'package'),
    ...(typeof d.hasSpecs === 'boolean' ? { hasSpecs: d.hasSpecs } : {}),
    ...(typeof d.hasOemLicense === 'boolean' ? { hasOemLicense: d.hasOemLicense } : {}),
    ...(typeof d.requiresSerial === 'boolean' ? { requiresSerial: d.requiresSerial } : {}),
    ...(typeof d.hasTypeField === 'boolean' ? { hasTypeField: d.hasTypeField } : {}),
  }
}

/**
 * Production read adapter. Status + branch equality filters and the sort field run
 * server-side (composite indexes — see firestore.indexes.json). Group (needs a
 * category lookup) and free-text search run client-side over the returned set,
 * matching the org-scale dataset (hundreds of assets).
 */
export class FirestoreAssetRepository implements AssetRepository, AssetWriteRepository {
  constructor(
    private readonly db: Firestore,
    /**
     * Optional workstation-license repository. When provided, `createAsset` creates
     * or re-binds a device-bound OEM license whenever `input.oemLicense` is set.
     * The license doc is written as a SEPARATE audited call after the asset transaction
     * (not inside the same `runTransaction`). The raw OEM secret is persisted by the
     * `setLicenseKey` callable in the create page — never in this repo.
     *
     * Asset + license-doc are created as sequential audited writes; the raw OEM secret
     * is persisted by the setLicenseKey callable in the create page. A future hardening
     * could merge the two doc writes into one runTransaction.
     */
    private readonly licenses?: WorkstationLicenseRepository,
  ) {}

  // Lazy audit context — avoids constructing the context (and any circular import
  // evaluation) until the first write call.
  private get audit() { return firestoreAuditContext(this.db) }

  // FIX 4: instance-level cache so loadReferenceData() is fetched at most once
  // per repository instance, regardless of how many callers (listAssets group filter
  // + useAssets hook) call it concurrently.
  // The cache is cleared on rejection so a transient failure (e.g. permission-denied
  // on former_employees before rules are deployed) doesn't permanently poison the cache.
  // TTL: when the repo instance is shared across navigations (module singleton in
  // AssetsPage), the cache expires after 60s so catalog/employee edits made elsewhere
  // still show up on the next visit without a full-session stale cache.
  private refCache: Promise<AssetReferenceData> | null = null
  private refCacheAt = 0
  private static readonly REF_TTL_MS = 60_000

  async listAssets(query: AssetListQuery): Promise<Asset[]> {
    const cons: QueryConstraint[] = []
    if (query.statusId && query.statusId !== 'all') cons.push(where('statusId', '==', query.statusId))
    if (query.branchId && query.branchId !== 'all') cons.push(where('branchId', '==', query.branchId))
    const [field, dir] = SERVER_SORT[query.sort ?? 'updated_desc']
    cons.push(orderBy(field, dir))
    const snap = await getDocs(fsQuery(collection(this.db, 'assets'), ...cons))
    let rows = snap.docs.map(d => toAsset(d.id, d.data() as Record<string, unknown>))

    if (query.group && query.group !== 'all') {
      const ref = await this.loadReferenceData()
      const catGroup = new Map(ref.categories.map(c => [c.id, c.group]))
      rows = rows.filter(a => catGroup.get(a.categoryId) === query.group)
    }
    const search = (query.search ?? '').trim().toLowerCase()
    if (search) {
      rows = rows.filter(a =>
        [a.invCode, a.brand, a.model, a.serial].filter(Boolean).join(' ').toLowerCase().includes(search),
      )
    }
    return rows
  }

  async loadReferenceData(): Promise<AssetReferenceData> {
    const expired = Date.now() - this.refCacheAt > FirestoreAssetRepository.REF_TTL_MS
    if (!this.refCache || expired) {
      this.refCacheAt = Date.now()
      // Clear the cache on rejection so a transient error (e.g. permission-denied
      // on former_employees before rules are deployed) doesn't permanently poison
      // the in-memory cache and make all subsequent calls fail without hitting Firebase.
      this.refCache = this.fetchReferenceData().catch((err) => {
        this.refCache = null
        throw err
      })
    }
    return this.refCache
  }

  async listAssetsForEmployee(employeeId: string): Promise<Asset[]> {
    const snap = await getDocs(fsQuery(
      collection(this.db, 'assets'), where('assignment.employeeId', '==', employeeId),
    ))
    return snap.docs.map(d => toAsset(d.id, d.data() as Record<string, unknown>))
  }

  subscribeAssetsForEmployee(
    employeeId: string,
    onData: (assets: Asset[]) => void,
    onError?: (err: unknown) => void,
  ): () => void {
    const q = fsQuery(
      collection(this.db, 'assets'), where('assignment.employeeId', '==', employeeId),
    )
    return onSnapshot(
      q,
      snap => onData(snap.docs.map(d => toAsset(d.id, d.data() as Record<string, unknown>))),
      err => onError?.(err),
    )
  }

  async loadSelfServiceRefData(): Promise<SelfServiceRefData> {
    const [statuses, categories, branches, departments] = await Promise.all([
      this.readCol<StatusRow>('asset_statuses', d => ({ name: String(d.name ?? ''), color: String(d.color ?? 'gray') })),
      this.readCol<CategoryRow>('categories', mapCategory),
      this.readCol<RefRow>('branches', d => ({ name: String(d.name ?? '') })),
      this.readCol<RefRow>('departments', d => ({ name: String(d.name ?? '') })),
    ])
    return { statuses, categories, branches, departments }
  }

  private async fetchReferenceData(): Promise<AssetReferenceData> {
    const empMap = (d: Record<string, unknown>) => ({
      firstName: (d.firstName as string | null) ?? null,
      lastName: (d.lastName as string | null) ?? null,
      email: (d.email as string | null) ?? null,
      departmentId: (d.departmentId as string | null) ?? null,
      position: (d.position as string | null) ?? null,
    })
    // former_employees is read fail-soft: if the collection is undeployable/unreachable
    // (e.g. Firestore rules not yet deployed to live), it degrades to an empty list
    // rather than rejecting the entire Promise.all and bricking every page.
    // categoryGroups is also read fail-soft: a missing or inaccessible collection
    // degrades to an empty list (no tabs rendered) rather than crashing the create form.
    // Core ref data (statuses, branches, departments, categories, active employees)
    // remain strict — those must succeed for the app to function.
    const [statuses, branches, departments, categories, activeEmps, formerEmps, rawGroups] = await Promise.all([
      this.readCol<StatusRow>('asset_statuses', d => ({ name: String(d.name ?? ''), color: String(d.color ?? 'gray') })),
      this.readCol<RefRow>('branches', d => ({ name: String(d.name ?? '') })),
      this.readCol<RefRow>('departments', d => ({ name: String(d.name ?? '') })),
      this.readCol<CategoryRow>('categories', mapCategory),
      this.readCol<EmployeeRow>('employees', empMap),
      this.readCol<EmployeeRow>('former_employees', empMap).catch(() => [] as EmployeeRow[]),
      this.readCol<CategoryGroupRow>('categoryGroups', mapCategoryGroup).catch(() => [] as CategoryGroupRow[]),
    ])
    const seen = new Set(activeEmps.map(e => e.id))
    const employees = [...activeEmps, ...formerEmps.filter(e => !seen.has(e.id))]
    const categoryGroups = [...rawGroups].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    return { statuses, branches, departments, categories, employees, categoryGroups }
  }

  // FIX 7: mapper returns Omit<T,'id'> — no id:'' placeholder needed.
  // The id is always spread in from d.id after mapping.
  private async readCol<T extends { id: string }>(
    name: string, map: (d: Record<string, unknown>) => Omit<T, 'id'>,
  ): Promise<T[]> {
    const snap = await getDocs(collection(this.db, name))
    return snap.docs.map(d => ({ ...map(d.data() as Record<string, unknown>), id: d.id } as T))
  }

  async getAsset(id: string): Promise<Asset | null> {
    const snap = await getDoc(doc(this.db, 'assets', id))
    return snap.exists() ? toAsset(snap.id, snap.data() as Record<string, unknown>) : null
  }

  async findByInvCode(invCode: string): Promise<Asset | null> {
    const snap = await getDocs(fsQuery(collection(this.db, 'assets'), where('invCode', '==', invCode), limit(1)))
    if (snap.empty) return null
    const d = snap.docs[0]!
    return toAsset(d.id, d.data() as Record<string, unknown>)
  }

  async findByBarcode(barcode: string): Promise<Asset | null> {
    const snap = await getDocs(fsQuery(collection(this.db, 'assets'), where('barcode', '==', barcode), limit(1)))
    if (snap.empty) return null
    const d = snap.docs[0]!
    return toAsset(d.id, d.data() as Record<string, unknown>)
  }

  async isBarcodeTaken(barcode: string, exceptId?: string): Promise<boolean> {
    const snap = await getDocs(fsQuery(collection(this.db, 'assets'), where('barcode', '==', barcode), limit(2)))
    return snap.docs.some(d => d.id !== exceptId)
  }

  async isInvCodeTaken(invCode: string, exceptId?: string): Promise<boolean> {
    const snap = await getDocs(fsQuery(collection(this.db, 'assets'), where('invCode', '==', invCode), limit(2)))
    return snap.docs.some(d => d.id !== exceptId)
  }

  async isSerialTaken(serial: string, exceptId?: string): Promise<boolean> {
    const snap = await getDocs(fsQuery(collection(this.db, 'assets'), where('serial', '==', serial), limit(2)))
    return snap.docs.some(d => d.id !== exceptId)
  }

  /** Atomically reserves a unique barcode by creating its /barcodes/{code} lock doc in a
   *  transaction. Two concurrent reservations of the same code can't both commit. Tries
   *  `preferred` first (if given), then random candidates. */
  private async reserveBarcode(assetId: string, preferred?: string): Promise<string> {
    const candidates = (preferred ? [preferred] : []).concat(
      Array.from({ length: 20 }, () => generateBarcodeCandidate()),
    )
    for (const code of candidates) {
      const lockRef = doc(this.db, 'barcodes', code)
      const ok = await runTransaction(this.db, async (txn) => {
        const snap = await txn.get(lockRef)
        if (snap.exists()) return false
        txn.set(lockRef, { assetId, createdAt: serverTimestamp() })
        return true
      })
      if (ok) return code
    }
    throw new Error('Could not reserve a unique barcode after multiple attempts')
  }

  async createAsset(input: CreateAssetInput, actor: Actor): Promise<AuditedResult<Asset>> {
    // Fast pre-checks (outside the txn) for a friendly error before barcode reservation.
    if (await this.isInvCodeTaken(input.invCode)) throw new DuplicateInvCodeError(input.invCode)
    if (input.serial && await this.isSerialTaken(input.serial)) throw new Error(`Serial already in use: ${input.serial}`)
    const ref = doc(collection(this.db, 'assets'))
    const barcode = await this.reserveBarcode(ref.id, input.barcode)
    const statusId = deriveCreateStatus(input.assignment)
    const data: Record<string, unknown> = stripUndefinedFs({
      categoryId: input.categoryId, brand: input.brand, model: input.model,
      type: input.type,
      invCode: input.invCode, serial: input.serial, barcode, statusId,
      assignment: input.assignment, branchId: input.branchId, deptId: input.deptId,
      currentSpecs: input.currentSpecs ?? null,
      condition: input.condition,
      purchaseDate: input.condition === 'new' ? input.purchaseDate : null,
      warrantyEndsAt: input.condition === 'new' ? input.warrantyEndsAt : null,
      ...(input.priceAmount != null ? { priceAmount: input.priceAmount } : {}),
      createdBy: actor.uid, updatedBy: actor.uid,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    // FIX 1: invCode uniqueness lock written inside the same txn as the asset doc.
    // The get() comes FIRST (Firestore web SDK requires all reads before any writes).
    const invLockRef = doc(this.db, 'inv_codes', invCodeLockId(input.invCode))
    const r = await withAudit(this.audit,
      { entityType: 'asset', entityId: ref.id, action: 'created', actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
        after: { invCode: input.invCode, statusId } },
      async (txn) => {
        const t = txn as unknown as Transaction
        // READ phase: check the lock atomically (prevents TOCTOU window from pre-check).
        const lockSnap = await t.get(invLockRef)
        if (lockSnap.exists()) throw new DuplicateInvCodeError(input.invCode)
        // WRITE phase: asset doc + invCode lock (barcode lock already committed by reserveBarcode).
        t.set(ref, data)
        t.set(invLockRef, { assetId: ref.id, invCode: input.invCode, createdAt: serverTimestamp() })
        return { value: undefined as unknown as void }
      })
    const created = await this.getAsset(ref.id)
    if (!created) throw new Error('Asset create succeeded but readback failed')

    // License coupling — runs AFTER the asset transaction so the new asset id is stable.
    // The license doc (and its masked audit entry) are written by the license repo in a
    // separate audited call. The raw OEM secret is NOT written here — the create page
    // calls the setLicenseKey Cloud Function after this method returns.
    // Asset + license-doc are created as sequential audited writes; a future hardening
    // could merge the two doc writes into one runTransaction.
    if (input.oemLicense && this.licenses) {
      if ('kind' in input.oemLicense && input.oemLicense.kind === 'manual') {
        // Manual/retail product key — type:'Retail', isReusable:true
        const manualName = [input.brand, input.model].filter(Boolean).join(' ').trim()
          ? `${[input.brand, input.model].filter(Boolean).join(' ')} — Ключ продукта`
          : 'Лицензия ОС'
        await this.licenses.createLicense({
          name: manualName,
          type: 'Retail',
          isReusable: true,
          rawKey: input.oemLicense.rawKey,
          assign: { to: 'device', assetId: ref.id },
        }, actor)
      } else if ('kind' in input.oemLicense && input.oemLicense.kind === 'oem-digital') {
        // Firmware-embedded OEM — type:'OEM', isReusable:false, NO rawKey
        const oemName = ['OEM —', input.brand, input.model].filter(Boolean).join(' ').trim()
          || 'OEM License'
        await this.licenses.createLicense({
          name: oemName,
          type: 'OEM',
          isReusable: false,
          assign: { to: 'device', assetId: ref.id },
        }, actor)
      } else if ('existingLicenseId' in input.oemLicense) {
        // existingLicenseId branch — re-bind an existing unassigned license to this device
        await this.licenses.assignLicense(
          input.oemLicense.existingLicenseId,
          { to: 'device', assetId: ref.id },
          actor,
        )
      }
    }

    return { value: created, auditId: r.auditId }
  }

  /**
   * FIX 4 — Atomic group registration in a single Firestore transaction.
   *
   * Op count per asset: 1 asset doc + 1 inv_codes lock + 1 barcodes lock + 1 audit_logs entry = 4.
   * Cap: 100 inputs × 4 = 400 ops < 500-op Firestore transaction limit.
   *
   * Transaction structure (reads MUST come before writes in the Firestore web SDK):
   *   READ phase:  for each input, get inv_codes lock; for barcode candidates, get lock refs.
   *   WRITE phase: set asset doc, inv_codes lock, barcodes lock, audit_logs entry.
   */
  async createAssetsBatch(inputs: CreateAssetInput[], actor: Actor): Promise<Asset[]> {
    // Guard: batch size
    if (inputs.length > MAX_BATCH_SIZE) throw new BatchTooLargeError(inputs.length, MAX_BATCH_SIZE)
    // Guard: no oemLicense in batch (group-mode UI never sends it; fail fast)
    for (const input of inputs) {
      if (input.oemLicense) throw new BatchLicenseUnsupportedError()
    }
    // Pre-validation (friendly errors before touching the txn)
    assertBatchUnique(inputs)
    for (const input of inputs) {
      if (await this.isInvCodeTaken(input.invCode)) throw new DuplicateInvCodeError(input.invCode)
      if (input.serial && await this.isSerialTaken(input.serial)) throw new Error(`Serial already in use: ${input.serial}`)
    }

    // Pre-allocate asset doc refs (ids must be known before the txn for audit specs)
    const assetRefs = inputs.map(() => doc(collection(this.db, 'assets')))
    const invLockRefs = inputs.map(inp => doc(this.db, 'inv_codes', invCodeLockId(inp.invCode)))

    // Build per-input barcode candidate lists (preferred + 20 generated)
    const barcodeCandidateLists = inputs.map(inp =>
      (inp.barcode ? [inp.barcode] : []).concat(Array.from({ length: 20 }, () => generateBarcodeCandidate())),
    )

    const ids = assetRefs.map(r => r.id)

    await runTransaction(this.db, async (txn) => {
      // ---- READ PHASE ----
      // 1. Inv_code lock reads — detect race conditions missed by pre-check
      const invLockSnaps = await Promise.all(invLockRefs.map(r => txn.get(r)))
      for (let i = 0; i < inputs.length; i++) {
        if (invLockSnaps[i]!.exists()) throw new DuplicateInvCodeError(inputs[i]!.invCode)
      }

      // 2. Barcode candidate reads — find a free slot per input (within-batch distinct)
      const reservedBarcodes = new Set<string>()
      const chosenBarcodes: string[] = []
      for (let i = 0; i < inputs.length; i++) {
        const candidates = barcodeCandidateLists[i]!
        let chosen: string | null = null
        for (const candidate of candidates) {
          if (reservedBarcodes.has(candidate)) continue
          const snap = await txn.get(doc(this.db, 'barcodes', candidate))
          if (!snap.exists()) {
            chosen = candidate
            break
          }
        }
        if (!chosen) throw new Error(`Could not reserve a unique barcode for asset ${i + 1} in the batch after multiple attempts`)
        reservedBarcodes.add(chosen)
        chosenBarcodes.push(chosen)
      }

      // ---- WRITE PHASE ----
      const at = serverTimestamp()
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i]!
        const assetRef = assetRefs[i]!
        const invLockRef = invLockRefs[i]!
        const barcode = chosenBarcodes[i]!
        const statusId = deriveCreateStatus(input.assignment)

        const assetData: Record<string, unknown> = stripUndefinedFs({
          categoryId: input.categoryId, brand: input.brand, model: input.model,
          type: input.type,
          invCode: input.invCode, serial: input.serial, barcode, statusId,
          assignment: input.assignment, branchId: input.branchId, deptId: input.deptId,
          currentSpecs: input.currentSpecs ?? null,
          condition: input.condition,
          purchaseDate: input.condition === 'new' ? input.purchaseDate : null,
          warrantyEndsAt: input.condition === 'new' ? input.warrantyEndsAt : null,
          ...(input.priceAmount != null ? { priceAmount: input.priceAmount } : {}),
          createdBy: actor.uid, updatedBy: actor.uid,
          createdAt: at, updatedAt: at,
        })

        txn.set(assetRef, assetData)
        txn.set(invLockRef, { assetId: ids[i], invCode: input.invCode, createdAt: at })
        txn.set(doc(this.db, 'barcodes', barcode), { assetId: ids[i], createdAt: at })

        const auditRef = doc(collection(this.db, 'audit_logs'))
        const auditSpec = {
          entityType: 'asset' as const,
          entityId: ids[i]!,
          action: 'created' as const,
          actorUid: actor.uid,
          actorRole: actor.role,
          actorName: actor.displayName ?? null,
        }
        txn.set(auditRef, buildAuditDocData(
          auditSpec,
          null,
          { invCode: input.invCode, statusId },
          at,
        ))
      }
    })

    // Read back all created assets in input order
    const created = await Promise.all(ids.map(id => this.getAsset(id)))
    return created.map((a, i) => {
      if (!a) throw new Error(`Batch create succeeded but readback failed for asset at index ${i}`)
      return a
    })
  }

  async updateAsset(id: string, patch: UpdateAssetInput, actor: Actor, opts?: { expectedUpdatedAt?: string }): Promise<AuditedResult<Asset>> {
    // Serial pre-check runs outside the txn (queries are not allowed inside Firestore txns).
    if (patch.serial && await this.isSerialTaken(patch.serial, id)) throw new Error(`Serial already in use: ${patch.serial}`)
    const ref = doc(this.db, 'assets', id)
    const fields = stripUndefinedFs({ ...patch, updatedBy: actor.uid, updatedAt: serverTimestamp() })
    // FIX 3: existence read + optimistic lock check INSIDE the txn for atomicity.
    // The before snapshot is returned from the mutate callback so buildAuditDocData
    // (inside firestoreAuditContext.run) picks it up via `before` — no spec.before needed.
    const r = await withAudit(this.audit,
      { entityType: 'asset', entityId: id, action: 'updated', actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
        after: patch as Record<string, unknown> },
      async (txn) => {
        const t = txn as unknown as Transaction
        // READ phase: existence + optimistic lock
        const snap = await t.get(ref)
        if (!snap.exists()) throw new Error(`Asset not found: ${id}`)
        const d = snap.data() as Record<string, unknown>
        if (opts?.expectedUpdatedAt !== undefined) {
          const stored = toIso(d.updatedAt)
          if (stored !== opts.expectedUpdatedAt) throw new ConcurrentEditError(id)
        }
        const before = {
          brand: (d.brand as Asset['brand']) ?? null,
          model: (d.model as Asset['model']) ?? null,
          serial: (d.serial as Asset['serial']) ?? null,
        }
        // WRITE phase
        t.set(ref, fields, { merge: true })
        return { value: undefined as unknown as void, before }
      })
    const next = await this.getAsset(id)
    if (!next) throw new Error('Asset update succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }

  async changeStatus(id: string, toStatusId: AssetStatusId, actor: Actor, opts?: ChangeStatusOpts): Promise<AuditedResult<Asset>> {
    const before = await this.getAsset(id)
    if (!before) throw new Error(`Asset not found: ${id}`)
    const ref = doc(this.db, 'assets', id)
    const patch: Record<string, unknown> = { statusId: toStatusId, updatedBy: actor.uid, updatedAt: serverTimestamp() }
    if (opts && 'assignment' in opts) patch.assignment = opts.assignment ?? null
    if (opts?.branchId !== undefined) patch.branchId = opts.branchId
    if (opts?.deptId !== undefined) patch.deptId = opts.deptId
    const hasAssignment = !!opts && 'assignment' in opts
    const auditBefore: Record<string, unknown> = {
      statusId: before.statusId,
      ...(hasAssignment ? { assignment: before.assignment ?? null } : {}),
    }
    const auditAfter: Record<string, unknown> = {
      statusId: toStatusId,
      ...(hasAssignment ? { assignment: opts!.assignment ?? null } : {}),
    }
    const r = await withAudit(this.audit,
      { entityType: 'asset', entityId: id, action: 'status_changed', actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
        before: auditBefore, after: auditAfter, comment: opts?.comment ?? null },
      async (txn) => { ;(txn as unknown as Transaction).set(ref, patch, { merge: true }); return { value: undefined as unknown as void } })
    const next = await this.getAsset(id)
    if (!next) throw new Error('Asset status change succeeded but readback failed')
    return { value: next, auditId: r.auditId }
  }

  async addUpgrade(id: string, ev: { component: UpgradeComponent; after: string }, actor: Actor): Promise<AuditedResult<UpgradeEvent>> {
    const asset = await this.getAsset(id)
    if (!asset) throw new Error(`Asset not found: ${id}`)
    const before = isSpecTracked(ev.component) ? (asset.currentSpecs?.[SPEC_KEY[ev.component]] ?? null) : null
    const upRef = doc(collection(this.db, 'assets', id, 'upgrades'))
    const assetRef = doc(this.db, 'assets', id)
    const r = await withAudit(this.audit,
      { entityType: 'upgrade', entityId: id, action: 'upgrade_added', actorUid: actor.uid, actorRole: actor.role, actorName: actor.displayName ?? null,
        before: before === null ? null : { value: before }, after: { component: ev.component, value: ev.after } },
      async (txn) => {
        const t = txn as unknown as Transaction
        t.set(upRef, { component: ev.component, before, after: ev.after, changedBy: actor.uid, changedAt: serverTimestamp() })
        if (isSpecTracked(ev.component)) {
          const specs: AssetSpecs = { ...(asset.currentSpecs ?? {}) }
          specs[SPEC_KEY[ev.component]] = ev.after
          t.set(assetRef, { currentSpecs: specs, updatedAt: serverTimestamp(), updatedBy: actor.uid }, { merge: true })
        }
        return { value: undefined as unknown as void }
      })
    const upgrade: UpgradeEvent = { id: upRef.id, component: ev.component, before, after: ev.after, changedAt: new Date().toISOString(), changedBy: actor.uid }
    return { value: upgrade, auditId: r.auditId }
  }

  async listUpgrades(id: string): Promise<UpgradeEvent[]> {
    const snap = await getDocs(fsQuery(collection(this.db, 'assets', id, 'upgrades'), orderBy('changedAt', 'desc')))
    return snap.docs.map(d => {
      const x = d.data() as Record<string, unknown>
      return { id: d.id, component: x.component as UpgradeComponent, before: (x.before as string | null) ?? null,
        after: String(x.after ?? ''), changedAt: toIso(x.changedAt), changedBy: String(x.changedBy ?? '') }
    })
  }

  async bulkChangeAssignment(
    ids: string[],
    assignment: AssetAssignment,
    actor: Actor,
    comment?: string,
  ): Promise<{ assetId: string; auditId: string }[]> {
    // Derive branch/dept from the assignment so bulk handovers keep branchId consistent.
    // Employee mode: deptId cannot be resolved inside the repo (no employee lookup here),
    // so we leave it undefined — existing deptId is preserved rather than forcibly cleared.
    const bulkBranchId = assignment.mode === 'branch' ? (assignment.branchId ?? HEAD_OFFICE_BRANCH_ID) : HEAD_OFFICE_BRANCH_ID
    const bulkDeptId: string | null | undefined =
      assignment.mode === 'department' ? assignment.departmentId
      : assignment.mode === 'employee' ? undefined   // preserve existing
      : null

    // Bounded concurrency: each changeStatus runs its own runTransaction (2 reads + 1
    // audited write). Firing all N at once can saturate the browser's HTTP/2 limit and
    // trigger spurious RESOURCE_EXHAUSTED at large batch sizes. Process in chunks of 5.
    const CHUNK = 5
    const results: { assetId: string; auditId: string }[] = []
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK)
      const part = await Promise.all(
        slice.map(async (id) => {
          const r = await this.changeStatus(id, ASSET_STATUS.assigned, actor, {
            assignment,
            branchId: bulkBranchId,
            ...(bulkDeptId !== undefined ? { deptId: bulkDeptId } : {}),
            ...(comment !== undefined ? { comment } : {}),
          })
          return { assetId: id, auditId: r.auditId }
        }),
      )
      results.push(...part)
    }
    return results
  }

  async listAudit(entityId: string): Promise<AuditLog[]> {
    const snap = await getDocs(fsQuery(collection(this.db, 'audit_logs'),
      where('entityId', '==', entityId), orderBy('at', 'desc')))
    return snap.docs.map(d => {
      const x = d.data() as Record<string, unknown>
      return {
        id: d.id,
        entityType: x.entityType as AuditLog['entityType'],
        entityId: String(x.entityId ?? ''),
        action: x.action as AuditLog['action'],
        actorUid: String(x.actorUid ?? ''),
        actorRole: x.actorRole as AuditLog['actorRole'],
        before: (x.before as AuditLog['before']) ?? null,
        after: (x.after as AuditLog['after']) ?? null,
        comment: (x.comment as string | null) ?? null,
        at: toIso(x.at),
      }
    })
  }
}

function stripUndefinedFs(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
}

/** Throws on the first within-batch duplicate inventory code or serial (GOLDEN RULE). */
export function assertBatchUnique(inputs: CreateAssetInput[]): void {
  const codes = new Set<string>()
  const serials = new Set<string>()
  for (const input of inputs) {
    const code = input.invCode.trim()
    if (codes.has(code)) throw new Error(`Inventory code already in use: ${code}`)
    codes.add(code)
    const serial = input.serial?.trim()
    if (serial) {
      if (serials.has(serial)) throw new Error(`Serial already in use: ${serial}`)
      serials.add(serial)
    }
  }
}
