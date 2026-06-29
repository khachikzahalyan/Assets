/**
 * AddSubscriptionModal ("Новая подписка") — creates a SaaS subscription.
 * Calls subRepo.createSubscription(input, actor) via onSubmit.
 */
import { useState, useEffect, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Btn, IconBtn, Icon, Field, DIALOG_BACKDROP_BLUR, MODAL_SHEET } from '@/components/ui'

const ADD_SUB_TITLE_ID = 'add-subscription-modal-title'
import type { Employee } from '@/domain/employee'
import type { CreateSubscriptionInput } from '@/domain/subscription'
import { DatePopover } from './DatePopover'
import { EmployeeMultiSelect } from './EmployeeMultiSelect'

export interface AddSubscriptionModalProps {
  employees: Employee[]
  submitting?: boolean
  submitError?: string | null
  onSubmit: (input: CreateSubscriptionInput) => void
  onClose: () => void
}

export function AddSubscriptionModal({
  employees,
  submitting,
  submitError,
  onSubmit,
  onClose,
}: AddSubscriptionModalProps) {
  const { t } = useTranslation('licenses')
  const [name, setName] = useState('')
  const [vendorEmail, setVendorEmail] = useState('')
  const [seatsTotal, setSeatsTotal] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [assignedIds, setAssignedIds] = useState<string[]>([])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  const activeEmps = useMemo(() => employees.filter(e => e.status === 'active'), [employees])

  const toggle = (id: string) =>
    setAssignedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const seatsNum = parseInt(seatsTotal, 10)
  const valid = name.trim() !== '' && !isNaN(seatsNum) && seatsNum >= 1 && !!purchaseDate && !!expiryDate

  const handleSubmit = () => {
    if (!valid) return
    onSubmit({
      name: name.trim(),
      vendorEmail: vendorEmail.trim() || null,
      seatsTotal: seatsNum,
      purchaseDate,
      expiryDate,
      assignedEmployeeIds: assignedIds,
    })
  }

  return ReactDOM.createPortal(
    <div
      className={DIALOG_BACKDROP_BLUR}
      style={{ animation: 'backdropFade 160ms ease both' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`relative w-full max-w-lg bg-surface rounded-xl shadow-2xl shadow-black/60 border border-border overflow-hidden flex flex-col max-h-[90vh] ${MODAL_SHEET}`}
        style={{ animation: 'modalPop 200ms cubic-bezier(.22,1,.36,1) both' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ADD_SUB_TITLE_ID}
      >
        {/* Pull-handle — mobile only */}
        <div className="max-md:block hidden mx-auto h-1 w-9 rounded-full bg-white/20 mb-3 mt-2" />
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-md bg-surface-2 text-accent inline-flex items-center justify-center">
              <Icon name="key-round" size={16} />
            </span>
            <h2 id={ADD_SUB_TITLE_ID} className="text-[15px] font-bold text-text-primary tracking-tight">{t('add.title')}</h2>
          </div>
          <IconBtn icon="x" onClick={onClose} size="sm" title={t('add.cancel')} {...(submitting ? { disabled: true } : {})} />
        </header>

        {/* Form body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <Field label={t('add.name')} required>
            <input
              id="sub-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('add.namePlaceholder')}
              autoFocus
              className="w-full h-9 px-3 text-[13.5px] bg-surface border border-border rounded-lg placeholder:text-text-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
            />
          </Field>

          <Field label={t('add.vendorEmail')}>
            <input
              id="sub-vendor-email"
              type="email"
              value={vendorEmail}
              onChange={e => setVendorEmail(e.target.value)}
              placeholder="it-admin@example.com"
              className="w-full h-9 px-3 text-[13.5px] bg-surface border border-border rounded-lg placeholder:text-text-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
            />
          </Field>

          <div className="grid grid-cols-3 max-md:grid-cols-1 gap-3">
            <Field label={t('add.seatsTotal')} required>
              <input
                id="sub-seats"
                type="number"
                min="1"
                value={seatsTotal}
                onChange={e => setSeatsTotal(e.target.value)}
                placeholder="10"
                className="w-full h-9 px-3 text-[13.5px] bg-surface border border-border rounded-lg placeholder:text-text-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
              />
            </Field>

            <Field label={t('add.purchaseDate')} required>
              <DatePopover
                value={purchaseDate}
                onChange={setPurchaseDate}
                direction="down"
                showOffsets={false}
                label={t('add.purchaseDate')}
              />
            </Field>

            <Field label={t('add.expiryDate')} required>
              <DatePopover
                value={expiryDate}
                onChange={setExpiryDate}
                {...(purchaseDate ? { min: purchaseDate } : {})}
                direction="down"
                showOffsets
                label={t('add.expiryDate')}
              />
            </Field>
          </div>

          <Field label={`${t('add.assignEmployees')} (${assignedIds.length})`}>
            <EmployeeMultiSelect
              employees={activeEmps}
              selected={assignedIds}
              onToggle={toggle}
            />
          </Field>

          {submitError && (
            <p role="alert" className="text-[12px] text-[#FDA4AF]">{submitError}</p>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border flex-shrink-0">
          <Btn variant="ghost" onClick={onClose} disabled={submitting}>
            {t('add.cancel')}
          </Btn>
          <Btn
            variant="primary"
            onClick={handleSubmit}
            disabled={!valid || submitting}
            data-testid="add-subscription-submit"
          >
            {t('add.submit')}
          </Btn>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
