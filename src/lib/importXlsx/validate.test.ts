import { describe, it, expect } from 'vitest'
import { validateImport } from './validate'
import type { RawAssetRow, RawEmployeeRow, ValidateContext } from './types'
import type { CategoryRow } from '@/domain/asset'

const cats: CategoryRow[] = [
  { id: 'cat_laptop', name: 'Ноутбук', group: 'devices', categoryGroupId: 'grp_devices', lucideIcon: 'laptop', requiresSerial: true },
  { id: 'cat_mouse', name: 'Мышь', group: 'devices', categoryGroupId: 'grp_devices', lucideIcon: 'mouse', requiresSerial: false },
  { id: 'cat_desk', name: 'Стол', group: 'furniture', categoryGroupId: 'grp_furniture', lucideIcon: 'table-2', hasTypeField: true },
]

function ctx(over: Partial<ValidateContext> = {}): ValidateContext {
  return {
    categories: cats,
    branches: [{ id: 'br_main', name: 'Головной офис' }, { id: 'br_g', name: 'Гюмри' }],
    departments: [{ id: 'dep_acc', name: 'Бухгалтерия' }, { id: 'dep_it', name: 'IT' }],
    activeEmployees: [{ id: 'e_active', email: 'active@corp.am', departmentId: 'dep_it' }],
    formerEmails: ['gone@corp.am'],
    existingAssets: [],
    today: '2026-07-22',
    ...over,
  }
}

let rowSeq = 1
function empRow(over: Partial<RawEmployeeRow> = {}): RawEmployeeRow {
  return {
    rowNumber: ++rowSeq,
    firstName: 'Анна', lastName: 'Петросян', email: `emp${rowSeq}@corp.am`,
    phone: '', position: '', department: 'Бухгалтерия', branch: '',
    ...over,
  }
}
function assetRow(over: Partial<RawAssetRow> = {}): RawAssetRow {
  return {
    rowNumber: ++rowSeq,
    category: 'Ноутбук', brand: 'Dell', model: 'Latitude', serial: `SN${rowSeq}`, invCode: `LAP/${String(rowSeq).padStart(5, '0')}`,
    branch: 'Головной офис', assigneeEmail: '', price: '', purchaseDate: '', warrantyEndsAt: '', comment: '',
    ...over,
  }
}
function keys(row: { errors: { key: string }[] }): string[] { return row.errors.map(e => e.key) }
function warnKeys(row: { warnings: { key: string }[] }): string[] { return row.warnings.map(w => w.key) }

function validateEmp(rows: RawEmployeeRow[], c: ValidateContext = ctx()) {
  return validateImport({ employees: rows, assets: [] }, c).employees
}
function validateAssets(rows: RawAssetRow[], c: ValidateContext = ctx()) {
  return validateImport({ employees: [], assets: rows }, c).assets
}

// ---------------------------------------------------------------------------
// Employees: E1–E5
// ---------------------------------------------------------------------------

