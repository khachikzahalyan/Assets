# Access Email Notification — Design

- **Date:** 2026-07-30
- **Status:** Approved design (look = mockup variant A), pending spec review → plan
- **Mockup:** `docs/superpowers/specs/2026-07-30-access-email-mockup.html`

## Goal

When an admin grants access in AMS, send the person's Gmail a professional email
notification. Two triggers:

- **A — role granted** to a gmail (new/invited OR existing user).
- **B — employee added** with an email (HR record, no role yet).

## Constraints

- **$0, no Firebase billing.** Must work on the Spark plan — no Cloud Functions,
  no Firebase Extensions (both require Blaze). This matches the project's existing
  `$0` design (see `src/lib/auth/claimPreassignedRole.ts`).
- Professional look, Russian language, brand **"AMS"**.
- Everything likely to change (sender, app URL, brand, subjects, body text) lives
  in **env / a single config/template module**, not scattered in code.

## Non-goals (YAGNI)

- English/Armenian templates — Russian only for now (structure so a 2nd language is
  a small add later).
- Delivery queue, retries, unsubscribe management, open-tracking.
- Any change to the auth / onboarding / role model.

## Architecture

Hosting is Vercel (SPA), so the free server-side path is a **Vercel Serverless
Function** + a **free transactional email API (Brevo)** — no Firebase billing.

```
Admin action (grant role / add employee)
  → Firestore write succeeds (existing code, unchanged)
  → client helper sendAccessEmail()  ── POST /api/notify-access (Bearer <Firebase ID token>)
       → verify token + admin role (server)
       → renderAccessEmail(kind) → { subject, html }
       → Brevo transactional API  → recipient Gmail inbox
```

### Units (each small, testable, one purpose)

| Unit | Location | Responsibility | Depends on |
|---|---|---|---|
| `renderAccessEmail` | `api/_lib/accessEmailTemplate.ts` | Pure `({kind,name,role,appUrl,brand}) → {subject, html}`. Variant A/B copy. | nothing (pure) |
| `verifyAdmin` | `api/_lib/verifyAdmin.ts` | Verify Firebase ID token + caller is `super_admin`/`tech_admin`. | Firebase (Admin SDK or public-cert verify) |
| `notify-access` handler | `api/notify-access.ts` | HTTP: validate body → verifyAdmin → render → send via Brevo. | above + env |
| `sendAccessEmail` | `src/lib/notifications/sendAccessEmail.ts` | Client helper: get ID token, POST, best-effort. **Single call site both triggers use.** | firebase auth |

### Config (all "change later in one place")

Vercel environment variables:

- `BREVO_API_KEY` — secret (server only).
- `BREVO_SENDER_EMAIL` = `zahalyanxcho@gmail.com`
- `BREVO_SENDER_NAME` = `AMS`
- `APP_URL` = `https://telcell-ams.vercel.app/`
- Firebase token-verification config (project id; + service-account creds if Admin SDK).

`vercel.json` — add an exception so `/api/*` is NOT rewritten to `index.html`
(the current catch-all rewrite would otherwise swallow the function route).

## Triggers (exact hook points)

- **A — role granted:** `src/pages/catalogs/RolesPage.tsx`, change-role dialog save
  handler, after `repo.preassignRole(...)` (invited) or `repo.assignRole(...)`
  (existing) resolves. `email = target.email`, `role = selectedRole`, `kind = 'role'`.
- **B — employee added:** `src/pages/employees/useEmployeesActions.ts`
  `handleSaveForm`, after `repo.createEmployee(...)` resolves on **create only**
  (not update) and only when `submit.email` is present. `kind = 'employee'`.

## Email content (RU, brand AMS)

Look = approved mockup **variant A** (light theme, orange `#F97316` accent,
table + inline-CSS layout, bulletproof CTA button, responsive). Both variants
share this style; they differ only in copy.

- **kind `role`** — subject «Вам открыт доступ в AMS»; body: greeting by name →
  «Вам открыт доступ…» → role chip «Ваша роль: {роль}» → CTA «Войти в систему →»
  (→ `APP_URL`) → fallback link → footer «автоматическое письмо».
- **kind `employee`** — subject «Вас добавили в AMS»; softer body («…как только
  назначат доступ, сможете войти») → CTA «Открыть AMS →».
- Name = provided `displayName`, else the email local-part.
- Role label = human-readable RU role name (reuse existing `roles.*` i18n strings).

## Security

- Brevo key + any service-account creds only in Vercel env — never in the client bundle.
- `/api/notify-access` requires a valid **admin** Firebase ID token; otherwise 401/403.
- Token verification is **$0** (Admin SDK `verifyIdToken` on Vercel needs no Firebase
  billing; alternative: verify the JWT against Google public certs with `jose` and read
  the caller's role). Exact mechanism chosen in the plan; default = Admin SDK.
- No extra throttle for MVP — admin-only access + Brevo's daily cap suffice.

## Error handling

- **Best-effort.** `sendAccessEmail` returns `{ ok: boolean }` and never throws into
  the admin flow. On failure the caller shows a non-blocking toast
  («Уведомление на почту не отправлено») — the role grant / employee record is already
  committed and must not be reverted.
- Function returns structured errors (400 bad body, 401/403 auth, 502 provider),
  logged in Vercel.

## Testing

- **Unit:** `renderAccessEmail` (both variants; role chip present for `role`, absent
  for `employee`; HTML-escapes name/role); `verifyAdmin` (admin → ok, non-admin → 403,
  bad/expired token → 401); `sendAccessEmail` client (attaches Bearer token + body;
  swallows failure → `{ok:false}`).
- **Manual:** grant a role to a test Gmail → confirm it lands in **inbox** (not spam)
  and renders correctly in Gmail desktop + mobile; add an employee with email → variant B.

## Free-tier limits

- Brevo free: **300 emails/day**. Vercel Hobby functions: free. Far above onboarding volume.

## One-time setup (by the user)

1. Create a free Brevo account; **verify sender** `zahalyanxcho@gmail.com` (one click);
   copy the API key.
2. Add the Vercel env vars above; redeploy.
