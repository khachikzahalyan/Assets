import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@/domain/asset'
import type { WorkstationLicense } from '@/domain/license'
import { SectionCard, Btn } from '@/components/ui'
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
}: TechSpecsCardProps) {
  const { t } = useTranslation('assets')
  const [copied, setCopied] = useState(false)

  const lines = buildSpecsLines(asset.currentSpecs, asset.categoryId)

  const handleCopy = () => {
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(buildSpecsCopyText(lines, t)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  const copyBtn = lines.length > 0 && copyEnabled ? (
    <Btn variant="ghost" size="sm" onClick={handleCopy}>
      {copied ? t('detail.specs.copied') : t('detail.specs.copy')}
    </Btn>
  ) : undefined

  // Whether the license section should be rendered at all.
  // Show when: licenses are bound OR an attach affordance is available OR category has OEM license cap.
  const hasAttachAffordance = Boolean(onAttachLicense && canManageLicense)
  const showLicenseSection = licenses.length > 0 || hasAttachAffordance || Boolean(hasOemLicenseCap)

  // Show the "empty specs" placeholder only when there is nothing at all to render.
  const showEmptyPlaceholder = lines.length === 0 && licenses.length === 0 && !hasAttachAffordance && !hasOemLicenseCap

  return (
    <SectionCard title={t('detail.specs.title')} icon="cpu" action={copyBtn}>
      {showEmptyPlaceholder ? (
        <p className="text-[13px] text-text-subtle italic">{t('detail.specs.empty')}</p>
      ) : (
        <>
          {lines.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
        <p className="mt-4 text-[12px] text-text-subtle">{t('detail.parts.note')}</p>
      )}
    </SectionCard>
  )
}
