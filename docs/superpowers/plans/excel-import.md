# Excel Import (Employees + Assets, Two-Pass Preview) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Sequential dispatch only: data-migration-engineer → test-engineer → react-ui-engineer → test-engineer → reviewers.
> **HARD CONSTRAINTS:** NO git operations (no add/commit/push). NO file edits via PowerShell (breaks UTF-8) — use Read/Write/Edit tools only. NO deploys.

**Goal:** Owner-approved Excel import: download our template → upload file → client-side preview with per-row validation → write valid rows through EXISTING repositories (employees first, then assets, then assignments), with progress and a precise final report.

**Architecture:** Pure-function parse/validate layer in `src/lib/importXlsx/` (unit-testable without Firebase), an injected-repository runner for pass 2, and one lazy-chunk fullscreen page `/import` (pattern: `/parts/new`). All writes go through existing repos (`createEmployee`, `createAssetsBatch`, `asnRepo.assign`) so audit entries are produced automatically. xlsx is lazy-imported on click (same as `exportXlsx`).

**Tech stack:** React 19 + TS strict, xlsx (already a dependency), i18next (ru/en/hy), Vitest + Testing Library, InMemory repositories for tests.

---

## 0. Verified codebase facts (do not re-litigate)

- `category_counters` does NOT exist. Normal single-create requires manual inv code; group stepper auto-increments client-side via pure helpers `nextInvCode` / `nextInvFromBatch` in `src/components/features/assets/create/ramStorage.ts`. Import auto-generation reuses `nextInvCode`.
- `Asset` / `CreateAssetInput` have NO price and NO comment field today. Plan adds additive optional `priceAmount?: number | null` (schema §5 reserves it). «Комментарий» maps to `transferComment` of the assign step.
- `AssignInput.employeeEmail` is used ONLY to enqueue mail. Import MUST OMIT `employeeEmail`/`employeeName` to suppress mass mail.
- Employee doc id pattern for admin-created records: `'pending_' + crypto.randomUUID()` (see `src/pages/employees/useEmployeesActions.ts:49`).
- `createAssetsBatch(inputs, actor)` (`src/infra/repositories/firestoreAssetRepository.ts`) is atomic ≤100 with inv/serial dual-uniqueness locks; throws before any write on duplicate.
- `loadReferenceData()` returns categories (with `requiresSerial`/`hasTypeField`/`group`), branches, departments, employees (with emails), statuses.
- Route protection pattern for non-nav routes: literal roles array, e.g. `/assets/new` → `<RoleGate roles={['super_admin','asset_admin']}>` in `src/config/routes.tsx`.
- Assets toolbar import stub: `src/components/features/assets/AssetsToolbar.tsx:131-141` (disabled button, keys `toolbar.import` / `toolbar.importSoon` in `assets.json`).
- Locale parity enforced by `src/locales/localesSync.test.ts` — every new namespace must land in ru+en+hy simultaneously; register namespace in `src/lib/i18n/index.ts`.

## 1. File tree

Create:
- `src/lib/importXlsx/types.ts` — row/result types.
- `src/lib/importXlsx/template.ts` — template workbook builder + browser download.
- `src/lib/importXlsx/parse.ts` — workbook → raw string rows (pure; takes `XLSX.WorkBook`).
- `src/lib/importXlsx/validate.ts` — pure validation + reference resolution + inv-code auto-generation → `ImportPlan`.
- `src/lib/importXlsx/run.ts` — pass-2 runner over injected repos with progress callback.
- `src/lib/importXlsx/index.ts` — barrel.
- `src/lib/importXlsx/parse.test.ts`, `validate.test.ts`, `run.test.ts` — dense unit tests.
- `src/pages/import/ImportPage.tsx` — fullscreen flow page (lazy chunk).
- `src/pages/import/ImportPage.test.tsx` — page tests with InMemory repos.
- `src/components/features/import/PreviewTable.tsx` — preview table (green/red rows, per-row error text).
- `src/components/features/import/ImportProgress.tsx` — phase + progress bar.
- `src/components/features/import/ImportReport.tsx` — final report.
- `src/locales/ru/import.json`, `src/locales/en/import.json`, `src/locales/hy/import.json`.

