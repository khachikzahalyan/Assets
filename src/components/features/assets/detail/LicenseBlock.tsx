import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import { Chip, Icon } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { revealLicenseKey } from '@/lib/licenses/revealKey'

// ---------------------------------------------------------------------------
// Public type — kept for backward-compat exports (TechSpecsCard / tests)
// ---------------------------------------------------------------------------

export type AttachChoice =
  | { kind: 'existing'; licenseId: string }
  | { kind: 'new-key'; rawKey: string }
  | { kind: 'oem-digital' }

// ---------------------------------------------------------------------------
// Props — attach props removed; block is always display-only.
// onAttach / canManage / pool / busy are kept as optional no-ops so callers
// do not need an immediate signature change, but are not used.
// ---------------------------------------------------------------------------

interface LicenseBlockProps {
  asset: Asset
  licenses: WorkstationLicense[]
  /** @deprecated No longer used — license management lives in the Licenses module */
  canManage?: boolean
  /** @deprecated No longer used */
  onAttach?: (choice: AttachChoice) => Promise<void> | void
  /** @deprecated No longer used */
  pool?: { id: string; name: string; vendor: string | null }[]
  /** @deprecated No longer used */
  busy?: boolean
}

// ---------------------------------------------------------------------------
// Microsoft logo SVG — shared by all three display states
// ---------------------------------------------------------------------------

function MsLogo() {
  return (
    <div className="w-11 h-11 rounded-lg bg-[#0F1620] border border-border inline-flex items-center justify-center shrink-0">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="1"  y="1"  width="10" height="10" fill="#F25022"/>
        <rect x="13" y="1"  width="10" height="10" fill="#7FBA00"/>
        <rect x="1"  y="13" width="10" height="10" fill="#00A4EF"/>
        <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LicenseBlock({
  asset,
  licenses,
  // deprecated props accepted but unused
  canManage: _canManage,
  onAttach: _onAttach,
  pool: _pool,
  busy: _busy,
}: LicenseBlockProps) {
  const { t } = useTranslation('assets')
  const { role } = useAuth()

  // Copy / reveal state for the bound-license Retail card
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  // null = probing, true = key exists, false = key absent
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (copiedTimer.current !== null) clearTimeout(copiedTimer.current)
  }, [])

  const lic = licenses.filter(l => l.assignedToAssetId === asset.id)[0]

  // ---------------------------------------------------------------------------
  // Lazy probe: for a non-OEM bound license, attempt one reveal on mount when
  // the current user has copy access (super_admin / tech_admin).
  // ---------------------------------------------------------------------------
  const canCopyForProbe = role === 'super_admin' || role === 'tech_admin'

  useEffect(() => {
    if (!lic || lic.type === 'OEM' || !canCopyForProbe) {
      if (lic && lic.type !== 'OEM') setHasKey(true)
      return
    }

    let cancelled = false

    async function probe() {
      try {
        const key = await revealLicenseKey('licenses', lic!.id)
        if (!cancelled) {
          setRevealedKey(key)
          setHasKey(true)
        }
      } catch {
        if (!cancelled) {
          setHasKey(false)
        }
      }
    }

    void probe()

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lic?.id, canCopyForProbe])

  async function handleCopy() {
    if (!lic) return
    setCopyError(false)
    try {
      const key = revealedKey ?? await revealLicenseKey('licenses', lic.id)
      if (!revealedKey) setRevealedKey(key)
      await navigator.clipboard.writeText(key)
      setCopied(true)
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopyError(true)
    }
  }

  // ---- STATE 1 & 2: Bound license (Retail or OEM) -------------------------
  if (lic) {
    const isOem = lic.type === 'OEM'
    const canCopy = role === 'super_admin' || role === 'tech_admin'

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3.5 p-4 rounded-xl bg-bg border border-border">
          <MsLogo />

          <div className="flex-1 min-w-0">
            {/* OEM: single centered line (name + OEM chip), no key sub-line.
                Retail: name + chip on top, key line below. */}
            <div className={`flex items-center gap-2 ${isOem ? '' : 'mb-1'}`}>
              <span className="text-[15.5px] font-semibold text-text-primary truncate leading-tight">{lic.name}</span>
              {isOem
                ? <Chip color="indigo">{t('detail.license.oem')}</Chip>
                : <Chip color="blue">{t('detail.license.retail')}</Chip>
              }
            </div>
            {!isOem && (
              // STATE 1: Retail → key line
              <div>
                {copyError && (
                  <p className="mt-0.5 text-[11px] text-[#FDA4AF]">{t('detail.license.copyFailed')}</p>
                )}
                {!copyError && revealedKey !== null && (
                  <p className="mt-0.5 text-[13.5px] font-mono text-text-secondary tracking-wider truncate select-all">{revealedKey}</p>
                )}
                {!copyError && hasKey === false && revealedKey === null && (
                  <p className="mt-0.5 text-[13px] text-text-subtle italic">{t('detail.license.keyAbsent')}</p>
                )}
              </div>
            )}
          </div>

          {/* Copy button — super_admin OR tech_admin, non-OEM, key confirmed present */}
          {!isOem && canCopy && hasKey === true && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? t('detail.license.copied') : t('detail.license.copy')}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 h-8 max-md:h-11 px-3 rounded-lg text-[12.5px] font-medium border transition-colors ${
                copied
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-surface-2 border-border text-text-tertiary hover:text-text-primary hover:border-border-strong'
              }`}
            >
              <Icon name={copied ? 'check' : 'copy'} size={13} />
              {copied ? t('detail.license.copied') : t('detail.license.copy')}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ---- STATE 3: No license doc (legacy asset) — default display card --------
  // Display-only; does NOT write any data. Never shows attach button.
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3.5 p-4 rounded-xl bg-bg border border-border">
        <MsLogo />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[15.5px] font-semibold text-text-primary truncate leading-tight">Windows</span>
            <Chip color="indigo">{t('detail.license.oem')}</Chip>
          </div>
        </div>
      </div>
    </div>
  )
}
