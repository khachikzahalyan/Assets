# Design — AMS App Shell + UI Primitives (TS port of `shell.js`)

Date: 2026-06-19
Owner: warehouse-orchestrator (AMS). Author: this orchestrator.
Status: design approved by owner brief (theme locked, build target locked). Decisions-needed flagged inline.

## Goal

Port the validated prototype shell component library (`prototypes/_shared/shell.js` +
`shell.css` + `tokens.css`, plus the inline shell.html role-switcher demo) into the
production `assets-crm` codebase as a strict-TypeScript, dark/orange-themed component set:

- **UI primitives**: `Icon`, `Chip`, `Btn`, `IconBtn`, `SectionCard`, `Field`, `Input`,
  `Select`, `Badge`, `Avatar`, `PageHeader`, `EmptyState`, `LoadingState`, `ErrorState`.
- **Shell parts**: `Sidebar` (role-filtered nav + Phase-2/3 "Скоро" stubs), `TopBar`
  (Breadcrumbs + LanguageToggle + ProfileMenu + Cmd+K SearchPalette trigger), `AppShell`
  composition root with mobile drawer + overlay.
- **Supporting infra**: `AuthContext` (mock user + dev role switcher, Firebase-ready
  interface), i18next init (ru/en/hy) + LanguageToggle wiring, react-router route table
  with Phase-2/3 stub pages.

The dark/orange theme (accent `#F97316`) is the locked production look. The light-indigo
§9bis tokens are superseded for look-and-feel. The token CSS-var system already exists in
`src/index.css` + `tailwind.config.ts`; this work consumes it, with a small set of
sidebar/card/input class additions ported from `shell.css`.

## Non-goals (explicit YAGNI)

- NO real Firebase auth wiring (lazy accessors exist; auth flow is a later plan). The mock
  user + role switcher stand in behind a clean `AuthContext` interface.
- NO feature pages (assets list, employees, etc.). Every nav target that isn't the shell
  itself renders a `StubPage` ("Скоро"/"coming soon") so the shell is navigable end-to-end.
- NO `fluid-scale.js` zoom hack (prototype-only; the scaffold plan already excluded it).
- NO `<MultiLangInput>` (no Tier-2 fields in the shell).
- NO drag-modal (`use-draggable-modal.js`) — not used by the shell.
- NO mobile.css port — normal Tailwind responsive (`lg:` breakpoint) like the prototype shell.

## Key divergences from a literal 1:1 port (decided, with rationale)

1. **Icon → `lucide-react`, not the CDN/innerHTML hack.** The prototype `Icon` uses
   `useLayoutEffect` + `innerHTML` + `window.lucide.createIcons()` to dodge a Lucide-CDN
   DOM-ownership crash. Production has `lucide-react` (real React components). Per the
   orchestrator's own §9bis v9.2.3 invariant, the workaround is dropped in the real app.
   Our `Icon` maps a kebab-case name string to a `lucide-react` component via a typed
   registry and renders it as a real React element. Keeps the `<Icon name="..." size=.../>`
   call sites identical so every other component ports unchanged.

2. **Routing → react-router SPA, not `window.location.href`.** `ROUTE_URL` /
   `navigateToRoute` (cross-HTML-file navigation) is replaced by a route table and
   `useNavigate`/`NavLink`. Sidebar items dispatch route ids; the router resolves them.
   The `optimisticRoute` hack (highlight before browser nav) is removed — SPA nav is instant.

3. **Auth/role → `AuthContext`, not module-level `MOCK_USERS` switcher.** A context provides
   `{ user, role, setRole, signOut }`. Seeded with a mock user; a dev-only role switcher
   (visible in the profile menu, gated by `import.meta.env.DEV`) flips the active role to
   exercise the role-filtered nav. The interface is shaped so the real `onAuthStateChanged`
   provider drops in later without touching any consumer.

4. **Primitives as CVA + exact prototype tokens, not forced Radix wrappers.** The prototype
   IS the visual spec. Primitives that are plain styled elements (Chip, Btn, Badge, Avatar,
   Field, Input, Select, SectionCard) become CVA-typed components emitting the same Tailwind
   classes. Radix is used only where it earns its keep: SearchPalette (Dialog/portal),
   LanguageToggle + ProfileMenu (DropdownMenu) — OR hand-rolled with the prototype's proven
   click-outside/Esc pattern if Radix styling friction is high. The existing
   `src/components/ui/button.tsx` (shadcn) stays but `Btn` is the canonical AMS button.

5. **i18n wired now.** i18next init + `LanguageDetector` + ru/en/hy resources; Tier-1 chrome
   strings (nav labels, route labels, search/profile/empty/error copy) go through `t()`.
   LanguageToggle persists choice to `localStorage` (i18next detector default) and updates
   `<html lang>`. The Russian strings from the prototype become the `ru` resource values; en/hy
   get parallel keys (English real, Armenian best-effort placeholder marked for later review).

## Architecture & file layout