Modify:
- `src/domain/asset/types.ts` — `Asset.priceAmount?: number | null`.
- `src/domain/asset/AssetRepository.ts` — `CreateAssetInput.priceAmount?: number | null`.
- `src/infra/repositories/firestoreAssetRepository.ts` — pass `priceAmount` through create/createBatch doc payload (conditional-spread idiom; `exactOptionalPropertyTypes`).
- `src/infra/repositories/inMemoryAssetRepository.ts` — same passthrough.
- `src/config/routes.tsx` — lazy `ImportPage`, route `/import` with `<RoleGate roles={['super_admin','asset_admin']}>`.
- `src/components/features/assets/AssetsToolbar.tsx` — enable Import button → `onNavigateImport` prop (visible/enabled only when `canMutate`).
- `src/pages/assets/AssetsPage.tsx` — pass `onNavigateImport={() => navigate('/import')}`.
- `src/pages/employees/EmployeesPage.tsx` — add Import button next to «Добавить» (same visual as assets toolbar import button; role-gated the same way, desktop only is acceptable — mirror assets behavior `max-md:hidden`).
- `src/lib/i18n/index.ts` — register `import` namespace.
- `src/locales/{ru,en,hy}/assets.json` — `toolbar.importSoon` no longer used → remove key in all three (or repurpose; keep parity).

No changes: `firestore.rules`, `storage.rules`, Cloud Functions. No new collections. `priceAmount` is an additive field on `assets/*` written through existing repo paths (rules do not field-whitelist assets writes).

## 2. Template format (sheet names and column order are the contract)

Sheet «Сотрудники» (header row 1, example row 2):
| Имя* | Фамилия* | Email* | Телефон | Должность | Отдел* | Филиал |

Sheet «Активы» (header row 1, example row 2):
| Категория* | Бренд | Модель | Серийный номер | Инв. код | Филиал* | Выдан сотруднику (email) | Цена | Дата покупки | Гарантия до | Комментарий |

Sheet «Справочник»: side-by-side columns with ACTUAL values from the DB — Категории, Отделы, Филиалы — plus a short instructions block:
- даты в формате ГГГГ-ММ-ДД или ДД.ММ.ГГГГ (Excel-даты тоже принимаются);
- пустой «Инв. код» → код будет сгенерирован автоматически;
- для мебели: «Модель» = тип (Стол/Стул/Шкаф), «Бренд» и «Серийный номер» не заполняются;
- «Комментарий» сохраняется только вместе с «Выдан сотруднику»;
- строку-пример удалите или оставьте — она игнорируется.

Example-row rule (locked): each example row's FIRST cell starts with the literal prefix `(пример)`. The parser silently drops any data row whose first cell, trimmed, starts with `(пример)`.

Template generation: `buildImportTemplate(ref: { categories: string[]; departments: string[]; branches: string[] }): XLSX.WorkBook` (pure, testable) + `downloadImportTemplate(ref)` that calls `XLSX.writeFile(wb, 'АМС-импорт-шаблон.xlsx')`. Column widths via the same auto-fit approach as `exportXlsx.ts`. Page lazy-imports the module on click.

## 3. Types (contract for both agents)

