import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

export interface Barcode128Props {
  value: string
  /** bar height in px (default 40) */
  height?: number
}

/** Renders a Code 128 barcode into an inline SVG. jsdom-safe (errors swallowed). */
export function Barcode128({ value, height = 40 }: Barcode128Props) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || !value) return
    try {
      JsBarcode(ref.current, value, { format: 'CODE128', displayValue: false, height, margin: 0, width: 2 })
    } catch {
      // jsdom (no getBBox) or invalid value — fail soft; the numeric text is shown by AssetLabel.
    }
  }, [value, height])
  return <svg ref={ref} aria-label={`barcode ${value}`} />
}
