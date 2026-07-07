import { useEffect } from 'react'

/**
 * Module-level ref-counted body scroll lock.
 *
 * Multiple overlapping lockers (e.g. a Drawer that opens a MobileSheet) used to
 * each snapshot `document.body.style.overflow` at effect time; the second locker
 * would snapshot the already-'hidden' value and restore 'hidden' on unlock,
 * leaving the page permanently unscrollable. This shared counter snapshots the
 * ORIGINAL overflow only on the first lock and restores it only on the last
 * unlock, so any number of concurrent lockers compose correctly.
 */
let lockCount = 0
let originalOverflow = ''

function lock() {
  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount++
}

function unlock() {
  if (lockCount === 0) return
  lockCount--
  if (lockCount === 0) {
    document.body.style.overflow = originalOverflow
  }
}

/**
 * Locks body scroll while `active` is true, restoring the original overflow when
 * the last active locker releases. Safe to nest / overlap across components.
 */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    lock()
    return unlock
  }, [active])
}
