import { useTranslation } from 'react-i18next'
import { Btn, Chip, EmptyState, Icon } from '@/components/ui'
import { fmtRuDate } from './detailFormat'

interface ActRecord {
  id: string
  name: string
  date: string
  path: string
}

interface DocumentsTabProps {
  acts: ActRecord[]
  onOpen: (path: string) => void
  /** ISO date string (YYYY-MM-DD); present when condition === 'new'. */
  purchaseDate?: string | null
  /** ISO date string (YYYY-MM-DD); present when condition === 'new'. */
  warrantyEndsAt?: string | null
}

// ---------------------------------------------------------------------------
// WarrantyBlock — mirrors prototype asset-detail.html WarrantyBlock component.
// Renders only when purchaseDate + warrantyEndsAt are both present.
// ---------------------------------------------------------------------------

interface WarrantyBlockProps {
  purchaseDate:   string
  warrantyEndsAt: string
}

function warrantyStatus(endsAt: string): {
  key: 'active' | 'expiring' | 'expired'
  label: string
  chipCls: string
  icon: string
  barCls: string
} {
  const end     = new Date(endsAt)
  const now     = new Date()
  const diffMs  = end.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0)  return { key: 'expired',  label: 'Истекла',                           chipCls: 'bg-rose-500/15 text-rose-300',       icon: 'shield-off',   barCls: 'bg-rose-400'   }
  if (diffDays < 30) return { key: 'expiring', label: `Истекает через ${diffDays} дн.`,    chipCls: 'bg-amber-500/15 text-amber-300',     icon: 'shield-alert', barCls: 'bg-amber-400'  }
  return                    { key: 'active',   label: 'Активна',                           chipCls: 'bg-emerald-500/15 text-emerald-300', icon: 'shield-check', barCls: 'bg-emerald-400' }
}

/** Calendar-month difference between two ISO date strings. */
function monthDiff(start: string, end: string): number {
  const s = new Date(start)
  const e = new Date(end)
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
}

function WarrantyBlock({ purchaseDate, warrantyEndsAt }: WarrantyBlockProps) {
  const status    = warrantyStatus(warrantyEndsAt)
  const totalMs   = new Date(warrantyEndsAt).getTime() - new Date(purchaseDate).getTime()
  const elapsedMs = Date.now()                        - new Date(purchaseDate).getTime()
  const barPct    = status.key === 'expired'
    ? 100
    : Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)))
  const months    = monthDiff(purchaseDate, warrantyEndsAt)
  const remaining = 100 - barPct

  const iconColor = status.key === 'active' ? 'text-emerald-500' : status.key === 'expiring' ? 'text-amber-500' : 'text-rose-400'
  const pctColor  = status.key === 'expired' ? 'text-rose-400'   : status.key === 'expiring' ? 'text-amber-500' : 'text-emerald-300'

  return (
    <div className="mb-4 p-3.5 rounded-xl bg-bg ring-1 ring-border">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Icon name={status.icon} size={13} className={iconColor} />
          <span className="text-[13px] font-medium tracking-widest uppercase text-text-tertiary">Гарантия</span>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12.5px] font-medium ${status.chipCls}`}>
          {status.label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-[15px] font-semibold text-text-primary">{months} мес.</span>
      </div>
      <div className="text-[13px] text-text-secondary mb-2.5">
        с {fmtRuDate(purchaseDate)} по {fmtRuDate(warrantyEndsAt)}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${status.barCls}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
        <span className={`text-[12px] font-medium tabular-nums shrink-0 ${pctColor}`}>
          {barPct}%
        </span>
      </div>
      {status.key !== 'expired' && (
        <div className="text-[12px] text-text-tertiary mt-1 text-right">{remaining}% осталось</div>
      )}
    </div>
  )
}

export function DocumentsTab({ acts, onOpen, purchaseDate, warrantyEndsAt }: DocumentsTabProps) {
  const { t } = useTranslation('assets')

  const showWarranty = Boolean(purchaseDate && warrantyEndsAt)

  return (
    <div>
      {/* Warranty block — shown when condition='new' and dates are present */}
      {showWarranty && (
        <WarrantyBlock purchaseDate={purchaseDate!} warrantyEndsAt={warrantyEndsAt!} />
      )}

      {acts.length === 0 ? (
        <div className="max-md:hidden">
          <EmptyState icon="file-x" title={t('detail.docs.empty')} />
        </div>
      ) : (
        <ul className="space-y-2">
          {acts.map(act => (
            <li
              key={act.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-bg border border-border"
            >
              <Icon name="file-text" size={16} className="text-text-tertiary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-[#E2E8F0] truncate">{act.name}</p>
                <p className="text-[12px] text-text-subtle">{fmtRuDate(act.date)}</p>
              </div>
              <Btn variant="ghost" size="sm" onClick={() => onOpen(act.path)}>
                {t('detail.docs.open')}
              </Btn>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 pt-4 border-t border-border max-md:hidden">
        <button
          disabled
          className="w-full flex items-center justify-center gap-2 h-10 max-md:h-12 rounded-lg border-2 border-dashed border-border text-text-subtle text-[14px] opacity-60 cursor-not-allowed"
        >
          <Icon name="upload" size={14} />
          <span>{t('detail.docs.upload')}</span>
          <Chip color="gray" size="sm">{t('detail.docs.soon')}</Chip>
        </button>
        <p className="mt-2 text-center text-[12px] text-text-subtle">{t('detail.docs.notice')}</p>
      </div>
    </div>
  )
}
