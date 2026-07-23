/**
 * Pure validation + reference resolution + inventory-code auto-generation (plan §4, §5).
 *
 * Emits i18n keys ONLY (import.json `errors.*` / `warnings.*`) — locale files are the
 * UI agent's responsibility. Normalization: every cell is trimmed; reference names are
 * matched case-insensitively; emails are compared lower-cased.
 */
import type { CategoryRow, RefRow } from '@/domain/asset'
import { parseInventoryCode } from '@/domain/asset'
import { nextInvCode } from '@/components/features/assets/create/ramStorage'
import type {
  AssetPlanRow, EmployeePlanRow, ImportPlan, ParsedFile, RawAssetRow, RowIssue, ValidateContext,
} from './types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Column headers referenced in `errors.dateInvalid` params (match the template).
const FIELD_PURCHASE = 'Дата покупки'
const FIELD_WARRANTY = 'Гарантия до'

// ---------------------------------------------------------------------------
// Cell parsers (exported for focused testing if ever needed)
// ---------------------------------------------------------------------------

function isoDate(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Accepts an Excel date serial (integer string), `YYYY-MM-DD`, or `DD.MM.YYYY`.
 * Returns a validated `YYYY-MM-DD` or null. Serial epoch: 25569 = 1970-01-01 (UTC-based).
 */
export function parseDateCell(raw: string): string | null {
  if (/^\d+$/.test(raw)) {
    const serial = Number(raw)
    // Plausible Excel serial window (~1913…2149); rejects things like a bare year typo.
    if (serial < 5000 || serial > 91000) return null
    return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().slice(0, 10)
  }
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw)
  if (m) return isoDate(Number(m[3]), Number(m[2]), Number(m[1]))
  return null
}

/** Normalizes ',' → '.', strips regular/non-breaking/narrow spaces. Returns a finite number or null. */
export function parsePriceCell(raw: string): number | null {
  const norm = raw.replace(/[\s  ]/g, '').replace(/,/g, '.')
  if (!/^-?\d+(\.\d+)?$/.test(norm)) return null
  const n = Number(norm)
  return Number.isFinite(n) ? n : null
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function byName<T extends { name: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map(r => [r.name.trim().toLowerCase(), r]))
}

/** Registers rowNumber under a normalized key for intra-file duplicate detection. */
function push(map: Map<string, number[]>, key: string, rowNumber: number): void {
  const list = map.get(key)
  if (list) list.push(rowNumber)
  else map.set(key, [rowNumber])
}

/** The «twin» row for a duplicate error: the first OTHER row sharing the key. */
function twinOf(rows: number[], self: number): number {
  return rows.find(n => n !== self) ?? self
}

function parseNumericInv(code: string): { prefix: string; num: number } | null {
  const p = parseInventoryCode(code)
  if (!p || !/^\d+$/.test(p.number)) return null
  return { prefix: p.prefix, num: Number(p.number) }
}

/** Intermediate per-asset-row state accumulated across the validation passes. */
interface AssetState {
  raw: RawAssetRow
  errors: RowIssue[]
  warnings: RowIssue[]
  cat: CategoryRow | null
  branchId: string | null
  brand: string | null
  model: string | null
  type: string | null
  serial: string | null
  invCode: string | null
  invCodeGenerated: boolean
  assigneeEmail: string | null
  comment: string | null
  price: number | null
  purchaseDate: string | null
  warrantyEndsAt: string | null
}

// ---------------------------------------------------------------------------
// validateImport
// ---------------------------------------------------------------------------