describe('validateImport — employees', () => {
  it('E1: missing Имя / Фамилия', () => {
    const [r] = validateEmp([empRow({ firstName: '', lastName: '' })])
    expect(keys(r!)).toContain('errors.firstNameRequired')
    expect(keys(r!)).toContain('errors.lastNameRequired')
    expect(r!.status).toBe('error')
  })

  it('E2: email required + format', () => {
    const [a, b] = validateEmp([empRow({ email: '' }), empRow({ email: 'not-an-email' })])
    expect(keys(a!)).toContain('errors.emailRequired')
    expect(keys(b!)).toContain('errors.emailInvalid')
  })

  it('E3: email taken by an active employee (case-insensitive)', () => {
    const [r] = validateEmp([empRow({ email: 'Active@Corp.am' })])
    expect(keys(r!)).toContain('errors.emailTaken')
  })

  it('E3: email of a terminated employee', () => {
    const [r] = validateEmp([empRow({ email: 'gone@corp.am' })])
    expect(keys(r!)).toContain('errors.emailTerminated')
  })

  it('E3: intra-file duplicate marks ALL involved rows with the twin row number', () => {
    const rows = [
      empRow({ rowNumber: 2, email: 'dup@corp.am' }),
      empRow({ rowNumber: 3, email: 'DUP@corp.am' }),
    ]
    const [a, b] = validateEmp(rows)
    const errA = a!.errors.find(e => e.key === 'errors.emailDupInFile')
    const errB = b!.errors.find(e => e.key === 'errors.emailDupInFile')
    expect(errA?.params).toEqual({ row: 3 })
    expect(errB?.params).toEqual({ row: 2 })
  })

  it('E4: department required and must resolve (unknown carries the value)', () => {
    const [a, b] = validateEmp([empRow({ department: '' }), empRow({ department: 'Продажи' })])
    expect(keys(a!)).toContain('errors.departmentRequired')
    const err = b!.errors.find(e => e.key === 'errors.departmentUnknown')
    expect(err?.params).toEqual({ value: 'Продажи' })
  })

  it('E5: branch optional, but non-empty must resolve', () => {
    const [a, b] = validateEmp([empRow({ branch: '' }), empRow({ branch: 'Марс' })])
    expect(a!.status).toBe('ready')
    expect(keys(b!)).toContain('errors.branchUnknown')
  })

  it('reference resolution is trim + case-insensitive', () => {
    const [r] = validateEmp([empRow({ department: '  бухгалтерия ', branch: 'гЮМРИ' })])
    expect(r!.status).toBe('ready')
    expect(r!.input).toMatchObject({ departmentId: 'dep_acc', branchId: 'br_g' })
  })

  it('ready row builds input: email lower-cased, free-text phone/position as typed, empty → null', () => {
    const [r] = validateEmp([empRow({ email: 'Anna@Corp.am', phone: '+374 77', position: 'Бухгалтер' })])
    expect(r!.status).toBe('ready')
    expect(r!.input).toEqual({
      firstName: 'Анна', lastName: 'Петросян', email: 'anna@corp.am',
      phone: '+374 77', position: 'Бухгалтер', branchId: null, departmentId: 'dep_acc',
    })
    const [r2] = validateEmp([empRow({})])
    expect(r2!.input).toMatchObject({ phone: null, position: null })
  })
})

// ---------------------------------------------------------------------------
// Assets: A1–A9
// ---------------------------------------------------------------------------

describe('validateImport — assets A1/A2 references', () => {
  it('A1: category required / unknown', () => {
    const [a, b] = validateAssets([assetRow({ category: '' }), assetRow({ category: 'Дрон' })])
    expect(keys(a!)).toContain('errors.categoryRequired')
    const err = b!.errors.find(e => e.key === 'errors.categoryUnknown')
    expect(err?.params).toEqual({ value: 'Дрон' })
  })

  it('A2: branch required / unknown', () => {
    const [a, b] = validateAssets([assetRow({ branch: '' }), assetRow({ branch: 'Марс' })])
    expect(keys(a!)).toContain('errors.branchRequired')
    expect(keys(b!)).toContain('errors.branchUnknown')
  })

  it('category resolution is case-insensitive', () => {
    const [r] = validateAssets([assetRow({ category: 'нОУТБУК' })])
    expect(r!.status).toBe('ready')
    expect(r!.input?.categoryId).toBe('cat_laptop')
  })
})

describe('validateImport — A3 identity shape', () => {
  it('furniture: Модель maps to type; brand/serial forced null; extras → warning', () => {
    const [r] = validateAssets([assetRow({
      category: 'Стол', brand: 'IKEA', model: 'Стол письменный', serial: 'SN-X', invCode: 'FRN/001',
    })])
    expect(r!.status).toBe('ready')
    expect(warnKeys(r!)).toContain('warnings.furnitureExtrasIgnored')
    expect(r!.input).toMatchObject({ type: 'Стол письменный', brand: null, model: null, serial: null })
  })

  it('furniture: missing Модель → modelRequired', () => {
    const [r] = validateAssets([assetRow({ category: 'Стол', brand: '', model: '', serial: '', invCode: 'FRN/002' })])
    expect(keys(r!)).toContain('errors.modelRequired')
  })

  it('furniture without extras produces no warning', () => {
    const [r] = validateAssets([assetRow({ category: 'Стол', brand: '', model: 'Шкаф', serial: '', invCode: 'FRN/003' })])
    expect(r!.warnings).toEqual([])
  })

  it('devices: Бренд and Модель required', () => {
    const [r] = validateAssets([assetRow({ brand: '', model: '' })])
    expect(keys(r!)).toContain('errors.brandRequired')
    expect(keys(r!)).toContain('errors.modelRequired')
  })

  it('devices with requiresSerial: Серийный номер required; category without the flag accepts empty serial', () => {
    const [a, b] = validateAssets([
      assetRow({ serial: '' }),
      assetRow({ category: 'Мышь', serial: '' }),
    ])
    expect(keys(a!)).toContain('errors.serialRequired')
    expect(b!.status).toBe('ready')
    expect(b!.input?.serial).toBeNull()
  })
})

