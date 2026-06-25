export interface AppLoaderProps {
  /** When true, wrapper fills the full viewport on the shell bg; default false (fills parent). */
  fullScreen?: boolean
  /** Overrides the default label text. */
  label?: string
}

/**
 * Branded AMS full-area loader.
 *
 * Shows the orange AMS gradient mark breathing in/out (opacity 1 → 0.3 → 1),
 * no spinner ring. Used by RequireAuth while auth state resolves.
 */
export function AppLoader({ fullScreen = false, label = 'Загрузка…' }: AppLoaderProps) {
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
      <div className="flex flex-col items-center gap-4">
        {/* AMS brand mark — breathing opacity pulse, matches Sidebar brand square */}
        <span
          aria-hidden="true"
          className="anim-logo-pulse w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white inline-flex items-center justify-center font-extrabold tracking-tight text-[20px] shadow-lg shadow-accent/25 select-none"
        >
          AMS
        </span>

        {/* Muted label */}
        <span className="text-[13px] text-text-subtle">{label}</span>
      </div>
    </div>
  )
}
