export interface MiniBarChartProps {
  /** Exactly 7 values; [0]=6 days ago … [6]=today. */
  days: number[]
  /** Tailwind bg-class for bars (box accent), e.g. 'bg-sky-400/70'. */
  barClass: string
  /** title attribute per bar: «date · N» (caller provides). */
  titles?: string[]
  /**
   * 'mini'  — compact 7-bar strip used in section-card headers (default).
   * 'full'  — full-width bar chart in the hero KPI card (Row 1, card 1).
   *           Container: h-[1.75rem] (28px). Bars: flex-1 width (equal share),
   *           gap 4px (0.25rem), rounded-[2px] (border-radius 2px),
   *           barClass with /[0.33] opacity. Zero bars: ~30% height plank.
   *           Linear normalization: barPct = 30 + (v/max)*70.
   */
  variant?: 'mini' | 'full'
  testId?: string
}

export function MiniBarChart({ days, barClass, titles, variant = 'mini', testId }: MiniBarChartProps) {
  const max = Math.max(1, ...days)

  if (variant === 'full') {
    // Full-width chart per spec:
    //   Container height: 1.75rem (28px)
    //   Bar width: flex-1 (equal share)
    //   Gap: 0.25rem (4px)
    //   Border-radius: 2px (rounded-[2px])
    //   Bar color: accent/33% → we apply opacity-[0.33] on the bar
    //   Zero bar: 30% height (visible plank)
    //   Linear: barPct = 30 + (v/max)*70
    return (
      <div
        className="flex items-end gap-1 w-full"
        style={{ height: '1.75rem' }}
        aria-hidden="true"
        {...(testId ? { 'data-testid': testId } : {})}
      >
        {days.map((v, i) => {
          const titleAttr = titles?.[i]
          const heightPct = v === 0 ? 30 : Math.round(30 + (v / max) * 70)
          // Strip any existing opacity from barClass so we can set /[0.33]
          // barClass examples: 'bg-accent/70', 'bg-rose-400/70' → 'bg-accent', 'bg-rose-400'
          const baseColorClass = barClass.split('/')[0] ?? barClass
          return (
            <span
              key={`bar-${i}`}
              className={`flex-1 rounded-[2px] ${baseColorClass} opacity-[0.33]`}
              style={{ height: `${heightPct}%` }}
              {...(titleAttr !== undefined ? { title: titleAttr } : {})}
            />
          )
        })}
      </div>
    )
  }

  // ── mini variant (default) ────────────────────────────────────────────────────
  return (
    <div
      className="flex items-end gap-[0.1875rem] h-6"
      aria-hidden="true"
      {...(testId ? { 'data-testid': testId } : {})}
    >
      {days.map((v, i) => {
        const titleAttr = titles?.[i]
        if (v === 0) {
          return (
            <span
              key={`bar-${i}`}
              className="w-1.5 h-0.5 rounded-sm bg-border"
              {...(titleAttr !== undefined ? { title: titleAttr } : {})}
            />
          )
        }
        return (
          <span
            key={`bar-${i}`}
            className={`w-1.5 rounded-sm ${barClass}`}
            style={{ height: `${Math.max(15, (v / max) * 100)}%` }}
            {...(titleAttr !== undefined ? { title: titleAttr } : {})}
          />
        )
      })}
    </div>
  )
}
