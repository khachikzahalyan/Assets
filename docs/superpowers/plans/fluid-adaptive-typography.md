# Fluid Adaptive Typography — Implementation Plan (approved 2026-07-31)

Status: APPROVED by owner. Execution via subagent-driven-development, phases 0–5, strictly sequential.
Audit: complete (previous orchestrator run). This file transcribes the approved plan verbatim.

## Owner decisions (locked)

1. **Fluid root — conservative ±8%:** `html { font-size: clamp(0.9375rem, 0.8875rem + 0.125vw, 1.09375rem); }`
   (15px @320 → 16px @1440 reference — ZERO visual shift at 1440 → 17.4px @2560).
2. **Scale consolidation (24 → ~10 semantic) — DEFERRED.** Migration is strictly 1:1: numeric rem tokens,
   mechanical codemod, no visual changes at 1440px.
3. **Playwright — APPROVED** as devDependency for screenshot verification.

## Audit findings (verified context)

- Tailwind 3.4.19, single `src/index.css` (~1044 lines), `tailwind.config.ts`. Colors/shadows/radii already
  tokenized (`--color-*` + `html.light` scope). `--content-max-width: 1400px` + margin-inline auto present.
- 1418 arbitrary px across 179 tsx files; ~1044 are font-size, 24 distinct values:
  text-[13px] ×219, text-[12px] ×160, text-[14px] ×114, text-[11px] ×83, text-[13.5px] ×77,
  text-[12.5px] ×75, text-[15px] ×73, etc. (incl. 8.5/9.5px ×4 — round to 9/10).
- Dead secondary scale `--text-xs…--text-2xl` + `--space-*` at index.css:156–166 (0 usages) — delete.
- Hard px in index.css: body font-size 0.875rem (:289), .sidebar-section-label 13px (:717),
  .sidebar-item 16.5px (:734), .sidebar-item-badge 13.5px (:753); `--sidebar-width: 260px`,
  `--content-px: 19px` (:137–144); mobile block :822–1033 (52px topbar, 10.5px pills, !important).
- Control heights: h-[28px] ×24, h-[30px] ×7, h-[34px] ×5, h-[36px] ×3, min-h-[44px] ×5.
- ~10 dialogs with w-[400/440/480/520px]: BranchFormDialog:38, DepartmentFormDialog:33,
  ConfirmDeleteDialog:20, AuthSettingsPanel:51, PartCategoryFormDialog:136, CategoryGroupFormDialog:41,
  CategoryFormDialog:43, AssignLicenseDialog:67, LicenseFormDialog:129. MODAL_SHEET in
  src/components/ui/styles.ts already provides `max-md:w-full` mobile fallback.
- Search inputs w-[280px]: LicensesPage:365, EmployeesPage:210.
- minmax(Npx,fr) tracks: AssetsTable, EmployeesPage:125, RolesPage:287, AuditTable, DepartmentsPage,
  BranchesPage, PartCategoriesSection; `grid-cols-[160px_1fr_180px_72px]` ×7.
- Skeletons (exact-footprint principle, must stay in sync with parents): CardListSkeleton (102 arb),
  AssetDetailSkeleton (53), PartsPageSkeleton (34), TableSkeleton (16). Skeleton tests assert
  gridTemplate strings — must be updated together.
- Login: login/FormPanel (23 arb + 13 inline), MobileHero (17 inline), DesktopDecorPanel (19 inline);
  display sizes text-[28/32/36/42px] → display clamp tokens.
- One test bound to a px class: CategoryGroupFormDialog.test.tsx ([18px]).

## Token system (locked)

In `src/index.css` `:root` — numeric rem tokens (value = px/16):

```
--fs-9: 0.5625rem;   --fs-10: 0.625rem;   --fs-10.5 → --fs-10p5: 0.65625rem;
--fs-11: 0.6875rem;  --fs-11p5: 0.71875rem; --fs-12: 0.75rem;  --fs-12p5: 0.78125rem;
--fs-13: 0.8125rem;  --fs-13p5: 0.84375rem; --fs-14: 0.875rem; --fs-14p5: 0.90625rem;
--fs-15: 0.9375rem;  --fs-15p5: 0.96875rem; --fs-16: 1rem;     --fs-17: 1.0625rem;
--fs-18: 1.125rem;   --fs-20: 1.25rem;      --fs-22: 1.375rem;
```
(CSS custom property names cannot contain dots — use `p5` suffix for half sizes: `--fs-13p5` etc.
Tailwind fontSize keys CAN contain dots: `'13.5': 'var(--fs-13p5)'`.)

