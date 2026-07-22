import type { ReactNode } from 'react'

/** Calendar surface wrapper: mobile = bottom sheet (slides up), desktop = anchored popover. */
export function DPPortal({ isMobile, pos, onBackdrop, children }: {
  isMobile: boolean
  pos: { top: number; left: number; width: number } | null
  onBackdrop: () => void
  children: ReactNode
}) {
  if (isMobile) {
    return (
      <div
        data-dp-portal="true"
        className="fixed inset-0 z-[1000] flex items-end bg-black/60 anim-backdrop-fade"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onBackdrop() }}
      >
        <div
          data-ams-dropdown="true"
          className="w-full bg-surface rounded-t-[18px] overflow-hidden pb-[env(safe-area-inset-bottom,0px)] [animation:amsSheetIn_0.22s_ease-out]"
        >
          {children}
        </div>
      </div>
    )
  }
  if (!pos) return null
  return (
    <div
      data-dp-portal="true"
      data-ams-dropdown="true"
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 1000 }}
      className="bg-surface ring-1 ring-border rounded-xl shadow-xl shadow-slate-900/40 anim-fade-slide-in overflow-hidden"
    >
      {children}
    </div>
  )
}
