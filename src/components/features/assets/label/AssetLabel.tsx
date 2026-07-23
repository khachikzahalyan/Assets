import type { Asset } from '@/domain/asset/types'
import { BarcodeSvg } from './BarcodeSvg'

export interface AssetLabelProps {
  asset: Asset
}

/**
 * One printable asset label — the owner's FINAL reference: Code 128 barcode
 * across the full width on top, then a single line underneath with the company
 * wordmark on the left and the inventory code (mono) on the right. Nothing else.
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
      /* Dense like the reference sticker: minimal padding, bars fill most of
         the height, the text line hugs the bars. */
      style={{
        width: '100%', padding: '2mm 2.5mm', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5mm',
        breakInside: 'avoid', overflow: 'hidden', color: '#000', background: '#fff',
      }}
    >
      {/* Barcode — full label width, tall bars */}
      {asset.barcode ? (
        <div style={{ width: '100%' }}>
          <BarcodeSvg value={asset.barcode} height={100} />
        </div>
      ) : null}

      {/* Bottom line: wordmark left, inventory code right — large, tight under the bars */}
      <div
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '3mm',
        }}
      >
        <img
          src="/telcell-logo.png"
          alt="Telcell"
          /* PNG is cropped to the glyph bounds, so height maps 1:1 to the visible
             wordmark — 6mm ≈ the inv-code cap height, like the reference. */
          style={{ height: '6mm', flexShrink: 0, filter: 'grayscale(1) brightness(0.7) contrast(9)' }}
        />
        <span
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '16pt', fontWeight: 700, letterSpacing: '0.06em',
            lineHeight: 1, whiteSpace: 'nowrap',
          }}
        >
          {asset.invCode}
        </span>
      </div>
    </div>
  )
}
