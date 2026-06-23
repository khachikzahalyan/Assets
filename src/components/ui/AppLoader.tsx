export interface AppLoaderProps {
  /** When true, wrapper fills the full viewport on the shell bg; default false (fills parent). */
  fullScreen?: boolean
  /** Overrides the default label text. */
  label?: string
}

/**
 * Branded AMS full-area loader.
 *
 * Shows the orange AMS gradient mark with a pulsing glow halo and a thin
 * spinner ring.  Used by RequireAuth while auth state resolves.
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
        {/* Glow halo + spinner ring + brand mark */}
        <div className="relative flex items-center justify-center">
          {/* Pulsing glow halo (sits behind everything) */}
          <div
            aria-hidden="true"
            className="absolute rounded-full anim-loader-glow"
            style={{
              width: 88,
              height: 88,
              background:
                'radial-gradient(circle, rgba(249,115,22,0.28) 0%, rgba(249,115,22,0) 70%)',
            }}
          />

          {/* Thin spinner ring */}
          <div
            aria-hidden="true"
            className="absolute animate-spin"
            style={{
              width: 84,
              height: 84,
              borderRadius: '50%',
              border: '2px solid rgba(249,115,22,0.15)',
              borderTopColor: '#F97316',
            }}
          />

          {/* AMS brand mark — matches Sidebar brand square */}
          <span
            aria-hidden="true"
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white inline-flex items-center justify-center font-extrabold tracking-tight text-[20px] shadow-lg shadow-accent/25 select-none"
          >
            AMS
          </span>
        </div>

        {/* Muted label */}
        <span className="text-[13px] text-text-subtle">{label}</span>
      </div>
    </div>
  )
}
