# Plan — License keys without Cloud Functions (free / no-Blaze)

## Goal
Make license KEYS work without Cloud Functions. Store/read the raw key secret directly in
Firestore at `licenses/{id}/secrets/current`, gated by `firestore.rules`. Reveal + copy read
it directly. Deploy the updated rules (free; only Functions need Blaze).

## Decisions (no clarification needed)
- **Secret path**: `licenses/{id}/secrets/current` = `{ key, updatedBy, updatedAt }` (unchanged
  path; keep the architecture's "secret lives in a sub-collection" invariant).
- **Gate** (client + rules): `super_admin` OR `tech_admin` — matches `canManageLicense` in
  `AssetDetailPage` (`role === 'super_admin' || role === 'tech_admin'`). DENY asset_admin /
  employee / unauthenticated.
- **server_licenses secrets stay super-admin-only** for read+write (server license DOCS are
  already super-admin-write-only; tech_admin can't manage them). This is stricter than
  `/licenses` and is intentional.
- **Display still masks**: `maskLicenseKey` (last-4). Raw key only reaches the clipboard on copy.
- **Audit**: setting/rotating a key is an audited write (masked `key` in `audit_logs` via
  `sanitizeLicenseAuditPayload` + existing `key_rotated` action). audit_logs immutability untouched.
- **Cloud Functions left in repo but unused** by the app for keys. `revealLicenseKey`/`setLicenseKey`
  callables in `src/lib/licenses/revealKey.ts` are replaced by direct-Firestore helpers with the
  SAME function signatures, so all call sites + injected test stubs keep working.
- No Java locally → emulator rules tests cannot run here. Update `tests/rules/licenses.rules.test.ts`
  to the new posture (will run in CI / on a Java machine via `npm run test:rules`) AND do a careful
  manual security review, stated explicitly in the report.

## Files

### firebase-engineer
1. `src/lib/licenses/licenseSecrets.ts` (NEW) — shared, framework-agnostic helpers:
   - `setLicenseSecretKey(db, collection, licenseId, rawKey, actor)` — direct
     `setDoc(doc(db, collection, licenseId, 'secrets', 'current'), { key, updatedBy, updatedAt: serverTimestamp() })`
     PLUS an audited masked `key_rotated`/`key_set` entry via `withAudit` + `firestoreAuditContext`
     (masked through `sanitizeLicenseAuditPayload`). One audit entry per set.
   - `getLicenseSecretKey(db, collection, licenseId): Promise<string | null>` — direct
     `getDoc`; returns `data.key` or `null` when the secret doc is absent.
2. `src/lib/licenses/revealKey.ts` (REWRITE) — keep `revealLicenseKey(collection, licenseId)` and
   `setLicenseKey(collection, licenseId, rawKey)` signatures, but implement via the new helpers and
   `db()` / current user. `revealLicenseKey` → `getLicenseSecretKey`; `setLicenseKey` →
   `setLicenseSecretKey`. (Actor for `setLicenseKey` derived from `auth().currentUser`; if absent,
   write without audit-actor is impossible → throw, caller already try/catches.)
   - Update `src/lib/licenses/revealKey.test.ts` to the direct-Firestore implementation (mock
     `firebase/firestore` getDoc/setDoc; drop `httpsCallable` expectations).
3. `firestore.rules` — replace the `/licenses/{id}/secrets/{s}` block:
   ```
   match /secrets/{s} {
     allow read, write: if isSuperAdmin() || isTechAdmin();
   }
   ```
   Leave `/server_licenses/{id}/secrets/{s}` as super-admin-only:
   ```
   match /secrets/{s} {
     allow read, write: if isSuperAdmin();
   }
   ```
   Everything else in the file stays byte-for-byte identical.
4. `tests/rules/licenses.rules.test.ts` — flip the `/licenses/{id}/secrets` cases:
   super_admin CAN read+write; tech_admin CAN read+write; asset_admin / employee / unauth CANNOT.
   `/server_licenses/{id}/secrets`: super_admin CAN read+write; tech_admin / asset_admin / employee
   / unauth CANNOT.

### react-ui-engineer
5. `src/components/features/assets/detail/LicenseBlock.tsx`:
   - Copy gate: show «Копировать» for non-OEM bound license when `role === 'super_admin' ||
     role === 'tech_admin'` (was super-only).
   - «Задать ключ»: when bound license is **non-OEM (Retail)**, `canManage`, AND no stored secret,
     render a «Задать ключ» affordance (small inline input + save) that calls a new
     `onSetKey(licenseId, rawKey)` prop (wired in `AssetDetailPage` to the shared helper). After a
     successful set, the key + «Копировать» work. To detect "no stored secret", attempt the reveal
     lazily on demand (copy/задать); the empty state is shown until a key is known. Simplest: render
     «Задать ключ» whenever Retail + canManage + no key revealed yet AND a probe read returned null.
     Implementation detail left to the engineer; OEM-digital NEVER gets a key affordance.
6. `src/pages/AssetDetailPage.tsx`:
   - Pass `canManage={canManageLicense}` down to the bound-license copy/set path (LicenseBlock
     already receives `canManage` via TechSpecsCard? verify — wire `onSetKey`).
   - `onSetKey` handler → `setLicenseKey('licenses', id, rawKey)` (or injected `onPersistOemSecret`),
     then `await load()`.
   - Existing `onAttachLicense` `new-key` branch already calls `setLicenseKey` — keep; now it writes
     directly to Firestore (no function). No code change needed beyond the helper rewrite.

### i18n-engineer
7. `src/locales/ru/assets.json` `detail.license` — add:
   - `"setKey": "Задать ключ"`, `"setKeyPlaceholder": "Введите лицензионный ключ"`,
     `"setKeySave": "Сохранить"`, `"setKeyCancel": "Отмена"`, `"setKeyFailed": "Не удалось сохранить ключ"`.
   RU only. No en/hy.

### test-engineer (after each implementer)
- Unit: `setLicenseSecretKey` then `getLicenseSecretKey` returns the raw key (mock firestore).
- Unit: copy path reveals + writes to clipboard, display masks.
- Component: «Задать ключ» appears only for keyless Retail + canManage; never for OEM; after set,
  «Копировать» renders.
- Rules test file updated (runs under emulator/CI only).

## Verify
- `npm run typecheck` → 0
- `npm run build` → 0
- `npm run test` → no NEW failures vs baseline (118 files / 1157 green; verify flaky timeouts in isolation)
- Deploy: `npx firebase deploy --only firestore:rules` → report CLI summary.

## Rollback
- Rules: redeploy previous `firestore.rules` (git has it). Helpers: revert `revealKey.ts` to the
  callable version. No data migration — secret docs written under new rules are forward-compatible.
