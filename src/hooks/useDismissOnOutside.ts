import { useEffect, useRef, type RefObject } from 'react'

/**
 * Outside-press dismissal for dropdowns/popovers/sheets.
 *
 * Owner rule (2026-07-28): on mobile, a tap outside an open overlay only CLOSES
 * it — it must never click through to the element underneath. We dismiss on
 * pointerdown; when the pointer is a touch, the follow-up click is swallowed in
 * the capture phase (one shot). Mouse (desktop) behavior is unchanged.
 *
 * `refs`: all elements considered "inside" (trigger + portalled popover etc.).
 * A press inside any of them does not dismiss.
 *
 * Contract: the `refs` array may be a new array instance each render (inline
 * literal is fine). The hook reads only `.current` values inside the event
 * handlers, which are always called at event time — never stale. Listeners are
 * only re-registered when `enabled` changes. The refsRef below mirrors the latest
 * array on every render so handlers always see the current `.current` values
 * without re-subscribing.
 */
export function useDismissOnOutside(
  refs: Array<RefObject<HTMLElement | null>>,
  onDismiss: () => void,
  enabled = true,
): void {
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  // Always-current snapshot of the refs array — updated on every render so
  // handlers read the latest .current values without triggering effect re-runs.
  const refsRef = useRef(refs)
  refsRef.current = refs

  useEffect(() => {
    if (!enabled) return
    const isInside = (target: Node) =>
      refsRef.current.some(r => r.current !== null && r.current.contains(target))
    const onPointerDown = (e: PointerEvent) => {
      if (isInside(e.target as Node)) return
      if (e.pointerType === 'touch') swallowNextClick()
      dismissRef.current()
    }
    // mousedown fallback keeps jsdom tests (fireEvent.mouseDown) and legacy
    // browsers working; double-fire after pointerdown is a harmless re-close.
    const onMouseDown = (e: MouseEvent) => {
      if (isInside(e.target as Node)) return
      dismissRef.current()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [enabled])
}

/**
 * Capture-phase one-shot trap: the click that follows a dismissing touch never
 * reaches the app. Exported for overlays that must keep a custom pointerdown
 * handler (e.g. SearchSelect inside MobileSheet, where a mousedown fallback
 * would fire prematurely) yet still need the no-click-through rule on touch.
 */
export function swallowNextClick(): void {
  const swallow = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  document.addEventListener('click', swallow, { capture: true, once: true })
  window.setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 500)
}
