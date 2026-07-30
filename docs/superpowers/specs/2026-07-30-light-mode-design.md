# Light Mode — Design Spec (2026-07-30)

Owner-approved decisions:
- **Default theme: dark** (current look, unchanged). Light is opt-in.
- **Toggle: topbar icon button** (sun/moon) in the control cluster next to NotificationBell / LanguageToggle / ProfileMenu. Works on mobile topbar too.
- **Palette: warm gray-white** (Linear/Notion-light character). Accent orange unchanged.
- **Persistence: localStorage** key `ams-theme` (`'dark' | 'light'`), no Firestore sync.
- Dark theme must remain **pixel-identical** after this work.

## 1. Architecture

Dark stays in `:root` (untouched values). Light is an additive override scope:

```css
html.light { --color-bg: #F4F5F7; ... }   /* redefines --color-*, --rgb-*, --shadow-* */
```

Tailwind gets a custom variant (tailwind.config.ts plugin):

```ts
plugin(({ addVariant }) => addVariant('light', '.light &'))
```

so components fix hardcoded colors locally: `bg-rose-950/30 light:bg-rose-50`.

Anti-FOUC: inline `<script>` in `index.html` `<head>` reads `localStorage['ams-theme']`
and adds `light` class to `<html>` before the bundle loads. `ThemeContext`
(src/contexts/ThemeContext.tsx) owns `theme` + `toggle()`, syncs class + localStorage.
`ThemeToggle` (src/components/common/ThemeToggle.tsx) renders the topbar button,
aria-label translated in ru/en/hy (`common.json` → `theme.toggleToLight/toggleToDark`).

## 2. Light token palette (html.light)

| Token | Dark (unchanged) | Light |
|---|---|---|
| bg | #111315 | **#F4F5F7** |
| surface | #1B1F24 | **#FFFFFF** |
| surface-2 | #22272E | **#F8F9FA** |
| surface-raised | #1B1F24 | **#FFFFFF** |
| surface-sunken | #0E1013 | **#EDEFF2** |
| border | #2A2F36 | **#E2E5E9** |
| border-strong | #3A4048 | **#CBD2D9** |
| text / text-primary | #F8FAFC | **#1A202C** |
| text-secondary | #CBD5E1 | **#445062** |
| text-tertiary / muted | #94A3B8 | **#5B6B80** |
| text-subtle | #64748B | **#75859B** |

