# License Module — Sub-plan B: Reveal Cloud Function

> Use superpowers:subagent-driven-development. Depends on Sub-plan A.

**Goal:** A callable Cloud Function `revealLicenseKey({ collection, licenseId })` that is the ONLY path to a raw key: verifies super_admin via server-trusted role lookup, reads `secrets/current.key`, writes a MASKED `key_revealed` audit entry in the SAME write as the read acknowledgement, returns the raw key to the caller.

**Architecture:** Mirrors `functions/src/auth/beforeCreate.ts` (Admin SDK, pure testable core). The function lives in `functions/` and uses `firebase-admin/firestore`.

## ARCHITECTURAL DECISION (from Sub-plan A security review, Finding 2)

The secrets sub-collection is `allow read, write: if false` for ALL client SDK callers.
Therefore the client repos CANNOT write `secrets/current` — a client-side secret write
would be rejected and abort the transaction. **All secret WRITES must go through a
callable Cloud Function (Admin SDK bypasses rules), exactly like reveals.**

**Decision (security-first, spec-aligned):** secret writes move server-side. We add a
second callable `setLicenseKey({ collection, licenseId, rawKey })` (Task B3). The client
Firestore repos write the license DOC (no key) + masked audit entry as today; when a
`rawKey` is supplied, the calling layer (page/service) makes a follow-up `setLicenseKey`
call to persist the secret + its own masked `key_rotated`/`created`-key audit entry.

**Tradeoff (flagged to owner):** the doc-write and secret-write are no longer one
Firestore transaction. Each step is individually audited and individually atomic; a
crash between them leaves a license doc with no secret (recoverable — the user re-enters
the key). The hard invariant "no client can ever write a secret" wins over single-txn
atomicity. The Firestore repos' direct `secrets/current` writes from Sub-plan A are
therefore DEAD in production — Task B4 removes them from the client repos (the InMemory
repos keep their in-process secret map for tests).

---

### Task B1: Pure mask helper for functions

**Files:** Create `functions/src/licenses/maskKey.ts`; Test `functions/src/licenses/maskKey.test.ts`

> The functions workspace is a separate package and cannot import `src/lib/audit`. Re-implement the SAME mask algorithm here (single small pure function) to keep parity. A test asserts the canonical example.

- [ ] **Step 1: test** — `maskKey('XCVF-7TR5-9HJK-5592') === '****-****-****-5592'`, short-key and no-separator cases.
- [ ] **Step 2: implement** identical algorithm to `src/lib/audit/maskSecrets.ts::maskLicenseKey` (last-4 alnum kept, separators preserved). Return plain `string`.
- [ ] **Step 3: PASS. Commit** `feat(functions): license key mask helper`

---

### Task B2: revealLicenseKey callable

**Files:** Create `functions/src/licenses/revealLicenseKey.ts`; Test `functions/src/licenses/revealLicenseKey.test.ts`; Modify `functions/src/index.ts`

- [ ] **Step 1: Pure testable core** `assertSuperAdmin(uid, db)` reads `users/{uid}.role`, throws `HttpsError('permission-denied')` unless `super_admin` (fail-closed on missing doc). Plus `revealCore({ uid, collection, licenseId }, db)` that:
  1. validates `collection in ['licenses','server_licenses']` (else `invalid-argument`);
  2. `assertSuperAdmin`;
  3. reads `users/{uid}.role` for the audit `actorRole`;
  4. reads `{collection}/{licenseId}/secrets/current` → 404 `not-found` if missing;
  5. writes an `audit_logs` doc: `{ entityType: collection==='licenses'?'license':'server_license', entityId: licenseId, action: 'key_revealed', actorUid: uid, actorRole, after: { key: maskKey(raw) }, at: FieldValue.serverTimestamp() }`;
  6. returns `{ key: raw }`.

- [ ] **Step 2: Tests** with a mocked Admin Firestore:
  - non-super → throws permission-denied, NO audit write, NO key returned;
  - bad collection → invalid-argument;
  - missing secret → not-found;
  - success → returns raw key AND exactly one audit doc whose serialized form contains the MASKED key and NOT the raw key.