Display:
```
--fs-display-sm: clamp(1.5rem, 1.1rem + 1.2vw, 2rem);
--fs-display-md: clamp(1.75rem, 1.3rem + 1.5vw, 2.5rem);
--fs-display-lg: clamp(2rem, 1.4rem + 2vw, 3rem);
```

Controls:
```
--ctl-h-xs: 1.75rem;  --ctl-h-sm: 2rem;  --ctl-h-md: 2.25rem;  --ctl-h-lg: 2.5rem;
--ctl-touch-min: 44px;  /* px intentional — touch target */
```

Layout:
```
--sidebar-width: 16.25rem;  --content-max-width: 87.5rem;
--content-px: clamp(0.75rem, 0.5rem + 0.9vw, 1.5rem);  --topbar-height-mobile: 3.25rem;
```

Modals:
```
--modal-w-sm: 25rem;  --modal-w-md: 27.5rem;  --modal-w-lg: 30rem;  --modal-w-xl: 32.5rem;
```
Pattern: `w-full max-w-[var(--modal-w-*)]` (+ `max-w-[90vw]` guard where missing).

`tailwind.config.ts` → `theme.extend.fontSize`: keys `'9'…'22'` (incl. half sizes as `'10.5'`, `'11.5'`,
`'12.5'`, `'13.5'`, `'14.5'`, `'15.5'`) and `'display-sm'/'display-md'/'display-lg'` via `var(--fs-*)`.

Spacing: arbitrary px → nearest standard rem utility (px-[14px]→px-3.5, py-[10px]→py-2.5);
no-equivalent → rem arbitrary (py-[9px]→py-[0.5625rem]). Tables: minmax minimums in rem;
`overflow-wrap: anywhere` on cells with emails/keys. Breakpoints: Tailwind defaults, documented
in index.css header.

## Phases

0. **Tokens:** fluid root + --fs-*/--ctl-*/layout/modal tokens in index.css; theme.extend.fontSize;
   delete dead scale :156–166. `body { font-size: var(--fs-14); }`.
1. **Typography codemod:** text-[Npx] → text-N across src (node script in scripts/); fix 3 sidebar px
   sizes in index.css; display clamps on login; fix CategoryGroupFormDialog.test.tsx.
   Verify: npm run build + npm test.
2. **Layout + modals:** layout tokens in rem; 10 dialogs → `w-full max-w-[var(--modal-w-*)]`;
   w-[280px] searches → max-w in rem; reconcile mobile block index.css:822–1033 with new scale.
3. **Controls + spacing:** primitives first (src/components/ui/* — btn, field, chip, SearchInput,
   SelectMini, Pagination, DataTable), then features; h-[28/30/34/36px] → var(--ctl-h-*).
4. **Skeletons + tables + inline styles:** 4 skeletons in sync with parents (update their tests);
   minmax tracks in rem; static inline login sizes → classes.
5. **Verification:** Playwright devDependency + chromium; dev server; screenshot matrix
   320/375/414/768/1024/1280/1440/1920/2560 for login (min), dashboard/assets/detail/modal if
   reachable; zoom 200% emulation; h-scroll check (scrollWidth <= innerWidth) at each width;
   screenshots into .screenshots/ (gitignored). App is behind Firebase auth — if screens behind
   login are unreachable, shoot login page across the full matrix and state it explicitly.

## Hard constraints (relayed to every subagent)

- NO git write operations (add/commit/push) — none at all.
- DO NOT touch: label print styles (--label-w: 2in, @page 2in 1.5in — TSC TDP-225), iOS hack
  font-size:16px !important on inputs ≤767px, 44px touch targets, lucide size={N}, 1px borders and
  micro-graphics, dynamic style={{width:%}} bar charts.
- Phase verification: npm run build (tsc -b, exactOptionalPropertyTypes) + npm test. No phase is
  complete without a green build.
- Reuse existing components/constants (styles.ts etc.), no new parallel primitives.
- Mobile list-page pattern (FLUSH_ROUTES + ListCard mx-[10px]) must not break. The `mx-[10px]` on
  ListCard is part of the locked mobile pattern — leave as is unless converting to exact rem
  equivalent (0.625rem) with zero visual change.

## Rollback

Each phase is a mechanical, reviewable diff. Rollback = `git checkout -- <files>` by the OWNER only
(agents perform no git operations). Codemod script retained in scripts/ for reproducibility.
