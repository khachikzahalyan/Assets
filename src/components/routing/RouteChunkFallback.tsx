import { createPortal } from 'react-dom'
import { AppLoader } from '@/components/ui/AppLoader'

/**
 * Suspense fallback for routed page chunks.
 *
 * Always a fullscreen viewport overlay in the exact position of the
 * RequireAuth auth loader — the owner wants exactly ONE loader appearance:
 * the centered AMS mark on a bare dark screen. Rendering the fallback inside
 * the shell content area (next to the sidebar/topbar) read as a second,
 * different loader.
 *
 * Portalled to document.body because .app-shell-content animates transform
 * (contentEnter, fill-mode both) — a transformed ancestor becomes the
 * containing block for position:fixed, which would trap the overlay inside
 * the content area. z-[60] = modal layer, above the BottomNav (z-40).
 */
export function RouteChunkFallback() {
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-bg" data-testid="startup-route-overlay">
      <AppLoader fullScreen />
    </div>,
    document.body,
  )
}
