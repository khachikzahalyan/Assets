# License Module (Phase 1) — Design

Date: 2026-06-19
Status: Approved (spec-driven brief; built to the canonical License spec in the AMS orchestrator doc)

## 1. Goal & boundary

Ship the License module as a first-class Phase-1 entity. Two physically separate
collections (workstation/employee licenses + global/server licenses), secrets in a
deny-all sub-collection, a callable reveal function as the only path to a raw key,
auto-decouple/retire of workstation licenses on asset write-off, and a UI that ports
the `prototypes/licenses.html` dark/orange prototype.

**Out of scope (Phase 2):** expiry alerts / badges / notifications. `expiresAt` MAY be
stored but no alerting is built. Purchase-batch / repair coupling stays untouched.

## 2. Hard invariants (from the canonical spec)

1. **Strict separation.** `WorkstationLicense` and `ServerLicense` are independent
   interfaces in independent files. NO `BaseLicense`. NO shared discriminator. The type
   system prevents assigning a `ServerLicense` to a person or asset (no `assignedTo*`
   fields exist on it).
2. **Two ports only.** `WorkstationLicenseRepository` + `ServerLicenseRepository`. Each
   owns its secret read/write/reveal as PRIVATE members. No shared secret repository.
3. **Secrets.** Keys live at `{collection}/{id}/secrets/current.key`. firestore.rules
   DENY client SDK reads of `{collection}/{id}/secrets/{...}` to ALL callers including
   super_admin. Three layers: sub-collection + rules + repository.
4. **withAudit integration.** Every mutating repo method calls `withAudit()` (one
   `audit_logs` entry per txn) and returns `AuditedResult`. There is NO public mutating
   method that skips audit.
5. **Masking.** Keys are ALWAYS masked before any `audit_logs` write. Mask format:
   preserve the LAST 4 alphanumerics, replace every other alphanumeric with `*`, preserve
   separators. `XCVF-7TR5-9HJK-5592` → `****-****-****-5592`. Implemented as
   `maskLicenseKey(raw): MaskedKey` (branded) in `src/lib/audit/maskSecrets.ts`.
   `withAudit` license-audit views type `key` as `MaskedKey` (compiler refuses raw
   objects); a runtime sanitizer re-masks defensively on every payload.
6. **Reveal flow.** Raw keys revealed ONLY via callable Cloud Function
   `revealLicenseKey({ collection, licenseId })` — verifies super_admin via
   server-trusted role lookup, reads `secrets/current.key`, writes a `key_revealed` audit
   entry (key MASKED), returns the raw key.
7. **Document shapes.** Workstation license = flat optional reference fields
   (`assignmentType: 'employee'|'device'|'unassigned'`; `assignedToEmployeeId?`,
   `assignedToAssetId?`; `isReusable`; `lifecycleStatus: 'active'|'retired'`;
   `retiredAt?`, `retiredWithAssetId?`; `expiresAt?` stored, not alerted). Repository-layer
   narrowing enforces the invariant (no `device` without `assignedToAssetId`).
8. **OEM-retire + auto-decouple on write-off.** `WriteOffAssetService` orchestrates
   `AssetRepository` + `WorkstationLicenseRepository` in ONE transaction: Computer/Laptop
   → Disposed ⇒ for each bound workstation license: `isReusable` → decouple to
   `unassigned` (audit `license_decoupled`); else RETIRE (`lifecycleStatus='retired'`,
   audit `license_retired_with_asset`). A status change leaving an orphaned
   `assignedToAssetId` is a FAIL.
9. **Un-stub asset-create license seam.** Real OEM license doc + secret written in the
   SAME transaction as the Computer/Laptop asset create; offer dropdown of FREE keys OR
   manual new-key entry.

## 3. Role matrix

- `tech_admin` + `super_admin`: manage workstation licenses (create/edit/assign/decouple).
- `super_admin` ONLY: server licenses (write), reveal key (callable CF).
- `asset_admin`, `employee`: no license management (read may be granted to admins for
  device-detail license listing; employees never read secrets).

## 4. Architecture (ports & adapters, mirrors existing repos)

```
src/domain/license/
  WorkstationLicense.ts      interface + assignment narrowing types
  ServerLicense.ts           interface (independent, no assignedTo*)
  LicenseKey.ts              secret payload type
  LicenseAudit.ts            WorkstationLicenseAuditView / ServerLicenseAuditView (key: MaskedKey)
  WorkstationLicenseRepository.ts   port (mutations return AuditedResult; secret methods private in impls)
  ServerLicenseRepository.ts        port
  index.ts                   barrel
  *.test-d.ts                type-level tests (strict separation + MaskedKey)
src/lib/audit/maskSecrets.ts   maskLicenseKey + MaskedKey brand + runtime sanitizer
src/infra/repositories/
  inMemoryWorkstationLicenseRepository.ts  (+ test)
  firestoreWorkstationLicenseRepository.ts
  inMemoryServerLicenseRepository.ts       (+ test)
  firestoreServerLicenseRepository.ts
src/domain/services/WriteOffAssetService.ts  (+ test)
functions/src/licenses/revealLicenseKey.ts   (+ test)
src/pages/LicensesPage.tsx + src/components/features/licenses/**
```

## 5. Firestore rules (added blocks)

```
match /licenses/{id} {
  allow read: if isAnyAdmin();              // device-detail listing needs read
  allow write: if isSuperAdmin() || isTechAdmin();
  match /secrets/{s} { allow read, write: if false; }  // CF (admin SDK) only
}
match /server_licenses/{id} {
  allow read: if isAnyAdmin();
  allow write: if isSuperAdmin();
  match /secrets/{s} { allow read, write: if false; }
}
```
(audit_logs create rule already allows the new entity types — `entityType is string` shape.)

## 6. Composite indexes

- `licenses`: `assignmentType ASC, assignedToAssetId ASC` (device-license query)
- `licenses`: `lifecycleStatus ASC` + assignable-pool ordering
- `licenses`: `assignmentType ASC, lifecycleStatus ASC` (free-pool: unassigned+active)

## 7. Audit extensions

`AuditEntityType` add `server_license` (license already present).
`AuditAction` add `key_revealed`, `license_decoupled`, `license_retired_with_asset`,
`assigned`/`returned` reused where they fit, plus `key_rotated`.

## 8. Sub-plans (sequential within this run, feature branch)

- **A** Domain + masking + repos (InMemory+Firestore) + rules + indexes + type-level tests.
- **B** Reveal Cloud Function + functions vitest.
- **C** WriteOffAssetService + un-stub asset-create OEM seam.
- **D** UI (licenses page, create/edit/assign, reveal action, history) + i18n + nav un-stub.

Each sub-plan: implementers gated by test-engineer, then spec-reviewer →
code-quality-reviewer → security-reviewer. Commit per task. Owner merges to master.

## 9. Testing strategy

- InMemory adapters drive unit/component tests (production Firestore + CF paths = real impl).
- Type-level `*.test-d.ts` for strict separation + `MaskedKey` brand (raw key refused).
- Rules tests authored for CI (Java/emulator unavailable locally).
- Functions have their own vitest (reveal: super-admin gate, masked audit, raw return).
- Baseline 388 tests must stay green; all additions are additive.
