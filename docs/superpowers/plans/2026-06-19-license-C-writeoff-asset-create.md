# License Module — Sub-plan C: WriteOffAssetService + un-stub asset-create OEM seam

> Use superpowers:subagent-driven-development. Depends on Sub-plans A & B.

**Goal:** (1) `WriteOffAssetService` decouples/retires bound workstation licenses in the SAME transaction as a Computer/Laptop → Disposed status change. (2) Retire the asset-create LICENSE STUB SEAM: real OEM license doc + secret written in the asset-create transaction, with a UI affordance to pick a FREE key or enter a new one.

---

### Task C1: WriteOffAssetService (domain service)

**Files:** Create `src/domain/services/WriteOffAssetService.ts`; Test `src/domain/services/WriteOffAssetService.test.ts`

**Invariant:** for each workstation license bound to the asset (assignmentType `device`, assignedToAssetId === assetId, lifecycleStatus active): `isReusable` → decouple to unassigned (audit `license_decoupled`); else RETIRE (`lifecycleStatus='retired'`, `retiredAt`, `retiredWithAssetId=assetId`, audit `license_retired_with_asset`). The asset status flips to Disposed. No orphaned `assignedToAssetId` may remain.

- [ ] **Step 1: Failing tests** with InMemory asset + workstation-license repos:
  - asset with 1 reusable + 1 OEM(non-reusable) device license → after writeOff: asset status `st_disposed`; reusable license → unassigned + `license_decoupled` audit; OEM → retired + `license_retired_with_asset` audit; zero licenses still pointing at the asset.
  - asset with no licenses → just status change.
- [ ] **Step 2: Implement** a service class taking the two repos (constructor injection). It calls `licenseRepo.listForAsset(assetId)`, branches per `isReusable`, then `assetRepo.changeStatus(assetId, 'st_disposed', actor, { comment })`. (InMemory adapters each own their own audit txn; the production Firestore note below documents the single-txn requirement.)
- [ ] **Step 3: PASS.** Add a doc comment: in the Firestore impl these run inside one `runTransaction`; the InMemory test verifies the orchestration + invariant (no orphan). **Commit** `feat(license): WriteOffAssetService (decouple/retire on dispose)`

> NOTE for the implementer: the production single-`runTransaction` wiring is a thin Firestore-specific orchestrator that reuses the repo secret/doc helpers. If the existing asset `changeStatus` already opens its own txn, expose a transaction-aware variant or document the accepted decision (flagged to owner). The InMemory invariant test is the contract.

---

### Task C2: Wire WriteOff into asset detail "Списать" action

**Files:** Modify `src/pages/AssetDetailPage.tsx` (or its write-off handler/component); reuse C1 service.

- [ ] Replace the direct `changeStatus(..., 'st_disposed')` call for Computer/Laptop with `WriteOffAssetService.writeOff(...)`. Keep the confirm modal. Component test: confirming dispose on a Computer with a bound license decouples/retires it. **Commit** `feat(license): asset write-off auto-decouples licenses`

---

### Task C3: Un-stub asset-create OEM seam (repos)

**Files:** Modify `src/domain/asset/AssetRepository.ts` (CreateAssetInput.oemLicense), `src/infra/repositories/firestoreAssetRepository.ts`, `src/infra/repositories/inMemoryAssetRepository.ts`

- [ ] **Step 1:** Change `CreateAssetInput.oemLicense` from `{ keyMasked: string } | null` to `{ rawKey: string } | { existingLicenseId: string } | null`.
- [ ] **Step 2: InMemory createAsset** — when `oemLicense` present and category hasOemLicense, in the same audit unit either (a) create a new OEM workstation license (`type:'OEM', isReusable:false, assignmentType:'device', assignedToAssetId: <newAssetId>`) with rawKey → secret, audit MASKED; or (b) assign an existing license to the device. Inject a `WorkstationLicenseRepository` (or its create/assign helpers) into the asset repo, OR have the create-page orchestrate two repo calls within one InMemory store and document the production single-txn requirement.
  - **Decision (spec-aligned default):** the Firestore asset-create writes the asset doc + license doc + secret in ONE `runTransaction` (the original seam intent). InMemory mirrors by performing both writes against the same store before the audit commit. Implement a private `writeOemLicense(txn, assetId, oem, actor)` on the asset repo so both adapters share the shape.
- [ ] **Step 3: Tests:** create Computer with `oemLicense:{rawKey}` → a `licenses` doc exists bound to the asset, secret stored, asset-create audit + license-create audit both masked, asset doc has no key. Create with `existingLicenseId` → that license becomes device-bound to the new asset.
- [ ] **Step 4: PASS. Commit** `feat(license): real OEM license write in asset-create txn`

---

### Task C4: Asset-create form — OEM key affordance

**Files:** Modify `src/components/features/assets/create/AssetCreateForm.tsx` (+ any OEM sub-section)

- [ ] When category `hasOemLicense`, render an OEM section: a combobox of FREE keys (from `listAssignablePool()` filtered to OEM-eligible) with a "+ enter new key" path that captures a raw key (masked preview as the user types). Submit maps to `oemLicense:{existingLicenseId}` or `{rawKey}`. Component test for both branches. **Commit** `feat(license): asset-create OEM key picker/new-key entry`

> Per the v9.2.2 spec, OEM lives on the Asset card and is interactive in Create mode for hasOemLicense categories; masked preview below the input; raw key never read back from the server.
