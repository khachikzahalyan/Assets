export interface AppLoaderProps {
  /** When true, wrapper fills the full viewport on the shell bg; default false (fills parent). */
  fullScreen?: boolean
}

/**
 * Branded AMS full-area loader.
 *
 * Shows the orange AMS gradient mark breathing in/out (opacity 1 → 0.3 → 1),
 * no spinner ring and no visible text (owner request — logo only).
 * Screen readers still get an sr-only status label.
 * Used by RequireAuth while auth state resolves.
 */
export function AppLoader({ fullScreen = false }: AppLoaderProps) {
  const wrapperClass = fullScreen
    ? 'min-h-screen w-full bg-bg flex items-center justify-center'
    : 'w-full h-full flex items-center justify-center'

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="app-loader"
      className={wrapperClass}
    >
      {/* AMS brand mark — breathing opacity pulse, matches Sidebar brand square */}
      <span
        aria-hidden="true"
        className="anim-logo-pulse w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white inline-flex items-center justify-center font-extrabold tracking-tight text-[20px] shadow-lg shadow-accent/25 select-none"
      >
        AMS
      </span>

      {/* Accessible-only label — visually hidden */}
      <span className="sr-only">Загрузка…</span>
    </div>
  )
}
