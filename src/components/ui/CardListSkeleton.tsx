export interface CardListSkeletonProps {
  /** Number of card rows to render. Default 10. */
  rows?: number
  /**
   * Card variant:
   * - "asset"    — 2-line, min-h-[54px]: icon + (name+status pill) / (assignee+inv-code)
   * - "employee" — 3-row, min-h-[68px]: icon + (name+status chip) / (position·dept) / (branch+asset-count)
   * - "catalog"  — py-3: primary text + secondary meta rows + edit/delete action stubs
   * - "audit"    — py-3 expandable: (time+chip) / (actor+action) / (entity-id) — no icon, no actions
   *
   * Default: "asset"
   */
  variant?: 'asset' | 'employee' | 'catalog' | 'audit'
}

/**
 * Mobile card-list skeleton that matches the exact footprint of the real card lists
 * used by AssetsTable, EmployeesTable, and CatalogTable on viewports ≤ 767px.
 *
 * Dimensions come directly from the real card implementations:
 *
 * Asset card  (AssetsTable.tsx ~line 147):
 *   flex items-center gap-3 px-[14px] py-[8px] min-h-[54px] border-b border-white/[0.06]
 *   icon: w-8 h-8 rounded-[8px]
 *   row1: name (flex-1) + status pill (w-~64px h-[18px])
 *   row2: assignee (flex-1) + inv-code badge (w-~72px h-[18px])
 *
 * Employee card (EmployeesTable.tsx ~line 87):
 *   flex items-start gap-3 px-[14px] py-[10px] min-h-[68px] border-b border-white/[0.06]
 *   icon: w-8 h-8 rounded-[8px]
 *   row1: name (flex-1) + status chip
 *   row2: position·dept (full-width)
 *   row3: branch (flex-1) + asset-count (shrink-0)
 *
 * Catalog card (CatalogTable.tsx ~line 50):
 *   flex items-start justify-between gap-3 py-3 px-1 border-b border-[#1F242B]
 *   primary: h-[14px] text bar
 *   secondary rows: h-[11px] text bar
 *   actions: two icon-btn stubs
 */
export function CardListSkeleton({ rows = 10, variant = 'asset' }: CardListSkeletonProps) {
  if (variant === 'employee') {
    return (
      <div
        data-testid="card-list-skeleton"
        data-variant="employee"
        aria-hidden="true"
        className="flex flex-col"
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            data-testid="card-list-skeleton-row"
            className="flex flex-row items-start gap-3 px-[14px] py-[10px] min-h-[68px] border-b border-white/[0.06] box-border last:border-b-0"
          >
            {/* Icon tile */}
            <div className="w-8 h-8 min-w-[32px] rounded-[8px] anim-skeleton flex-shrink-0 mt-[1px]" />

            {/* 3-row content */}
            <div className="flex-1 min-w-0 flex flex-col gap-[4px]">
              {/* Row 1: name bar (flex-1) + status chip stub (shrink-0) */}
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="h-[14px] w-[52%] rounded anim-skeleton flex-1 min-w-0" />
                <div className="h-[18px] w-[58px] rounded-md anim-skeleton shrink-0" />
              </div>
              {/* Row 2: position·dept */}
              <div className="h-[11px] w-[65%] rounded anim-skeleton" />
              {/* Row 3: branch (flex-1) + asset-count (shrink-0) */}
              <div className="flex items-center justify-between gap-2">
                <div className="h-[11px] w-[44%] rounded anim-skeleton" />
                <div className="h-[11px] w-[36px] rounded anim-skeleton shrink-0" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'audit') {
    // Mirrors AuditTable mobile card (AuditTable.tsx ~line 44):
    //   px-1 py-3 border-b divide-border — no icon tile
    //   row1: time bar (left, monospace-width) + chip stub (right)
    //   row2: actor bar (flex-1) + action label bar (right, shrink-0)
    //   row3: entity-id bar (monospace, narrow)
    return (
      <div
        data-testid="card-list-skeleton"
        data-variant="audit"
        aria-hidden="true"
        className="flex flex-col divide-y divide-border"
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            data-testid="card-list-skeleton-row"
            className="px-1 py-3"
          >
            {/* Row 1: timestamp + chip */}
            <div className="flex items-center justify-between gap-2 mb-[5px]">
              <div className="h-[11px] w-[88px] rounded anim-skeleton shrink-0" />
              <div className="h-[18px] w-[72px] rounded-md anim-skeleton shrink-0" />
            </div>
            {/* Row 2: actor name (flex-1) + action label (right) */}
            <div className="flex items-center gap-2 mb-[4px]">
              <div className="flex-1 h-[12px] rounded anim-skeleton" style={{ maxWidth: '55%' }} />
              <div className="shrink-0 h-[12px] w-[56px] rounded anim-skeleton" />
            </div>
            {/* Row 3: entity-id (monospace narrow) */}
            <div className="h-[11px] w-[120px] rounded anim-skeleton" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'catalog') {
    return (
      <div
        data-testid="card-list-skeleton"
        data-variant="catalog"
        aria-hidden="true"
        className="flex flex-col divide-y divide-[#1F242B]"
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            data-testid="card-list-skeleton-row"
            className="flex items-start justify-between gap-3 py-3 px-1"
          >
            {/* Text content column */}
            <div className="flex-1 min-w-0 space-y-[6px]">
              {/* Primary field */}
              <div className="h-[14px] w-[55%] rounded anim-skeleton" />
              {/* Secondary meta row 1 */}
              <div className="h-[11px] w-[42%] rounded anim-skeleton" />
              {/* Secondary meta row 2 (not all catalogs have 3 cols, but harmless) */}
              <div className="h-[11px] w-[35%] rounded anim-skeleton" />
            </div>

            {/* Action stubs (edit + delete icon-btn placeholders) */}
            <div className="flex items-center gap-1 flex-shrink-0 self-center">
              <div className="w-[44px] h-[44px] rounded-lg anim-skeleton" />
              <div className="w-[44px] h-[44px] rounded-lg anim-skeleton" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── Default: "asset" variant ────────────────────────────────────────────────
  // Mirrors AssetsTable mobile card exactly:
  //   flex items-center gap-3 px-[14px] py-[8px] min-h-[54px] border-b border-white/[0.06]
  return (
    <div
      data-testid="card-list-skeleton"
      data-variant="asset"
      aria-hidden="true"
      className="flex flex-col"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          data-testid="card-list-skeleton-row"
          className="flex flex-row items-center gap-3 px-[14px] py-[8px] min-h-[54px] border-b border-white/[0.06] box-border last:border-b-0"
        >
          {/* Icon tile shimmer: w-8 h-8 rounded-[8px] */}
          <div className="w-8 h-8 min-w-[32px] rounded-[8px] anim-skeleton flex-shrink-0" />

          {/* Content column: flex-1 min-w-0 flex flex-col gap-[3px] */}
          <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
            {/* Row 1: name bar (flex-1) + status-pill shimmer (flush right) */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex-1 min-w-0 h-[14px] rounded anim-skeleton" style={{ maxWidth: '55%' }} />
              <div className="shrink-0 h-[18px] w-[64px] rounded-md anim-skeleton" />
            </div>
            {/* Row 2: assignee bar (flex-1) + inv-code badge shimmer (flush right) */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex-1 min-w-0 h-[11px] rounded anim-skeleton" style={{ maxWidth: '40%' }} />
              <div className="shrink-0 h-[18px] w-[72px] rounded-[4px] anim-skeleton" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