describe('validateImport — A4/A5 uniqueness', () => {
  it('A4: serial taken in DB', () => {
    const c = ctx({ existingAssets: [{ invCode: 'X/1', serial: 'SN-DB', categoryId: 'cat_laptop' }] })
    const [r] = validateAssets([assetRow({ serial: 'SN-DB' })], c)
    expect(keys(r!)).toContain('errors.serialTaken')
  })

  it('A4: serial duplicated within the file marks both rows', () => {
    const [a, b] = validateAssets([
      assetRow({ rowNumber: 2, serial: 'SN-DUP', invCode: 'LAP/1' }),
      assetRow({ rowNumber: 3, serial: 'SN-DUP', invCode: 'LAP/2' }),
    ])
    expect(a!.errors.find(e => e.key === 'errors.serialDupInFile')?.params).toEqual({ row: 3 })
    expect(b!.errors.find(e => e.key === 'errors.serialDupInFile')?.params).toEqual({ row: 2 })
  })

  it('A5: inv code taken in DB / duplicated within file', () => {
    const c = ctx({ existingAssets: [{ invCode: 'LAP/00099', serial: null, categoryId: 'cat_laptop' }] })
    const [a, b, d] = validateAssets([
      assetRow({ rowNumber: 2, invCode: 'LAP/00099' }),
      assetRow({ rowNumber: 3, invCode: 'LAP/00100' }),
      assetRow({ rowNumber: 4, invCode: 'LAP/00100' }),
    ], c)
    expect(keys(a!)).toContain('errors.invTaken')
    expect(b!.errors.find(e => e.key === 'errors.invDupInFile')?.params).toEqual({ row: 4 })
    expect(d!.errors.find(e => e.key === 'errors.invDupInFile')?.params).toEqual({ row: 3 })
  })
})

describe('validateImport — A6 assignee', () => {
  it('invalid email format', () => {
    const [r] = validateAssets([assetRow({ assigneeEmail: 'nope' })])
    expect(keys(r!)).toContain('errors.assigneeEmailInvalid')
  })

  it('unknown / terminated assignee', () => {
    const [a, b] = validateAssets([
      assetRow({ assigneeEmail: 'stranger@corp.am' }),
      assetRow({ assigneeEmail: 'gone@corp.am' }),
    ])
    expect(keys(a!)).toContain('errors.assigneeUnknown')
    expect(keys(b!)).toContain('errors.assigneeTerminated')
  })

  it('resolves against active DB employees case-insensitively and normalizes to lower case', () => {
    const [r] = validateAssets([assetRow({ assigneeEmail: 'Active@Corp.am' })])
    expect(r!.status).toBe('ready')
    expect(r!.assigneeEmail).toBe('active@corp.am')
  })

  it('resolves against READY employee rows of the same file, but not against error rows', () => {
    const plan = validateImport({
      employees: [
        empRow({ rowNumber: 2, email: 'new@corp.am' }),                      // ready
        empRow({ rowNumber: 3, email: 'broken@corp.am', department: '' }),   // error
      ],
      assets: [
        assetRow({ rowNumber: 2, assigneeEmail: 'new@corp.am', invCode: 'LAP/1', serial: 'S1' }),
        assetRow({ rowNumber: 3, assigneeEmail: 'broken@corp.am', invCode: 'LAP/2', serial: 'S2' }),
      ],
    }, ctx())
    expect(plan.assets[0]!.status).toBe('ready')
    expect(plan.assets[0]!.assigneeEmail).toBe('new@corp.am')
    expect(keys(plan.assets[1]!)).toContain('errors.assigneeUnknown')
  })
})

describe('validateImport — A7 price', () => {
  it('normalizes comma decimal and spaces (incl. non-breaking)', () => {
    const [r] = validateAssets([assetRow({ price: '1 234,50' })])
    expect(r!.status).toBe('ready')
    expect(r!.input?.priceAmount).toBe(1234.5)
  })

  it('invalid / negative price', () => {
    const [a, b] = validateAssets([assetRow({ price: 'дорого' }), assetRow({ price: '-5' })])
    expect(keys(a!)).toContain('errors.priceInvalid')
    expect(keys(b!)).toContain('errors.priceNegative')
  })

  it('empty price → no priceAmount on input', () => {
    const [r] = validateAssets([assetRow({ price: '' })])
    expect(r!.status).toBe('ready')
    expect(r!.input && 'priceAmount' in r!.input).toBe(false)
  })

  it('zero price is allowed', () => {
    const [r] = validateAssets([assetRow({ price: '0' })])
    expect(r!.status).toBe('ready')
    expect(r!.input?.priceAmount).toBe(0)
  })
})

