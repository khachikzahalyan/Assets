export interface MiniBarChartProps {
  /** Exactly 7 values; [0]=6 days ago … [6]=today. */
  days: number[]
  /** Tailwind bg-class for bars (box accent), e.g. 'bg-sky-400/70'. */
  barClass: string
  /** title attribute per bar: «date · N» (caller provides). */
  titles?: string[]
  testId?: string
}

export function MiniBarChart({ days, barClass, titles, testId }: MiniBarChartProps) {
  const max = Math.max(1, ...days)

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
