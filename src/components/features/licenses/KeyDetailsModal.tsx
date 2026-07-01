/**
 * KeyDetailsModal — shows key details, copy (reveal), and usage history timeline.
 * Copy/reveal is gated to super_admin | tech_admin.
 */
import { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { IconBtn, Icon, DIALOG_BACKDROP_BLUR, MODAL_SHEET } from '@/components/ui'
import { formatLicenseDate } from './formatLicenseDate'
import type { AuditLog } from '@/domain/audit'

/** Microsoft 4-square logo SVG — inline, rules-compliant */
function MsLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1"  y="1"  width="10" height="10" fill="#F25022" />
      <rect x="13" y="1"  width="10" height="10" fill="#7FBA00" />
      <rect x="1"  y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  )
}

export interface KeyDetailsModalProps {
  /** License id — used for reveal */
  licenseId: string
  /** Masked key shown by default */
  maskedKey: string
  /** Version / license name */
  version: string
  /** Whether the key is currently in use */
  isInUse: boolean
  /** Current asset name (if in use) */
  assetName?: string | null
  /** Current asset invCode (if in use) */
  invCode?: string | null
  /** Map of assetId → { name, invCode } for resolving history entries */
  assetNameMap?: Record<string, { name: string; invCode: string }>
  /** Audit log entries for this license */
  auditEntries: AuditLog[]
  /** Can this user reveal (copy) the full key? */
  canReveal: boolean
  /** Injectable revealFn for tests; defaults to revealLicenseKey */
  revealFn?: (collection: 'licenses' | 'server_licenses', id: string) => Promise<string>
  onClose: () => void
}

const TITLE_ID = 'key-details-modal-title'