export function validateImport(parsed: ParsedFile, ctx: ValidateContext): ImportPlan {
  const catByName = byName(ctx.categories)
  const branchByName = byName<RefRow>(ctx.branches)
  const deptByName = byName<RefRow>(ctx.departments)
  const activeEmails = new Set(
    ctx.activeEmployees.map(e => e.email?.trim().toLowerCase()).filter((x): x is string => !!x),
  )
  const formerEmails = new Set(ctx.formerEmails.map(e => e.trim().toLowerCase()))
  const dbInv = new Set(ctx.existingAssets.map(a => a.invCode))
  const dbSerial = new Set(ctx.existingAssets.map(a => a.serial).filter((s): s is string => !!s))

  // ---- Employees (E1–E5) --------------------------------------------------

  const empEmailRows = new Map<string, number[]>()
  for (const r of parsed.employees) {
    const em = r.email.trim().toLowerCase()
    if (em) push(empEmailRows, em, r.rowNumber)
  }

  const employees: EmployeePlanRow[] = parsed.employees.map((r) => {
    const errors: RowIssue[] = []
    const warnings: RowIssue[] = []

    // E1
    const firstName = r.firstName.trim()
    const lastName = r.lastName.trim()
    if (!firstName) errors.push({ key: 'errors.firstNameRequired' })
    if (!lastName) errors.push({ key: 'errors.lastNameRequired' })

    // E2 + E3
    const email = r.email.trim().toLowerCase()
    if (!email) errors.push({ key: 'errors.emailRequired' })
    else if (!EMAIL_RE.test(email)) errors.push({ key: 'errors.emailInvalid' })
    else {
      if (activeEmails.has(email)) errors.push({ key: 'errors.emailTaken' })
      if (formerEmails.has(email)) errors.push({ key: 'errors.emailTerminated' })
      const rows = empEmailRows.get(email) ?? []
      if (rows.length > 1) errors.push({ key: 'errors.emailDupInFile', params: { row: twinOf(rows, r.rowNumber) } })
    }

    // E4
    const dept = r.department.trim()
    let departmentId: string | null = null
    if (!dept) errors.push({ key: 'errors.departmentRequired' })
    else {
      const d = deptByName.get(dept.toLowerCase())
      if (!d) errors.push({ key: 'errors.departmentUnknown', params: { value: dept } })
      else departmentId = d.id
    }

    // E5
    const branch = r.branch.trim()
    let branchId: string | null = null
    if (branch) {
      const b = branchByName.get(branch.toLowerCase())
      if (!b) errors.push({ key: 'errors.branchUnknown', params: { value: branch } })
      else branchId = b.id
    }

    if (errors.length > 0) return { rowNumber: r.rowNumber, status: 'error', errors, warnings }
    return {
      rowNumber: r.rowNumber, status: 'ready', errors, warnings,
      input: {
        firstName, lastName, email,
        phone: r.phone.trim() || null,
        position: r.position.trim() || null,
        branchId, departmentId,
      },
    }
  })

  const readyEmployeeEmails = new Set(
    employees.filter(e => e.status === 'ready').map(e => e.input!.email),
  )

  // ---- Assets pass 1: resolve categories, collect intra-file pools --------

  const states: AssetState[] = parsed.assets.map(r => ({
    raw: r, errors: [], warnings: [],
    cat: catByName.get(r.category.trim().toLowerCase()) ?? null,
    branchId: null, brand: null, model: null, type: null, serial: null,
    invCode: null, invCodeGenerated: false,
    assigneeEmail: null, comment: null, price: null,
    purchaseDate: null, warrantyEndsAt: null,
  }))

  const serialRowsMap = new Map<string, number[]>()
  const invRowsMap = new Map<string, number[]>()
  const fileExplicitByCat = new Map<string, string[]>()
  /** Every explicit code in the file reserves its value, valid row or not. */
  const usedInFile = new Set<string>()

  for (const st of states) {
    const explicitInv = st.raw.invCode.trim()
    if (explicitInv) {
      push(invRowsMap, explicitInv, st.raw.rowNumber)
      usedInFile.add(explicitInv)
      if (st.cat) {
        const list = fileExplicitByCat.get(st.cat.id)
        if (list) list.push(explicitInv)
        else fileExplicitByCat.set(st.cat.id, [explicitInv])
      }
    }
    // Furniture serials are dropped (A3) — they do not participate in uniqueness pools.
    const effSerial = st.cat?.hasTypeField ? '' : st.raw.serial.trim()
    if (effSerial) push(serialRowsMap, effSerial, st.raw.rowNumber)
  }

  // ---- Assets pass 2: per-row rules (A1–A9 except generation) -------------

  for (const st of states) {
    const r = st.raw
    const { errors, warnings } = st

    // A1
    const catRaw = r.category.trim()
    if (!catRaw) errors.push({ key: 'errors.categoryRequired' })
    else if (!st.cat) errors.push({ key: 'errors.categoryUnknown', params: { value: catRaw } })

    // A2
    const branchRaw = r.branch.trim()
    if (!branchRaw) errors.push({ key: 'errors.branchRequired' })
    else {
      const b = branchByName.get(branchRaw.toLowerCase())
      if (!b) errors.push({ key: 'errors.branchUnknown', params: { value: branchRaw } })
      else st.branchId = b.id
    }

    // A3 — identity shape by category flags
    const brandRaw = r.brand.trim()
    const modelRaw = r.model.trim()
    const serialRaw = r.serial.trim()
    if (st.cat) {
      if (st.cat.hasTypeField) {
        // Furniture: Модель → type; brand/serial forced null
        if (!modelRaw) errors.push({ key: 'errors.modelRequired' })
        else st.type = modelRaw
        if (brandRaw || serialRaw) warnings.push({ key: 'warnings.furnitureExtrasIgnored' })
      } else {
        if (!brandRaw) errors.push({ key: 'errors.brandRequired' })
        else st.brand = brandRaw
        if (!modelRaw) errors.push({ key: 'errors.modelRequired' })
        else st.model = modelRaw
        if (st.cat.requiresSerial && !serialRaw) errors.push({ key: 'errors.serialRequired' })
        st.serial = serialRaw || null
      }
    }

    // A4 — serial uniqueness (non-empty, non-furniture only)
    const effSerial = st.cat?.hasTypeField ? '' : serialRaw
    if (effSerial) {
      if (dbSerial.has(effSerial)) errors.push({ key: 'errors.serialTaken', params: { value: effSerial } })
      const rows = serialRowsMap.get(effSerial) ?? []
      if (rows.length > 1) errors.push({ key: 'errors.serialDupInFile', params: { row: twinOf(rows, r.rowNumber) } })
    }

    // A5 — explicit inv code uniqueness (auto-generation happens in pass 3)
    const explicitInv = r.invCode.trim()
    if (explicitInv) {
      if (dbInv.has(explicitInv)) errors.push({ key: 'errors.invTaken', params: { value: explicitInv } })
      const rows = invRowsMap.get(explicitInv) ?? []
      if (rows.length > 1) errors.push({ key: 'errors.invDupInFile', params: { row: twinOf(rows, r.rowNumber) } })
      st.invCode = explicitInv
    }

    // A6 — assignee
    const aeRaw = r.assigneeEmail.trim().toLowerCase()
    if (aeRaw) {
      if (!EMAIL_RE.test(aeRaw)) errors.push({ key: 'errors.assigneeEmailInvalid' })
      else if (formerEmails.has(aeRaw)) errors.push({ key: 'errors.assigneeTerminated' })
      else if (!activeEmails.has(aeRaw) && !readyEmployeeEmails.has(aeRaw)) {
        errors.push({ key: 'errors.assigneeUnknown', params: { value: aeRaw } })
      } else st.assigneeEmail = aeRaw
    }

    // A7 — price
    const priceRaw = r.price.trim()
    if (priceRaw) {
      const n = parsePriceCell(priceRaw)
      if (n === null) errors.push({ key: 'errors.priceInvalid' })
      else if (n < 0) errors.push({ key: 'errors.priceNegative' })
      else st.price = n
    }

    // A8 — dates: both-or-neither; historical purchases expected and allowed
    const pRaw = r.purchaseDate.trim()
    const wRaw = r.warrantyEndsAt.trim()
    if (!!pRaw !== !!wRaw) errors.push({ key: 'errors.datesPairRequired' })
    else if (pRaw && wRaw) {
      const p = parseDateCell(pRaw)
      const w = parseDateCell(wRaw)
      if (!p) errors.push({ key: 'errors.dateInvalid', params: { field: FIELD_PURCHASE } })
      if (!w) errors.push({ key: 'errors.dateInvalid', params: { field: FIELD_WARRANTY } })
      if (p && w) {
        if (p > ctx.today) errors.push({ key: 'errors.purchaseInFuture' })
        if (w <= p) errors.push({ key: 'errors.warrantyBeforePurchase' })
        st.purchaseDate = p
        st.warrantyEndsAt = w
      }
    }

    // A9 — comment kept only alongside a valid assignee
    const commentRaw = r.comment.trim()
    if (commentRaw && !aeRaw) warnings.push({ key: 'warnings.commentDropped' })
    st.comment = commentRaw && st.assigneeEmail ? commentRaw : null
  }

  // ---- Assets pass 3: inventory-code auto-generation (§5) -----------------

  /** catId → seed code (last code in the chosen prefix sequence) or null (no parseable prefix). */
  const genSeed = new Map<string, string | null>()

  const initSeed = (catId: string): string | null => {
    const pool = [
      ...ctx.existingAssets.filter(a => a.categoryId === catId).map(a => a.invCode),
      ...(fileExplicitByCat.get(catId) ?? []),
    ]
    const stats = new Map<string, { count: number; maxNum: number; maxCode: string }>()
    for (const code of pool) {
      const p = parseNumericInv(code)
      if (!p) continue
      const s = stats.get(p.prefix)
      if (!s) stats.set(p.prefix, { count: 1, maxNum: p.num, maxCode: code })
      else {
        s.count++
        if (p.num > s.maxNum) { s.maxNum = p.num; s.maxCode = code }
      }
    }
    let best: { count: number; maxNum: number; maxCode: string } | null = null
    for (const s of stats.values()) {
      if (!best || s.count > best.count || (s.count === best.count && s.maxNum > best.maxNum)) best = s
    }
    return best ? best.maxCode : null
  }

  for (const st of states) {
    if (st.raw.invCode.trim() || st.errors.length > 0 || !st.cat) continue
    const catId = st.cat.id
    if (!genSeed.has(catId)) genSeed.set(catId, initSeed(catId))
    const seed = genSeed.get(catId)!
    if (seed === null) {
      st.errors.push({ key: 'errors.invPrefixUndetermined' })
      continue
    }
    // Generated codes join the intra-file pool; skip over any code already reserved.
    let candidate = nextInvCode(seed)
    let guard = 0
    while ((usedInFile.has(candidate) || dbInv.has(candidate)) && guard++ < 100_000) {
      candidate = nextInvCode(candidate)
    }
    st.invCode = candidate
    st.invCodeGenerated = true
    usedInFile.add(candidate)
    genSeed.set(catId, candidate)
  }

  // ---- Assemble plan rows -------------------------------------------------

  const assets: AssetPlanRow[] = states.map((st) => {
    const base = {
      rowNumber: st.raw.rowNumber,
      errors: st.errors,
      warnings: st.warnings,
      invCodeGenerated: st.invCodeGenerated,
      ...(st.invCode ? { invCode: st.invCode } : {}),
      assigneeEmail: st.assigneeEmail,
      comment: st.comment,
    }
    if (st.errors.length > 0) return { ...base, status: 'error' as const }
    const hasDates = st.purchaseDate !== null && st.warrantyEndsAt !== null
    return {
      ...base,
      status: 'ready' as const,
      input: {
        categoryId: st.cat!.id,
        brand: st.brand,
        model: st.model,
        type: st.type,
        invCode: st.invCode!,
        serial: st.serial,
        branchId: st.branchId!,
        assignment: null,
        deptId: null,
        ...(hasDates ? { condition: 'new' as const, purchaseDate: st.purchaseDate, warrantyEndsAt: st.warrantyEndsAt } : {}),
        ...(st.price !== null ? { priceAmount: st.price } : {}),
      },
    }
  })

  const readyEmployees = employees.filter(e => e.status === 'ready').length
  const readyAssets = assets.filter(a => a.status === 'ready').length
  return {
    employees, assets,
    readyEmployees, errorEmployees: employees.length - readyEmployees,
    readyAssets, errorAssets: assets.length - readyAssets,
  }
}
