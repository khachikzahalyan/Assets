# AMS Go-Live Operator Runbook

> **CRITICAL: FAIL-CLOSED WARNING — READ BEFORE RUNNING ANYTHING**
>
> The `beforeCreate` Cloud Function reads `settings/auth.allowedEmailDomains`
> from Firestore on every sign-up attempt. If that array is **empty or missing**,
> the function **rejects ALL sign-ups** — including your own first login.
> Nobody can sign in until allowed domains are set. This means the seeder MUST
> be run with `--domains yourcompany.example` (or `SEED_ALLOWED_DOMAINS` set)
> so that `settings/auth.allowedEmailDomains` is populated before anyone tries
> to sign in. Do not skip the `--domains` flag.

---

## What the scripts will and will not do

**Seeder (`npm run seed`):**
- Creates reference docs (statuses, branches, departments, categories, settings)
  in Firestore if they do not exist. Idempotent and re-runnable.
- With `--force`, re-writes reference docs using merge (preserves extra fields).
- With `--domains`, sets `settings/auth.allowedEmailDomains` so sign-ups are
  allowed.
- NEVER deletes any document. NEVER overwrites `users`, `assets`, or `employees`
  docs. Safe to re-run against a live project.

**Grant-super-admin (`npm run grant:super-admin`):**
- Preview-by-default: resolves and prints the target user, then exits without
  writing. Add `--confirm` to apply.
- Only sets `role` and `status` fields on the target user doc. Does not delete
  anything, does not touch other fields.

---

## Step 1 — Prerequisites [OPERATOR]

Required tools on the operator's machine:

- **Node.js 20 LTS or higher** (`node --version`)
- **npm 9 or higher** (`npm --version`)
- **Firebase CLI**: either install globally once (`npm install -g firebase-tools`)
  or use the project-bundled copy via `npx firebase` (already available after
  `npm ci` in the repo root).
- A Google account that has access to the Firebase project.

Log in to Firebase (must be done interactively in a terminal — not in a CI
session):

```
npx firebase login
```

Install project dependencies if you have not already:

```
npm ci
```

---

## Step 2 — Create the Firebase project [OPERATOR] [BLAZE]

1. Go to https://console.firebase.google.com and click **Add project**.
2. Give it a meaningful name (e.g. `ams-production`). Note the auto-generated
   **project id** — you will need it throughout these steps.
3. When the project is created, open **Project settings** (gear icon) ->
   **Usage and billing** -> **Modify plan** and **upgrade to Blaze (pay-as-you-go)**.

   **Why Blaze is required:** Cloud Functions deployment requires Blaze. The
   `beforeCreate` blocking trigger is a Cloud Function — without it, all sign-up
   domain checking is disabled. Blaze is also required to use Firebase Extensions.

---

## Step 3 — Enable Firebase services [OPERATOR] [BLAZE]

In the Firebase console for your project, enable each service:

- **Cloud Firestore**: Build -> Firestore Database -> Create database.
  Choose **production mode** (rules are deployed from the repo — start locked).
  Select a region close to your users (e.g. `europe-west1`).
- **Cloud Storage**: Build -> Storage -> Get started.
  Accept the default rules (they will be overwritten by `deploy:all`).
  Use the same region as Firestore.
- **Authentication**: Build -> Authentication -> Get started.
- **Cloud Functions**: Build -> Functions -> Get started.
  (Requires Blaze. Functions are deployed from the repo.)

---

## Step 4 — Configure Authentication providers [OPERATOR]

In Firebase console -> Authentication -> Sign-in method, enable:

1. **Google** — Enable, set a support email.
2. **Email/Password** — Enable, then also enable the sub-option
   **Email link (passwordless sign-in)**.

In Authentication -> Settings -> Authorized domains, add:

- `localhost` (for local dev — already present by default)
- Your Vercel domain (e.g. `ams-yourcompany.vercel.app` or your custom domain).
  Add this **after** Vercel deployment is complete (Step 11).

---

## Step 5 — Point the repo at the project [OPERATOR]

Run this from the repo root (it rewrites `.firebaserc` with your real project id):

```
npx firebase use --add
```

Select your project from the list and set the alias to `default` when prompted.

After this step, `.firebaserc` will contain your real project id. This file is
safe to commit (it contains no secrets, only the project id).

---

## Step 6 — Configure frontend environment variables [OPERATOR]

Copy the example file and fill in the Firebase values:

```
cp .env.example .env.local
```

Open `.env.local` and fill in the `VITE_FIREBASE_*` values. Find them in
Firebase console -> Project settings -> Your apps -> Web app -> SDK setup and
configuration (choose **Config**):

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

`.env.local` is gitignored — never commit it.

