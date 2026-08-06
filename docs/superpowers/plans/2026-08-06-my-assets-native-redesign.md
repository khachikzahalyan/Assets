# «Мои активы» — Native Redesign (self-service) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **NO GIT OPERATIONS** — owner forbade `git add/commit/push` in this session. Verification is `npm test -- --run` + `npm run build` only.
> **Unrelated dirty files in tree** (`SpecsPanel.tsx`, `specSuggestions.ts`, parts/dashboard/locales) — DO NOT touch or revert.

**Goal:** Rebuild `MyAssetsPage` as a native-looking composition of EXISTING components (approved layout A-light: profile header → 2 compact StatCards → pending-confirmation section → asset list → my subscriptions), plus a security-scoped Firestore read path for employee's own subscriptions.

**Architecture:** Phase A is pure UI on existing data (`subscribeAssetsForEmployee`, HR record load as in `ProfilePage`). Phase B adds `listSubscriptionsForEmployee` (array-contains query) to the subscription port/adapters and a fail-closed self-scope read rule in `firestore.rules` using the existing `myEmployeeId()` / terminated-guard helpers.

**Tech Stack:** React 19 + Vite + TS strict, i18next (ns `employees`, keys `self.*`; ns `licenses` for subs), Firestore modular SDK, `@firebase/rules-unit-testing`.

**Reuse inventory (verified in code, 2026-08-06):**
- `PageHeader`, `SectionCard`, `Chip`, `EmptyState`, `ErrorState`, `Icon`, `Field` — `@/components/ui`.
- `Avatar` — `src/components/ui/avatar.tsx`, takes `{ initials, avatarColor }`; `useAuth().user` already carries both. THIS is the avatar recipe — do not hand-roll.
- `StatCard` variant `compact` — `src/components/features/dashboard/StatCard.tsx` (accepts `value: number | null`, `accent`, optional `to`).
- Asset row pattern — already implemented inside `MyAssetsPage` (category icon box + `resolveCategoryColor` + inv-code mono + brand/model + status `Chip`). Keep as-is, extract to a local `AssetRow` sub-component inside the page file.
- `SubscriptionCard` — `src/components/features/licenses/SubscriptionCard.tsx`; needs a `readOnly` mode (hide «Details»/manage affordance, no `ManageAssigneesModal`, `employees` not needed).
- HR load pattern — `ProfilePage.tsx`: `repo.getEmployee(user.employeeId ?? user.id)` + `loadSelfServiceRefData()` branch/dept maps; best-effort (`catch` → hide subtitle).
- `confirmReceipt` — `src/lib/notifications/confirmReceipt.ts` — DO NOT touch logic; move the button markup into the pending section unchanged.
- `canAccess(role, 'assets')` — row click gating, already present.

**Page skeleton (target JSX order, all inside `div.space-y-5`):**
1. `PageHeader icon="package" title=t('self.myAssets') className="max-md:hidden"` (unchanged chrome).
2. Profile header row (NOT a new global component — local block in the page): `Avatar` (size lg) + name (`user.name`) + `Chip` with role label + subtitle `branch · dept · position` from HR record; subtitle silently absent when HR record/ref missing.
3. Counters grid `grid grid-cols-2 gap-4` (mirror dashboard row-2): `StatCard variant="compact" accent="blue" icon="package"` «На руках» = assets where `statusId !== ASSET_STATUS.disposed`; second card `accent="amber" icon="clock"` «Ожидает подтверждения» = pending count, rendered ONLY if pending > 0.
4. `SectionCard title=t('self.needsConfirmation') icon="clock"` — only if pending > 0; rows = pending assets + existing confirm button.
5. `SectionCard title=t('self.myProperty')` with count in header (pattern: append ` · N` or use existing SectionCard actions slot as neighbors do) — non-pending, non-disposed assets. No search/grid/pagination. Row clickable → `/assets/:id` only when `canAccess(role,'assets')`.
6. `SectionCard title=t('self.mySubscriptions') icon="boxes"` — Phase B data; hidden entirely while subs empty (per approved design: скрыть или тихий EmptyState — choose HIDE). Grid `grid-cols-1 md:grid-cols-2` of read-only `SubscriptionCard`.
7. Empty assets → existing `EmptyState icon="package" title=t('self.noAssets')` inside section 5; header + «На руках: 0» stay.