```ts
it('super-admin reveal returns raw, audit is masked', async () => {
  const db = makeMockDb({ role: 'super_admin', secret: 'XCVF-7TR5-9HJK-5592' })
  const res = await revealCore({ uid: 'u1', collection: 'licenses', licenseId: 'l1' }, db)
  expect(res.key).toBe('XCVF-7TR5-9HJK-5592')
  expect(JSON.stringify(db.written)).toContain('****-****-****-5592')
  expect(JSON.stringify(db.written)).not.toContain('9HJK')
})
it('non-super denied, no audit, no key', async () => {
  const db = makeMockDb({ role: 'tech_admin', secret: 'X' })
  await expect(revealCore({ uid: 'u1', collection: 'licenses', licenseId: 'l1' }, db)).rejects.toThrow()
  expect(db.written).toHaveLength(0)
})
```

- [ ] **Step 3: Wrap** in `onCall` (`firebase-functions/v2/https`), reading `request.auth.uid` (throw `unauthenticated` if absent) and `request.data`. Export `revealLicenseKey` from `functions/src/index.ts`.
- [ ] **Step 4: `cd functions && npm run build && npx vitest run`. PASS. Commit** `feat(functions): revealLicenseKey callable (super-admin, masked audit)`

---

### Task B3: setLicenseKey callable (secret WRITE path)

**Files:** Create `functions/src/licenses/setLicenseKey.ts`; Test `functions/src/licenses/setLicenseKey.test.ts`; Modify `functions/src/index.ts`.

- [ ] **Step 1: Pure core** `setKeyCore({ uid, collection, licenseId, rawKey }, db)`:
  1. validate `collection in ['licenses','server_licenses']` else `invalid-argument`; `rawKey` non-empty string else `invalid-argument`.
  2. Role gate: for `server_licenses` require super_admin; for `licenses` require super_admin OR tech_admin (reuse a server-trusted role read of `users/{uid}.role`, fail-closed on missing). Throw `permission-denied` otherwise.
  3. Assert the parent license doc exists (`{collection}/{licenseId}`) else `not-found`.
  4. Write `{collection}/{licenseId}/secrets/current` = `{ key: rawKey, updatedAt: serverTimestamp(), updatedBy: uid }` (Admin SDK).
  5. Write one `audit_logs` entry: `{ entityType, entityId: licenseId, action: 'key_rotated', actorUid: uid, actorRole, after: { id: licenseId, key: maskKey(rawKey) }, at: serverTimestamp() }`. The raw key NEVER appears in the audit doc.
  6. Return `{ ok: true }` (never the key).
- [ ] **Step 2: Tests** (mock Admin db): non-privileged role → permission-denied, NO secret write, NO audit; bad collection / empty rawKey → invalid-argument; missing license → not-found; success → secret doc written with raw key, audit doc serialized contains MASKED key and NOT the raw key, return has no key.
- [ ] **Step 3: Wrap** in `onCall`, read `request.auth.uid` (throw `unauthenticated` if absent). Export `setLicenseKey` from `functions/src/index.ts`.
- [ ] **Step 4: `cd functions && npm run build && npx vitest run` PASS. Commit** `feat(functions): setLicenseKey callable (server-side secret write, masked audit)`

---

### Task B4: Remove dead client-side secret writes from the Firestore repos

**Files:** Modify `src/infra/repositories/firestoreWorkstationLicenseRepository.ts`, `src/infra/repositories/firestoreServerLicenseRepository.ts`.

- [ ] **Step 1:** In both Firestore repos, REMOVE the `txn.set(doc(...,'secrets','current'), {...})` writes from `createLicense` and `rotateKey` (they would be rejected by the deny-all rules). The repos now write only the license DOC + masked audit entry. The `rawKey`/secret is persisted separately by the `setLicenseKey` callable (the page/service orchestrates: create doc, then call setLicenseKey when a rawKey was supplied). Keep the masked-key audit `after` field on createLicense (so the create event still records that a key was set, masked).
- [ ] **Step 2:** `rotateKey` on the client repo becomes a thin no-op-doc-touch OR is removed from the client repo and callers use `setLicenseKey` directly. **Decision:** keep `rotateKey` on the InMemory repos (tests rely on it) but in the Firestore repos make `rotateKey` delegate conceptually to the callable — i.e. the Firestore `rotateKey` only bumps `updatedAt`/`updatedBy` + writes the masked audit; the secret itself is set via `setLicenseKey`. Document this in a comment. (The UI reveal/rotate flow in Sub-plan D calls `setLicenseKey` for the secret.)
- [ ] **Step 3:** typecheck clean; `npx vitest run` green (InMemory tests unaffected — they keep the in-process secret map). Commit `refactor(license): client repos stop writing secrets (CF owns secret writes)`

> NOTE: This keeps the InMemory contract intact for unit tests while making the production path honor the deny-all secrets rule. The InMemory repos simulate the secret store in-process; production uses the callable.
