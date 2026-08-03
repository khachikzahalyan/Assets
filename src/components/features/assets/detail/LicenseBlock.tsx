import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@/domain/asset'
import { ASSET_STATUS } from '@/domain/asset'
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
  /**
   * Licenses decoupled (freed) from this asset during write-off.
   * Only populated when the asset is disposed and has no active license.
   */
  decoupledLicenses?: WorkstationLicense[]
  /**
   * Licenses that were retired together with this asset (OEM path).
   * Only populated when the asset is disposed.
   */
  retiredWithAssetLicenses?: WorkstationLicense[]
  /** @deprecated No longer used — license management lives in the Licenses module */
  canManage?: boolean
  /** @deprecated No longer used */
  onAttach?: (choice: AttachChoice) => Promise<void> | void
  /** @deprecated No longer used */
  pool?: { id: string; name: string; vendor: string | null }[]
  /** @deprecated No longer used */
  busy?: boolean
  /**
   * Mobile compact mode — renders a single horizontal row inside the spec tile
   * grid (col-span-2). Shows 30px white MS-logo box + "OEM — name" + amber badge.
   * Desktop LicenseBlock is unaffected; this prop is only passed from TechSpecsCard's
   * bare mode (mobile only).
   */
  compact?: boolean
}

// ---------------------------------------------------------------------------
// Microsoft logo SVG — shared by all three display states
// ---------------------------------------------------------------------------

