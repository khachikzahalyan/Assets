import * as XLSX from 'xlsx'

export interface ExportRow {
  category: string
  brand: string
  model: string
  invCode: string
  serial: string
  branch: string
  status: string
  assignee: string
  updatedAt: string
}

const HEADERS: string[] = [
  'Категория',
  'Бренд',
  'Модель',
  'Инв. код',
  'Серийный №',
  'Филиал',
  'Статус',
  'Назначен',
  'Обновлено',
]

const COL_KEYS: (keyof ExportRow)[] = [
  'category',
  'brand',
  'model',
  'invCode',
  'serial',
  'branch',
  'status',
  'assignee',
  'updatedAt',
]

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** Auto-fit column widths; max 40 chars. */
function calcColWidths(rows: ExportRow[]): XLSX.ColInfo[] {
  return COL_KEYS.map((key, i) => {
    const headerLen = HEADERS[i]!.length
    const maxDataLen = rows.reduce((max, row) => {
      const val = String(row[key] ?? '')
      return Math.max(max, val.length)
    }, 0)
    return { wch: Math.min(40, Math.max(headerLen, maxDataLen) + 2) }
  })
}

/**
 * Exports an array of asset rows to a .xlsx file, triggering a browser download.
 */
export function exportAssetsXlsx(rows: ExportRow[], filename?: string): void {
  const today = todayStr()
  const name = filename ?? `АМС-активы-${today}.xlsx`

  // Build worksheet data: header row + data rows
  const wsData: string[][] = [
    HEADERS,
    ...rows.map(r => COL_KEYS.map(k => String(r[k] ?? ''))),
  ]

  const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(wsData)

  // Auto-fit column widths
  ws['!cols'] = calcColWidths(rows)

  // Freeze top row via sheet views
  ws['!sheetViews'] = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2' }]

  // Autofilter across header row
  const lastColLetter = String.fromCharCode(65 + HEADERS.length - 1)
  ws['!autofilter'] = { ref: `A1:${lastColLetter}1` }

  const wb: XLSX.WorkBook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Активы')

  XLSX.writeFile(wb, name)
}
