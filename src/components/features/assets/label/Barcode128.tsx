import { useLayoutEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

export interface Barcode128Props {
  value: string
  /** bar height in px (default 110) */
  height?: number
}

/**
 * Renders a Code 128 barcode into an inline SVG that scales to its container width.
 *
 * Uses `useLayoutEffect` (not `useEffect`) on purpose: the parent `LabelPrintHost` calls
 * `window.print()` inside its OWN layout effect, and React runs child layout effects BEFORE
 * the parent's — so the bars are guaranteed drawn before the print dialog opens. With a passive
 * `useEffect` the print fired first and the label printed without bars. jsdom-safe (errors swallowed).
 */
export function Barcode128({ value, height = 110 }: Barcode128Props) {
  const ref = useRef<SVGSVGElement>(null)
  useLayoutEffect(() => {
    const svg = ref.current
    if (!svg || !value) return
    try {
      JsBarcode(svg, value, { format: 'CODE128', displayValue: false, height, margin: 10, width: 2 })
      // JsBarcode sets fixed px width/height; convert to a viewBox so CSS (width:100%) scales
      // the bars to fill the label regardless of how many digits the code has.
      const w = svg.getAttribute('width')
      const h = svg.getAttribute('height')
      if (w && h) {
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
