import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseImportWorkbook } from './parse'
import {
  buildImportTemplate,
  EMPLOYEE_SHEET, ASSET_SHEET, REF_SHEET,
  EMPLOYEE_HEADERS, ASSET_HEADERS,
} from './template'

type Cell = string | number | null
function wbFrom(sheets: Record<string, Cell[][]>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  for (const [name, aoa] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name)
  }
  return wb
}

const EMP_HEADER: Cell[] = [...EMPLOYEE_HEADERS]
const ASSET_HEADER: Cell[] = [...ASSET_HEADERS]

describe('parseImportWorkbook — employees sheet', () => {
  it('maps columns by position and records 1-based Excel row numbers', () => {
    const wb = wbFrom({
      [EMPLOYEE_SHEET]: [
        EMP_HEADER,
        ['Анна', 'Петросян', 'Anna@corp.am', '+374 77 000000', 'Бухгалтер', 'Бухгалтерия', 'Головной офис'],
      ],
    })
    const { employees, assets } = parseImportWorkbook(wb)
    expect(assets).toEqual([])
    expect(employees).toEqual([{
      rowNumber: 2,
      firstName: 'Анна', lastName: 'Петросян', email: 'Anna@corp.am',
      phone: '+374 77 000000', position: 'Бухгалтер', department: 'Бухгалтерия', branch: 'Головной офис',
    }])
  })

  it('trims every cell and stringifies non-string cells', () => {
    const wb = wbFrom({
      [EMPLOYEE_SHEET]: [
        EMP_HEADER,
        ['  Арам ', ' Саргсян ', ' aram@corp.am ', 374770, null, ' IT ', ''],
      ],
    })
    const [row] = parseImportWorkbook(wb).employees
    expect(row).toMatchObject({
      firstName: 'Арам', lastName: 'Саргсян', email: 'aram@corp.am',
      phone: '374770', position: '', department: 'IT', branch: '',
    })
  })

  it('silently drops the example row (first cell starts with «(пример)»)', () => {
    const wb = wbFrom({
      [EMPLOYEE_SHEET]: [
        EMP_HEADER,
        ['(пример) Анна', 'Петросян', 'anna@example.com', '', '', 'Бухгалтерия', ''],
        ['Арам', 'Саргсян', 'aram@corp.am', '', '', 'IT', ''],
      ],
    })
    const { employees } = parseImportWorkbook(wb)
    expect(employees).toHaveLength(1)
    expect(employees[0]).toMatchObject({ rowNumber: 3, firstName: 'Арам' })
  })

  it('silently drops fully-empty rows while preserving Excel row numbers of later rows', () => {
    const wb = wbFrom({
      [EMPLOYEE_SHEET]: [
        EMP_HEADER,
        ['', '', '', '', '', '', ''],
        [null, null, null, null, null, null, null],
        ['Арам', 'Саргсян', 'aram@corp.am', '', '', 'IT', ''],
      ],
    })
    const { employees } = parseImportWorkbook(wb)
    expect(employees).toHaveLength(1)
    expect(employees[0]!.rowNumber).toBe(4)
  })

  it('missing sheet → empty array', () => {
    const wb = wbFrom({ [ASSET_SHEET]: [ASSET_HEADER] })
    const parsed = parseImportWorkbook(wb)
    expect(parsed.employees).toEqual([])
    expect(parsed.assets).toEqual([])
  })
})

