import { useLayoutEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { isValidEan13 } from '@/domain/asset/barcode'

export interface BarcodeSvgProps {
  value: string
  /** bar height in px (default 110) */
  height?: number
}

/**
 * Renders an EAN-13 barcode for valid EAN-13 values, or a Code 128 barcode for legacy
 * 9-digit codes. The SVG scales to its container width.
 *
 * Uses `useLayoutEffect` (not `useEffect`) on purpose: the parent `LabelPrintHost` calls
 * `window.print()` inside its OWN layout effect, and React runs child layout effects BEFORE
 * the parent's — so the bars are guaranteed drawn before the print dialog opens. With a passive
 * `useEffect` the print fired first and the label printed without bars. jsdom-safe (errors swallowed).
 */
export function BarcodeSvg({ value, height = 110 }: BarcodeSvgProps) {
  const ref = useRef<SVGSVGElement>(null)
  useLayoutEffect(() => {
    const svg = ref.current
    if (!svg || !value) return
    try {
      // margin: 0 — no quiet zone INSIDE the SVG: the bars span the full SVG
      // width so they align edge-to-edge with the wordmark/inv-code line below.
      // The printed quiet zone is provided by the label's own 2.5mm padding.
      if (isValidEan13(value)) {
        JsBarcode(svg, value, {
          format: 'EAN13',
          flat: true,
          displayValue: false,
          height,
          margin: 0,
          width: 2,
        })
      } else {
        JsBarcode(svg, value, { format: 'CODE128', displayValue: false, height, margin: 0, width: 2 })
      }
      // JsBarcode sets width/height WITH a "px" suffix (e.g. "210px") AND its own valid
      // viewBox. Previously we rebuilt the viewBox from the raw attribute values, producing
      // an INVALID `viewBox="0 0 210px 110px"` that browsers ignore — the barcode printed
      // unscaled (~56mm instead of the full label width) and vertically clipped. parseFloat
      // strips the suffix so the viewBox is valid and CSS (width:100%) scales the bars.
      const w = parseFloat(svg.getAttribute('width') ?? '')
      const h = parseFloat(svg.getAttribute('height') ?? '')
      if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
        svg.removeAttribute('width')
        svg.removeAttribute('height')
      }
    } catch {
      // jsdom (no getBBox) or invalid value — fail soft; AssetLabel still shows the numeric text.
    }
  }, [value, height])
  // `preserveAspectRatio="none"` makes the barcode fill the full label width edge-to-edge.
  // Bars look natural (not smeared) because JsBarcode is called with a tall `height` (110 px):
  // the natural aspect ratio of the generated SVG is already close to the rendered box, so the
  // residual horizontal stretch introduced by `none` is negligible — each module stretches only
  // a tiny amount.
  // Earlier attempts:
  //   - `none` with height=60 → bars looked short & too wide (smeared).
  //   - `xMidYMid meet` → "meet" scales to fit the smaller dimension (height), leaving whitespace
  //     on both sides — the barcode shrank and didn't fill the label.
  // Explicit physical height (20mm) prevents the SVG collapsing to a thin line on print
  // (`height: auto` was a real bug on the EPSON printer).
  return (
    <svg
      ref={ref}
      aria-label={`barcode ${value}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: '20mm', display: 'block' }}
    />
  )
}
