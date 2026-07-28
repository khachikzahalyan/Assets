export interface CardListSkeletonProps {
  /** Number of card rows to render. Default 10. */
  rows?: number
  /**
   * Card variant (all MobileListRow-based variants share outer px-[14px] py-[9px] geometry):
   * - "asset"    — 28×28 rounded-[8px] icon + 13px title/11px subline + right pill+invcode
   * - "employee" — 28×28 rounded-full avatar + 13px title/11px subline + right pill+branch
   * - "catalog"  — 28×28 rounded-[8px] icon + 13px title/11px subline + two w-11 h-11 action stubs
   * - "audit"    — 28×28 rounded-[8px] icon + 13px title/2-line 11px subline + right chip+chevron
   *
   * Default: "asset"
   */
  variant?: 'asset' | 'employee' | 'catalog' | 'audit' | 'key' | 'part-device' | 'subscription' | 'role'
}

/**
 * Mobile card-list skeleton that matches the exact footprint of the real card lists
 * used by AssetsTable, EmployeesTable, CatalogTable, and AuditTable on viewports ≤ 767px.
 *
 * All MobileListRow-based variants share the same outer geometry:
 *   px-[14px] py-[9px] border-b border-border border-l-[3px] border-l-transparent bg-surface
 *   inner flex: items-center gap-[9px]
 *
 * FILL CONTRACT (MobileListRow-based variants only): real mobile lists stretch
 * their rows to distribute the whole Zone-2 height between toolbar and the
 * pinned pagination (flexGrow on rows + placeholder slots). The skeleton must
 * occupy EXACTLY that region — never shorter (dead band below) and never
 * taller (rows spilling past the card). Root takes `flex:1 1 0; min-height:0`
 * so it resolves to the region height regardless of content, and every row is
 * `flex:1 1 0; min-height:0; overflow:hidden` so N rows split the region into
 * N equal slots with the shimmer content vertically centered.
 * Grid variants ("part-device", "subscription") are natural-height cards in
 * scrollable areas — they intentionally do NOT fill.
 *
 * - "asset"        — mirrors AssetRowMobile → MobileListRow: 28×28 rounded-[8px] tile,
 *                    13px title mb-[2px] + 11px subline; right flex-col items-end gap-1:
 *                    status pill h-[18px] w-[54px] rounded-[5px] + invcode h-[10px] w-[64px]
 * - "employee"     — mirrors EmployeeRowMobile → MobileListRow: 28×28 rounded-full avatar
 *                    (RoleIcon SVG is visually circular); 13px title mb-[2px] + 11px subline;
 *                    right flex-col items-end gap-[3px]: pill h-[18px] w-[54px] rounded-[5px] + branch h-[10px] w-[64px]
 * - "catalog"      — mirrors CatalogTable mobile rows → MobileListRow: 28×28 rounded-[8px] tile,
 *                    13px title mb-[2px] + 11px subline; right flex items-center gap-1:
 *                    two IconBtn stubs at max-md:!w-11 max-md:!h-11 rounded-lg
 * - "audit"        — mirrors AuditRowMobile → MobileListRow: 28×28 rounded-[8px] tile,
 *                    13px actor title mb-[2px] + 2-line subline (11px action·ts + mt-0.5 11px entity-id);
 *                    right flex items-center gap-1.5: chip h-[18px] w-[72px] + chevron 13×13
 * - "key"          — mirrors KeyRowMobile → MobileListRow: 28×28 icon, mono title+subline, right pill+invcode
 * - "part-device"  — mirrors DeviceGridCard isMobile=true: 34×34 icon, title+subline, right chip
 * - "subscription" — mirrors SubscriptionCard card grid: bg-surface card with header+seatbar+dates+employees
 * - "role"         — mirrors RoleRowMobile → MobileListRow: 28×28 icon, title+email+chip, right Btn stub
 */
/** Root of fill-contract list variants — resolves to the Zone-2 region height. */
const FILL_ROOT_CLASS = 'flex flex-col flex-1 min-h-0'
/** Fill-contract row shell — equal slot of the region, content vertically centered. */
const FILL_ROW_CLASS =
  'flex items-center gap-[9px] px-[14px] py-[9px] overflow-hidden border-b border-border border-l-[3px] border-l-transparent bg-surface last:border-b-0'
const FILL_ROW_STYLE = { flex: '1 1 0', minHeight: 0 } as const

