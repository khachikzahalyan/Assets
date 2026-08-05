import { useEffect } from 'react'

/**
 * Attaches a document-level `keydown` listener that calls `onClose` when
 * the Escape key is pressed. Active only while `open` is true.
 */
export function useEscapeKey(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
}
