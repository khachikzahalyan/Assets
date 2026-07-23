/**
 * Import template builder (plan §2). Sheet names and column order are the contract:
 * parse.ts maps columns strictly BY POSITION against these headers.
 *
 * xlsx is imported statically here — the PAGE lazy-imports this whole module on click
 * (same pattern as exportXlsx), so the static import never lands in the main chunk.
 */
import * as XLSX from 'xlsx'

export const IMPORT_TEMPLATE_FILENAME = 'АМС-импорт-шаблон.xlsx'

export const EMPLOYEE_SHEET = 'Сотрудники'
export const ASSET_SHEET = 'Активы'
export const REF_SHEET = 'Справочник'

/** Any data row whose FIRST cell starts with this literal is silently ignored by the parser. */
export const EXAMPLE_PREFIX = '(пример)'

export const EMPLOYEE_HEADERS = ['Имя*', 'Фамилия*', 'Email*', 'Телефон', 'Должность', 'Отдел*', 'Филиал'] as const
export const ASSET_HEADERS = ['Категория*', 'Бренд', 'Модель', 'Серийный номер', 'Инв. код', 'Филиал*', 'Выдан сотруднику (email)', 'Цена', 'Дата покупки', 'Гарантия до', 'Комментарий'] as const

export interface ImportTemplateRef { categories: string[]; departments: string[]; branches: string[] }

const INSTRUCTIONS: string[] = [
  'Как заполнять:',
  '• Даты — в формате ГГГГ-ММ-ДД или ДД.ММ.ГГГГ (Excel-даты тоже принимаются).',
  '• Пустой «Инв. код» — код будет сгенерирован автоматически.',
  '• Для мебели: «Модель» = тип (Стол/Стул/Шкаф), «Бренд» и «Серийный номер» не заполняются.',
  '• «Комментарий» сохраняется только вместе с «Выдан сотруднику».',
  '• Строку-пример удалите или оставьте — она игнорируется.',
]

/** Auto-fit column widths over an aoa; max 40 chars (same approach as exportXlsx). */
function autoFitCols(aoa: string[][]): XLSX.ColInfo[] {
  const colCount = aoa.reduce((m, r) => Math.max(m, r.length), 0)
  return Array.from({ length: colCount }, (_, i) => {
    const max = aoa.reduce((m, r) => Math.max(m, String(r[i] ?? '').length), 0)
    return { wch: Math.min(40, max + 2) }
  })
}

function sheetFrom(aoa: string[][]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = autoFitCols(aoa)
  ws['!sheetViews'] = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2' }]
  return ws
}

/** Pure template builder — testable without a browser. */
export function buildImportTemplate(ref: ImportTemplateRef): XLSX.WorkBook {
  const firstDept = ref.departments[0] ?? 'Бухгалтерия'
  const firstBranch = ref.branches[0] ?? ''
  const firstCategory = ref.categories[0] ?? 'Ноутбук'

  const employeesAoa: string[][] = [
    [...EMPLOYEE_HEADERS],
    [`${EXAMPLE_PREFIX} Анна`, 'Петросян', 'anna.petrosyan@example.com', '+374 77 123456', 'Бухгалтер', firstDept, firstBranch],
  ]

  const assetsAoa: string[][] = [
    [...ASSET_HEADERS],
    [`${EXAMPLE_PREFIX} ${firstCategory}`, 'Dell', 'Latitude 5440', 'SN12345678', '', firstBranch, 'anna.petrosyan@example.com', '350000', '2025-01-15', '2027-01-15', 'Выдан при приёме на работу'],
  ]

  const maxRefLen = Math.max(ref.categories.length, ref.departments.length, ref.branches.length)
  const refAoa: string[][] = [['Категории', 'Отделы', 'Филиалы']]
  for (let i = 0; i < maxRefLen; i++) {
    refAoa.push([ref.categories[i] ?? '', ref.departments[i] ?? '', ref.branches[i] ?? ''])
  }
  refAoa.push([])
  for (const line of INSTRUCTIONS) refAoa.push([line])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheetFrom(employeesAoa), EMPLOYEE_SHEET)
  XLSX.utils.book_append_sheet(wb, sheetFrom(assetsAoa), ASSET_SHEET)
  XLSX.utils.book_append_sheet(wb, sheetFrom(refAoa), REF_SHEET)
  return wb
}

/** Browser download of the template (triggers XLSX.writeFile). */
export function downloadImportTemplate(ref: ImportTemplateRef): void {
  XLSX.writeFile(buildImportTemplate(ref), IMPORT_TEMPLATE_FILENAME)
}
