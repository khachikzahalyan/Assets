import { useState } from 'react'
import { Field } from './ui'
import { Icon } from '@/components/ui'
import { DatePicker } from './DatePicker'
import { addYearsISO } from './warranty'

export interface ConditionWarrantyValue {
  condition: 'new' | 'used'
  purchaseDate: string
  warrantyEndsAt: string
}

export interface ConditionWarrantyProps {
  value: ConditionWarrantyValue
  onChange: (next: ConditionWarrantyValue) => void
}

/**
 * Состояние и гарантия: Новый / Б/У toggle. When «Новый», shows purchase date +
 * warranty-until pickers. Warranty defaults to purchase + 1 year (calendar math),
 * editable; warranty earlier than purchase is rejected with visible feedback.
 */
export function ConditionWarranty({ value, onChange }: ConditionWarrantyProps) {
  const [warrantyError, setWarrantyError] = useState('')

  const setCondition = (condition: 'new' | 'used') => {
    setWarrantyError('')
    onChange({ ...value, condition })
  }

  const setPurchase = (iso: string) => {
    // Advance warranty only if it became earlier than the new purchase date.
    const newWarranty = iso && value.warrantyEndsAt && value.warrantyEndsAt < iso
      ? addYearsISO(iso, 1)
      : value.warrantyEndsAt
    onChange({ ...value, purchaseDate: iso, warrantyEndsAt: newWarranty })
    setWarrantyError('')
  }

  const setWarranty = (iso: string) => {
    if (iso && value.purchaseDate && iso < value.purchaseDate) {
      setWarrantyError('Дата гарантии не может быть раньше даты покупки')
      return
    }
    setWarrantyError('')
    onChange({ ...value, warrantyEndsAt: iso })
  }

  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* B4: section header font text-[13px] */}
        <div className="text-[13px] font-semibold text-text-tertiary tracking-[0.06em] uppercase">Состояние и гарантия</div>
        <div className="inline-flex bg-surface-2/70 rounded-lg p-0.5" role="group" aria-label="Состояние">
          <button
            type="button"
            onClick={() => setCondition('new')}
            aria-pressed={value.condition === 'new'}
            className={`px-3.5 py-1 text-[14px] font-semibold rounded-md transition-all duration-150 ${value.condition === 'new' ? 'bg-accent text-white shadow-sm' : 'text-text-primary hover:bg-surface/70'}`}
          >Новый</button>
          <button
            type="button"
            onClick={() => setCondition('used')}
            aria-pressed={value.condition === 'used'}
            className={`px-3.5 py-1 text-[14px] font-semibold rounded-md transition-all duration-150 ${value.condition === 'used' ? 'bg-accent text-white shadow-sm' : 'text-text-primary hover:bg-surface/70'}`}
          >Б/У</button>
        </div>
      </div>

      {value.condition === 'new' && (
        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
          <Field label="Дата покупки" required>
            <DatePicker value={value.purchaseDate} onChange={setPurchase} />
          </Field>
          <Field label="Гарантия до" required>
            <DatePicker
              value={value.warrantyEndsAt}
              {...(value.purchaseDate ? { min: value.purchaseDate } : {})}
              onChange={setWarranty}
              showPlusYear
            />
            {warrantyError && (
              <p className="mt-1 text-[13px] font-medium text-rose-300 flex items-center gap-1" role="alert">
                {/* B4: alert-circle icon before warranty error */}
                <Icon name="alert-circle" size={13} className="shrink-0" />
                {warrantyError}
              </p>
            )}
          </Field>
        </div>
      )}
    </div>
  )
}