(Muted tiers darkened after owner feedback 2026-07-30: pale grays washed out
on white; hierarchy preserved but every tier is readable.)
| text-mono | #FB923C | **#C2410C** (readable orange on white) |
| accent / hover / light / dark | unchanged | unchanged (#F97316 …) |
| accent-soft | rgba(249,115,22,.12) | **rgba(249,115,22,.10)** |
| focus-ring | rgba(249,115,22,.40) | **rgba(249,115,22,.30)** |

Status tokens in light: pale tinted bg + dark tinted text (invert of dark's pattern):
- stock-ok / move-receipt: bg rgba(16,185,129,.12), text **#047857**, dot #10B981
- stock-low / move-repair: bg rgba(245,158,11,.14), text **#B45309**, dot #F59E0B
- stock-empty: bg rgba(244,63,94,.10), text **#BE123C**, dot #F43F5E
- move-install: bg rgba(56,189,248,.12), text **#0369A1**, dot #0EA5E9
- move-removal: bg rgba(100,116,139,.10), text **#475569**, dot #64748B
- success/warning/error/info dots: #059669 / #D97706 / #DC2626 / #0284C7

`--rgb-*` channels mirror every light hex (space-separated R G B).

Shadows (much softer on light):
- sm `0 1px 2px rgb(16 24 40 / .06)`
- md `0 4px 6px -1px rgb(16 24 40 / .07), 0 2px 4px -2px rgb(16 24 40 / .05)`
- lg `0 10px 15px -3px rgb(16 24 40 / .08), 0 4px 6px -4px rgb(16 24 40 / .05)`
- xl `0 20px 25px -5px rgb(16 24 40 / .09), 0 8px 10px -6px rgb(16 24 40 / .05)`
- 2xl `0 25px 50px -12px rgb(16 24 40 / .18)`
- card `0 1px 2px rgb(16 24 40 / .05), 0 4px 12px rgb(16 24 40 / .06)`
- elevated `0 8px 24px rgb(16 24 40 / .10)`
- popover `0 12px 32px rgb(16 24 40 / .14)`

Also inside `html.light`:
- `color-scheme: light` (native controls, date inputs, mobile pickers)
- autofill: `-webkit-text-fill-color: #1A202C; caret-color: #1A202C`
  (move hardcoded #F8FAFC in base rule to `var(--color-text)`)
- `.app-shell-bg` gradients: same radials at half strength over light bg
- `.sidebar-overlay`: `rgba(15,23,42,0.35)` (was black/.60)
- scrollbars / `::selection` / `.anim-skeleton` / `.card` / `.input` already
  var-driven — they follow automatically. Verify only.

## 3. Sweep conversion rules (EVERY subagent follows these)

1. **Never change the dark rendering.** The base class stays as-is; add `light:`
   overrides only. Exception: replacing a hardcoded value with a token that
   resolves to the identical dark value (e.g. `#F97316` → `accent`) is allowed
   and preferred.
2. Tinted **text** on colored chips/banners: `-300/-400` → `light:-700`
   (e.g. `text-emerald-300 light:text-emerald-700`). Amber prefers `-700`,
   sky → `light:text-sky-700`, rose → `light:text-rose-700`, violet →
   `light:text-violet-700`, slate/gray text-300 → `light:text-slate-600`.
3. Dark tinted **backgrounds** `bg-<hue>-950/30`-style → `light:bg-<hue>-50`;
   `bg-<hue>-500/10..20` translucent tints usually work on white — check contrast,
   optionally `light:bg-<hue>-500/10`. Borders `border-<hue>-800/40` →
   `light:border-<hue>-200`.
4. `text-white` **on solid accent / solid status buttons stays** (works in both).
   `text-white` used as "primary text" → replace with `text-text-primary` token.
5. Ghost/hover surfaces `bg-white/5..20` → prefer tokens (`bg-surface-2`,
   `hover:bg-bg`) or add `light:bg-black/5`-style counterpart.
   `bg-black/60` modal backdrops → `light:bg-slate-900/35`.
6. Hex literals in TSX/TS (`#F97316`, `#38BDF8` dots, chart colors): if a token
   fits, use the token. For data-viz / dot maps keep hex but provide a light
   variant map when contrast fails (bright -300/-400 hexes on white).
   Saturated -500 dots are fine on both themes.
7. Colored glow shadows (`shadow-[#FB923C]/40`) → halve on light:
   `light:shadow-[#F97316]/20`.
8. Gradients `from-accent-light to-accent` (primary buttons) — keep; verify.
9. Skeletons are token-driven (`anim-skeleton`, surface vars) — do not touch
   unless a hardcoded color slipped in.
10. Focus rings: keep token-based `ring-accent/…`; hardcoded rgba focus shadows
    → `var(--color-focus-ring)`.
11. **Reuse existing components**; do not fork components per theme. One tree,
    class-level overrides.
12. After each file: confirm no `light:` class changed dark output (light: only
    activates under `html.light`).

## 4. Scope inventory

159 source files carry hardcoded colors (list generated by grep, 2026-07-30 —
see plan). Sweep is organized by area: shell/common → assets → employees +
licenses → parts + catalogs → dashboard/audit/import/settings/scan/self-service
→ auth/login. UI primitives + categoryColors.ts / partsTokens.ts /
licenseHelpers.ts / assetPickerTypes.ts / detailFormat.ts go first (Phase 2)
since features consume them.

## 5. Verification

- `npx tsc -b`, `npm run build`, `npx vitest run` — all green.
- Run the app; walk **every route and every modal** in light AND dark, desktop
  (~1280px) and mobile (~390px). Checklist per page: text readable, borders
  visible, chips/pills legible, hover states visible, focus rings visible,
  skeletons shimmer correctly, no dark-only remnants (dark rectangles on light).
- Dark theme diff: zero visual change expected.
