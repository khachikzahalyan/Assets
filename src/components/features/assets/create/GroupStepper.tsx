import { useState } from 'react'
import { Field, Input } from './ui'
import { Btn, Chip, Icon } from '@/components/ui'
import { nextInvFromBatch, pluralAssets } from './ramStorage'

export interface GroupRow { invCode: string; serial: string }

export interface GroupStepperProps {
  requiresSerial: boolean
  quantity: number
  setQuantity: (n: number) => void
  rows: GroupRow[]
  setRows: (rows: GroupRow[]) => void
  /** Placeholder for the inventory-code input (category-flavored). */
  invPlaceholder?: string
  /** Initial inventory code seed for the first row. */
  seedInvCode?: string
}

/**
 * Group registration stepper — one row at a time. Enter (or Подтвердить) commits the
 * active row, auto-advances the inventory code (nextInvFromBatch), and clears serial.
 * Within-batch dual uniqueness (invCode + serial) blocks confirm with inline feedback.
 * Confirmed rows can be pulled back into the active form (edit) or deleted.
 */
export function GroupStepper({ requiresSerial, quantity, setQuantity, rows, setRows, invPlaceholder = '460/00007', seedInvCode = '' }: GroupStepperProps) {
  const [activeInv, setActiveInv] = useState(seedInvCode)
  const [activeSerial, setActiveSerial] = useState('')

  const total = Math.max(2, quantity)
  const done = rows.length
  const progress = total ? Math.min(100, Math.round((done / total) * 100)) : 0
  const allDone = done >= total

  const invVal = activeInv.trim()
  const serVal = activeSerial.trim()
  const invDup = !!invVal && rows.some(r => r.invCode === invVal)
  const serDup = !!serVal && rows.some(r => r.serial && r.serial === serVal)
  const invEmpty = !invVal
  const serEmpty = requiresSerial && !serVal
  const canConfirm = !allDone && !invEmpty && !invDup && !serEmpty && !serDup

  const confirmActive = () => {
    if (!canConfirm) return
    const newRows = [...rows, { invCode: invVal, serial: requiresSerial ? serVal : '' }]
    setRows(newRows)
    if (newRows.length < total) {
      setActiveInv(nextInvFromBatch(newRows, invVal))
      setActiveSerial('')
    } else {
      setActiveInv('')
      setActiveSerial('')
    }
  }

  const pullBackRow = (idx: number) => {
    const row = rows[idx]
    if (!row) return
    setRows(rows.filter((_, i) => i !== idx))
    setActiveInv(row.invCode)
    setActiveSerial(row.serial || '')
  }

  const deleteRow = (idx: number) => setRows(rows.filter((_, i) => i !== idx))

  const onQuantityChange = (raw: string) => {
    const n = parseInt(raw || '0', 10) || 0
    const floor = Math.max(2, done)
    setQuantity(Math.max(floor, Math.min(200, n)))
  }

  return (
    <div className="rounded-xl ring-1 ring-[#2A2F36]/70 bg-[#111315]/60 p-3.5 space-y-2.5 anim-fade-slide-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-[14px] font-semibold text-text-primary flex items-center gap-1.5 tracking-tight">
          <Icon name="copy-plus" size={13} className="text-text-subtle" />Партия активов
        </div>
        {/* B8: indigo instead of orange */}
        <Chip color="indigo">{done} / {total}</Chip>
      </div>

      <div className="grid grid-cols-3 max-md:grid-cols-2 gap-2 items-end">
        <Field label="Количество" required {...(done > 0 ? { hint: `Не меньше ${done}` } : {})}>
          <Input type="number" value={String(quantity)} onChange={onQuantityChange} className="tabular-nums" />
        </Field>
        <div className="col-span-2 max-md:col-span-1">
          <div className="text-[13px] text-text-primary mb-1.5 flex items-center justify-between">
            <span>Прогресс</span><span className="tabular-nums font-medium">{progress}%</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-accent to-[#E29772] transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={r.invCode} className="flex items-center gap-2 bg-surface ring-1 ring-[#2A2F36]/70 rounded-lg px-2.5 py-1.5">
              <span className="w-5 h-5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[12px] font-bold flex items-center justify-center tabular-nums shrink-0">{i + 1}</span>
              <span className="font-mono text-[14px] text-text-primary tracking-tight truncate" title={r.invCode}>{r.invCode}</span>
              {requiresSerial && (
                <>
                  <span className="text-text-subtle shrink-0">·</span>
                  <span className="font-mono text-[13.5px] text-text-primary tracking-tight truncate" title={r.serial}>{r.serial || '—'}</span>
                </>
              )}
              <div className="ml-auto flex items-center gap-0.5 shrink-0">
                <button type="button" onClick={() => pullBackRow(i)} className="w-6 h-6 rounded text-text-subtle hover:text-accent hover:bg-[rgba(249,115,22,0.12)] flex items-center justify-center transition-colors" title="Редактировать" aria-label={`Редактировать строку ${i + 1}`}><Icon name="pencil" size={12} /></button>
                <button type="button" onClick={() => deleteRow(i)} className="w-6 h-6 rounded text-text-subtle hover:text-rose-300 hover:bg-rose-500/10 flex items-center justify-center transition-colors" title="Удалить" aria-label={`Удалить строку ${i + 1}`}><Icon name="trash-2" size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {allDone ? (
        <div className="bg-emerald-500/10 ring-1 ring-emerald-500/30 rounded-lg px-3 py-2.5 flex items-center gap-2">
          <Icon name="circle-check" size={14} className="text-emerald-300 shrink-0" />
          <span className="text-[14px] font-medium text-emerald-300">Все {total} {pluralAssets(total)} добавлены — нажмите «Создать»</span>
        </div>
      ) : (
        <div key={done} className="bg-surface ring-1 ring-[#2A2F36]/70 rounded-lg p-2.5 space-y-2">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-text-primary tracking-tight">
            <span className="w-5 h-5 rounded bg-[rgba(249,115,22,0.12)] border border-[#F97316]/50 text-accent-hover text-[12px] font-bold flex items-center justify-center tabular-nums shrink-0">{done + 1}</span>Текущая запись
          </div>
          <div className={`grid gap-2 ${requiresSerial ? 'grid-cols-2 max-md:grid-cols-1' : 'grid-cols-1'}`}>
            <Field label="Инвентарный код" required {...(invDup ? { hint: 'Этот код уже добавлен в партию' } : {})}>
              <Input
                autoFocus
                value={activeInv}
                onChange={setActiveInv}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmActive() } }}
                placeholder={invPlaceholder}
                mono
                className={invDup ? 'border-rose-500/40 focus:border-rose-400' : ''}
              />
            </Field>
            {requiresSerial && (
              <Field label="Серийный номер" required {...(serDup ? { hint: 'Этот серийный уже добавлен в партию' } : {})}>
                <Input
                  value={activeSerial}
                  onChange={setActiveSerial}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmActive() } }}
                  placeholder="SN-…"
                  mono
                  className={serDup ? 'border-rose-500/40 focus:border-rose-400' : ''}
                />
              </Field>
            )}
          </div>
          <div className="flex items-center justify-end">
            {/* B8: size="sm" → default md */}
            <Btn variant="primary" onClick={confirmActive} disabled={!canConfirm}>
              <Icon name="check" size={14} /> Подтвердить
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}
