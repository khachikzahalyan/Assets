import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Asset } from '@/domain/asset/types'
import { AssetLabel } from './AssetLabel'

export interface LabelPrintHostProps {
  assets: Asset[]
  /** Called once after the print dialog returns (or is cancelled). */
  onAfterPrint: () => void
}

/**
 * Renders the label(s) into a body-level portal (visible only in @media print via index.css)
 * and triggers window.print() once, then calls onAfterPrint. Single asset → one label,
 * multiple → a sheet. window.print is wrapped so jsdom/tests don't throw.
 */
export function LabelPrintHost({ assets, onAfterPrint }: LabelPrintHostProps) {
  const startedRef = useRef(false)
  useLayoutEffect(() => {
    // StrictMode (dev) double-invokes effects. Without this guard window.print() fired TWICE
    // → two stacked browser print dialogs → the user had to press Cancel twice to dismiss both.
    // The old cleanup also cleared the finish timer between the two invocations, so the preview
    // never auto-closed. Guard so the whole print flow runs exactly once.
    if (startedRef.current) return
    startedRef.current = true

    let done = false
    const finish = () => { if (!done) { done = true; onAfterPrint() } }
    try {
      window.print()
    } catch {
      // jsdom: window.print not implemented — ignore.
    }
    // window.print() is blocking in Chrome (returns after Print OR Cancel), so this fires right
    // after the dialog closes → onAfterPrint clears the labels and closes the preview dialog.
    window.setTimeout(finish, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!assets.length) return null
  return createPortal(
    <div className="ams-print-label-root">
      {assets.map((a) => <AssetLabel key={a.id} asset={a} />)}
    </div>,
    document.body,
  )
}