For Vercel production, set the same six `VITE_FIREBASE_*` vars in:
Vercel project dashboard -> Settings -> Environment Variables.

---

## Step 7 — Credentials for Admin scripts

The seeder and grant-super-admin script use the Firebase Admin SDK, which
requires credentials that bypass Firestore security rules. There are three
options (choose one):

**Option A — Application Default Credentials (recommended for developers):**
Install the Google Cloud SDK (https://cloud.google.com/sdk/docs/install) and run:

```
gcloud auth application-default login
```

This stores credentials locally. The scripts will find them automatically with
no further configuration. No `GOOGLE_APPLICATION_CREDENTIALS` env var needed.

**Option B — Service account key file (recommended for automated/CI use):**
1. Firebase console -> Project settings -> Service accounts -> Generate new
   private key. Download the JSON file.
2. Move it to `.secrets/service-account.json` inside the repo root.
   (`.secrets/` is gitignored — the file will never be committed.)
3. Set the env var in your shell (or in `.env.local` with the comment removed):

```
GOOGLE_APPLICATION_CREDENTIALS=./.secrets/service-account.json
```

Required IAM roles: **Editor** or at minimum **Cloud Datastore User** +
**Firebase Authentication Admin**.

**Option C — Emulator (for local testing only):**
The `seed:emulator` script targets the local Firebase emulator, so no real
credentials are needed. See the emulator section in Step 9.

---

## Step 8 — Deploy the backend [BLAZE]

Deploy Firestore rules, Storage rules, Firestore indexes, and Cloud Functions
in a single atomic command:

```
npm run deploy:all
```

This runs: `npx firebase deploy --only firestore:rules,storage:rules,firestore:indexes,functions`

Note:
- The first deploy builds the Cloud Functions TypeScript (`functions/`) before
  uploading — this takes 1-2 minutes.
- Firestore composite indexes may take 5-10 minutes to finish building after
  deploy. During that time some queries may fail — this is expected.
- To deploy rules and indexes only (no functions): `npm run deploy:rules`
- To deploy indexes only: `npm run deploy:indexes`

Confirm success: the Firebase CLI will print
`Deploy complete!` and list the deployed resources.

---

## Step 9 — Seed reference data (CRITICAL STEP)

> **See the FAIL-CLOSED WARNING at the top of this runbook.** Always pass
> `--domains` with the real email domain for your organization.

Run the seeder against your real project:

```
npm run seed -- --domains yourcompany.example --project your-project-id
```

Replace `yourcompany.example` with your organization's email domain (the part
after `@`). Replace `your-project-id` with the Firebase project id from Step 2.

The seeder will create:
- 4 asset statuses (На складе, Выдано, В ремонте, Списано)
- 5 branches (Головной офис + 4 regional)
- 6 departments (ИТ, HR, Продажи, Финансы, Юристы, Операции)
- 25 core asset categories with inventory-code prefixes
- `settings/auth` with `allowedEmailDomains: ["yourcompany.example"]`
- `settings/defaults` with `mainBranchId: "br_main"`, `defaultLocale: "ru"`

**Flags:**

| Flag | Effect |
|------|--------|
| `--domains a,b` | Sets allowed sign-up domains (comma-separated). REQUIRED for first run. |
| `--project <id>` | Target project id. Can also be set via `GOOGLE_CLOUD_PROJECT` env var. |
| `--force` | Re-writes reference docs with merge (preserves extra fields). Safe to re-run. |
| `--dry-run` | Prints what would be written; touches nothing. Use to preview. |
| `--all-categories` | Seeds the full 131-category taxonomy instead of the 25-category core set. On a real project also pass `--all-categories-confirm`. |
| `--demo` | Adds sample assets and employees (synthetic PII). NEVER on prod. On a real project also pass `--demo-confirm`. |
| `--main-branch <id>` | Overrides the default mainBranchId (default: `br_main`). |

**Emulator (preview before seeding a real project):**

Start the emulators in one terminal:
```
npm run emulators
```

Preview what would be written (dry-run, no writes):
```
npm run seed:emulator -- --dry-run
```

Seed the emulator (writes to local emulator, not to a real project):
```
npm run seed:emulator -- --domains yourcompany.example
```

On Windows PowerShell, if `seed:emulator` does not work, set env vars manually:
```powershell
$env:FIRESTORE_EMULATOR_HOST="localhost:8080"
$env:GOOGLE_CLOUD_PROJECT="demo-ams"
npm run seed -- --dry-run
```

**The seeder is idempotent.** Re-running it without `--force` skips docs that
already exist. With `--force` it merges (never deletes). Safe to re-run at any
time.

---

