# Feature Spec — Запчасти (Parts / Spare-Parts Inventory)

Status: Phase 1 (MVP) · Confirmed 2026-06-23
Route: `/parts` · Nav id `parts` · Roles: `super_admin`, `asset_admin`, `tech_admin`
Prototype source of truth: `Warehouse/prototypes/parts.html` (4665 lines) + `Warehouse/prototypes/_shared/mock-data.js`

## 1. One-liner

A spare-parts warehouse + installed-base manager. Admins track stock of replaceable
components (PSU, coolers, SSD/HDD/M.2, RAM, GPU) as catalog SKUs, record every
movement (receive / install / uninstall / scrap / return) through an immutable
journal, and install/replace/dismount components on real assets — keeping each
asset's `upgradeCurrent` hardware snapshot in lock-step with stock, all in one
transaction.

## 2. Confirmed scope decisions

- **Q1 — MVP breadth: FULL parity with the prototype.** Both tabs (Склад / Устройства),
  movement journal, install / replace / dismount with slot logic, service records,
  GPU CRUD, broken-unit accounting, mobile adaptation.
- **Q2 — Data model: EVENT-SOURCED (like the prototype).** Two collections:
  `parts` (SKU catalog) + `part_movements` (the journal). Stock is COMPUTED from
  movements; an install both appends a movement AND mutates the asset's
  `upgradeCurrent`, atomically.
- **Q3 — Data source: FULL repository stack.** Domain types + `PartRepository` port +
  Firestore adapter + in-memory adapter + factory + hook. Production runs on Firestore;
  tests run on in-memory.

### Owner decisions (no user fork — defaults follow existing conventions)

- **Audit enum extension** — additive, non-breaking. New `AuditEntityType`: `part`,
  `part_movement`. New `AuditAction`s: `part_received`, `part_installed`,
  `part_uninstalled`, `part_scrapped`, `part_returned`, `gpu_created`. Mirrors the
  precedent of `license_decoupled` / `subscription_created` already in the enum.
- **Role gate** — `super_admin | asset_admin | tech_admin`, exactly as the prototype
  `ADMIN_NAV` declares for the `parts` item. `employee` has no access.

## 3. Domain vocabulary

- **Part / SKU (запчасть / артикул)** — a catalog entry for a replaceable component
  TYPE (e.g. "Kingston 16 ГБ DDR4-3200" RAM). Identified by `id`. Carries
  `category`, `unit` (`'шт'`), `lowStockThreshold`, and a denormalised
  `{ onHand, broken }` snapshot that is RECOMPUTED from movements on every write.
- **Movement (движение)** — one journal event. `type ∈ { 'receive', 'install',
  'uninstall', 'service' }`. Append-only. The journal is the source of truth for stock.
  - `receive` → +qty to `onHand` (supply delivery).
  - `install` → −qty from `onHand` (consumed into an asset).
  - `uninstall` + `broken === false` → +qty back to `onHand` (working part returned to shelf).
  - `uninstall` + `broken === true` → stock unchanged (scrapped; audit tail only).
  - `service` → SKU-less maintenance event for a device (laptop/AIO sent to external
    service centre). Carries `kindId` / `kindLabel` (repair, cleaning, diagnostics,
    replacement, other), `skuId === ''`, stock untouched. Audit action `part_serviced`.
    Per-prototype-parity (parts.html service-record flow); included under the
    "full parity" scope decision.
- **Stock invariant** — `onHand = Σ receive − Σ install + Σ (uninstall where !broken)`.
  `broken` count = running tally of units flagged broken on the SKU (seeded + scrap events).
  **Working stock** displayed in UI = `max(0, onHand − broken)`.
- **Part category (категория запчасти)** — `psu | cooler | ssd | hdd | nvme | ram | gpu`.
  `SINGLE_SLOT_CATS = { psu, cooler, gpu }` (asset can hold at most one).
  `CATEGORY_TO_SLOT`: `{ ssd, hdd, nvme } → 'storage'`, `ram → 'ram'`, `psu → 'psu'`,
  `cooler → 'cooler'`, `gpu → 'gpu'`. Categories sharing a slot compete as replace targets.
