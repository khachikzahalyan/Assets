# Settings — `/settings/auth` OAuth-domain editor (Super-Admin only)

Date: 2026-06-20
Status: Approved (owner-decided defaults; high-stakes forks flagged in §9)
Branch: `feat/settings-auth-domains`

## 1. Purpose

Give the Super Admin a UI to edit the allowed email-domain list stored in the
Firestore doc `/settings/auth`. This doc is the SINGLE source of truth that the
`beforeCreate` Cloud Function reads (server-side, via the Admin SDK) to allow or
deny every new account sign-up. Today the doc can only be edited by hand in the
Firebase console; this feature makes it a first-class, audited, role-gated screen.

This is a Phase-1 feature. The Settings page is structured so future panels
(notifications matrix, etc.) drop in as sibling sections later, but ONLY the
Authentication panel is built now.

## 2. The enforcement-point invariant (the whole point of this feature)

`functions/src/auth/beforeCreate.ts` reads exactly one field:

```ts
const raw = data?.allowedEmailDomains
const domains = Array.isArray(raw) ? raw.filter(d => typeof d === 'string') : []
// fail closed: if domains.length === 0, EVERY sign-up is rejected.
if (!isDomainAllowed(email, domains)) throw new HttpsError('permission-denied', ...)
```

Therefore the editor MUST write `allowedEmailDomains` as a `string[]`. The match
between what the editor writes and what the function reads is the key correctness
invariant of this task. A type-level test ties the editor's written shape to the
function's read shape so a future drift breaks the build.

**Confirmed `/settings/auth` doc shape (what the owner should seed):**

```jsonc
{
  // READ + WRITTEN by this editor. The ONLY field beforeCreate reads.
  "allowedEmailDomains": ["example.com"],   // string[], lowercase, deduped

  // PRESERVED but NOT edited by this task (merge-write never clobbers them):
  "emailLinkActionUrl": "https://...",       // operator/deploy concern (see §9, Fork 1)
  "googleClientId": "...",                    // operator/deploy concern

  // bookkeeping written by the editor on every save:
  "updatedAt": <serverTimestamp>,
  "updatedBy": "<uid>"
}
```

`beforeCreate` does **not** read `emailLinkActionUrl` or `googleClientId`. We
therefore do not build editors for them (editing a field the enforcement point
ignores is a false affordance). We DO preserve them via a `{ merge: true }`
write so an operator-seeded value is never lost. See §9 Fork 1.

## 3. Fail-closed semantics — preserved end to end

- `beforeCreate` already fails closed: empty/missing list → reject all sign-ups.
- The editor must make it **impossible to silently brick auth.** Saving an empty
  domain list is allowed (an operator may legitimately want to freeze all new
  sign-ups), but ONLY behind an explicit, escalated danger-confirm that states in
  plain language: "Removing all domains blocks ALL new sign-ups."
- Normal (non-empty) saves still require a confirm, because this controls who can
  ever access the system. Confirm copy summarizes the resulting domain list.

## 4. Architecture (mirrors the established catalog pattern)

Ports-and-adapters, exactly like `CategoryRepository`:

- **Domain** `src/domain/settings/`
  - `types.ts` — `AuthSettings { allowedEmailDomains: string[]; emailLinkActionUrl?: string; googleClientId?: string; updatedAt?: string; updatedBy?: string }`
  - `AuthSettingsRepository.ts` — the port:
    - `getAuthSettings(): Promise<AuthSettings>` (returns a normalized default
      `{ allowedEmailDomains: [] }` when the doc is missing — fail-closed read)
    - `updateAllowedDomains(domains: string[], actor: Actor): Promise<AuditedResult<AuthSettings>>`
  - `validation.ts` — pure helpers (no Firebase): `normalizeDomain`,
    `isValidDomain`, `dedupeDomains`. Unit-tested independently of any adapter.
    (An earlier draft listed a `parseDomainsInput` bulk-paste helper; dropped as
    YAGNI — the panel adds domains one at a time, so it would be dead code.)
  - `index.ts` — barrel.
- **Infra**
  - `inMemoryAuthSettingsRepository.ts` — used by component/unit tests.
  - `firestoreAuthSettingsRepository.ts` — production; reads/writes
    `doc(db,'settings','auth')`; write is `set(ref, {...}, { merge: true })`
    inside `withAudit`; read normalizes the raw doc into `AuthSettings`.
- **Audit**: add `'settings'` to `AuditEntityType`. Reuse the existing
  `'updated'` action. The audit `before`/`after` carry the domain LIST only
  (no secrets are involved in this doc). One `audit_logs` row per save, in the
  same transaction as the doc write (the `withAudit` chokepoint guarantees this).

## 5. Domain validation rules (pure, in `validation.ts`)

- `normalizeDomain(s)`: trim, lowercase, strip a leading `@` and any leading
  `https://`/`http://`/`www.` and any path — reduce to the bare host.
- `isValidDomain(s)`: matches a conservative domain regex
  (`/^(?=.{1,253}$)([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/`); rejects empty,
  spaces, `@`, missing TLD.
- `dedupeDomains(list)`: case-insensitive de-dupe, stable order.
- Reject on add: empty, invalid format, or duplicate (case-insensitive).
- The saved array is always normalized + deduped.

## 6. UI — `SettingsPage` (super-admin route, replaces the StubPage)