## Step 10 — Mint the first super_admin (chicken-and-egg bootstrap) [OPERATOR]

The app's Firestore rules require an existing `super_admin` to grant roles. The
`grant-super-admin` script uses the Admin SDK (bypasses rules) to break this
cycle exactly once.

**a. The chosen person signs in to the deployed app ONCE.**

Because you ran the seeder with `--domains yourcompany.example`, sign-ups from
that domain are now allowed. The person visits the app URL and signs in with
Google or email link. This creates their Firebase Auth record and their `users/`
doc with `role: null`.

**b. Preview the grant (no write yet):**

```
npm run grant:super-admin -- their.email@yourcompany.example --project your-project-id
```

The script resolves the email to a Firebase UID, prints the uid/email/name and
target project, then exits without writing. Verify the output looks correct.

**c. Apply the grant:**

```
npm run grant:super-admin -- their.email@yourcompany.example --project your-project-id --confirm
```

The script sets `role: "super_admin"` and `status: "active"` on the user's
`users/` doc.

**d. The person signs out and back in.**

Firebase custom claims and role state are cached in the session token. A fresh
sign-in picks up the new role. The app will now show the super_admin interface.

Note: if the person's `users/` doc does not exist yet (sign-in hasn't happened),
the script will print an error. The person must sign in first (step a).

---

## Step 11 — Deploy the frontend to Vercel [OPERATOR]

**Option A — Connect via Vercel dashboard (recommended):**
1. Go to https://vercel.com and import the GitHub repository.
2. Vercel auto-detects the build settings from `vercel.json`:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Framework: None (SPA with rewrites handled by `vercel.json`)
3. Before the first deploy, set all six `VITE_FIREBASE_*` env vars in
   Vercel project -> Settings -> Environment Variables (use the same values as
   your `.env.local`).
4. Trigger a deploy (push to main or click "Deploy").

**Option B — Vercel CLI:**
```
npx vercel deploy --prod
```

**After Vercel deployment:**
Return to Firebase console -> Authentication -> Settings -> Authorized domains
and add your Vercel domain (e.g. `ams-yourcompany.vercel.app`). Without this,
Firebase will reject OAuth callbacks from the Vercel domain.

---

## Step 12 — Smoke-test checklist

After deployment, verify the following in order:

- [ ] Sign in as the `super_admin` user (the one from Step 10). The app
      should load and show the full admin navigation.
- [ ] Go to the asset statuses catalog (Settings -> Asset Statuses or
      equivalent). Confirm all 4 system statuses are present:
      На складе, Выдано, В ремонте, Списано.
- [ ] Go to the categories catalog. Confirm ~25 categories are listed
      (or more if `--all-categories` was used).
- [ ] Go to the branches list. Confirm 5 branches including Головной офис.
- [ ] Go to the departments list. Confirm 6 departments.
- [ ] Check Settings -> Auth / Allowed Domains. Confirm your domain is listed.
- [ ] Create a test asset. Confirm it appears in the assets list.
- [ ] Open the test asset. Confirm an entry appears in the audit log section.
- [ ] Invite a test employee (from your allowed domain) and have them sign in
      via email link. Confirm they land on the employee self-service view.

---

## Step 13 — Troubleshooting

**All sign-ups are rejected / "Your email domain is not authorized":**
The `settings/auth.allowedEmailDomains` array is empty or missing. Fix options:
- Re-run the seeder with `--domains yourcompany.example --force`.
- Or log in to the app as `super_admin` and add the domain via Settings ->
  Auth Settings (once a super_admin exists).

**"Permission denied" when writing to catalogs from the app:**
The user is not `super_admin`. Re-run Step 10 (`grant-super-admin`) and have
the user sign out and back in to refresh the role.

**Cloud Functions deploy fails with "requires Blaze plan":**
The Firebase project is on the Spark (free) plan. Upgrade to Blaze in the
Firebase console (Step 2).

**Queries fail / "index required" errors in the app:**
Composite indexes are still building after `deploy:all`. Wait 5-10 minutes.
To re-deploy indexes only: `npm run deploy:indexes`.

**`grant-super-admin` says "No Firebase Auth user found":**
The target person has not signed in to the app yet. Have them complete Step 10a
first (sign in once to create their Auth record), then re-run the grant.

**`seed` fails with "No project id":**
Pass `--project your-project-id`, or set `GOOGLE_CLOUD_PROJECT=your-project-id`
in your shell, or run `npx firebase use --add` first (Step 5) so `.firebaserc`
holds the real project id.

**`seed` fails with ADC / credential error:**
Run `gcloud auth application-default login` (Option A in Step 7), or set
`GOOGLE_APPLICATION_CREDENTIALS` to a service-account key path (Option B).