describe('validateImport — A8 dates', () => {
  it('both-or-neither', () => {
    const [a, b] = validateAssets([
      assetRow({ purchaseDate: '2025-01-01', warrantyEndsAt: '' }),
      assetRow({ purchaseDate: '', warrantyEndsAt: '2027-01-01' }),
    ])
    expect(keys(a!)).toContain('errors.datesPairRequired')
    expect(keys(b!)).toContain('errors.datesPairRequired')
  })

  it('accepts YYYY-MM-DD, DD.MM.YYYY and Excel serials (45292 = 2024-01-01)', () => {
    const [a, b, c] = validateAssets([
      assetRow({ purchaseDate: '2024-01-01', warrantyEndsAt: '2027-01-01' }),
      assetRow({ purchaseDate: '01.01.2024', warrantyEndsAt: '15.06.2027' }),
      assetRow({ purchaseDate: '45292', warrantyEndsAt: '2027-01-01' }),
    ])
    expect(a!.input).toMatchObject({ condition: 'new', purchaseDate: '2024-01-01', warrantyEndsAt: '2027-01-01' })
    expect(b!.input).toMatchObject({ condition: 'new', purchaseDate: '2024-01-01', warrantyEndsAt: '2027-06-15' })
    expect(c!.input).toMatchObject({ condition: 'new', purchaseDate: '2024-01-01' })
  })

  it('rejects malformed and non-calendar dates with the offending field', () => {
    const [a] = validateAssets([assetRow({ purchaseDate: '2024-02-30', warrantyEndsAt: 'скоро' })])
    const errs = a!.errors.filter(e => e.key === 'errors.dateInvalid')
    expect(errs).toHaveLength(2)
    expect(errs.map(e => e.params?.field)).toEqual(['Дата покупки', 'Гарантия до'])
  })

  it('purchase must be ≤ today; historical dates are fine', () => {
    const [a, b] = validateAssets([
      assetRow({ purchaseDate: '2026-08-01', warrantyEndsAt: '2028-01-01' }),
      assetRow({ purchaseDate: '2019-05-20', warrantyEndsAt: '2021-05-20' }),
    ])
    expect(keys(a!)).toContain('errors.purchaseInFuture')
    expect(b!.status).toBe('ready')
  })

  it('warranty must be strictly after purchase (equal → error)', () => {
    const [a, b] = validateAssets([
      assetRow({ purchaseDate: '2024-01-01', warrantyEndsAt: '2024-01-01' }),
      assetRow({ purchaseDate: '2024-01-01', warrantyEndsAt: '2023-01-01' }),
    ])
    expect(keys(a!)).toContain('errors.warrantyBeforePurchase')
    expect(keys(b!)).toContain('errors.warrantyBeforePurchase')
  })

  it('both absent → no condition/date fields on input', () => {
    const [r] = validateAssets([assetRow({})])
    expect(r!.status).toBe('ready')
    expect(r!.input && 'condition' in r!.input).toBe(false)
    expect(r!.input && 'purchaseDate' in r!.input).toBe(false)
  })
})

