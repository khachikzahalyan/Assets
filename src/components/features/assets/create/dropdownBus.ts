import { useEffect, useRef } from 'react'

/**
 * Exclusive-dropdown coordinator: only one custom dropdown stays open at a time.
 * Each dropdown calls useExclusiveDropdown(open, setOpen). When it opens it broadcasts
 * a unique id; every other open dropdown closes itself. Outside-click closes any open
 * dropdown whose surface (trigger or portal) carries data-ams-dropdown="true".
 * Ported from prototypes/preview.html.
 */
const AMS_DROPDOWN_EVENT = 'ams:dropdown-open'
let amsDropdownSeq = 0

export function useExclusiveDropdown(open: boolean, setOpen: (v: boolean) => void): void {
  const idRef = useRef<number | null>(null)
  if (idRef.current === null) idRef.current = ++amsDropdownSeq

  useEffect(() => {
    if (open) document.dispatchEvent(new CustomEvent(AMS_DROPDOWN_EVENT, { detail: idRef.current }))
  }, [open])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail
      if (detail !== idRef.current) setOpen(false)
    }
    document.addEventListener(AMS_DROPDOWN_EVENT, handler)
    return () => document.removeEventListener(AMS_DROPDOWN_EVENT, handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target?.closest('[data-ams-dropdown]')) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, setOpen])
}
