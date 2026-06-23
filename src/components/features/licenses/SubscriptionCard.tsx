/**
 * SubscriptionCard — displays one SaaS subscription.
 * seatsUsed = assignedEmployeeIds.length (never stored).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Subscription } from '@/domain/subscription'
import type { Employee } from '@/domain/employee'
import { SeatBar } from './SeatBar'
import { ManageAssigneesModal } from './ManageAssigneesModal'
import { daysUntil, fmtDate, pluralEmp } from './licenseHelpers'

export interface SubscriptionCardProps {
  sub: Subscription
  employees: Employee[]
  onUpdateAssignees: (subId: string, ids: string[]) => Promise<void>
}

export function SubscriptionCard({ sub, employees, onUpdateAssignees }: SubscriptionCardProps) {
  const { t, i18n } = useTranslation('licenses')
  const [manageOpen, setManageOpen] = useState(false)

  const seatsUsed = sub.assignedEmployeeIds.length
  const days = daysUntil(sub.expiryDate)
  const expiringSoon = isFinite(days) && days >= 0 && days <= 10

  return (
    <article
      className="bg-surface border border-border rounded-xl shadow-sm shadow-black/30 p-5 flex flex-col gap-4"
      data-testid={`sub-card-${sub.id}`}
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-bold text-text-primary tracking-tight truncate">{sub.name}</h3>
            {expiringSoon && (
              <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold border bg-amber-500/15 text-amber-300 border-amber-500/25 flex-shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                {t('subs.expiresInDays', { days })}
              </span>
            )}
          </div>
          {sub.vendorEmail && (
            <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-text-tertiary truncate">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="1.75" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <span className="truncate">{sub.vendorEmail}</span>
            </div>
          )}
        </div>
        <span
          className="w-9 h-9 rounded-lg bg-surface-2 text-text-tertiary inline-flex items-center justify-center flex-shrink-0"
          aria-hidden="true"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"/>
            <path d="m7 16.5-4.74-2.85M7 16.5l5-3M7 16.5v5.17M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"/>
            <path d="m17 16.5-5-3M17 16.5 21.74 13.65M17 16.5v5.17M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"/>
            <path d="M12 8 7.26 5.15M12 8l4.74-2.85M12 13.5V8"/>
          </svg>
        </span>
      </div>

      {/* Seat bar */}
      <SeatBar used={seatsUsed} total={sub.seatsTotal} />

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.06em] font-semibold text-text-subtle mb-0.5">
            {t('subs.purchaseDate')}
          </div>
          <div className="text-[13.5px] text-text-secondary font-mono">
            {sub.purchaseDate ? fmtDate(sub.purchaseDate, i18n.language) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.06em] font-semibold text-text-subtle mb-0.5">
            {t('subs.expiryDate')}
          </div>
          <div className={`text-[13.5px] font-mono ${expiringSoon ? 'text-amber-300 font-semibold' : 'text-text-secondary'}`}>
            {sub.expiryDate ? fmtDate(sub.expiryDate, i18n.language) : '—'}
          </div>
        </div>
      </div>

      {/* Employees row */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-border">
        <span className="text-[11.5px] uppercase tracking-[0.06em] font-semibold text-text-subtle">
          {t('subs.employees')}
        </span>
        <div className="flex items-center gap-2">
          {seatsUsed > 0 ? (
            <span className="text-[13px] font-semibold text-text-primary">
              {pluralEmp(seatsUsed)}
            </span>
          ) : (
            <span className="text-[12.5px] text-text-subtle italic">{t('subs.notAssigned')}</span>
          )}
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            data-testid={`manage-btn-${sub.id}`}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-text-tertiary hover:text-text-primary transition-colors"
          >
            {t('subs.details')}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
        </div>
      </div>

      {manageOpen && (
        <ManageAssigneesModal
          subId={sub.id}
          subName={sub.name}
          seatsTotal={sub.seatsTotal}
          initialAssignedIds={sub.assignedEmployeeIds}
          employees={employees}
          onUpdateAssignees={onUpdateAssignees}
          onClose={() => setManageOpen(false)}
        />
      )}
    </article>
  )
}
