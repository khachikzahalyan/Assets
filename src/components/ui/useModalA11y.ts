import { useEffect } from 'react'

const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Shared modal a11y hook — ported from Warehouse/prototypes/employees.html useModalA11y (lines 424-487).
 * Responsibilities:
 *   1. Save and restore focus to the previously-focused element on close.
 *   2. Set `#root` inert while open to screen-reader-isolate the dialog.
 *   3. Move focus into the container (first focusable child, or container itself).
 *   4. Trap Tab/Shift+Tab inside the container.
 *
 * Used by both Drawer.tsx and EmployeeModalShell.tsx.
 */
export function useModalA11y(open: boolean, containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return

    // 1. Save trigger element for focus restore.
    const previouslyFocused = document.activeElement as HTMLElement | null

    // 2. Make the rest of the app inert.
    const appRoot = document.getElementById('root')
    if (appRoot) appRoot.setAttribute('inert', '')

    // 3. Move focus into the container.
    const container = containerRef.current
    const focusableList = container
      ? container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      : ([] as unknown as NodeListOf<HTMLElement>)
    const firstFocusable: HTMLElement | null = focusableList[0] ?? container ?? null

    // Defer to allow animation to start first.
    const focusTimer = setTimeout(() => {
      if (firstFocusable && typeof firstFocusable.focus === 'function') {
        firstFocusable.focus({ preventScroll: true })
      }
    }, 0)

    // 4. Tab trap.
    function onTabKey(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !container) return
      const list = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      if (list.length === 0) {
        e.preventDefault()
        return
      }
      const first: HTMLElement = list[0]!
      const last: HTMLElement = list[list.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onTabKey)

    return () => {
      clearTimeout(focusTimer)
      document.removeEventListener('keydown', onTabKey)
      if (appRoot) appRoot.removeAttribute('inert')
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus()
      }
    }
  }, [open, containerRef])
}