export function KeyDetailsModal({
  licenseId,
  maskedKey,
  version,
  isInUse,
  assetName,
  invCode,
  assetNameMap = {},
  auditEntries,
  canReveal,
  revealFn,
  onClose,
}: KeyDetailsModalProps) {
  const { t, i18n } = useTranslation('licenses')
  const [displayKey, setDisplayKey] = useState(maskedKey)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)

  // Refs to track pending setTimeout ids for cleanup
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ref for focus management — focus the footer close button on open
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  // Focus the close button when modal opens
  useEffect(() => {
    const id = setTimeout(() => { closeBtnRef.current?.focus() }, 30)
    return () => clearTimeout(id)
  }, [])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current)
      if (copyErrorTimerRef.current !== null) clearTimeout(copyErrorTimerRef.current)
    }
  }, [])

  const handleCopy = async () => {
    setCopyError(false)
    try {
      let key = displayKey
      // If key is still masked, reveal first (rules-gated on server)
      if (canReveal && revealFn) {
        key = await revealFn('licenses', licenseId)
        setDisplayKey(key)
      }
      await navigator.clipboard.writeText(key)
      // Clear any pending copied timer before setting a new one
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current)
      setCopied(true)
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clear any pending copyError timer before setting a new one
      if (copyErrorTimerRef.current !== null) clearTimeout(copyErrorTimerRef.current)
      setCopyError(true)
      copyErrorTimerRef.current = setTimeout(() => setCopyError(false), 2500)
    }
  }

  // Build timeline from audit entries sorted newest first
  const historyEntries = [...auditEntries]
    .filter(e => ['assigned', 'created', 'key_rotated', 'license_decoupled'].includes(e.action))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  return ReactDOM.createPortal(
    <div
      className={DIALOG_BACKDROP_BLUR}
      style={{ animation: 'backdropFade 160ms ease both' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`relative w-full max-w-md bg-surface rounded-xl shadow-2xl shadow-black/60 border border-border overflow-hidden flex flex-col max-h-[90vh] ${MODAL_SHEET}`}
        style={{ animation: 'modalPop 200ms cubic-bezier(.22,1,.36,1) both' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
      >
        {/* Pull-handle — mobile only */}
        <div className="max-md:block hidden mx-auto h-1 w-9 rounded-full bg-white/20 mb-3 mt-2" />
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-md bg-surface-2 inline-flex items-center justify-center flex-shrink-0">
              <MsLogo size={18} />
            </span>
            <h2 id={TITLE_ID} className="text-[15px] font-bold text-text-primary tracking-tight">{t('keyDetails.title')}</h2>
          </div>
          <IconBtn icon="x" onClick={onClose} size="sm" title={t('keyDetails.close')} />
        </header>

        <div className="p-5 space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* Key display */}
          <div className="rounded-xl border border-border bg-bg p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-lg bg-[#0F1620] border border-border inline-flex items-center justify-center flex-shrink-0">
                  <MsLogo size={18} />
                </span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-text-primary leading-tight truncate">{version}</div>
                  <div className="text-[11.5px] text-text-subtle">{t('keyDetails.keyLabel')}</div>
                </div>
              </div>
              {canReveal && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className={[
                    'flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium border transition-colors',
                    copyError
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : copied
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'bg-surface-2 border-border text-text-tertiary hover:text-text-primary hover:border-border-strong',
                  ].join(' ')}
                >
                  <Icon name={copied ? 'check' : 'copy'} size={13} />
                  {copyError ? t('keyDetails.copyError') : copied ? t('keyDetails.copied') : t('keyDetails.copy')}
                </button>
              )}
            </div>
            <div className="rounded-lg bg-surface border border-border px-3 py-2.5">
              <span className="font-mono text-[14px] font-semibold text-text-primary tracking-[0.06em] break-all leading-snug select-all">
                {displayKey}
              </span>
            </div>
          </div>

          {/* History timeline */}
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.09em] font-semibold text-text-subtle mb-3">
              {t('keyDetails.historyHeading')}
            </div>

            {historyEntries.length === 0 && !isInUse ? (
              <div className="text-[13px] text-text-subtle italic">{t('keyDetails.historyEmpty')}</div>
            ) : (
              <div className="space-y-0">
                {/* Current entry */}
                {isInUse && assetName && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/25 flex-shrink-0 mt-1" />
                      {historyEntries.length > 0 && <div className="w-px flex-1 bg-border mt-1.5" />}
                    </div>
                    <div className="pb-4 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-[13.5px] font-semibold text-text-primary leading-tight truncate">{assetName}</span>
                        <span className="inline-flex items-center text-[10.5px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 flex-shrink-0">
                          {t('keyDetails.now')}
                        </span>
                      </div>
                      {invCode && <div className="font-mono text-[11.5px] text-text-subtle">{invCode}</div>}
                    </div>
                  </div>
                )}

                {/* Audit-log based history */}
                {historyEntries.map((entry, i) => {
                  const isLast = i === historyEntries.length - 1
                  const afterData = entry.after as Record<string, unknown> | null
                  const beforeData = entry.before as Record<string, unknown> | null
                  const rawAssetId = (afterData?.['assetId'] ?? beforeData?.['assetId']) as string | undefined
                  const resolvedEntry = rawAssetId ? assetNameMap[rawAssetId] : undefined
                  const resolvedAssetName = resolvedEntry ? resolvedEntry.name : rawAssetId
                  const resolvedInvCode = resolvedEntry ? resolvedEntry.invCode : null
                  const dateStr = formatLicenseDate(entry.at, i18n.language)
                  const actionLabel = t(`keyDetails.action.${entry.action}`, { defaultValue: entry.action })
                  return (
                    <div key={entry.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-border-strong flex-shrink-0 mt-1" />
                        {!isLast && <div className="w-px flex-1 bg-border mt-1.5" />}
                      </div>
                      <div className={`${isLast ? '' : 'pb-4'} flex-1 min-w-0`}>
                        <div className="text-[13px] font-medium text-text-tertiary leading-tight truncate mb-0.5">
                          {actionLabel}
                        </div>
                        {resolvedAssetName && (
                          <div className="text-[12.5px] text-text-primary truncate">{resolvedAssetName}</div>
                        )}
                        {resolvedInvCode && (
                          <div className="font-mono text-[11.5px] text-text-subtle">{resolvedInvCode}</div>
                        )}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11.5px] text-text-subtle">{dateStr}</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-surface-2 text-text-subtle">
                            {entry.actorRole}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border flex-shrink-0">
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="text-text-secondary hover:bg-surface-2 hover:text-text-primary h-9 px-3.5 text-sm gap-1.5 inline-flex items-center justify-center rounded-lg font-medium tracking-tight transition-all duration-150"
          >
            {t('keyDetails.close')}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
