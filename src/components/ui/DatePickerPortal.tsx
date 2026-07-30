import { forwardRef, type ReactNode } from 'react'

/** Calendar surface wrapper: desktop-only anchored popover. Mobile is handled by DatePicker via MobileSheet. */
export const DPPortal = forwardRef<HTMLDivElement, {
  pos: { top: number; left: number; width: number } | null
  children: ReactNode
}>(function DPPortal({ pos, children }, ref) {
  if (!pos) return null
  return (
    <div
      ref={ref}
      data-dp-portal="true"
      data-ams-dropdown="true"
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 1000 }}
      className="bg-surface ring-1 ring-border rounded-xl shadow-xl shadow-slate-900/40 light:shadow-slate-300/60 anim-fade-slide-in overflow-hidden"
    >
      {children}
    </div>
  )
})