```ts
// types.ts
export interface RawEmployeeRow { rowNumber: number; firstName: string; lastName: string; email: string; phone: string; position: string; department: string; branch: string }
export interface RawAssetRow { rowNumber: number; category: string; brand: string; model: string; serial: string; invCode: string; branch: string; assigneeEmail: string; price: string; purchaseDate: string; warrantyEndsAt: string; comment: string }
export interface ParsedFile { employees: RawEmployeeRow[]; assets: RawAssetRow[] }

export type RowIssue = { key: string; params?: Record<string, string | number> }  // i18n key into import.json errors.*

export interface EmployeePlanRow {
  rowNumber: number
  status: 'ready' | 'error'
  errors: RowIssue[]
  warnings: RowIssue[]
  input?: { firstName: string; lastName: string; email: string; phone: string | null; position: string | null; branchId: string | null; departmentId: string | null }
}
export interface AssetPlanRow {
  rowNumber: number
  status: 'ready' | 'error'
  errors: RowIssue[]
  warnings: RowIssue[]
  invCodeGenerated: boolean            // true when auto-generated (preview shows «авто» chip)
  invCode?: string
  assigneeEmail?: string | null        // normalized lower-case; resolved at run time
  comment?: string | null
  input?: Omit<CreateAssetInput, 'assignment' | 'deptId'> & { deptId: null; assignment: null }
}
export interface ImportPlan {
  employees: EmployeePlanRow[]
  assets: AssetPlanRow[]
  readyEmployees: number; errorEmployees: number
  readyAssets: number; errorAssets: number
}

export interface ValidateContext {
  categories: CategoryRow[]            // from loadReferenceData
  branches: RefRow[]
  departments: RefRow[]
  activeEmployees: { id: string; email: string | null; departmentId?: string | null }[]
  formerEmails: string[]               // lower-cased emails of terminated employees
  existingAssets: { invCode: string; serial: string | null; categoryId: string }[]
  today: string                        // ISO YYYY-MM-DD, injected for testability
}

export type ImportPhase = 'employees' | 'assets' | 'assignments'
export interface ImportProgressEvent { phase: ImportPhase; done: number; total: number }
export interface SkippedRow { sheet: 'employees' | 'assets'; rowNumber: number; reason: string }
export interface ImportResult {
  employeesCreated: number
  assetsCreated: number
  assignmentsCreated: number
  skipped: SkippedRow[]
}
```

## 4. Validation rules (locked; each rule = i18n error key + unit test)

Normalization first: every cell `String(v).trim()`; reference resolution is case-insensitive on `name.trim().toLowerCase()`; emails compared lower-cased.

