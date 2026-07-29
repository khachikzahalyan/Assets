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
 * `@page` (2×1.5in ≈ 50.8×38mm — TSC TDP-225 2" stock — index.css). Logo + code
 * sizes are tuned to fit the ~50mm printable width without clipping on the right.
 * NOTE: inline styles + literal black/white are intentional and CODE_QUALITY-justified — this
 * is a print artifact: physical mm dimensions aren't Tailwind tokens, and the label must be
 * black-on-white on paper regardless of the app's (dark) theme tokens.
 * The wordmark is rendered as bold text (not the low-res orange PNG) so it prints razor-sharp
 * on the B/W thermal head — a rasterised logo dithered into speckle at 203dpi.
 */
export function AssetLabel({ asset }: AssetLabelProps) {
  return (
    <div
      className="ams-label"
      /* Dense like the reference sticker: bars fill most of the height, the text
         line hugs the bars. 3mm side padding = the barcode quiet zone AND keeps the
         code away from the right edge (the TDP-225 clips the last mm or two). The
         column is centred vertically so the block sits balanced on the 1.5in label. */
      style={{
        width: '100%', padding: '2mm 3mm', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '1mm',
        breakInside: 'avoid', overflow: 'hidden', color: '#000', background: '#fff',
      }}
    >
      {/* Barcode — full label width, tall bars */}
      {asset.barcode ? (
        <div style={{ width: '100%' }}>
          <BarcodeSvg value={asset.barcode} height={100} />
        </div>
      ) : null}

      {/* Bottom line: wordmark left, inventory code right — sharing one baseline.
          The wordmark is CRISP BOLD TEXT «Telcell®» (capital T only, straight bold Arial),
          NOT the low-res /telcell-logo.png — that PNG dithered into speckle on the 203dpi
          thermal head. Text prints razor-sharp at any DPI. Sizes are tuned so wordmark +
          gap + 11-char code fit the ~44mm printable width of the 2" stock without clipping
          the last digit. */}
      <div
        style={{
          width: '100%', display: 'flex', alignItems: 'baseline',
          justifyContent: 'space-between', gap: '2mm',
        }}
      >
        <span
          style={{
            fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
            fontSize: '10.5pt', fontWeight: 700, lineHeight: 1,
            letterSpacing: '0.01em', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          Telcell
          <span style={{ fontSize: '58%', verticalAlign: 'super', fontWeight: 700 }}>®</span>
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '10pt', fontWeight: 700, letterSpacing: 0,
            lineHeight: 1, whiteSpace: 'nowrap',
          }}
        >
          {asset.invCode}
        </span>
      </div>
    </div>
  )
}
