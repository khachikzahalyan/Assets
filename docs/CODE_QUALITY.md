# AMS — Code Quality Standard

> **Canonical coding standard for assets-crm.** Every file you touch — main thread or
> subagent, every session — follows this, without being asked. If unsure whether something
> violates a rule, it probably does: ask before writing.

This is the project owner's quality bar, **adapted to the real AMS stack**. The original
draft referenced a Supabase + CSS-Modules + TanStack + Zustand stack; AMS does **not** use
any of those. Where a rule named a foreign tool, it is translated to the actual stack below.

## The real stack (source of truth — do not re-confuse)

| Concern | AMS uses | NOT |
|---|---|---|
| Backend / data | **Firebase / Firestore** via the **repository pattern** (`src/infra/repositories/*`, ports in `src/domain/*`) | ~~Supabase~~ |
| Server state | direct async **repository** calls + **React Context** + small hooks (`useAssets`, …) | ~~TanStack Query~~ |
| Client state | **React Context** (`src/contexts/*`) + local `useState` | ~~Zustand~~ |
| Styling | **Tailwind CSS + shadcn/ui (Radix)** + **semantic design tokens** (`index.css`, `tailwind.config.ts`), shared constants in `components/ui/styles.ts` | ~~CSS Modules / `.module.css`~~ |
| Status / enums | **data-driven** Firestore docs (e.g. `statusId: 'st_warehouse'`) resolved via reference data | ~~hardcoded `enum AssetStatus`~~ |
| i18n | **react-i18next**, keys in **ru / en / hy** (4-tier strategy), `MultiLangInput` for Tier-2 | — |

---

## 1. File size — hard limit
- **Max 300 lines per file.** Over 300 → split before continuing.
- Split by: extract each logical section into its own component; business logic into a custom hook; helpers/formatters into a `*.utils.ts`; constants into a `*.constants.ts`.

## 2. TypeScript — zero tolerance
- `strict: true` **and** `exactOptionalPropertyTypes: true` (already on). Keep both green: `npx tsc -b`.
- **`any` is forbidden.** Unknown shape → `unknown` + narrow. No `@ts-ignore` / `@ts-nocheck`.
- Avoid type assertions (`as X`). If truly unavoidable, add a one-line comment explaining why. (Prefer fixing the type — e.g. add the method to the port — over `as unknown as`.)
- Every entity/prop set has a typed `interface`. **Repository reads are typed at the port**, not cast at the call site:
  ```ts
  // port: src/domain/asset/AssetRepository.ts
  findByInvCode(invCode: string): Promise<Asset | null>
  ```
- Fixed value sets that are **code constants** (not Firestore data) → use a union type or `enum`. Asset *status* is **data-driven** (`statusId` from Firestore) — resolve via reference data, never a hardcoded status enum.

## 3. React rules
- **`useEffect` only for:** media/camera lifecycle, realtime/`onSnapshot` subscriptions, third-party DOM init, unmount cleanup. **Never** for data fetching (use a repository hook), deriving state from props (`useMemo`/compute inline), or syncing state→state.
- **No prop drilling beyond 2 levels.** Level 3+ → React Context (not Zustand).
- **Pages are lazy-loaded** in the router (`lazy(() => import('./pages/...'))`).
- One component = one responsibility. More than ~3–4 `useState` in a component → extract a hook.

## 4. Component structure — standard order
1. Imports: external → internal (`@/…`) → types → (no CSS-module import — Tailwind only).
2. File-local `interface`/types.
3. Named export component (no inline `export default`):
   - hooks first → derived/computed values → handlers → early returns (loading/empty/error) → main render (short, readable).

## 5. Hooks
- Name starts with `use`; does **one** thing; returns a **typed object** (array only to mirror `useState`); handles loading / error / empty.

## 6. Styling (Tailwind + tokens — replaces the CSS-Modules rule)
- **No `.module.css`.** Style with **Tailwind utility classes**.
- **No hardcoded hex in app UI.** Use **semantic design tokens** (`bg-surface`, `text-text-primary`, `border-border`, `accent`, …) and **alpha-aware tokens** (`border-border/60`, `ring-accent/15` → backed by `rgb(var(--rgb-X) / <alpha>)`). Add a new token rather than a raw hex.
- **Avoid inline `style={{}}`** for anything expressible as a class. Inline style is acceptable only for genuinely dynamic values (computed positions/sizes, `getBoundingClientRect` portals) or a one-off decorative full-bleed surface — and call that out.
- Mobile conventions: mobile-first; modals/dialogs are **bottom-sheets** on ≤767px (`MobileSheet`/`MODAL_SHEET`, `max-md:items-end`); gate with `max-md:`. Skeletons = **plain shimmer only** (no real text/icons), mirroring the real block.

## 7. Review checklist (every file)
**Size/structure:** ≤300 lines · one responsibility · logic in hooks · helpers in utils.
**TypeScript:** zero `any` · typed props · repository reads typed at the port (no call-site cast) · data-driven status (no hardcoded enum).
**React:** no `useEffect` data-fetch · no prop drilling >2 · no stored-but-derivable state · list `key`s present.
**Styling:** no `.module.css` · no inline style where a class works · no hardcoded hex (tokens only).
**General:** no commented-out code · no `console.log` · no bare `TODO` (link an issue) · imports ordered · i18n keys in ru/en/hy (no hardcoded Cyrillic strings).
**Verify:** `npx tsc -b` + `npx vite build` + relevant `npx vitest run` all green before claiming done.

## 8. On finding a violation
Stop → fix it immediately → check related files for the same violation → then continue. If a prior agent left a violation in code you're extending, fix it before adding new code.
