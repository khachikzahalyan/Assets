# Plan 00 — Project Scaffold (devops)

Status: ready to dispatch. Owner: warehouse-orchestrator. Implementer: devops-engineer.
Working dir: `C:/Users/DELL/Desktop/assets-crm` (does NOT exist yet — create it).

## Goal
Stand up a buildable, type-checked, themed empty app that boots to a dark/orange app shell.
NO feature code. This plan is purely the foundation that every later plan depends on.

## Confirmed stack (owner-resolved, do not deviate)
React 19 + Vite 6 + TypeScript strict + Tailwind CSS + shadcn/ui + Firebase v9+ modular
(Auth/Firestore/Storage/Functions) + Vercel target. lucide-react for icons.
NO Supabase / Zustand / TanStack Query / CSS Modules / React 18.

## Owner decisions made in absence of AskUserQuestion (override me if wrong)
1. **Design tokens encoded as CSS variables + Tailwind theme extension**, not raw hex in JSX.
   Source = `memory/project_design_tokens_extracted.md` + prototype `_shared/tokens.css`.
2. **Dark theme only** for MVP (matches prototypes; spec said "no dark mode in MVP" but prototypes ARE dark
   — prototypes win for look-and-feel per owner brief). No light theme toggle in MVP.
3. **Do NOT port `fluid-scale.js`** (a prototype-only zoom hack). Use normal responsive layout.
4. **Firebase config via `import.meta.env.VITE_FIREBASE_*`**; `.env.local` gitignored; a committed
   `.env.example` documents the keys. No real Firebase project created yet (separate later task).
5. **Testing = Vitest + @testing-library/react + jsdom**; `@firebase/rules-unit-testing` added but
   rules tests come later. `npm test -- --run` and `npm run build` must both pass on an empty app.

## Tasks (in order; devops does all of these in one dispatch)
1. `npm create vite@latest . -- --template react-ts` (scaffold in place) at assets-crm.
2. Pin deps; install: firebase, react-router-dom@7, lucide-react, i18next, react-i18next,
   i18next-browser-languagedetector, clsx, tailwind-merge, class-variance-authority.
   devDeps: tailwindcss postcss autoprefixer, vitest, @testing-library/react, @testing-library/jest-dom,
   jsdom, @firebase/rules-unit-testing, @types/node.
3. Tailwind + PostCSS init. In `src/index.css`: import Inter + JetBrains Mono, declare ALL extracted
   tokens as CSS custom properties on `:root`, set dark bg/text on html/body, add the `.app-shell-bg`
   radial gradient + the keyframe animations (fadeSlideIn/popIn/modalPop/backdropFade/drawerSlideIn/
   dropdownIn/skeletonShimmer) copied from prototype shell.css.
4. `tailwind.config.ts`: extend theme.colors with semantic names mapping to the CSS vars
   (surface, surface-2, border, border-strong, accent, accent-light, text-secondary/tertiary/subtle,
   status hues), fontFamily sans/mono, borderRadius card/btn/input, the box-shadows. content globs for src.
5. `npx shadcn@latest init` (dark base, neutral), seed primitives: button, input, select, dialog,
   dropdown-menu, table, label, badge, tooltip, popover, command, sheet, skeleton. Reconcile their
   theme tokens to our CSS vars so they render dark/orange.
6. `tsconfig`: strict true, noUncheckedIndexedAccess true, exactOptionalPropertyTypes true, path alias `@/*`.
7. Folder skeleton (empty index files OK): src/lib/{firebase,auth,audit,i18n}, src/domain, src/infra,
   src/hooks, src/contexts, src/components/{ui,common,features}, src/pages, src/config, src/locales/{ru,en,hy},
   src/types, src/test-utils.
8. `src/lib/firebase/index.ts`: singletons (app/auth/db/storage/functions) guarded by getApps().length,
   reading `import.meta.env.VITE_FIREBASE_*`. No real values inlined.
9. `src/App.tsx` + router: a single placeholder route rendering an app shell stub that uses the dark
   theme + a "AMS — каркас готов" message so the theme is visibly applied. Real shell components come
   in a later react-ui plan; this is just proof the theme compiles.
10. `.gitignore` (node_modules, dist, .env.local, .firebase), `.env.example`, `vercel.json` (SPA rewrites),
    `README.md` (run/build/test commands). Optional `git init` (no commit unless owner asks).
11. npm scripts: dev / build / preview / test / typecheck.

## Verification (devops must paste evidence)
- `npm run build` succeeds (last 10 lines).
- `npm test -- --run` passes (0 tests OK, runner green) — add one trivial smoke test asserting the
  token CSS var is defined or App renders, so the runner has something.
- `npm run typecheck` (tsc --noEmit) clean.

## Non-goals
No auth, no Firestore reads, no real pages, no security rules, no Cloud Functions, no i18n keys beyond
an i18next init stub. Those are later plans.

## Rollback
The directory is new; rollback = delete `C:/Users/DELL/Desktop/assets-crm`.
