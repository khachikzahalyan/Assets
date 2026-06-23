/**
 * LicenseAttachPanel — presentational panel for attaching a license to an asset.
 *
 * No Firebase imports. Handlers come from props (wired in Task 3 via AssetDetailPage).
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Icon } from '@/components/ui'
import { LicensePicker, emptyLicensePickerValue } from '@/components/features/licenses/LicensePicker'
import type { LicensePickerValue } from '@/components/features/licenses/LicensePicker'
import type { AttachChoice } from './LicenseBlock'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LicenseAttachPanelProps {
  pool: { id: string; name: string; vendor: string | null }[]
  busy?: boolean
  onConfirm: (choice: AttachChoice) => void
  onCancel: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LicenseAttachPanel({
  pool,
  busy = false,
  onConfirm,
  onCancel,
}: LicenseAttachPanelProps) {
  const { t } = useTranslation('assets')
  const [picker, setPicker] = useState<LicensePickerValue>(emptyLicensePickerValue)

  // Derive whether the current picker state represents a valid choice
  const validChoice =
    Boolean(picker.pickId) ||
    (picker.licenseMode === 'manual' && picker.rawKey.trim().length > 0) ||
    picker.licenseMode === 'oem_digital'

  function handleConfirm() {
    if (!validChoice) return
    if (picker.pickId) {
      onConfirm({ kind: 'existing', licenseId: picker.pickId })
    } else if (picker.licenseMode === 'manual' && picker.rawKey.trim()) {
      onConfirm({ kind: 'new-key', rawKey: picker.rawKey.trim() })
    } else if (picker.licenseMode === 'oem_digital') {
      onConfirm({ kind: 'oem-digital' })
    }
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      <p className="text-[13px] font-semibold text-text-tertiary tracking-[0.06em] uppercase">
        {t('detail.license.attachTitle')}
      </p>

      {/* Picker */}
      <LicensePicker
        showDigital
        idPrefix="attach-oem"
        pool={pool}
        value={picker}
        onChange={setPicker}
      />

      {/* Action row */}
      <div className="flex items-center gap-2 pt-1">
        <Btn variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          <Icon name="x" size={13} />
          {t('detail.license.cancel')}
        </Btn>
        <Btn
          variant="primary"
          size="sm"
          onClick={handleConfirm}
          disabled={busy || !validChoice}
        >
          <Icon name="link" size={13} />
          {t('detail.license.attach')}
        </Btn>
      </div>
    </div>
  )
}
