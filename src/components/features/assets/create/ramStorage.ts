/**
 * Pure parse/serialize helpers for the spec builders + inventory-code utilities.
 * Ported from prototypes/preview.html (StorageListBuilder / RamListBuilder / nextInvCode).
 */

export const RAM_SIZES = ['4 ГБ', '6 ГБ', '8 ГБ', '12 ГБ', '16 ГБ', '20 ГБ', '32 ГБ', '40 ГБ', '64 ГБ', '128 ГБ']
export const RAM_TYPES = ['DDR3', 'DDR4', 'DDR5']
export const STORAGE_SIZES = ['64 ГБ', '128 ГБ', '256 ГБ', '512 ГБ', '1 ТБ', '2 ТБ']
export const STORAGE_TYPES = ['HDD', 'SSD', 'M.2']

let _seq = 0
const newId = () => `r${(++_seq).toString(36)}${Math.random().toString(36).slice(2, 5)}`

// ---------------------------------------------------------------------------
// Storage: list of { type, size } rows -> "SSD 256 ГБ + HDD 1 ТБ"
// ---------------------------------------------------------------------------
export interface StorageRow { _id: string; type: string; size: string }

export function parseStorageRow(seg: string): { type: string; size: string } | null {
  const trimmed = (seg || '').trim()
  if (!trimmed) return null
  let type = ''
  for (const t of STORAGE_TYPES) {
    const safe = t.replace(/\./g, '\\.')
    if (new RegExp(`(^|[\\s,])${safe}(?=[\\s,]|$)`).test(trimmed)) { type = t; break }
  }
  const safe = type.replace(/\./g, '\\.')
  const size = type
    ? trimmed.replace(new RegExp(`[\\s,]*${safe}[\\s,]*`), ' ').replace(/\s+/g, ' ').trim()
    : trimmed
  return { type, size }
}

export function parseStorageValue(s: string | null | undefined): StorageRow[] {
  if (!s) return [{ _id: newId(), type: 'SSD', size: '' }]
  return s.split(/\s*\+\s*/).map(parseStorageRow).filter(Boolean).map(r => ({ _id: newId(), type: r!.type, size: r!.size }))
}

export function serializeStorage(rows: { type: string; size: string }[]): string {
  return rows
    .filter(r => r.type || r.size)
    .map(r => [r.type, r.size].filter(Boolean).join(' '))
    .join(' + ')
}

// ---------------------------------------------------------------------------
// RAM: one global DDR type + ECC flag + auto-numbered size slots
//   "16 ГБ + 32 ГБ DDR4 ECC"
// ---------------------------------------------------------------------------
export interface RamSlot { _id: string; size: string }
export interface ParsedRam { ddrType: string; ecc: boolean; slots: RamSlot[] }

export function parseRamValue(s: string | null | undefined): ParsedRam {
  if (!s) return { ddrType: '', ecc: false, slots: [{ _id: newId(), size: '' }] }
  let rest = s.trim()
  const eccMatch = rest.match(/\bECC\s*$/i)
  const ecc = !!eccMatch
  if (eccMatch) rest = rest.slice(0, eccMatch.index).trim()
  const ddrMatch = rest.match(/\b(DDR3|DDR4|DDR5)\s*$/i)
  const ddrType = ddrMatch ? ddrMatch[1]!.toUpperCase() : ''
  if (ddrMatch) rest = rest.slice(0, ddrMatch.index).trim()
  const parts = rest ? rest.split(/\s*\+\s*/) : []
  const slots: RamSlot[] = parts.length > 0
    ? parts.map(p => ({ _id: newId(), size: p.trim() }))
    : [{ _id: newId(), size: '' }]
  return { ddrType, ecc, slots }
}

export function serializeRam(slots: { size: string }[], ddrType: string, ecc: boolean): string {
  const filled = slots.map(s => s.size).filter(Boolean)
  if (filled.length === 0) return ''
  let out = filled.join(' + ')
  if (ddrType) out += ' ' + ddrType
  if (ecc) out += ' ECC'
  return out
}

// ---------------------------------------------------------------------------
// Inventory-code increment: preserve zero-padding of the trailing numeric run.
//   nextInvCode('460/00007') -> '460/00008' ; nextInvCode('LAP-099') -> 'LAP-100'
// ---------------------------------------------------------------------------
export function nextInvCode(cur: string | null | undefined): string {
  const m = /^(.+?)(\d+)(\D*)$/.exec(cur || '')
  if (!m) return cur || ''
  const [, head, num, tail] = m
  const padded = String(Number(num) + 1).padStart(num!.length, '0')
  return head! + padded + tail!
}

/** Seed the next code from the largest numeric suffix in a batch of rows. */
export function nextInvFromBatch(rows: { invCode: string }[], fallback: string): string {
  const best = rows.reduce<{ code: string; num: number } | null>((acc, r) => {
    const m = /^(.+?)(\d+)(\D*)$/.exec(r.invCode || '')
    if (!m) return acc
    const num = Number(m[2])
    return !acc || num > acc.num ? { code: r.invCode, num } : acc
  }, null)
  return best ? nextInvCode(best.code) : nextInvCode(fallback)
}

/** Russian noun plural for «актив»: 1 актив · 2 актива · 5 активов. */
export function pluralAssets(n: number): string {
  const mod10 = n % 10, mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'актив'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'актива'
  return 'активов'
}
