/**
 * ActivateKeyModal — assigns a free Windows key onto a keyless OEM-capable asset.
 * Calls wRepo.assignLicense(id, { to: 'device', assetId }, actor).
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Btn, IconBtn, Icon, DIALOG_BACKDROP_BLUR } from '@/components/ui'

const ACTIVATE_TITLE_ID = 'activate-key-modal-title'

function MsLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1"  y="1"  width="10" height="10" fill="#F25022" />
      <rect x="13" y="1"  width="10" height="10" fill="#7FBA00" />
      <rect x="1"  y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  )
}

export interface KeylessAsset {
  id: string
  assetName: string
  invCode: string
  catName: string
}

export interface ActivateKeyModalProps {
  maskedKey: string
  version: string
  keylessAssets: KeylessAsset[]
  submitting?: boolean
  submitError?: string | null
  onConfirm: (assetId: string) => void
  onClose: () => void
}

export function ActivateKeyModal({
  maskedKey,
  version,
  keylessAssets,
  submitting,
  submitError,
  onConfirm,
  onClose,
}: ActivateKeyModalProps) {
  const { t } = useTranslation('licenses')
  const [search, setSearch] = useState('')
  const [targetId, setTargetId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  // Focus management on open — focus the search input
  useEffect(() => {
    const id = setTimeout(() => { searchInputRef.current?.focus() }, 30)
    return () => clearTimeout(id)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return keylessAssets
    return keylessAssets.filter(a =>
      a.assetName.toLowerCase().includes(q) ||
      a.invCode.toLowerCase().includes(q) ||
      a.catName.toLowerCase().includes(q),
    )
  }, [keylessAssets, search])

  return ReactDOM.createPortal(
    <div
      className={DIALOG_BACKDROP_BLUR}
      style={{ animation: 'backdropFade 160ms ease both' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-lg bg-surface rounded-xl shadow-2xl shadow-black/60 border border-border overflow-hidden flex flex-col max-h-[90vh]"
        style={{ animation: 'modalPop 200ms cubic-bezier(.22,1,.36,1) both' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ACTIVATE_TITLE_ID}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-md bg-surface-2 text-accent inline-flex items-center justify-center">
              <Icon name="zap" size={16} />
            </span>
            <h2 id={ACTIVATE_TITLE_ID} className="text-[15px] font-bold text-text-primary tracking-tight">{t('activate.title')}</h2>
          </div>
          <IconBtn icon="x" onClick={onClose} size="sm" title={t('activate.cancel')} />
        </header>

        <div className="p-5 space-y-4 overflow-y-auto flex flex-col min-h-0">
          {/* Key being activated */}
          <div className="rounded-lg border border-border bg-bg px-3.5 py-3 flex-shrink-0 flex items-center gap-3.5">
            <span className="w-11 h-11 rounded-lg bg-[#0F1620] border border-border inline-flex items-center justify-center flex-shrink-0">
              <MsLogo size={22} />
            </span>
            <div className="min-w-0">
              <div className="text-[10.5px] uppercase tracking-[0.08em] font-semibold text-text-subtle mb-0.5">
                {t('activate.keyLabel')}
              </div>
              <div className="font-mono text-[13.5px] text-text-primary tracking-tight truncate">{maskedKey}</div>
              <div className="text-[12px] text-text-tertiary mt-0.5">{version}</div>
            </div>
          </div>

          {/* Target asset picker */}
          <div className="flex flex-col min-h-0">
            <div className="relative mb-2 flex-shrink-0">
              <Icon name="search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none" />
              <input
                ref={searchInputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('activate.searchPlaceholder')}
                aria-label={t('activate.searchPlaceholder')}
                className="w-full h-9 pl-7 pr-2 text-[13.5px] rounded-lg bg-bg border border-border text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-accent/50"
              />
            </div>

            <div
              className="rounded-lg border border-border overflow-y-auto flex-1"
              style={{ maxHeight: 340 }}
              role="listbox"
              aria-label={t('activate.assetListLabel')}
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-[13.5px] text-text-subtle">
                  {t('activate.noAssets')}
                </div>
              ) : (
                filtered.map(a => {
                  const sel = a.id === targetId
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="option"
                      aria-selected={sel}
                      onClick={() => setTargetId(a.id)}
                      data-testid={`activate-asset-${a.id}`}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-border last:border-b-0 ${
                        sel ? 'bg-accent/10' : 'hover:bg-surface-2'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors ${
                        sel ? 'bg-accent border-accent' : 'border-border-strong'
                      }`}>
                        {sel && <Icon name="check" size={11} className="text-white" />}
                      </span>
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="text-[13.5px] text-text-primary font-medium truncate">{a.assetName}</div>
                        <div className="font-mono text-[11.5px] text-text-tertiary truncate">
                          {a.invCode}{a.catName ? ` · ${a.catName}` : ''}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {submitError && (
            <p role="alert" className="text-[12px] text-[#FDA4AF]">{submitError}</p>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border flex-shrink-0">
          <Btn variant="ghost" onClick={onClose} disabled={submitting}>
            {t('activate.cancel')}
          </Btn>
          <Btn
            variant="primary"
            onClick={() => targetId && onConfirm(targetId)}
            disabled={!targetId || submitting}
          >
            {t('activate.confirm')}
          </Btn>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
