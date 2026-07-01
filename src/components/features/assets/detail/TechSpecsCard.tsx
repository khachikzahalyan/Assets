import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import { SectionCard, Icon } from '@/components/ui'
import { buildSpecsLines, buildSpecsCopyText } from './detailFormat'
import { SpecTile } from './SpecTile'
import { LicenseBlock } from './LicenseBlock'
import type { AttachChoice } from './LicenseBlock'

interface TechSpecsCardProps {
  asset: Asset
  licenses: WorkstationLicense[]
  copyEnabled?: boolean
  partsNote?: boolean
  /** Pass true when the asset category has hasOemLicense capability. */
  hasOemLicenseCap?: boolean
  /** When true, attach affordances are shown in LicenseBlock. */
  canManageLicense?: boolean
  onAttachLicense?: (choice: AttachChoice) => Promise<void> | void
  // detach lives in the Licenses module, not the asset card
  licensePool?: { id: string; name: string; vendor: string | null }[]
  licenseBusy?: boolean
  /** When provided, renders the «Открыть Запчасти →» button in the parts footer row. */
  onOpenParts?: () => void
  /**
   * Mobile-only bare mode (passed from AssetDetailMobileView).
   * When true: renders WITHOUT the SectionCard wrapper, header/title, copy button,
   * and parts-note footer — just the tile grid + a standalone license card.
   * Desktop always receives bare=false (the default).
   */
  bare?: boolean
}

export function TechSpecsCard({
  asset,
  licenses,
  copyEnabled = true,
  partsNote = true,
  hasOemLicenseCap = false,
  canManageLicense = false,
  onAttachLicense,
  licensePool,
  licenseBusy = false,
  onOpenParts,
  bare = false,
}: TechSpecsCardProps) {
  const { t } = useTranslation('assets')
  const [copied, setCopied] = useState(false)

  const lines = buildSpecsLines(asset.currentSpecs, asset.categoryId, asset.upgradeCurrent)

  const handleCopy = () => {
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(buildSpecsCopyText(lines, t)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  const copyBtn = lines.length > 0 && copyEnabled ? (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? t('detail.specs.copied') : t('detail.specs.copy')}
      className={`flex-shrink-0 inline-flex items-center gap-1.5 h-8 max-md:h-11 px-3 rounded-lg text-[12.5px] font-medium border transition-colors ${
        copied
          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
          : 'bg-surface-2 border-border text-text-tertiary hover:text-text-primary hover:border-border-strong'
      }`}
    >
      <Icon name={copied ? 'check' : 'copy'} size={13} />
      {copied ? t('detail.specs.copied') : t('detail.specs.copy')}
    </button>
  ) : undefined

  // Whether the license section should be rendered at all.
  // Show when: licenses are bound OR an attach affordance is available OR category has OEM license cap.
  const hasAttachAffordance = Boolean(onAttachLicense && canManageLicense)
  const showLicenseSection = licenses.length > 0 || hasAttachAffordance || Boolean(hasOemLicenseCap)

  // Show the "empty specs" placeholder only when there is nothing at all to render.
  const showEmptyPlaceholder = lines.length === 0 && licenses.length === 0 && !hasAttachAffordance && !hasOemLicenseCap

  // ── BARE MODE (mobile only) ─────────────────────────────────────────────
  // No SectionCard, no header, no copy button, no parts-note footer.
  // License block renders as a full-width compact row inside the same spec grid
  // (grid-column: span 2) — matching the prototype's OEM tile placement.
  if (bare) {
    return (
      <div>
        {showEmptyPlaceholder ? (
          <p className="text-[13px] text-text-subtle italic">{t('detail.specs.empty')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {lines.map((line, idx) => (
              <SpecTile
                key={`${line.labelKey}-${idx}`}
                icon={line.icon}
                label={t(line.labelKey)}
                value={line.value}
                accent={line.accent}
                {...(line.badge          !== undefined ? { badge:          line.badge }          : {})}
                {...(line.badgeAccent    !== undefined ? { badgeAccent:    line.badgeAccent }    : {})}
                {...(line.valueClassName !== undefined ? { valueClassName: line.valueClassName } : {})}
                {...(line.slots          !== undefined ? { slots:          line.slots }          : {})}
              />
            ))}
            {showLicenseSection && (
              /* Full-width OEM compact row — matches prototype §682–688 (grid-column:1/-1). */
              <div className="col-span-2 bg-surface border border-border rounded-[10px] px-[13px] py-[10px]">
                <LicenseBlock
                  asset={asset}
                  licenses={licenses}
                  canManage={canManageLicense}
                  busy={licenseBusy}
                  compact
                  {...(onAttachLicense ? { onAttach: onAttachLicense } : {})}
                  {...(licensePool ? { pool: licensePool } : {})}
                />
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── DESKTOP / FULL MODE ──────────────────────────────────────────────────
  return (
    <SectionCard title={t('detail.specs.title')} icon="cpu" iconTone="violet" action={copyBtn}>
      {showEmptyPlaceholder ? (
        <p className="text-[13px] text-text-subtle italic">{t('detail.specs.empty')}</p>
      ) : (
        <>
          {lines.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {lines.map((line, idx) => (
                <SpecTile
                  key={`${line.labelKey}-${idx}`}
                  icon={line.icon}
                  label={t(line.labelKey)}
                  value={line.value}
                  accent={line.accent}
                  {...(line.badge          !== undefined ? { badge:          line.badge }          : {})}
                  {...(line.badgeAccent    !== undefined ? { badgeAccent:    line.badgeAccent }    : {})}
                  {...(line.valueClassName !== undefined ? { valueClassName: line.valueClassName } : {})}
                  {...(line.slots          !== undefined ? { slots:          line.slots }          : {})}
                />
              ))}
            </div>
          )}
          {showLicenseSection && (
            <div className="border-t border-border mt-4 pt-4">
              <LicenseBlock
                asset={asset}
                licenses={licenses}
                canManage={canManageLicense}
                busy={licenseBusy}
                {...(onAttachLicense ? { onAttach: onAttachLicense } : {})}
                {...(licensePool ? { pool: licensePool } : {})}
              />
            </div>
          )}
        </>
      )}
      {partsNote && (
        <div className="mt-5 pt-3 border-t border-dashed border-border flex items-center justify-between gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[13px] text-text-tertiary">
            <Icon name="info" size={12} className="text-text-subtle" />
            {t('detail.parts.note')}
          </span>
          {onOpenParts && (
            <button
              type="button"
              onClick={onOpenParts}
              className="inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-xl text-[14px] font-semibold text-accent-light bg-accent/10 ring-1 ring-inset ring-accent/30 hover:bg-accent/20 transition-colors"
            >
              {t('detail.parts.openParts')}
              <Icon name="arrow-right" size={13} />
            </button>
          )}
        </div>
      )}
    </SectionCard>
  )
}
