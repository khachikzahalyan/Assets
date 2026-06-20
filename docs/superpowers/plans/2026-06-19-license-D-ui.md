# License Module — Sub-plan D: UI (Licenses page, create/edit/assign, reveal, history)

> Use superpowers:subagent-driven-development. Depends on Sub-plans A, B, C.

**Goal:** Port `prototypes/licenses.html` (dark/orange) into the production app: a Licenses page with workstation vs server views, create/edit/assign flows, a super-admin-only reveal-key action that calls the `revealLicenseKey` callable (masked otherwise), and full history of which assets used a key. Add i18n (ru/en/hy), un-stub the nav/route.

---

### Task D1: i18n license namespace

**Files:** Create `src/locales/{ru,en,hy}/licenses.json`; register namespace in `src/lib/i18n`.
- [ ] Keys: page title, tabs (workstation/server), columns (name, vendor, type, assignment, status, expiry), actions (create, edit, assign, decouple, reveal, rotate), masked-key label, history heading, reveal-confirm, empty/loading/error states, role-gated notices. ru is source; en + hy filled. Test: each key resolves in all three locales. **Commit** `feat(i18n): licenses namespace (ru/en/hy)`

---

### Task D2: reveal-key client helper

**Files:** Create `src/lib/licenses/revealKey.ts`; Test (mock).
- [ ] `revealLicenseKey(collection, licenseId): Promise<string>` wrapping `httpsCallable(functions(),'revealLicenseKey')`. try/catch → user-visible error via toast at call site. Test mocks the callable. **Commit** `feat(license): reveal-key client helper`

---

### Task D3: Licenses list page + workstation/server tabs

**Files:** Create `src/pages/LicensesPage.tsx`, `src/components/features/licenses/*` (LicenseTable, LicenseFilters, tab switch); export from `src/pages/index.ts`.
- [ ] Lazily construct `FirestoreWorkstationLicenseRepository` + `FirestoreServerLicenseRepository` (page-local, mirrors AssetsPage). Workstation tab visible to super+tech; server tab visible to super only (RoleGate/inline check). Columns per prototype; status/assignment chips; masked key shown by default. Component test (InMemory repos via prop injection) renders rows + hides server tab for tech_admin. **Commit** `feat(license): licenses list page with tabs`

---

### Task D4: Create / edit / assign dialogs

**Files:** `src/components/features/licenses/LicenseFormDialog.tsx`, `AssignLicenseDialog.tsx`.
- [ ] Workstation create: name, vendor, type, isReusable, optional expiresAt, optional raw key (masked preview). Assign dialog: employee | device picker → `assignLicense`. Server create (super only): name, vendor, type, environment, host, expiresAt, optional key. Decouple action with confirm. All mutations surface audit via toast. Component tests for the narrowing (device requires asset). **Commit** `feat(license): create/edit/assign dialogs`

---

### Task D5: Reveal action + key history

**Files:** `src/components/features/licenses/RevealKeyButton.tsx`, `LicenseHistory.tsx`.
- [ ] RevealKeyButton: super-admin only (RoleGate); on click calls D2 helper, shows raw key transiently (copy + auto-hide), error toast on denial. LicenseHistory: reads `listAudit`-equivalent entries for the license entityId (reuse the asset detail audit-list pattern) — shows which assets used the key (`assigned`/`license_decoupled`/`license_retired_with_asset`/`key_revealed` rows, keys masked). Component test: non-super does not see reveal button; reveal calls the helper. **Commit** `feat(license): reveal action + key history`

---

### Task D6: Un-stub nav + route

**Files:** Modify `src/config/nav.ts` (remove `'licenses'` from `PHASE_STUB_ROUTES`), `src/config/routes.tsx` (add real `/licenses` route under RoleGate `routeRoles('licenses')`), `src/pages/index.ts`.
- [ ] Remove `licenses` from `PHASE_STUB_ROUTES`; add `<Route path="/licenses" element={<RoleGate roles={routeRoles('licenses')}><LicensesPage/></RoleGate>} />`. Update `routes.test.tsx` mock to include the new repos so the router test stays green. **Commit** `feat(license): un-stub licenses route + nav`

---

### Final verification (whole feature)
- `npm run typecheck` clean
- `npx vitest run` — green, count ≥ 388 baseline + additions
- `cd functions && npm run build && npx vitest run` — green
- `npm run build` — green
- Gates per sub-plan: spec-reviewer → code-quality-reviewer → security-reviewer (CRITICAL: secrets, reveal, masking, rules deny, write-off decouple).

---

### Task D7: Asset-create OEM free-key picker (deferred from Sub-plan C)

**Files:** Modify `src/components/features/assets/create/AssetCreateForm.tsx` (replace the `// TODO(D): free-key picker` note).
- [ ] When the selected category has `hasOemLicense`, in addition to the raw-key input, render a combobox of FREE assignable OEM licenses sourced from `WorkstationLicenseRepository.listAssignablePool()` (filter to OEM-eligible / unassigned). Selecting one maps the submitted `CreateAssetInput.oemLicense` to `{ existingLicenseId }`; typing a raw key maps to `{ rawKey }`; the two are mutually exclusive (picking an existing license clears the raw-key field and vice-versa). Component test for BOTH branches (picker → `{existingLicenseId}`, raw → `{rawKey}`). Inject the license repo (prop with a Firestore default, mirroring the page pattern) so the test uses InMemory. **Commit** `feat(license): asset-create free-key picker (existingLicenseId branch)`