describe('validateImport — A9 comment', () => {
  it('comment without assignee → warning, comment dropped', () => {
    const [r] = validateAssets([assetRow({ comment: 'просто заметка' })])
    expect(r!.status).toBe('ready')
    expect(warnKeys(r!)).toContain('warnings.commentDropped')
    expect(r!.comment).toBeNull()
  })

  it('comment with assignee is kept', () => {
    const [r] = validateAssets([assetRow({ assigneeEmail: 'active@corp.am', comment: 'выдан при приёме' })])
    expect(r!.comment).toBe('выдан при приёме')
    expect(r!.warnings).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// A7 price — explicit non-breaking / narrow-no-break space (parsePriceCell)
// ---------------------------------------------------------------------------

describe('validateImport — A7 price (explicit non-breaking space)', () => {
  it('strips U+00A0 non-breaking space used as a thousands separator', () => {
    // U+00A0 is the character Russian Excel inserts between digit groups.
    const price = '150 000,00'
    const [r] = validateAssets([assetRow({ price })])
    expect(r!.status).toBe('ready')
    expect(r!.input?.priceAmount).toBe(150000)
  })

  it('strips U+202F narrow no-break space (another common Russian Excel separator)', () => {
    const price = '1 234,50'
    const [r] = validateAssets([assetRow({ price })])
    expect(r!.status).toBe('ready')
    expect(r!.input?.priceAmount).toBe(1234.5)
  })
})

// ---------------------------------------------------------------------------
// §5 inventory-code auto-generation
// ---------------------------------------------------------------------------

describe('validateImport — inv-code auto-generation (§5)', () => {
  const dbAssets = [
    { invCode: '460/00006', serial: null, categoryId: 'cat_laptop' },
    { invCode: '460/00007', serial: null, categoryId: 'cat_laptop' },
    { invCode: 'MSE/01', serial: null, categoryId: 'cat_mouse' },
  ]

  it('generates the next sequential code preserving zero-padding', () => {
    const [r] = validateAssets([assetRow({ invCode: '' })], ctx({ existingAssets: dbAssets }))
    expect(r!.status).toBe('ready')
    expect(r!.invCode).toBe('460/00008')
    expect(r!.invCodeGenerated).toBe(true)
    expect(r!.input?.invCode).toBe('460/00008')
  })

  it('explicit codes carry invCodeGenerated: false', () => {
    const [r] = validateAssets([assetRow({ invCode: 'LAP/00500' })])
    expect(r!.invCodeGenerated).toBe(false)
    expect(r!.invCode).toBe('LAP/00500')
  })

  it('N auto rows of one category get N sequential codes', () => {
    const rows = validateAssets(
      [assetRow({ invCode: '', serial: 'S1' }), assetRow({ invCode: '', serial: 'S2' }), assetRow({ invCode: '', serial: 'S3' })],
      ctx({ existingAssets: dbAssets }),
    )
    expect(rows.map(r => r.invCode)).toEqual(['460/00008', '460/00009', '460/00010'])
  })

  it('explicit parseable file codes of the same category join the pool (generated skips over them)', () => {
    const rows = validateAssets(
      [
        assetRow({ invCode: '460/00008', serial: 'S1' }),
        assetRow({ invCode: '', serial: 'S2' }),
      ],
      ctx({ existingAssets: dbAssets }),
    )
    expect(rows[1]!.invCode).toBe('460/00009')
  })

  it('most frequent prefix wins', () => {
    const db = [
      { invCode: 'AAA/01', serial: null, categoryId: 'cat_laptop' },
      { invCode: 'AAA/02', serial: null, categoryId: 'cat_laptop' },
      { invCode: 'ZZZ/99', serial: null, categoryId: 'cat_laptop' },
    ]
    const [r] = validateAssets([assetRow({ invCode: '' })], ctx({ existingAssets: db }))
    expect(r!.invCode).toBe('AAA/03')
  })

  it('tie-break: equal frequency → prefix with the highest max numeric suffix', () => {
    const db = [
      { invCode: 'AAA/05', serial: null, categoryId: 'cat_laptop' },
      { invCode: 'BBB/09', serial: null, categoryId: 'cat_laptop' },
    ]
    const [r] = validateAssets([assetRow({ invCode: '' })], ctx({ existingAssets: db }))
    expect(r!.invCode).toBe('BBB/10')
  })

  it('no parseable code for the category (DB + file) → errors.invPrefixUndetermined', () => {
    const [r] = validateAssets([assetRow({ category: 'Мышь', invCode: '', serial: '' })], ctx({ existingAssets: [] }))
    expect(keys(r!)).toContain('errors.invPrefixUndetermined')
    expect(r!.status).toBe('error')
  })

  it('generation is per-category (other categories do not leak prefixes)', () => {
    const [r] = validateAssets(
      [assetRow({ category: 'Мышь', invCode: '', serial: '' })],
      ctx({ existingAssets: dbAssets }),
    )
    expect(r!.invCode).toBe('MSE/02')
  })
})

// ---------------------------------------------------------------------------
// Plan summary + input shape
// ---------------------------------------------------------------------------

describe('validateImport — plan assembly', () => {
  it('counts ready/error rows per sheet; errors never block other rows', () => {
    const plan = validateImport({
      employees: [empRow({}), empRow({ email: '' })],
      assets: [assetRow({}), assetRow({ category: '' })],
    }, ctx())
    expect(plan.readyEmployees).toBe(1)
    expect(plan.errorEmployees).toBe(1)
    expect(plan.readyAssets).toBe(1)
    expect(plan.errorAssets).toBe(1)
  })

  it('asset input rows are built with assignment: null and deptId: null', () => {
    const [r] = validateAssets([assetRow({})])
    expect(r!.input?.assignment).toBeNull()
    expect(r!.input?.deptId).toBeNull()
    expect(r!.input?.branchId).toBe('br_main')
  })

  it('error rows do not carry an input', () => {
    const [r] = validateAssets([assetRow({ category: '' })])
    expect(r!.input).toBeUndefined()
  })
})
