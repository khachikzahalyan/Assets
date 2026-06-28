import type { Asset } from '@/domain/asset/types'
import { Barcode128 } from './Barcode128'

export interface AssetLabelProps {
  asset: Asset
}

/**
 * One ~50×30mm printable asset label: barcode + numeric code + invCode + brand/model.
 * NOTE: inline styles + literal black are intentional and CODE_QUALITY-justified — this is a
 * print artifact: physical mm dimensions aren't expressible as Tailwind tokens, and the label
 * must be black-on-white on paper regardless of the app's (dark) theme tokens.
 */
export function AssetLabel({ asset }: AssetLabelProps) {
  const title = [asset.brand, asset.model].filter(Boolean).join(' ')
  return (
    <div
      className="ams-label"
      style={{
        width: '50mm', height: '30mm', padding: '2mm', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        breakInside: 'avoid', overflow: 'hidden', color: '#000', background: '#fff',
      }}
    >
      {asset.barcode ? <Barcode128 value={asset.barcode} height={36} /> : null}
      <div style={{ fontFamily: 'monospace', fontSize: '10pt', lineHeight: 1.1, marginTop: '1mm' }}>
        {asset.barcode ?? ''}
      </div>
      <div style={{ fontSize: '7pt', lineHeight: 1.1 }}>{asset.invCode}</div>
      {title ? (
        <div style={{ fontSize: '7pt', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '46mm' }}>
          {title}
        </div>
      ) : null}
    </div>
  )
}