describe('parseImportWorkbook — assets sheet', () => {
  it('maps all 11 columns by position; numeric price/date cells keep their raw string form', () => {
    const wb = wbFrom({
      [ASSET_SHEET]: [
        ASSET_HEADER,
        ['Ноутбук', 'Dell', 'Latitude', 'SN1', 'LAP/00010', 'Головной офис', 'anna@corp.am', 350000, 45292, '2027-01-01', 'выдан давно'],
      ],
    })
    const { assets } = parseImportWorkbook(wb)
    expect(assets).toEqual([{
      rowNumber: 2,
      category: 'Ноутбук', brand: 'Dell', model: 'Latitude', serial: 'SN1', invCode: 'LAP/00010',
      branch: 'Головной офис', assigneeEmail: 'anna@corp.am', price: '350000',
      purchaseDate: '45292', warrantyEndsAt: '2027-01-01', comment: 'выдан давно',
    }])
  })

  it('short rows are padded with empty strings', () => {
    const wb = wbFrom({
      [ASSET_SHEET]: [
        ASSET_HEADER,
        ['Стол', '', 'Стол офисный'],
      ],
    })
    const [row] = parseImportWorkbook(wb).assets
    expect(row).toMatchObject({
      category: 'Стол', brand: '', model: 'Стол офисный',
      serial: '', invCode: '', branch: '', assigneeEmail: '', price: '',
      purchaseDate: '', warrantyEndsAt: '', comment: '',
    })
  })

  it('silently drops example row from the assets sheet (first cell starts with «(пример)»)', () => {
    const wb = wbFrom({
      [ASSET_SHEET]: [
        ASSET_HEADER,
        ['(пример) Ноутбук', 'Dell', 'Latitude', 'SN-ex', 'LAP/00001', 'Головной офис', '', '', '', '', ''],
        ['Мышь', 'Logitech', 'MX', '', 'MSE/00001', 'Головной офис', '', '', '', '', ''],
      ],
    })
    const { assets } = parseImportWorkbook(wb)
    expect(assets).toHaveLength(1)
    expect(assets[0]).toMatchObject({ rowNumber: 3, category: 'Мышь' })
  })

  it('silently drops fully-empty asset rows while preserving Excel row numbers of later rows', () => {
    const wb = wbFrom({
      [ASSET_SHEET]: [
        ASSET_HEADER,
        ['', '', '', '', '', '', '', '', '', '', ''],
        [null, null, null, null, null, null, null, null, null, null, null],
        ['Ноутбук', 'Dell', 'Latitude', 'SN1', 'LAP/00001', 'Головной офис', '', '', '', '', ''],
      ],
    })
    const { assets } = parseImportWorkbook(wb)
    expect(assets).toHaveLength(1)
    expect(assets[0]!.rowNumber).toBe(4)
  })
})

describe('buildImportTemplate', () => {
  const ref = {
    categories: ['Ноутбук', 'Монитор', 'Стол'],
    departments: ['Бухгалтерия', 'IT'],
    branches: ['Головной офис'],
  }

  it('produces the three contract sheets with the exact header rows', () => {
    const wb = buildImportTemplate(ref)
    expect(wb.SheetNames).toEqual([EMPLOYEE_SHEET, ASSET_SHEET, REF_SHEET])
    const empAoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[EMPLOYEE_SHEET]!, { header: 1 })
    const assetAoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[ASSET_SHEET]!, { header: 1 })
    expect(empAoa[0]).toEqual([...EMPLOYEE_HEADERS])
    expect(assetAoa[0]).toEqual([...ASSET_HEADERS])
  })

  it('row 2 of sheets 1–2 is an example row whose first cell starts with «(пример)»', () => {
    const wb = buildImportTemplate(ref)
    const empAoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[EMPLOYEE_SHEET]!, { header: 1 })
    const assetAoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[ASSET_SHEET]!, { header: 1 })
    expect(String(empAoa[1]![0]).startsWith('(пример)')).toBe(true)
    expect(String(assetAoa[1]![0]).startsWith('(пример)')).toBe(true)
  })

  it('Справочник sheet contains the actual reference values side-by-side', () => {
    const wb = buildImportTemplate(ref)
    const aoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[REF_SHEET]!, { header: 1 })
    expect(aoa[0]).toEqual(['Категории', 'Отделы', 'Филиалы'])
    expect(aoa[1]).toEqual(['Ноутбук', 'Бухгалтерия', 'Головной офис'])
    expect(aoa[2]!.slice(0, 2)).toEqual(['Монитор', 'IT'])
    expect(aoa[3]![0]).toBe('Стол')
    // Instructions block is present somewhere below the values
    const flat = aoa.flat().map(String)
    expect(flat.some(s => s.includes('Инв. код'))).toBe(true)
  })

  it('round trip: parsing the template yields an empty ParsedFile (example rows ignored)', () => {
    const parsed = parseImportWorkbook(buildImportTemplate(ref))
    expect(parsed).toEqual({ employees: [], assets: [] })
  })

  it('sets auto-fit column widths on data sheets', () => {
    const wb = buildImportTemplate(ref)
    const cols = wb.Sheets[ASSET_SHEET]!['!cols']
    expect(cols).toBeDefined()
    expect(cols!.length).toBe(ASSET_HEADERS.length)
    cols!.forEach(c => expect((c.wch ?? 0) > 0).toBe(true))
  })
})