- **Parts-asset (устройство в разделе запчасти)** — the read-model projection of an
  upgradeable asset (`UPGRADEABLE_CATEGORIES` = Computer / Laptop / Server). Shape:
  `{ id: invCode, assetId, categoryId, kind, name, user, upgradeCurrent }`.
  `kind` label: servers render as `Сетевые Устройство` (exact spelling, per prototype);
  others render the category name.
- **Service device (сервисное устройство)** — laptop / AIO. Component swaps route
  through an external service centre; stock is NOT debited (`serviceReplace: true`).
  Determined by category family. Desktops/servers debit stock normally.
- **upgradeCurrent** — the asset's live hardware snapshot array. Single source of truth
  for slot occupancy. An install appends/replaces an entry; an uninstall removes one.

## 4. UI surfaces

### 4.1 Tab «Склад» (Warehouse)
- Left: category card grid (PartCard per category) showing per-SKU working count +
  broken count + low-stock colour (rose = 0, amber ≤3, green otherwise). Cards offer
  «Установить» and (GPU only) «Добавить видеокарту».
- Top action: «Принять запчасти» → AddPartModal (qty grid across all SKUs incl. 0-stock).
- Selecting a category reveals its SKU rows with per-SKU install action.
- Mobile (≤768px): the card list is replaced by `CategoryChipStrip` (horizontal
  scrollable chip row) + a single detail panel.

### 4.2 Tab «Устройства» (Devices)
- Table of parts-assets (`id`, `name`, `kind`, `user`, installed-component summary).
- Per-row «Установить» / «Демонтировать» actions open InstallModal / UninstallModal.
- Mobile: dedicated card list + `MobileSheet` bottom-sheets for the modals.

### 4.3 Movement journal
- A «Журнал движений» surface (section or drawer) lists `part_movements` newest-first:
  type icon, SKU name, qty (+/−), asset link (if any), broken flag, actor, timestamp.

### 4.4 Modals
- **AddPartModal** — receive stock. Qty per SKU → emits one `receive` movement per
  non-zero qty.
- **InstallModal** — install OR replace. Slot logic from `upgradeCurrent`:
  - empty slot → straight install.
  - occupied single-slot cat → forced replace (pick which one).
  - occupied multi-slot cat (storage/ram) → replace one OR «Добавить рядом».
  - replaced part disposal: `warehouse` (return working → +1) or `broken` (scrap).
    Cooler & PSU are always auto-broken on replace.
  - service device → `serviceReplace: true`, stock untouched, `upgradeCurrent` still mutated.
- **UninstallModal** — dismount. Desktop/server → choose return-to-shelf or scrap.
  Service device → `serviceReplace`, stock untouched.
- **ServiceRecordModal** — SKU-less maintenance log for a device. Pick a service kind
  (repair / cleaning / diagnostics / replacement / other) + optional note → emits one
  `service` movement (`skuId === ''`, stock untouched, audit `part_serviced`).
  Per-prototype-parity; included under "full parity" scope.
- **GPU create** — «Добавить видеокарту» creates a new GPU SKU dynamically (`gpu_created`).
  Doc id is a Firestore auto-id (not slug+timestamp) to avoid same-millisecond collisions.

## 5. Data model (Firestore)

### `parts/{partId}` (SKU catalog)
| Field | Type | Notes |
|---|---|---|
| `id` | string (doc id) | seeded SKUs `sku_ram_16gb`; dynamically-created GPUs use a Firestore auto-id |
| `name` | string (Tier-4, EN-only) | e.g. "Kingston 16 ГБ DDR4-3200" — free text, not multi-lang |
| `category` | `'psu'\|'cooler'\|'ssd'\|'hdd'\|'nvme'\|'ram'\|'gpu'` | |
| `unit` | string | `'шт'` |
| `onHand` | number | DERIVED snapshot; recomputed from movements every write |
| `broken` | number | running broken tally; recomputed every write |
| `lowStockThreshold` | number | default 5 |
| `createdAt` / `updatedAt` | ISO string | |
| `createdBy` / `updatedBy` | uid | |