function MsLogo() {
  return (
    <div className="w-11 h-11 rounded-lg bg-[#0F1620] light:bg-slate-100 border border-border inline-flex items-center justify-center shrink-0">
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
// RetailKeyArea — key line + copy button for a Retail license, self-contained
// probe/reveal (same rights and behaviour as the bound-license STATE 1 line).
// Used by the disposed-asset freed-key cards so the owner sees the actual
// Windows key regardless of the asset status.
// ---------------------------------------------------------------------------

function RetailKeyArea({ licenseId }: { licenseId: string }) {
  const { t } = useTranslation('assets')
  const { role } = useAuth()
  const canCopy = role === 'super_admin' || role === 'tech_admin'

  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [hasKey, setHasKey] = useState<boolean | null>(canCopy ? null : false)
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (copiedTimer.current !== null) clearTimeout(copiedTimer.current)
  }, [])

  useEffect(() => {
    if (!canCopy) return
    let cancelled = false
    async function probe() {
      try {
        const key = await revealLicenseKey('licenses', licenseId)
        if (!cancelled) { setRevealedKey(key); setHasKey(true) }
      } catch {
        if (!cancelled) setHasKey(false)
      }
    }
    void probe()
    return () => { cancelled = true }
  }, [licenseId, canCopy])

  async function handleCopy() {
    try {
      const key = revealedKey ?? await revealLicenseKey('licenses', licenseId)
      if (!revealedKey) setRevealedKey(key)
      await navigator.clipboard.writeText(key)
      setCopied(true)
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 1500)
    } catch { /* copy is best-effort here */ }
  }

  if (!canCopy) return null

  return (
    <div className="flex items-center gap-2 min-w-0">
      {hasKey === null && (
        <div aria-hidden="true" className="h-[16px] w-[256px] max-w-full rounded anim-skeleton" />
      )}
      {revealedKey !== null && (
        <p className="text-13.5 font-mono text-text-secondary tracking-wider truncate select-all flex-1 min-w-0">{revealedKey}</p>
      )}
      {hasKey === false && revealedKey === null && (
        <p className="text-13 text-text-subtle italic">{t('detail.license.keyAbsent')}</p>
      )}
      {hasKey === true && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? t('detail.license.copied') : t('detail.license.copy')}
          className={`flex-shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-12 font-medium border transition-colors ${
            copied
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 light:text-emerald-700'
              : 'bg-surface-2 border-border text-text-tertiary hover:text-text-primary hover:border-border-strong'
          }`}
        >
          <Icon name={copied ? 'check' : 'copy'} size={12} />
          {copied ? t('detail.license.copied') : t('detail.license.copy')}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LicenseBlock({
  asset,
  licenses,
  decoupledLicenses = [],
  retiredWithAssetLicenses = [],
  canManage: _canManage,
  onAttach: _onAttach,
  pool: _pool,
  busy: _busy,
  compact = false,
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

  // Written-off assets have no active bound license: reusable (manual/Retail)
  // keys are DECOUPLED back to the pool and OEM keys are RETIRED on write-off.
  // The assumed-OEM legacy fallback must therefore never render for a disposed
  // asset — it would falsely brand a freed manual key's device as OEM.
  const isDisposed = asset.statusId === ASSET_STATUS.disposed

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

  // ---- COMPACT mode (mobile only — inside spec tile grid) -----------------
  if (compact) {
    // Disposed asset: show the freed / retired license rows (full info
    // regardless of asset status — owner rule); nothing only when none exist.
    if (!lic && isDisposed) {
      const rows = [
        ...decoupledLicenses.map(l => ({ id: l.id, name: l.name, oem: false })),
        ...retiredWithAssetLicenses.map(l => ({ id: l.id, name: l.name, oem: true })),
      ]
      if (rows.length === 0) return null
      return (
        <div className="flex flex-col gap-2">
          {rows.map(r => (
            <div key={r.id} className="flex items-center gap-2.5">
              <div className="w-[1.875rem] h-[1.875rem] rounded-lg bg-white flex items-center justify-center shrink-0">
                <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="1"  y="1"  width="10" height="10" fill="#F25022"/>
                  <rect x="13" y="1"  width="10" height="10" fill="#7FBA00"/>
                  <rect x="1"  y="13" width="10" height="10" fill="#00A4EF"/>
                  <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
                </svg>
              </div>
              <span className="text-13 font-bold text-text-primary flex-1 truncate">{r.name}</span>
              {r.oem ? (
                <span className="shrink-0 bg-amber-500/10 border border-amber-500/30 text-amber-300 light:text-amber-700 text-10 font-bold rounded-md px-2 py-0.5">
                  {t('detail.license.oem')}
                </span>
              ) : (
                <span className="shrink-0 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 light:text-emerald-700 text-10 font-bold rounded-md px-2 py-0.5">
                  {t('licenses:assignment.unassigned')}
                </span>
              )}
            </div>
          ))}
        </div>
      )
    }

    const licName = lic ? lic.name : 'Windows'
    // Badge reflects the REAL license type from data. Only the legacy
    // no-license-doc state (active asset, hasOemLicense category) assumes OEM.
    const isOemCompact = lic ? lic.type === 'OEM' : true
    const canCopyCompact = role === 'super_admin' || role === 'tech_admin'
    // Copy roles (super_admin / tech_admin) with a Retail bound license see the
    // KEY inline — one line: MS-logo + key + copy button, no name/badge text.
    const showKeyLine = !isOemCompact && !!lic && canCopyCompact
    return (
      <div className="flex items-center gap-2.5">
        {/* White MS-logo box — 1.875rem */}
        <div className="w-[1.875rem] h-[1.875rem] rounded-lg bg-white flex items-center justify-center shrink-0">
          <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="1"  y="1"  width="10" height="10" fill="#F25022"/>
            <rect x="13" y="1"  width="10" height="10" fill="#7FBA00"/>
            <rect x="1"  y="13" width="10" height="10" fill="#00A4EF"/>
            <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
          </svg>
        </div>

        {showKeyLine ? (
          /* One line: icon + key + copy button (name/badge dropped). */
          <>
            {hasKey === null && revealedKey === null && (
              <div aria-hidden="true" className="h-[15px] flex-1 min-w-0 rounded anim-skeleton" />
            )}
            {revealedKey !== null && (
              <p className="text-13 font-mono text-text-secondary tracking-wider truncate select-all flex-1 min-w-0">{revealedKey}</p>
            )}
            {hasKey === false && revealedKey === null && (
              <p className="text-12.5 text-text-subtle italic flex-1 min-w-0">{t('detail.license.keyAbsent')}</p>
            )}
            {hasKey === true && (
              <button
                type="button"
                onClick={handleCopy}
                aria-label={copied ? t('detail.license.copied') : t('detail.license.copy')}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-12 font-medium border transition-colors ${
                  copied
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 light:text-emerald-700'
                    : 'bg-surface-2 border-border text-text-tertiary hover:text-text-primary hover:border-border-strong'
                }`}
              >
                <Icon name={copied ? 'check' : 'copy'} size={12} />
                {copied ? t('detail.license.copied') : t('detail.license.copy')}
              </button>
            )}
          </>
        ) : (
          /* OEM / non-copy roles: license name + type badge. */
          <>
            <span className="text-13 font-bold text-text-primary flex-1 truncate">{licName}</span>
            {isOemCompact ? (
              <span className="shrink-0 bg-amber-500/10 border border-amber-500/30 text-amber-300 light:text-amber-700 text-10 font-bold rounded-md px-2 py-0.5">
                {t('detail.license.oem')}
              </span>
            ) : (
              <span className="shrink-0 bg-blue-500/10 border border-blue-500/30 text-blue-300 light:text-blue-700 text-10 font-bold rounded-md px-2 py-0.5">
                {t('detail.license.retail')}
              </span>
            )}
          </>
        )}
      </div>
    )
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
              <span className="text-15.5 font-semibold text-text-primary truncate leading-tight">{lic.name}</span>
              {isOem
                ? <Chip color="indigo">{t('detail.license.oem')}</Chip>
                : <Chip color="blue">{t('detail.license.retail')}</Chip>
              }
            </div>
            {!isOem && (
              // STATE 1: Retail → key line
              <div>
                {copyError && (
                  <p className="mt-0.5 text-11 text-rose-300 light:text-rose-700">{t('detail.license.copyFailed')}</p>
                )}
                {/* Probing the key — shimmer bar matched to the real key width
                    (≈29 mono chars · tracking-wider) and the key line's height, so
                    the block doesn't grow/jump when the key resolves. */}
                {!copyError && hasKey === null && revealedKey === null && (
                  <div aria-hidden="true" className="mt-0.5 h-[16px] w-[256px] max-w-full rounded anim-skeleton" />
                )}
                {!copyError && revealedKey !== null && (
                  <p className="mt-0.5 text-13.5 font-mono text-text-secondary tracking-wider truncate select-all">{revealedKey}</p>
                )}
                {!copyError && hasKey === false && revealedKey === null && (
                  <p className="mt-0.5 text-13 text-text-subtle italic">{t('detail.license.keyAbsent')}</p>
                )}
              </div>
            )}
          </div>

          {/* Copy button skeleton — while the key probe is in flight */}
          {!isOem && canCopy && hasKey === null && (
            <div aria-hidden="true" className="flex-shrink-0 h-8 max-md:h-11 w-[92px] rounded-lg anim-skeleton" />
          )}

          {/* Copy button — super_admin OR tech_admin, non-OEM, key confirmed present */}
          {!isOem && canCopy && hasKey === true && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? t('detail.license.copied') : t('detail.license.copy')}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 h-8 max-md:h-11 px-3 rounded-lg text-12.5 font-medium border transition-colors ${
                copied
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 light:text-emerald-700'
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

  // ---- STATE 4: Disposed asset — freed / retired license cards ---------------
  if (isDisposed) {
    const hasFreed = decoupledLicenses.length > 0
    const hasRetired = retiredWithAssetLicenses.length > 0
    if (!hasFreed && !hasRetired) return null

    return (
      <div className="flex flex-col gap-3">
        {decoupledLicenses.map(freed => (
          <div key={freed.id} className="flex items-center gap-3.5 p-4 rounded-xl bg-bg border border-border">
            <MsLogo />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-15.5 font-semibold text-text-primary truncate leading-tight">
                  {freed.name}
                </span>
                <Chip color="blue">{t('detail.license.retail')}</Chip>
                <Chip color="green">{t('licenses:assignment.unassigned')}</Chip>
              </div>
              {/* The actual Windows key — full info regardless of asset status (owner rule) */}
              <RetailKeyArea licenseId={freed.id} />
              <p className="text-12 text-text-subtle italic mt-0.5">
                {t('detail.license.freedByWriteOff')}
              </p>
            </div>
          </div>
        ))}
        {retiredWithAssetLicenses.map(retired => (
          <div key={retired.id} className="flex items-center gap-3.5 p-4 rounded-xl bg-bg border border-border">
            <MsLogo />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-15.5 font-semibold text-text-primary truncate leading-tight">
                  {retired.name}
                </span>
                <Chip color="indigo">{t('detail.license.oem')}</Chip>
              </div>
              <p className="text-12 text-text-subtle italic">
                {t('detail.license.retiredWithAsset')}
              </p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ---- STATE 3: No license doc (legacy asset) — default display card --------
  // Display-only; does NOT write any data. Never shows attach button.
  // Never rendered for a disposed asset: after write-off a freed manual key
  // must not be misrepresented as an OEM license (see isDisposed note above).

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3.5 p-4 rounded-xl bg-bg border border-border">
        <MsLogo />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-15.5 font-semibold text-text-primary truncate leading-tight">Windows</span>
            <Chip color="indigo">{t('detail.license.oem')}</Chip>
          </div>
        </div>
      </div>
    </div>
  )
}
