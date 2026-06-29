import { useLayoutEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

export interface Barcode128Props {
  value: string
  /** bar height in px (default 60) */
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
export function Barcode128({ value, height = 60 }: Barcode128Props) {
  const ref = useRef<SVGSVGElement>(null)
  useLayoutEffect(() => {
    const svg = ref.current
    if (!svg || !value) return
    try {
      JsBarcode(svg, value, { format: 'CODE128', displayValue: false, height, margin: 0, width: 2 })
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
  // Explicit physical height + preserveAspectRatio="none": a 1D barcode only encodes data
  // horizontally, so stretching vertically is harmless and keeps it scannable. `height: auto`
  // collapsed to ~0 on some printers (e.g. an 80mm receipt printer), printing just a thin line.
  return (
    <svg
      ref={ref}
      aria-label={`barcode ${value}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: '18mm', display: 'block' }}
    />
  )
}
