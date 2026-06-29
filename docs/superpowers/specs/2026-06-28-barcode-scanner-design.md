# Barcode Scanner (mobile) — Design Spec

**Date:** 2026-06-28
**Status:** Approved (brainstorming) — pending implementation plan
**Phase:** Read-only scanner (label generation/printing is a separate, later phase)

> ⚠️ Testing phase: do NOT `git add` / `git commit` / `git push` while iterating on this feature. (Owner instruction, 2026-06-28.)

---

## 1. Goal

On a phone, a user opens the **Assets** page → taps **«Сканировать»** → the camera opens → they scan the
physical barcode sticker on an asset → the app resolves the asset by its `invCode` → navigates to the
existing **Asset Detail page** (`/assets/:id`), which already shows full history (assignment, repairs,
installed parts, license).

This phase delivers **reading only**. Generating/printing labels is explicitly out of scope here.

## 2. Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Symbology | **Code 128**, encoding the **inventory code** (e.g. `LAP/00123`) | Matches existing physical asset tags; our own scanner resolves it. URL-in-code is unnecessary since we don't rely on the native phone camera in this phase. |
| Platforms | **iPhone + Android** | Mixed fleet. Native `BarcodeDetector` does NOT exist on iOS Safari, so a WASM fallback is mandatory. |
| Library | **`@yudiel/react-qr-scanner`** | Maintained, TS-native. Uses `barcode-detector` ponyfill under the hood: native `BarcodeDetector` on Android, ZXing-C++ WASM fallback on iOS. Less custom code than hand-rolling `@zxing/library`. |
| Detail UI | **Reuse existing `AssetDetailPage`** | The app already has `/assets/:id` with full history/assignment/repairs/parts. No new `AssetDetailModal` is built. |
| Entry point | **New nav item «Сканировать» in the «Система» group** → dedicated `/scan` page | Owner request (2026-06-28). Discoverable from the navbar everywhere, not just the Assets page. |
| Routing | **New route `/scan`** rendering `ScanPage` under `RoleGate` | Required because the entry point is a nav item, not an in-page button. |
| Access | `super_admin`, `asset_admin`, `tech_admin` | Same roles that view assets — they're the ones physically scanning. Side effect: the «Система» group becomes visible (with only this item) to `asset_admin`/`tech_admin`. |

## 3. Stack alignment (this is a Firebase/Tailwind/i18n project)

The feature MUST follow the real `assets-crm` conventions, NOT the generic brief's stack:

- **Data:** Firestore via the repository pattern (`infra/repositories/firestoreAssetRepository.ts` +
  `inMemoryAssetRepository.ts`). **No Supabase. No TanStack Query.** Resolution is a direct async repo call.
- **Styling:** **Tailwind + shadcn/ui (Radix)** + semantic design tokens + shared style constants
  (`components/ui/styles.ts`). **No CSS Modules. No hardcoded hex.** Use alpha-aware tokens
  (`rgb(var(--rgb-X) / <alpha>)`).
- **State:** React Context (`contexts/`). **No Zustand.**
- **i18n:** every user-facing string via `react-i18next` `t()`, with keys added to **ru / en / hy**
  locale files (4-tier strategy). **No hardcoded Russian strings.**
- **Icons:** `lucide-react`.
- **Mobile conventions:** mobile-first; respect existing mobile patterns (bottom-sheet for sheets,
  `max-md:` gating, matchMedia 767px). The camera surface itself is a full-viewport overlay.

## 4. Components & data flow

```
[Navbar → group «Система» → item «Сканировать»]   (RoleGate: super_admin, asset_admin, tech_admin)
   └─ route /scan → <ScanPage>
        │ renders the scanner as page content (inside AppShell)
        ▼
   <Scanner formats={['code_128','qr_code']} onScan={...}>   // @yudiel/react-qr-scanner
        │ fires onDetect(rawValue) EXACTLY ONCE, then pauses + releases camera
        ▼
   resolve(invCode):
        │ assetRepo.findByInvCode(invCode)  // Firestore where('invCode','==',code) limit 1
        ├─ found    → navigate(`/assets/${asset.id}`)
        └─ not found→ toast/inline error «Актив с кодом X не найден» (i18n); re-enable scanning to retry
```