export function CardListSkeleton({ rows = 10, variant = 'asset' }: CardListSkeletonProps) {
  if (variant === 'employee') {
  // Mirrors EmployeeRowMobile → MobileListRow (EmployeeRowMobile.tsx):
  //   outer:  px-[14px] py-[9px] border-b border-border border-l-[3px] border-l-transparent bg-surface
  //   inner flex: items-center gap-[9px]
  //   avatar: w-[28px] h-[28px] rounded-full (RoleIcon SVG is visually circular)
  //   middle flex-1: 13px title mb-[2px] + 11px subline (position·dept)
  //   right:  flex-col items-end gap-[3px] → pill h-[18px] w-[54px] rounded-[5px] + branch h-[10px] w-[64px]
    return (
      <div
        data-testid="card-list-skeleton"
        data-variant="employee"
        aria-hidden="true"
        className={FILL_ROOT_CLASS}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            data-testid="card-list-skeleton-row"
            className={FILL_ROW_CLASS}
            style={FILL_ROW_STYLE}
          >
            {/* Avatar tile — RoleIcon renders as a circular SVG; rounded-full matches the visual shape */}
            <div className="w-[28px] h-[28px] rounded-full anim-skeleton flex-shrink-0" />
            {/* Middle: 2-line block (title + subline) */}
            <div className="flex-1 min-w-0">
              <div className="h-[13px] w-[52%] rounded anim-skeleton mb-[2px]" />
              <div className="h-[11px] w-[65%] rounded anim-skeleton" />
            </div>
            {/* Right: asset-count pill + branch name */}
            <div className="flex flex-col items-end gap-[3px] flex-shrink-0">
              <div className="h-[18px] w-[54px] rounded-[5px] anim-skeleton" />
              <div className="h-[10px] w-[64px] rounded anim-skeleton" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'audit') {
  // Mirrors AuditRowMobile → MobileListRow (AuditRowMobile.tsx):
  //   outer:  px-[14px] py-[9px] border-b border-border border-l-[3px] border-l-transparent bg-surface
  //   inner flex: items-center gap-[9px]
  //   icon:   w-[28px] h-[28px] rounded-[8px]
  //   middle flex-1: 13px actor title mb-[2px] + 2-line subline:
  //     line1 h-[11px] (action · timestamp) + mt-0.5 line2 h-[11px] w-[88px] (entity-id monospace)
  //   right:  flex items-center gap-1.5 → chip h-[18px] w-[72px] rounded-md + chevron 13×13
    return (
      <div
        data-testid="card-list-skeleton"
        data-variant="audit"
        aria-hidden="true"
        className={FILL_ROOT_CLASS}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            data-testid="card-list-skeleton-row"
            className={FILL_ROW_CLASS}
            style={FILL_ROW_STYLE}
          >
            {/* Icon tile */}
            <div className="w-[28px] h-[28px] rounded-[8px] anim-skeleton flex-shrink-0" />
            {/* Middle: actor title + 2-line subline (action·ts + entity-id) */}
            <div className="flex-1 min-w-0">
              <div className="h-[13px] w-[55%] rounded anim-skeleton mb-[2px]" />
              <div className="h-[11px] w-[65%] rounded anim-skeleton" />
              <div className="h-[11px] w-[88px] rounded anim-skeleton mt-0.5" />
            </div>
            {/* Right: entity-type chip + chevron icon stub */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="h-[18px] w-[72px] rounded-md anim-skeleton" />
              <div className="w-[13px] h-[13px] rounded anim-skeleton" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'catalog') {
  // Mirrors CatalogTable mobile rows → MobileListRow (CatalogTable.tsx lines ~99-168):
  //   outer:  px-[14px] py-[9px] border-b border-border border-l-[3px] border-l-transparent bg-surface
  //   inner flex: items-center gap-[9px]
  //   icon:   w-[28px] h-[28px] rounded-[8px]
  //   middle flex-1: 13px title mb-[2px] + 11px subline
  //   right:  flex items-center gap-1 → two IconBtn stubs at max-md:!w-11 max-md:!h-11 rounded-lg
    return (
      <div
        data-testid="card-list-skeleton"
        data-variant="catalog"
        aria-hidden="true"
        className={FILL_ROOT_CLASS}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            data-testid="card-list-skeleton-row"
            className={FILL_ROW_CLASS}
            style={FILL_ROW_STYLE}
          >
            {/* Icon tile */}
            <div className="w-[28px] h-[28px] rounded-[8px] anim-skeleton flex-shrink-0" />
            {/* Middle: primary title + secondary subline */}
            <div className="flex-1 min-w-0">
              <div className="h-[13px] w-[55%] rounded anim-skeleton mb-[2px]" />
              <div className="h-[11px] w-[42%] rounded anim-skeleton" />
            </div>
            {/* Action stubs — IconBtn at max-md:!w-11 max-md:!h-11 rounded-lg */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="w-11 h-11 rounded-lg anim-skeleton" />
              <div className="w-11 h-11 rounded-lg anim-skeleton" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'key') {
  // Mirrors KeyRowMobile → MobileListRow (KeyRowMobile.tsx):
  //   outer:  px-[14px] py-[9px] border-b border-border border-l-[3px] border-l-transparent bg-surface
  //   inner flex: items-center gap-[9px]
  //   icon:   w-[28px] h-[28px] rounded-[8px]
  //   middle flex-1: mono 13px title mb-[2px] + 11px subline
  //   right:  flex-col items-end gap-1 → status pill h-[18px] w-[64px] rounded-[5px] + invcode h-[10px] w-[56px]
    return (
      <div
        data-testid="card-list-skeleton"
        data-variant="key"
        aria-hidden="true"
        className={FILL_ROOT_CLASS}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            data-testid="card-list-skeleton-row"
            className={FILL_ROW_CLASS}
            style={FILL_ROW_STYLE}
          >
            <div className="w-[28px] h-[28px] rounded-[8px] anim-skeleton flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-[13px] w-[55%] rounded anim-skeleton mb-[2px]" />
              <div className="h-[11px] w-[40%] rounded anim-skeleton" />
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="h-[18px] w-[64px] rounded-[5px] anim-skeleton" />
              <div className="h-[10px] w-[56px] rounded anim-skeleton" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'part-device') {
  // Mirrors DeviceGridCard isMobile=true (DeviceGridCard.tsx):
  //   outer:  p-[14px] rounded-xl border border-border flex items-center gap-2.5 w-full
  //   icon:   w-[34px] h-[34px] rounded-[9px]
  //   middle flex-1: title 14px bold + subline 11.5px mono mt-[2px]
  //   right cluster: flex items-center gap-1.5 →
  //     • comp-count dot-chip h-[18px] w-[64px] rounded-[6px] (always)
  //     • service icon stub w-[20px] h-[20px] rounded-[6px] (conditional — ~1/4 of rows)
  //
  //   Real list wrapper: display:grid; gridTemplateColumns:'1fr'; gap:'8px' (no extra p).
  //   Skeleton outer carries NO padding so caller's wrapper (max-md:px-[14px] max-md:pt-[10px])
  //   aligns exactly with the real DevicesTab column wrapper.
    return (
      <div
        data-testid="card-list-skeleton"
        data-variant="part-device"
        aria-hidden="true"
        className="flex flex-col gap-[8px]"
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            data-testid="card-list-skeleton-row"
            className="p-[14px] rounded-xl border border-border flex items-center gap-2.5"
          >
            {/* Category icon tile — 34×34 rounded-[9px] */}
            <div className="w-[34px] h-[34px] rounded-[9px] anim-skeleton flex-shrink-0" />
            {/* Middle: bold title + mono subline */}
            <div className="flex-1 min-w-0">
              <div className="h-[14px] w-[55%] rounded anim-skeleton" />
              <div className="h-[11px] w-[42%] rounded anim-skeleton mt-[2px]" />
            </div>
            {/* Right cluster: comp-count chip (always) + service icon (most rows —
                mirrors that isServiceOnly devices dominate; ~1 in 4 lacks it). */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="h-[18px] w-[64px] rounded-[6px] anim-skeleton" />
              {/* Service icon stub — mirrors isService && <span w-[20px] h-[20px] rounded-[6px]> */}
              {i % 4 !== 3 && (
                <div className="w-[20px] h-[20px] rounded-[6px] anim-skeleton" />
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'subscription') {
  // Mirrors SubscriptionsSection → SubscriptionCard (SubscriptionCard.tsx):
  //   grid: grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 (matches SubscriptionsSection layout)
  //   card: bg-surface border border-border rounded-xl p-5 flex flex-col gap-4
  //   header: title h-[15px] w-[55%] + icon tile w-9 h-9 rounded-lg flex-shrink-0
  //   seat bar (progress): h-[8px] w-full rounded-full
  //   dates grid: 2-col gap-3, each space-y-1 with label h-[11px] + value h-[13px]
  //   employees row: flex items-center justify-between
    return (
      <div
        data-testid="card-list-skeleton"
        data-variant="subscription"
        aria-hidden="true"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-5 max-md:p-3.5"
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            data-testid="card-list-skeleton-row"
            className="bg-surface border border-border rounded-xl shadow-sm shadow-black/30 p-5 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div className="h-[15px] w-[55%] rounded anim-skeleton" />
              <div className="w-9 h-9 rounded-lg anim-skeleton flex-shrink-0" />
            </div>
            <div className="h-[8px] w-full rounded-full anim-skeleton" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 2 }).map((__, j) => (
                <div key={j} className="space-y-1">
                  <div className="h-[11px] w-[60%] rounded anim-skeleton" />
                  <div className="h-[13px] w-[80%] rounded anim-skeleton" />
                </div>
              ))}
            </div>
            {/* Employees row — mirrors SubscriptionCard: border-t border-border pt-1 */}
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <div className="h-[11px] w-[40%] rounded anim-skeleton" />
              <div className="h-[13px] w-[30%] rounded anim-skeleton" />
            </div>
          </div>
        ))}
      </div>
    )
  }


  if (variant === 'role') {
  // Mirrors RoleRowMobile → MobileListRow (RoleRowMobile.tsx):
  //   outer:  px-[14px] py-[9px] border-b border-border border-l-[3px] border-l-transparent bg-surface
  //   inner flex: items-center gap-[9px]
  //   icon:   w-[30px] h-[30px] rounded-full (role badge avatar)
  //   middle flex-1: title 13px bold mb-[2px] + email h-[11px] (compact 2-line row)
  //   right:  Btn sm → h-7 w-[72px] rounded-lg
    return (
      <div
        data-testid="card-list-skeleton"
        data-variant="role"
        aria-hidden="true"
        className={FILL_ROOT_CLASS}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            data-testid="card-list-skeleton-row"
            className={FILL_ROW_CLASS}
            style={FILL_ROW_STYLE}
          >
            <div className="w-[30px] h-[30px] rounded-full anim-skeleton flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-[13px] w-[52%] rounded anim-skeleton mb-[3px]" />
              <div className="h-[11px] w-[65%] rounded anim-skeleton" />
            </div>
            <div className="h-7 w-[72px] rounded-lg anim-skeleton flex-shrink-0" />
          </div>
        ))}
      </div>
    )
  }

  // ── Default: "asset" variant ────────────────────────────────────────────────
  // Mirrors AssetRowMobile → MobileListRow (AssetRowMobile.tsx):
  //   outer:  px-[14px] py-[9px] border-b border-border border-l-[3px] border-l-transparent bg-surface
  //   inner flex: items-center gap-[9px]
  //   icon:   w-[28px] h-[28px] rounded-[8px]
  //   middle flex-1: 13px title mb-[2px] + 11px subline
  //   right:  flex-col items-end gap-1 → status pill h-[18px] w-[54px] rounded-[5px] + invcode h-[10px] w-[64px]
  return (
    <div
      data-testid="card-list-skeleton"
      data-variant="asset"
      aria-hidden="true"
      className={FILL_ROOT_CLASS}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          data-testid="card-list-skeleton-row"
          className={FILL_ROW_CLASS}
          style={FILL_ROW_STYLE}
        >
          {/* Icon tile shimmer: w-[28px] h-[28px] rounded-[8px] */}
          <div className="w-[28px] h-[28px] rounded-[8px] anim-skeleton flex-shrink-0" />
          {/* Middle: title (13px/bold, mb-[2px]) + subline (11px) */}
          <div className="flex-1 min-w-0">
            <div className="h-[13px] w-[55%] rounded anim-skeleton mb-[2px]" />
            <div className="h-[11px] w-[40%] rounded anim-skeleton" />
          </div>
          {/* Right: status pill + inventory code */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="h-[18px] w-[54px] rounded-[5px] anim-skeleton" />
            <div className="h-[10px] w-[64px] rounded anim-skeleton" />
          </div>
        </div>
      ))}
    </div>
  )
}
