# License Module — Sub-plan B: Reveal Cloud Function

> Use superpowers:subagent-driven-development. Depends on Sub-plan A.

**Goal:** A callable Cloud Function `revealLicenseKey({ collection, licenseId })` that is the ONLY path to a raw key: verifies super_admin via server-trusted role lookup, reads `secrets/current.key`, writes a MASKED `key_revealed` audit entry in the SAME write as the read acknowledgement, returns the raw key to the caller.

**Architecture:** Mirrors `functions/src/auth/beforeCreate.ts` (Admin SDK, pure testable core). The function lives in `functions/` and uses `firebase-admin/firestore`.

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