### 4.0 Nav + route wiring (new)
- `config/nav.ts`: add `'scan'` to the `RouteId` union; add a `NavItem` to the `system` group:
  `{ id: 'scan', labelKey: 'items.scan', icon: 'scan-line', allow: ['super_admin','asset_admin','tech_admin'] }`.
  `routeRoles('scan')` is derived automatically from this (see `config/access.ts`) — no separate access edit.
- `config/routes.tsx`: add `<Route path="/scan" element={<RoleGate roles={routeRoles('scan')}><ScanPage/></RoleGate>} />`
  and import `ScanPage` from `@/pages`.
- `pages/scan/ScanPage.tsx` + export from `pages/index.ts`.

### 4.1 `findByInvCode` repository method — ALREADY PRESENT (verified 2026-06-28)
- `findByInvCode(invCode: string): Promise<Asset | null>` exists on `AssetWriteRepository` and in BOTH
  implementations (`firestoreAssetRepository.ts` — `getDocs(query(collection(db,'assets'),
  where('invCode','==',invCode), limit(1)))`; `inMemoryAssetRepository.ts` — `assets.find(...)`).
- Covered by `inMemoryAssetRepository.test.ts` (found / not-found / case-and-format exactness).
- Status: present in the working tree (uncommitted), `npx vitest` 9/9 green, `tsc --noEmit` exit 0.
  No further repo work needed for this feature.

### 4.2 `ScanPage` (`pages/scan/ScanPage.tsx`)
- The `/scan` route content, rendered inside the normal `AppShell`. Hosts the scanner as page content
  (a framed camera surface), not a global overlay.
- Wraps `@yudiel/react-qr-scanner`'s `<Scanner>` (which owns the `<video>` + finder).
  `formats={['code_128','qr_code']}` (QR included so future QR labels also work).
- Chrome: page header (title «Сканировать актив»), centered scan-zone framing, a status line
  («Наведите камеру на штрих-код…»), a «resolving» state («Поиск актива…»), and an error/permission state
  with a retry action.
- Lifecycle: detection callback fires **once** per scan (guard against multiple `onScan` fires); pause the
  scanner while resolving. On unmount the library releases the camera stream; we ensure scanning is stopped.
- Permission denied → friendly i18n message + retry; never a blank black screen.
- On found → `navigate('/assets/' + asset.id)`. On not-found → error, re-enable scanning to retry.
- All strings via `t()`. Mobile-first; reuse shared style constants / design tokens.

## 5. Error handling

- **Camera permission denied / no camera:** inline message on the page + retry; do not crash the page.
- **Asset not found for scanned code:** non-blocking toast/inline error with the scanned code; scanning
  re-enables so the user can scan again.
- **Malformed / unexpected code:** treated as "not found" (resolver returns null).
- **iOS WASM load failure (offline):** surface a clear error; the WASM module is fetched by the library —
  consider self-hosting/bundling it later if offline scanning is required (out of scope now, noted).

## 6. Testing

- `inMemoryAssetRepository.findByInvCode` unit tests (found / not-found).
- Resolver logic test: detect → found → navigate target; detect → not-found → error state.
- Component test for `ScanPage` mount/unmount + single-fire detection (camera/scanner mocked).
- Nav/access test: `routeRoles('scan')` resolves to the three roles; `/scan` is guarded by `RoleGate`.
- i18n: assert the new keys exist in ru/en/hy (or follow the project's existing locale-coverage test).

## 7. Out of scope (explicitly deferred)

- Label/QR generation and printing (separate phase — `bwip-js`/`react-qr-code` candidates).
- Switching the physical symbology to QR + deep-link URL (revisit if native-camera-opens-app is wanted).
- Offline/PWA bundling of the ZXing WASM module.
- Additional scan entry points (e.g. a quick-scan button on the Assets page or mobile bottom-nav) — start
  with the «Система» → «Сканировать» nav item only.

## 8. New dependency

- `@yudiel/react-qr-scanner` (pulls `barcode-detector` / ZXing-C++ WASM transitively).
