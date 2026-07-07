/**
 * rafThrottle — coalesce high-frequency callback invocations (scroll / resize)
 * into at most one call per animation frame.
 *
 * The returned function stores the latest arguments and schedules a single
 * requestAnimationFrame; further calls before the frame fires are dropped
 * (only the most recent args survive). Call `.cancel()` in effect cleanup to
 * drop any pending frame and avoid running after unmount.
 *
 * Used by anchored popovers (DestPicker, SelectMini, ViewPopover,
 * CategoryPicker) to throttle capture-phase scroll repositioning.
 */
export function rafThrottle<A extends unknown[]>(
  fn: (...args: A) => void,
): ((...args: A) => void) & { cancel: () => void } {
  let rafId: number | null = null
  let lastArgs: A | null = null

  const throttled = (...args: A) => {
    lastArgs = args
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      if (lastArgs) fn(...lastArgs)
    })
  }

  throttled.cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  return throttled
}