**i18n keys (ns `employees`, block `self`, ru/en/hy):** `onHand` «На руках», `pendingConfirmation` «Ожидает подтверждения», `needsConfirmation` «Требует подтверждения», `myProperty» «Моё имущество», `mySubscriptions` «Мои подписки». Alphabetical insertion into existing `self` block, all three locales.

---

## PHASE A — UI (react-ui-engineer → test-engineer)

### Task A1: MyAssetsPage recomposition

**Files:**
- Modify: `src/pages/self-service/MyAssetsPage.tsx`
- Modify: `src/components/features/licenses/SubscriptionCard.tsx` (add optional `readOnly?: boolean`; when true: no `ManageAssigneesModal` import path executed, «Details» button hidden, `employees`/`onUpdateAssignees` become optional props — keep existing callers type-compatible)
- Modify: `src/locales/{ru,en,hy}/employees.json` (5 keys above)
- Test: `src/pages/self-service/MyAssetsPage.test.tsx` (extend existing suite)

- [ ] Load HR record best-effort alongside existing subscription (`getSharedEmployeeRepository().getEmployee(employeeDocId)` + branch/dept from already-loaded `loadSelfServiceRefData()` — NOTE: `SelfServiceRefData` already contains `branches`/`departments`, no extra fetch needed; catch → `null`).
- [ ] Render blocks 1–5,7 per skeleton above; pending rows excluded from «Моё имущество».
- [ ] Skeleton state: keep the existing skeleton approach; add compact placeholders for the header/counters rows following ProfilePage skeleton conventions (exact footprint, `anim-skeleton`, async-only shimmer, parent-level granularity).
- [ ] Update tests: pending asset appears in «Требует подтверждения» and NOT in «Моё имущество»; counters correct; amber card absent when no pending; employee row not clickable / admin row navigates; confirm button flow unchanged (existing tests must stay green).
- [ ] Run `npm test -- --run src/pages/self-service` → PASS; `npm run build` → PASS.

## PHASE B — Subscriptions self-scope (firebase-engineer → test-engineer → reviews)

### Task B1: Repo port + adapters

**Files:**
- Modify: `src/domain/subscription/SubscriptionRepository.ts` — add `listSubscriptionsForEmployee(employeeDocId: string): Promise<Subscription[]>`
- Modify: `src/infra/repositories/firestoreSubscriptionRepository.ts` — `query(collection(db,'subscriptions'), where('assignedEmployeeIds','array-contains', employeeDocId))`; sort client-side by `name.localeCompare(ru)`. NO orderBy → no composite index needed (`firestore.indexes.json` untouched).
- Modify: `src/infra/repositories/inMemorySubscriptionRepository.ts` — filter by `assignedEmployeeIds.includes(id)`.

### Task B2: firestore.rules self-scope read

**Files:**
- Modify: `firestore.rules` `/subscriptions/{id}` block — ADD an OR-arm to `allow read` (write rules untouched):

```
allow read: if isSuperAdmin() || isTechAdmin()
  || (
    isSignedIn()
    && userDoc().get('status', '') != 'terminated'
    && (request.auth.uid in resource.data.assignedEmployeeIds
        || myEmployeeId() in resource.data.assignedEmployeeIds)
  );
```

Secure-list rationale: a client list query MUST carry `array-contains <uid|myEmployeeId>` to be provable; unconstrained list stays DENY. Mirrors `isSelfEmployee` semantics (terminated guard) without requiring a doc-id match. Do NOT deploy.

### Task B3: Rules tests

**Files:**
- Modify/Create in `tests/rules/` (follow existing harness): employee with linked `employeeId` reads own subscription via array-contains query → ALLOW; get of own sub → ALLOW; get of foreign sub → DENY; unconstrained list as employee → DENY; terminated user → DENY; asset_admin read → DENY (unchanged from today); tech/super read → ALLOW.
- Run `npm run test:rules` (storage part fails on Java 25 — known, not ours).

### Task B4: Wire «Мои подписки» into the page

**Files:**
- Modify: `src/pages/self-service/MyAssetsPage.tsx` — best-effort `getSharedSubscriptionRepository().listSubscriptionsForEmployee(employeeDocId)` (catch → `[]`, section hidden); optional `subscriptionRepo?: SubscriptionRepository` prop for tests (mirror `LicensesPage`).
- Test: extend `MyAssetsPage.test.tsx` with `InMemorySubscriptionRepository` seed — sub with me → section renders card read-only (no manage button); no subs → section absent; repo throws → section absent, page fine.

## Reviews & Verification
- spec-reviewer → code-quality-reviewer → security-reviewer (MANDATORY — rules diff).
- `npm test -- --run` (targeted dirs) + `npm run build` (tsc -b) green. `npm run test:rules` firestore part green.
- No FLUSH_ROUTES change. No deploy. No git.
