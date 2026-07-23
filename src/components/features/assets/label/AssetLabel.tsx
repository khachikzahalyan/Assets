import type { Asset } from '@/domain/asset/types'
import { BarcodeSvg } from './BarcodeSvg'

export interface AssetLabelProps {
  asset: Asset
}

/**
 * One printable asset label, matching the owner's reference sticker exactly:
 * bold black company wordmark on the left, a thin full-height divider rule,
 * then the Code 128 barcode with the inventory code as a small mono
 * human-readable line tucked right under the bars. No other text.
 * The label fills its container's width; physical size is driven by the print
 * `@page` (80×40mm, index.css).
 * NOTE: inline styles + literal black/white are intentional and CODE_QUALITY-justified — this
 * is a print artifact: physical mm dimensions aren't Tailwind tokens, and the label must be
 * black-on-white on paper regardless of the app's (dark) theme tokens.
 * The logo PNG (orange on light gray) is forced to solid black via a CSS filter —
 * thermal printers are B/W, and mid-luminance orange dithers to unreadable speckle;
 * grayscale→darken→hard-contrast maps the wordmark to black and the backdrop to white.
 */
export function AssetLabel({ asset }: AssetLabelProps) {
  return (
    <div
      className="ams-label"
      style={{
        width: '100%', padding: '3.5mm 4mm', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', gap: '3mm',
        breakInside: 'avoid', overflow: 'hidden', color: '#000', background: '#fff',
      }}
    >
      {/* Left: company wordmark, vertically centered */}
      <div style={{ width: '20mm', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src="/telcell-logo.png"
          alt="Telcell"
          style={{ width: '100%', filter: 'grayscale(1) brightness(0.7) contrast(9)' }}
        />
      </div>

      {/* Thin divider rule — spans the content height like the reference */}
      <div aria-hidden="true" style={{ width: '0.4mm', alignSelf: 'stretch', background: '#000', flexShrink: 0 }} />

      {/* Right: barcode with the inventory code as its human-readable line */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {asset.barcode ? (
          <div style={{ width: '100%' }}>
            <BarcodeSvg value={asset.barcode} height={80} />
          </div>
        ) : null}
        <div
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '8.5pt', fontWeight: 600, letterSpacing: '0.18em',
            lineHeight: 1, marginTop: '1mm', whiteSpace: 'nowrap',
          }}
        >
          {asset.invCode}
        </div>
      </div>
    </div>
  )
}
