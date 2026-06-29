import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('assets')
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
      setWarrantyError(t('condition.warrantyBeforePurchase'))
      return
    }
    setWarrantyError('')
    onChange({ ...value, warrantyEndsAt: iso })
  }

  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Section header */}
        <div className="text-[13px] font-semibold text-text-tertiary tracking-[0.06em] uppercase">{t('condition.title')}</div>
        <div className="inline-flex bg-[#22272E]/70 rounded-lg p-0.5" role="group" aria-label={t('condition.title')}>
          <button
            type="button"
            onClick={() => setCondition('new')}
            aria-pressed={value.condition === 'new'}
            className={`px-3.5 py-1 text-[14px] font-semibold rounded-md transition-all duration-150 ${value.condition === 'new' ? 'bg-accent text-white shadow-sm' : 'text-text-primary hover:bg-[#1B1F24]/70'}`}
          >{t('condition.new')}</button>
          <button
            type="button"
            onClick={() => setCondition('used')}
            aria-pressed={value.condition === 'used'}
            className={`px-3.5 py-1 text-[14px] font-semibold rounded-md transition-all duration-150 ${value.condition === 'used' ? 'bg-accent text-white shadow-sm' : 'text-text-primary hover:bg-[#1B1F24]/70'}`}
          >{t('condition.used')}</button>
        </div>
      </div>

      {value.condition === 'new' && (
        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
          <Field label={t('condition.purchaseDate')} required>
            <DatePicker value={value.purchaseDate} onChange={setPurchase} />
          </Field>
          <Field label={t('condition.warrantyEndsAt')} required>
            <DatePicker
              value={value.warrantyEndsAt}
              {...(value.purchaseDate ? { min: value.purchaseDate } : {})}
              onChange={setWarranty}
              showPlusYear
            />
            {warrantyError && (
              <p className="mt-1 text-[13px] font-medium text-rose-300 flex items-center gap-1" role="alert">
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