- Route `/settings` is currently a `StubPage` via `PHASE_STUB_ROUTES`. Remove
  `'settings'` from `PHASE_STUB_ROUTES` and add a real route in `routes.tsx`
  wrapped in `<RoleGate roles={routeRoles('settings')}>` (already super-admin).
  The nav item already exists (`items.settings`, super_admin only) — no nav change.
- `SettingsPage` renders a `PageHeader`, then one panel per setting area. For now,
  one panel: **`AuthSettingsPanel`** (`src/components/features/settings/`). NOTE:
  the panel OWNS its own `<SectionCard>` (so its loading/error/ready states render
  inside a single consistent card, and because the shared `SectionCard` primitive
  has no `subtitle` prop — the description is a `<p>` inside the panel). The page
  composes panels directly; future sibling panels follow the same self-carded
  shape. (An earlier draft put the `SectionCard` in the page wrapping the panel;
  panel-owns-card is the implemented, cleaner approach.)
- The page accepts an optional `repository?: AuthSettingsRepository` prop for
  test injection, exactly like `CategoriesPage`. Default wires
  `new FirestoreAuthSettingsRepository(db())` via `useMemo`.
- Panels are independent components so adding a sibling panel later is additive.

### `AuthSettingsPanel`
- States: loading (`LoadingState`), error (`ErrorState` + retry), ready.
- Shows the current domain list as removable chips/rows. Each row has a remove
  `[x]`. An add-row: text input + "Add" button; validates on add (inline error
  for empty/invalid/duplicate; input normalizes to lowercase bare host).
- A persistent **fail-closed warning banner** appears whenever the working list
  is empty: "No domains — ALL new sign-ups are blocked."
- "Save" is disabled until the working list differs from the saved list (dirty
  tracking). On Save:
  - If the working list is **non-empty** → standard `ConfirmDialog` summarizing
    the new list ("New sign-ups will be allowed only from: a.com, b.com").
  - If the working list is **empty** → escalated danger confirm (distinct red
    styling + the strong fail-closed warning; requires an explicit second click /
    type-to-confirm of a short token). Cannot be dismissed by accident.
- Save calls `repo.updateAllowedDomains(working, { uid: user.id, role })`.
  Surfaces save errors via inline error state. On success, re-reads + resets dirty.
- i18n: new `settings` namespace, `ru/en/hy`. All user-facing strings via `t()`.

## 7. Security rules

- Replace the generic `/settings/{doc}` block with an explicit `/settings/auth`
  block ABOVE a retained generic `/settings/{doc}`:
  - `/settings/auth`: `read: super_admin`; `write: super_admin` AND a shape guard
    that `allowedEmailDomains` (when present) is a `list`. (Rules cannot deeply
    validate each element is a domain string; the repository + function enforce
    that. The list-type guard prevents an obviously-wrong scalar write.)
  - generic `/settings/{doc}`: unchanged `read/write: super_admin` for any future
    settings docs.
- `beforeCreate` reads via Admin SDK → bypasses rules → unaffected.
- New rules tests authored for CI (Java emulator unavailable locally; tests run
  in CI): super_admin can read/write `/settings/auth`; asset_admin/tech_admin/
  employee/anon are all denied read AND write; a scalar `allowedEmailDomains`
  write is rejected.

## 8. Testing

- `validation.test.ts` — normalize/validate/dedupe/parse edge cases.
- `inMemoryAuthSettingsRepository.test.ts` — get returns fail-closed default when
  empty; update writes normalized+deduped list; one audit row per update; merge
  preserves untouched fields (`emailLinkActionUrl`).
- `SettingsPage.test.tsx` / `AuthSettingsPanel.test.tsx` — render current list;
  add/remove/validate; dirty-gating; standard confirm on non-empty save;
  escalated confirm on empty save; fail-closed banner; super-admin gating.
- **Shape-tie test** — a `*.test-d.ts` (or runtime test importing the function's
  reader) asserting the field name + type the editor writes (`allowedEmailDomains:
  string[]`) matches what `beforeCreate` consumes. Drift breaks the build.
- `firestore.rules` tests as in §7.
- Baseline: 731 app + 53 function tests green; this work is additive.

## 9. Owner decisions / flagged forks (resolved with spec-aligned defaults)

**Fork 1 (HIGH-STAKES — the spec/function mismatch).** The orchestrator §5 docs
list `emailLinkActionUrl` on `/settings/auth`, but `beforeCreate` does NOT read
it. **Decision: conform to the enforcement point.** Build the validated editor
for `allowedEmailDomains` ONLY. Preserve `emailLinkActionUrl`/`googleClientId`
via merge-write but do not surface an editor for them — editing a field the
enforcement point ignores is a false affordance, and the email-link action URL
is a Firebase-console/deploy concern, not a runtime-read setting. Owner may later
request a read-only display or a separate operator panel.

**Fork 2.** Every save confirms; empty-list save escalates to a danger confirm
with explicit fail-closed warning + type-to-confirm. (Default chosen; lower
friction is possible if the owner prefers.)

**Fork 3.** `/settings/auth` read+write stays super_admin-only (matches the nav
matrix). The function bypasses rules anyway. (Default chosen.)

Non-blocking owner decisions to confirm post-merge:
- Seed `/settings/auth` with the real customer domain(s) before go-live (the doc
  is fail-closed; until seeded, NO ONE can sign up).
- Whether a future read-only display of `emailLinkActionUrl`/`googleClientId` is
  wanted.
- Whether empty-list save should keep the type-to-confirm friction or relax to a
  single danger click.
