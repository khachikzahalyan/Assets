# Compact-scale px cleanup (root 10–12px hardening)

Date: 2026-07-31. Context: scaling mode committed (20a741b) — root `clamp(0.625rem, 100vw/120, 1rem)` for ≥768px, 1920px anchor. Remaining px sizes in desktop contexts become proportionally oversized at root 10–12px. This plan converts them to rem, syncs skeletons, hardens overlays, and audits micro fonts.

## Rules
- px → rem at 16px reference (Npx → N/16 rem).
- `44px` touch-min stays ONLY in ≤767px contexts (`max-md:`); desktop equivalents → `2.75rem`.
- DO NOT touch: mobile block in index.css (≤767px), mobile-only components (BottomNav, MobileSheet, ListCard/MobileListRow, CardListSkeleton, *RowMobile, *MobileView, PartsReceiveMobileForm, DetailHeroMobile, AssignmentCardMobile), label printing (2in), root font-size formula, iOS 16px input rule.
- DO NOT touch (parallel session): src/components/features/dashboard/**, src/domain/dashboard/**, src/components/features/parts/DevicesTab.tsx, src/pages/parts/PartsPageSkeleton.tsx, src/pages/assets/AssetCreatePage.tsx + its tests, src/pages/employees/useEmployeesActions*, src/locales/*/dashboard.json, all untracked files of that session. Also SKIP src/pages/dashboard/DashboardPage.tsx (page will be reworked by that session).
- Radii (`rounded-[Npx]`) stay in px — cosmetic, not layout-breaking.
- No git write operations.

## Work items
1. Core primitives / inline styles: DataTable minHeight 58 → '3.625rem' (+TableSkeleton sync), ToastContext min-w 260px → 16.25rem, SelectMini (max-h 280px, 18px icon, max-w 140px), badge min-w 20px, NotificationBell + ThemeToggle desktop min 44px → 2.75rem, AppLoader calc(100dvh-128px) → 8rem (+test), DatePopover 244px, ActivateKeyModal maxHeight 340, EmployeeMultiSelect maxHeight 280, HandoverModal min(680px,88vh) + max-w 280px, AssetPickerSteps (340/420/18px), DestPicker (md:160px, 18/20px icons, 110px cap), EmployeeDetailDrawer 18px pill, PartCard max-h 220px, TransferPanel lg:min-h 64px, AssetDetailDesktopView lg:min-h 155px.
2. Desktop rows / toolbars / truncate caps: HistoryPanel (56px rows, 88px col, min(700px,62vh)), WarehouseSkuList 54px (+minHeight 48 if desktop), PartsReceiveSmallCatCard 34px, PartsReceiveSizedCatCard 72px, DeviceGridCard 20px, PartCategoriesSection 22px (desktop), AssetsToolbar 280px, AuditFilterBar 128px/160px, RolesPage 160/180px, ManageAssigneesModal 130px, MyAssetsPage + MyActsPage (min-h 44px desktop → rem/var; min-w 80px), AssetCreateForm max-lg:min-h-[44px] → split max-md 44px / md:max-lg 2.75rem (skip if it breaks forbidden AssetCreatePage tests), SearchInput docstring, DesktopDecorPanel 280px.
3. Skeleton shimmers px → rem (desktop-visible): ProfilePage, MyAssetsPage, MyActsPage, PartsReceivePage, AssetDetailSkeleton, AssetDetailPage, AuthSettingsPanel, LicenseBlock, StatTile (desktop part).
4. Micro-font floor audit: bump informative micro text to text-11 (NotificationBell count, LicenseBlock status chips, ManageAssigneesModal badge, EmployeeMultiSelect "+N" counter, PartsReceive on-hand counts). Decorative uppercase kickers / kbd hints / mono short-codes stay.
5. Verify: `npm run build`; targeted vitest for touched tested files; Playwright (docs/screenshots/verify-scaling.mjs) at 1280/1366/1440/1920 on /login and /login/employee — screenshots + no horizontal scroll.

## Known leftovers (accepted)
- PartsPageSkeleton / AssetCreatePage / DashboardPage skeletons stay px until the parallel session lands.
- MiniDropdown/SpecCombobox/SelectMini JS min-width floors (120/180px) stay — viewport-clamped, cannot overflow.
- LabelPreviewDialog 320px stays — depicts a fixed physical label.
