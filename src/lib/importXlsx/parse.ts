/**
 * Workbook → raw string rows (pure; takes an already-read XLSX.WorkBook).
 *
 * Contract (plan §2):
 *  - sheets are found by name («Сотрудники» / «Активы»); a missing sheet → empty array;
 *  - columns are mapped strictly BY POSITION per the template header contract;
 *  - every cell is `String(v).trim()` — numbers (incl. Excel date serials) keep their raw
 *    string representation here; conversion happens in validate.ts;
 *  - 1-based Excel row numbers are recorded (header = row 1);
 *  - fully-empty rows and rows whose first cell starts with «(пример)» are silently dropped.
 */
import * as XLSX from 'xlsx'
import type { ParsedFile, RawAssetRow, RawEmployeeRow } from './types'
import { ASSET_SHEET, EMPLOYEE_SHEET, EXAMPLE_PREFIX } from './template'

type RawCell = string | number | boolean | Date | null | undefined

function toStr(v: RawCell): string {
  if (v == null) return ''
  // Defensive: a workbook read with { cellDates: true } delivers Date objects.
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).trim()
}

interface SheetRow { rowNumber: number; cells: string[] }

function sheetRows(wb: XLSX.WorkBook, name: string): SheetRow[] {
  const ws = wb.Sheets[name]
  if (!ws) return []
  // { raw: true } keeps numeric cells as numbers (deterministic — no display formatting);
  // toStr() then stringifies them, so Excel date serials arrive as e.g. '45292'.
  const aoa = XLSX.utils.sheet_to_json<RawCell[]>(ws, { header: 1, raw: true, defval: null })
  const rows: SheetRow[] = []
  for (let i = 1; i < aoa.length; i++) { // i = 0 is the header row
    const cells = (aoa[i] ?? []).map(toStr)
    if (cells.every(c => c === '')) continue
    if ((cells[0] ?? '').startsWith(EXAMPLE_PREFIX)) continue
    rows.push({ rowNumber: i + 1, cells })
  }
  return rows
}

const cell = (r: SheetRow, i: number): string => r.cells[i] ?? ''

export function parseImportWorkbook(wb: XLSX.WorkBook): ParsedFile {
  const employees: RawEmployeeRow[] = sheetRows(wb, EMPLOYEE_SHEET).map(r => ({
    rowNumber: r.rowNumber,
    firstName: cell(r, 0),
    lastName: cell(r, 1),
    email: cell(r, 2),
    phone: cell(r, 3),
    position: cell(r, 4),
    department: cell(r, 5),
    branch: cell(r, 6),
  }))

  const assets: RawAssetRow[] = sheetRows(wb, ASSET_SHEET).map(r => ({
    rowNumber: r.rowNumber,
    category: cell(r, 0),
    brand: cell(r, 1),
    model: cell(r, 2),
    serial: cell(r, 3),
    invCode: cell(r, 4),
    branch: cell(r, 5),
    assigneeEmail: cell(r, 6),
    price: cell(r, 7),
    purchaseDate: cell(r, 8),
    warrantyEndsAt: cell(r, 9),
    comment: cell(r, 10),
  }))

  return { employees, assets }
}
