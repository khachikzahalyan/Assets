import type { Asset } from '@/domain/asset/types'
import { Barcode128 } from './Barcode128'

export interface AssetLabelProps {
  asset: Asset
}

/**
 * One printable asset label: the Code 128 barcode + the inventory code, nothing else
 * (owner wants only the barcode and the inventory code). The label fills its container's
 * width, so the physical size is driven by the print `@page` size (see index.css) or the
 * preview frame in LabelPreviewDialog.
 * NOTE: inline styles + literal black/white are intentional and CODE_QUALITY-justified — this
 * is a print artifact: physical mm dimensions aren't Tailwind tokens, and the label must be
 * black-on-white on paper regardless of the app's (dark) theme tokens.
 */
export function AssetLabel({ asset }: AssetLabelProps) {
  return (
    <div
      className="ams-label"
      style={{
        width: '100%', padding: '3mm', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '3mm', breakInside: 'avoid', overflow: 'hidden', color: '#000', background: '#fff',
      }}
    >
      {/* Order matches the owner's target label (image #22): barcode on top, inventory code centered below. */}
      {asset.barcode ? (
        <div style={{ width: '100%' }}>
          <Barcode128 value={asset.barcode} />
        </div>
      ) : null}
      <div
        style={{
          width: '100%', textAlign: 'center',
          fontSize: '16pt', fontWeight: 700, lineHeight: 1.05, letterSpacing: '0.5px',
        }}
      >
        {asset.invCode}
      </div>
    </div>
  )
}
