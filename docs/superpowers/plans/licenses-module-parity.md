# Plan — Licenses Module Parity (prototype → production React)

Migrate `/licenses` so the production React page reaches full visual + logic parity with
`C:/Users/DELL/Desktop/Warehouse/prototypes/licenses.html`, while preserving the existing
audited/secret-gated architecture (NO new Cloud Functions; secrets read/written directly,
gated by deployed firestore.rules).

## Prototype shape (source of truth)
Two tabs in a tab strip (count chips), with a right-aligned search (keys tab only) + primary
"Добавить лицензию" button:

1. **Windows-ключи** — table: Ключ продукта (mono), Версия, Статус chip (Используется blue /
   Свободен green), Актив (in_use → name + invCode; free → prevAssetName + "Освобождён DATE"),
   Действие (free rows → "Активировать"). Filter chips (Используется / Свободен) with counts,
   fixed 56px rows, 10/page pagination, placeholder rows to keep block height constant.
   Row click → **Key Details modal** (Microsoft 4-square logo, key + copy button, "История
   использования" timeline: current asset "Сейчас" + previous entries). Activate button →
   **Activate Key modal** (key summary + searchable target-asset radio picker → activates key
   onto a keyless OEM-capable asset).

2. **Подписки и ПО** — responsive grid of **subscription cards**: name + "Истекает через N дн."
   amber badge when ≤10 days, vendor email, **SeatBar** (used/total, emerald/amber/rose),
   Куплено/Истекает dates, assignee count + "Детали" → **Manage Assignees modal** (searchable
   employee list, toggle select, avatars). Add → **Add License modal** (name, vendor email,
   seats total, purchase + expiry DatePopover, employee multi-select).

## Architecture mapping (reuse, don't reinvent)
- **Windows keys ARE workstation licenses.** Drive the keys table from the existing
  `WorkstationLicenseRepository.listLicenses()`. Mapping:
  - `productKey` = masked key from `maskLicenseKey` of the secret (display only) — full key only
    on reveal/copy via `getLicenseSecretKey` (rules: super_admin|tech_admin).
  - `version` = license `name` (e.g. "Windows 11 Pro").
  - `status`: `in_use` ⇔ `assignmentType === 'device'` & `lifecycleStatus === 'active'`;
    `free` ⇔ `assignmentType === 'unassigned'` & `lifecycleStatus === 'active'`.
  - Activate = `assignLicense(id, { to:'device', assetId }, actor)` (audited). Target pool =
    assets whose category `hasOemLicense` and that have no in-use license (via AssetRepository +
    listForAsset / listLicenses).
  - Key Details "history" = audit_logs for that license (`assigned` / `created` / `key_rotated`),
    rendered as a timeline. Keys in audit payloads are already masked — never unmask in history.
- **Subscriptions are NEW.** New collection `/subscriptions`, domain type + port + Firestore
  audited adapter + in-memory adapter + rules. Assignees are employee ids.

## Domain / data changes (firebase-engineer)
1. `src/domain/audit/types.ts` — extend `AuditEntityType` with `'subscription'`; extend
   `AUDIT_ACTIONS` with `'activated'`, `'subscription_created'`, `'subscription_updated'`,
   `'subscription_assignees_changed'`. (Adding to a union + const array; no removals.)
2. NEW `src/domain/subscription/` — `Subscription.ts` (id, name, vendorEmail|null, seatsTotal,
   assignedEmployeeIds:string[], purchaseDate:string|null, expiryDate:string|null, createdAt,
   updatedAt, createdBy, updatedBy; `seatsUsed` is DERIVED = assignedEmployeeIds.length, not
   stored), `SubscriptionRepository.ts` port (listSubscriptions, getSubscription,
   createSubscription, updateAssignees — all mutators audited → AuditedResult), barrel `index.ts`.
3. NEW `src/infra/repositories/firestoreSubscriptionRepository.ts` (withAudit, serverTimestamp,
   stripUndefined; seatsUsed derived on read). NEW `inMemorySubscriptionRepository.ts` for tests.
   Export both from `src/infra/repositories/index.ts`.
4. `firestore.rules` — add `match /subscriptions/{id}`: read `isAnyAdmin()`; write
   `isSuperAdmin() || isTechAdmin()` (licenses are tech_admin-managed per nav allow list).
   No secrets sub-collection (subscriptions have no product key in the prototype). Add a
   `tests/rules` spec. Do NOT loosen any existing block.
5. Add `revealLicenseKeyMasked` helper? NO — reuse `getLicenseSecretKey`. For the keys table we
   need a masked display without a full reveal; add `src/lib/licenses/maskedKey.ts`
   `getMaskedLicenseKey(db, col, id)` = `getLicenseSecretKey` → `maskLicenseKey` (returns '—'
   when absent). This does a read but returns ONLY the masked value to the table (full key still
   requires the explicit reveal/copy action, which itself is rules-gated + the copy is the reveal).

## UI changes (react-ui-engineer)
Component tree under `src/components/features/licenses/`:
- `LicensesPage.tsx` (rewrite) — PageHeader + tab strip (Windows-ключи / Подписки и ПО with
  counts) + keys-search + primary "Добавить лицензию" (only meaningful for subscriptions; on the
  keys tab the create button is hidden or routes to subscription-add per prototype — prototype
  shows the add button on BOTH tabs and it always opens AddSubscription, so keep that).
- `WindowsKeysSection.tsx` — filter chips, table, pagination, ActivateKeyModal, KeyDetailsModal.
- `KeyDetailsModal.tsx` — MS logo, key + copy (copy triggers reveal via getLicenseSecretKey →
  full key; super_admin|tech_admin only; non-privileged sees masked + disabled copy), timeline.
- `ActivateKeyModal.tsx` — searchable keyless-OEM-asset radio picker → assignLicense device.
- `SubscriptionsSection.tsx` + `SubscriptionCard.tsx` + `SeatBar.tsx`.
- `ManageAssigneesModal.tsx` — searchable employee toggle list (audited updateAssignees).
- `AddSubscriptionModal.tsx` — fields + DatePopover + EmployeeMultiSelect.
- `DatePopover.tsx` — port the prototype calendar (RU months/weekdays, min, presets, portal).
- `EmployeeMultiSelect.tsx` — portaled searchable multi-select with avatar stack.
- Helpers: `formatLicenseDate` (exists), `daysUntil`, `pluralEmp`, `initialsOf`, `avatarColorFor`.
- KEEP existing components used by AssetCreateForm/detail (LicensePicker, RevealKeyButton,
  WorkstationLicenseTable, ServerLicenseTable, LicenseFormDialog, AssignLicenseDialog,
  LicenseHistory) — they are imported elsewhere; do not delete. Re-export what's still used.

Visual tokens: dark `#1B1F24` cards, `#2A2F36` borders, orange `#F97316/#FB923C` accent, Chip
palette, SectionCard, Btn, EmptyState — all already exist in `@/components/ui`.

## i18n (i18n-engineer) — RU ONLY
Extend `src/locales/ru/licenses.json` with: tab labels (Windows-ключи / Подписки и ПО), keys
table columns + statuses + filters + "Активировать" + "Освобождён", Key Details modal strings,
Activate modal strings, subscription card strings (Места, Куплено, Истекает, Истекает через N
дн., Сотрудники, не назначены, Детали), Manage Assignees + Add Subscription modal strings,
pluralization handled in code. Do NOT touch en/hy.

## Tests (test-engineer, after each implementer)
- subscription in-memory repo (CRUD + assignees + audit emitted).
- firestore rules: subscriptions read/write role matrix; audit_logs immutability unchanged.
- WindowsKeysSection: filter chips switch, status mapping, activate calls assignLicense,
  row-click opens details, masked display, free rows show Активировать.
- KeyDetailsModal: copy reveals via injected revealFn; non-privileged hides copy.
- SubscriptionCard/SeatBar: seat ratio + expiry badge thresholds.
- ManageAssigneesModal: toggle + search + calls updateAssignees.
- AddSubscriptionModal: validation gates submit; DatePopover min.
- LicensesPage: tab switching, role gating (tech_admin sees both tabs per nav allow).

## Reviews
spec-reviewer → code-quality-reviewer → security-reviewer (secrets, rules, audit immutability,
no key leakage to audit/history, role gating both client + rules).

## DoD
`npm run typecheck` exit 0; `npm run build` exit 0; full `npm run test` no NEW failures vs the
baseline (4 known flaky timeouts: AssetsPage.test, AuditPage.test, AssetsPage.parity.test,
AssetCreateForm.freekey.test — all pass in isolation). Visual parity on dark theme.