```
src/
  lib/i18n/index.ts                 # i18next init (ru/en/hy, detector, fallback ru)
  locales/{ru,en,hy}/
    common.json                     # buttons, states, search, profile, language
    nav.json                        # sidebar group + item labels, route labels
  contexts/
    AuthContext.tsx                 # { user, role, setRole, signOut }; mock + dev switcher
    index.ts
  config/
    roles.ts                        # ROLES, ROLE_LABEL (i18n keys), Role type
    nav.ts                          # ADMIN_NAV, EMPLOYEE_NAV, navForRole, defaultRouteForRole
    routes.tsx                      # route table: shell + per-route StubPage; Phase 2/3 "Скоро"
    index.ts
  components/
    ui/                             # AMS primitives (CVA)
      icon.tsx                      # lucide-react registry + <Icon name size/>
      chip.tsx  btn.tsx  icon-btn.tsx  section-card.tsx
      field.tsx  input.tsx  select.tsx  badge.tsx  avatar.tsx
      page-header.tsx  empty-state.tsx  loading-state.tsx  error-state.tsx
      index.ts                      # barrel
    common/
      Sidebar.tsx
      TopBar.tsx  Breadcrumbs.tsx  LanguageToggle.tsx  ProfileMenu.tsx
      SearchPalette.tsx
      AppShell.tsx
      TopbarSlotContext.tsx         # page-supplied topbar content slot
      index.ts
  pages/
    StubPage.tsx                    # generic "Скоро" page for every non-shell route
    DashboardPage.tsx               # minimal real content so the default route isn't a stub
  App.tsx                           # Providers (i18n, Auth) + Router + AppShell
```

### Data flow

- `App` mounts: i18n initialized (side-effect import) → `<AuthProvider>` → `<BrowserRouter>`
  → `<AppShell>` wraps `<Routes>`. `AppShell` reads `user`/`role` from `AuthContext`,
  computes nav via `navForRole(role)`, renders `Sidebar` + `TopBar` + `<Outlet/>` content.
- Sidebar item click → `useNavigate(routeId)`. Active state from `useLocation()`.
- Cmd+K → SearchPalette dialog (mock results; picking logs/navigates — picking a result
  navigates to its route stub for now).
- LanguageToggle → `i18n.changeLanguage(lng)`; ProfileMenu role switcher → `setRole(...)`.
- TopbarSlotContext: a page can inject custom topbar content (kept for future pages); shell
  default is Breadcrumbs.

### Role → nav matrix (unchanged from prototype, the AMS role spec)

- `super_admin`: all admin groups (Главное, Активы и операции, Организация, Справочники, Система).
- `asset_admin`: Дашборд, Активы, Выдачи, Запчасти, Сотрудники, Филиалы, Отделы.
- `tech_admin`: Дашборд, Активы, Ремонты, Лицензии, Запчасти.
- `employee`: flat IA — Мои активы, Мои акты, Профиль.

Phase-2/3 routes (assignments, repairs, licenses, parts, branches, departments, categories,
statuses, roles, audit, settings, my-acts) render `StubPage` with a "Скоро" badge. Dashboard,
assets(→stub for now), employees(→stub), my-assets(→stub) are present in IA but only Dashboard
has real (minimal) content; the rest are stubs until their feature plans land.

## Security considerations (security-reviewer will gate)

- Role-filtered nav is **UX only** — `navForRole` hides items the role can't use, but this is
  not a security control. The eventual Firestore rules + route guards are the real control.
  This must be documented in code comments so no one mistakes it for enforcement.
- `AuthContext` mock must never leak into a "logged in as super_admin" production default.
  The dev role switcher is gated by `import.meta.env.DEV`. The mock user is clearly marked.
- No secrets, no Firebase config inlined. No real auth tokens. PII in mock users is fake.
- `<html lang>` updates and i18n key resolution validate language id against `['ru','en','hy']`.

## Testing strategy

- **Primitives**: render + variant smoke tests (Btn variants/sizes, Chip colors, Badge tones,
  Avatar initials, Input/Select onChange, SectionCard header/noHeader, state components).
- **Icon**: renders an svg for a known name; falls back gracefully for unknown name.
- **nav config**: `navForRole` returns correct groups/items per role; employee gets flat IA;
  empty groups filtered out.
- **Sidebar**: renders role-appropriate items; active item reflects current route; badge shows.
- **AppShell**: mounts with a role; switching role changes visible nav; Cmd+K opens palette;
  mobile drawer toggles.
- **i18n**: a sample key resolves in ru/en/hy; LanguageToggle changes active language.
- **AuthContext**: provides user/role; setRole updates; consumers re-render.
- Build + typecheck + full vitest green is the completion gate (existing 7 tests stay green).

## Decisions needed from owner (non-blocking — defaults chosen, flag for confirm)

1. **D1 — Armenian (hy) translations**: real translation not available to this agent. Default:
   seed `hy` with English values as placeholders + a `// TODO: native hy review` marker, so the
   toggle works and keys exist. Confirm whether a native-hy pass should be scheduled now or later.
2. **D2 — `assets` route**: IA lists Активы but no asset-list feature exists yet. Default: route
   it to `StubPage` ("Скоро") for now; the asset-list feature plan replaces it. Confirm OK.
3. **D3 — Dev role switcher placement**: default = inside ProfileMenu, DEV-only. Confirm vs. a
   separate floating dev widget.

None of these block the build; defaults are implemented and flagged in the delivery report.