Employees:
- E1 Имя and Фамилия required → `errors.firstNameRequired` / `errors.lastNameRequired`.
- E2 Email required + format (simple RFC-lite `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) → `errors.emailRequired` / `errors.emailInvalid`.
- E3 Email must not exist among active employees (`errors.emailTaken`), must not belong to a terminated employee (`errors.emailTerminated` — restore manually), must be unique within the file (`errors.emailDupInFile` with `{ row }` of the twin; ALL involved rows get the error).
- E4 Отдел required and must resolve → `errors.departmentRequired` / `errors.departmentUnknown` with `{ value }`.
- E5 Филиал optional; if non-empty must resolve → `errors.branchUnknown`.
- Телефон/Должность: free text, stored as typed (Tier-3), no validation.

Assets:
- A1 Категория required + resolves → `errors.categoryRequired` / `errors.categoryUnknown`.
- A2 Филиал required + resolves → `errors.branchRequired` / `errors.branchUnknown`.
- A3 Identity shape by category flags: `hasTypeField` (furniture) → Модель required, mapped to `type`; `brand=null`, `serial=null`; non-empty Бренд or Серийный номер → warning `warnings.furnitureExtrasIgnored` (values dropped). Otherwise (devices/network) → Бренд and Модель required (`errors.brandRequired` / `errors.modelRequired`); when `requiresSerial` → Серийный номер required (`errors.serialRequired`).
- A4 Serial uniqueness (non-empty only): against DB and within file → `errors.serialTaken` / `errors.serialDupInFile`.
- A5 Инв. код provided: unique against DB and within file → `errors.invTaken` / `errors.invDupInFile`. Empty → auto-generate (§5); generated code joins the intra-file uniqueness pool; `invCodeGenerated: true`.
- A6 Выдан сотруднику non-empty: email format (`errors.assigneeEmailInvalid`); must exist among active DB employees OR among READY rows of the «Сотрудники» sheet of the same file (`errors.assigneeUnknown`); terminated → `errors.assigneeTerminated`.
- A7 Цена non-empty: number after normalizing `,`→`.` and stripping spaces; must be finite and ≥ 0 → `errors.priceInvalid` / `errors.priceNegative`.
- A8 Дата покупки / Гарантия до: both-or-neither (`errors.datesPairRequired`); accepted forms: Excel serial number, `YYYY-MM-DD`, `DD.MM.YYYY` (`errors.dateInvalid` with `{ field }`); purchase ≤ today (`errors.purchaseInFuture`); warranty strictly > purchase (`errors.warrantyBeforePurchase`). Both present → `condition: 'new'` + both dates; both absent → `condition: null`, no dates. (Import is historical: past purchase dates are expected and allowed.)
- A9 Комментарий: kept only when Выдан сотруднику is non-empty (becomes `transferComment`); comment without assignee → warning `warnings.commentDropped`.

Cross-cutting: rows that are entirely empty are skipped silently; the example row (first cell starts with `(пример)`) is skipped silently; errors never block importing the OTHER (green) rows.

## 5. Inventory-code auto-generation (locked)

For an asset row with empty Инв. код:
1. Candidate prefix = among `existingAssets` of the same `categoryId` with `parseInventoryCode()`-parseable codes, the prefix with the most occurrences; tie-break: the prefix whose max numeric suffix is highest. File rows of the same category with explicit parseable codes count toward the pool too.
2. If NO parseable code exists for the category (DB + file) → row ERROR `errors.invPrefixUndetermined` («укажите инв. код вручную» — first-ever asset of a category must be coded explicitly).
3. Seed = the code with the highest numeric suffix among (existing assets with that prefix + file rows with that prefix + codes already generated for earlier rows). Next code = `nextInvCode(seed)` from `src/components/features/assets/create/ramStorage.ts` (preserves zero-padding, e.g. `460/00007` → `460/00008`).
4. Generated codes are checked and reserved in the intra-file pool so N auto rows of one category get N sequential codes.
Pass-2 safety net: `createAssetsBatch` re-checks uniqueness transactionally; a race between preview and run surfaces as a batch fallback (§6).

## 6. Pass 2 — runner (`run.ts`)

```ts
export interface ImportDeps {
  employeeRepo: Pick<EmployeeRepository, 'createEmployee'>
  assetRepo: Pick<AssetWriteRepository, 'createAssetsBatch' | 'createAsset'>
  asnRepo: Pick<AssignmentRepository, 'assign'>
  newEmployeeId?: () => string          // default: () => 'pending_' + crypto.randomUUID()
}
export async function runImport(deps: ImportDeps, plan: ImportPlan, actor: Actor, onProgress: (e: ImportProgressEvent) => void): Promise<ImportResult>
```

Order and behavior:
1. **Employees** — sequential over `status==='ready'` rows. Each: `createEmployee({ id: newEmployeeId(), ...input }, actor)`. Per-row try/catch → failed row goes to `skipped` with the thrown message (e.g. `EmployeeEmailTerminatedError` race); assets referencing that email by file-lookup then fail their assignment step with a skipped entry, asset itself still created (stays warehouse). Build `emailToEmployee` map: lower-cased email → `{ id, departmentId }`, seeded from `ctx.activeEmployees` + newly created.
2. **Assets** — chunk `ready` rows into groups of ≤100 → `createAssetsBatch(chunkInputs, actor)` with `assignment: null`, `deptId: null` (asset lands `st_warehouse`; branchId from the row). On a chunk throw (duplicate race): fall back to per-row `createAsset` within that chunk sequentially; individual failures go to `skipped`, successes count. Keep `rowNumber → createdAsset` map.
3. **Assignments** — sequential over created assets whose plan row has `assigneeEmail`. Resolve via `emailToEmployee`; call `asnRepo.assign({ assetId, mode: 'employee', employeeId, deptId: employee.departmentId ?? null, transferComment: row.comment ?? null, actStoragePath: null }, actor)`. **Do NOT pass `employeeEmail`/`employeeName`** (suppresses the mail queue — no mass email on import). Per-row try/catch → `skipped` entry «актив создан, но не выдан: <reason>».
Progress: emit after every unit (each employee, each asset chunk completes → done += chunk size, each assignment).
Audit: produced automatically by the repos (employee `created`, asset created per item, assignment `assigned`) — no direct audit writes in this feature.
Interruption: batches are atomic; between units interruption is tolerated — the report lists exactly what was created (counters + skipped are maintained incrementally and returned even on thrown fatal error via try/finally capture in the page layer).

## 7. UI flow (`/import`)

Fullscreen flow page in the shell (registered exactly like `/parts/new`: plain lazy route, NOT in FLUSH_ROUTES). Steps rendered as a single page with progressive states (no router sub-steps):
1. **Шаблон** — intro card + `Btn` «Скачать шаблон» (lazy import of `template.ts`; ref values from `loadReferenceData()`).
2. **Файл** — `<input type="file" accept=".xlsx">` (styled with existing Btn; no drag-n-drop). On pick: lazy-import xlsx + `parse.ts`, load context (refData + `listAssets({})` + `listFormerEmployees()`), run `validate()`.
3. **Превью** — TabStrip «Сотрудники (N)» / «Активы (M)»; `PreviewTable` per sheet: row number, key fields, status (green `ready` / red `error`), error/warning texts via `t('import:errors.*')`; «авто» chip on generated inv codes. Summary chips: N готово / M с ошибками (per sheet + total). `Btn` «Импортировать N строк» enabled when total ready > 0; red rows never block.
4. **Импорт** — `ImportProgress`: phase label (Сотрудники → Активы → Привязки) + progress bar + counts; buttons disabled while running.
5. **Итог** — `ImportReport`: создано X сотрудников, Y активов, Z привязок; таблица пропущенных строк (лист, №, причина); buttons «К активам», «Импортировать ещё файл».

Reuse strictly: `Btn`, `Icon`, `PageHeader`, `TabStrip`, `EmptyState`, `ErrorState`, existing table primitives — mirror `PartsReceivePage` structure. Actor from `useAuth()` (`{ uid, role, displayName }`). Repos: `getSharedEmployeeRepository()`, `getSharedAssetRepository()` (write side: `FirestoreAssetRepository` implements both), `getSharedAssignmentRepository()`; all injectable via props for tests (pattern: `AssetCreatePage`).

Entry points:
- `/assets` toolbar: replace the disabled stub with an enabled button (`onNavigateImport`), rendered only when `canMutate`.
- `/employees`: Import button beside «Добавить», same gating, navigate to `/import`.

## 8. i18n

New namespace `import` (ru/en/hy in sync; `localesSync.test.ts` enforces parity; register in `src/lib/i18n/index.ts`). Key groups: `title`, `steps.*`, `template.*`, `upload.*`, `preview.*` (incl. `readyCount`, `errorCount`, `autoChip`, `importN`), `progress.*` (phase labels), `report.*`, `errors.*` (every key from §4), `warnings.*`. All UI strings Tier-1 via `t()`. Data itself (names, comments) is Tier-3/Tier-4 — stored as typed.

## 9. Task breakdown (dependency order)

**Task 1 — data-migration-engineer:** domain `priceAmount` passthrough (types + both repos), `src/lib/importXlsx/*` (types, template, parse, validate incl. inv-code gen, run) + dense unit tests for parse/validate/run (all §4 rules, §5 generation incl. padding + no-prefix error + sequential multi-row, §6 happy path + batch-fallback + assignment-failure reporting, example-row skip, comma decimals, all 3 date forms, case-insensitive resolution, mail-suppression assertion — assign called WITHOUT employeeEmail). TDD: write failing tests per rule, implement, green. Verify: `npx vitest run src/lib/importXlsx --pool=forks` + `npm run build`.

**Task 2 — test-engineer gate:** audit Task-1 coverage against §4/§5/§6, add missing cases, run full suite.

**Task 3 — react-ui-engineer:** ImportPage + PreviewTable/ImportProgress/ImportReport, route `/import` (lazy chunk, literal RoleGate `['super_admin','asset_admin']`), toolbar wiring on /assets + /employees, i18n namespace ru/en/hy + registration, page tests with InMemory repos (preview render, green/red rows, import button count, report screen, role gate). Verify: targeted vitest + `npm run build`.

**Task 4 — test-engineer gate:** full suite green.

**Task 5 — reviews:** spec-reviewer → code-quality-reviewer → security-reviewer (role gate on route AND toolbar visibility; no mail flood; no raw Firestore imports in page; i18n parity; audit via repos only).

**Task 6 — verification:** `npm run build` + FULL `npx vitest run --pool=forks --poolOptions.forks.minForks=1 --poolOptions.forks.maxForks=4`.

## 10. Rollback

Feature is additive: delete `src/lib/importXlsx/`, `src/pages/import/`, `src/components/features/import/`, the `/import` route block, the two toolbar buttons, `import.json` ×3 + namespace registration; revert the 4 `priceAmount` touch-points. No Firestore schema/rules migration to undo (field is optional and unread elsewhere).