### `part_movements/{movementId}` (journal — append-only)
| Field | Type | Notes |
|---|---|---|
| `id` | string (doc id) | |
| `type` | `'receive'\|'install'\|'uninstall'\|'service'` | |
| `skuId` | string | FK → `parts`; `''` for `service` events |
| `qty` | number | always positive |
| `broken` | boolean | uninstall only; scrap when true |
| `assetId` | string \| null | install/uninstall/service target |
| `assetInvCode` | string \| null | denormalised for journal display |
| `serviceReplace` | boolean | true → stock not debited (service device) |
| `kindId` / `kindLabel` | string \| null | `service` events only — maintenance kind |
| `note` | string \| null | Tier-3 free text |
| `actorUid` / `actorRole` | string | pinned server-side via rules (== auth uid / role()) |
| `at` | server timestamp | pinned to `request.time` by rules |

Storage: none (parts have no scans in MVP).

## 6. Security rules

- `/parts/{id}`: read by any signed-in admin role; create/update by
  `super_admin | asset_admin | tech_admin` with field-shape validation
  (`category` enum, numeric stock fields, non-empty `name`, `created/updatedBy == auth uid`,
  `keys().hasOnly(...)`). No client delete.
- `/part_movements/{id}`: read by the three admin roles; **create only** by the three
  admin roles with attribution pinned (`actorUid == auth uid`, `actorRole == role()`,
  `at == request.time`, `type` enum, `keys().hasOnly(...)`); **`allow update, delete: if false`**
  (journal is immutable, like `audit_logs`). Movement writes always pair with an
  `audit_logs` write via `withAudit`.
- Asset rule: `tech_admin` may update an asset's `upgradeCurrent` (whitelisted alongside
  `statusId/updatedAt/updatedBy`) so install/uninstall transactions are not rejected;
  identity/assignment fields remain off-limits to tech_admin.
- Role resolved server-side via `get(/users/$(uid)).role` (never client claims).

## 7. Audit trail

Every mutating repository method runs inside `withAudit`, writing exactly one
`audit_logs` entry in the same transaction:

| Operation | entityType | action | before/after |
|---|---|---|---|
| receive stock | `part_movement` | `part_received` | null → movement |
| install part | `part` | `part_installed` | upgradeCurrent before/after |
| uninstall (return) | `part` | `part_returned` | upgradeCurrent before/after |
| uninstall (scrap) | `part` | `part_scrapped` | upgradeCurrent before/after |
| create GPU SKU | `part` | `gpu_created` | null → SKU |
| service record | `part_movement` | `part_serviced` | null → movement |

`part_uninstalled` is the umbrella action where return/scrap distinction is not needed.

## 8. i18n

- Tier-1 (UI chrome) — namespace `parts` in `ru/en/hy`: tab labels, modal titles,
  buttons, column headers, empty/loading/error states, journal action labels.
- Tier-4 (EN-only, NO multi-lang) — SKU `name`, part category technical labels,
  `unit`, any spec strings. No `<MultiLangInput>` anywhere in this module.
- Part-category display labels (ОЗУ / SSD / Блок / Кулер / Видеокарта) are Tier-1 keys
  (UI chrome describing a fixed taxonomy), keyed by category id.

## 9. Out of scope (MVP)

- Purchase-order linkage, supplier records, cost tracking (Phase 2 procurement).
- Part-level scans / invoices in Storage.
- Cross-branch parts transfer.
- Reorder automation / low-stock email alerts (Phase 2 notifications).

## 10. Acceptance

- `/parts` renders for the three admin roles; `employee` is denied by route guard + rules.
- Both tabs functional; stock derives correctly from movements (matches §3 invariant).
- Install on a desktop debits stock −1 and updates `upgradeCurrent` in one transaction;
  rollback on failure leaves no orphaned movement.
- Install on a laptop (service device) leaves stock unchanged but updates `upgradeCurrent`.
- Replace with `broken` disposal scraps the old part (no +1 return).
- Every mutation writes exactly one `audit_logs` entry; `part_movements` is immutable.
- `npm test -- --run` and `npm run build` both pass.
