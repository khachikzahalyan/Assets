# Plan — Asset license OEM-digital vs manual/retail fix + asset-detail license re-audit

## Problem
A manual product key entered at creation ("Ручной ввод") is stored and displayed as
OEM-digital: detail shows «OEM» chip + «Встроен в BIOS», and the action is «Открепить»
(a detach) instead of the prototype's «Копировать». The prototype (asset-detail.html
`LicenseBlock`) is canonical:
- `licenseMode === 'oem'` → OEM chip + «Встроен в BIOS» italic, NO key, NO button.
- `manual/retail`         → Retail chip + masked key (mono) + «Копировать» button.
- NO detach in the asset-detail license block.

## Root cause (3 hardcoded `type: 'OEM'` sites + a non-discriminating input type)
1. `src/domain/asset/AssetRepository.ts` — `CreateAssetInput.oemLicense` is
   `{ rawKey } | { existingLicenseId } | null` — no OEM-digital vs manual discriminator.
2. `src/infra/repositories/firestoreAssetRepository.ts` (~233) and
   `src/infra/repositories/inMemoryAssetRepository.ts` (~164) — `createLicense({ type:'OEM', isReusable:false, rawKey })`.
3. `src/pages/AssetDetailPage.tsx` `onAttachLicense` (~270) — both `new-key` and `oem-digital`
   create `type:'OEM'`.

Create-form gap: `AssetCreateForm.baseInput()` sets `oemLicense = null` for digital mode →
OEM-digital is never created on the create path. Only a manual key creates a license, mislabeled OEM.

## License-type mapping (locked)
- **oem_digital** → `type:'OEM'`, `isReusable:false`, NO rawKey. Display: OEM chip + «Встроен в BIOS».
- **manual**      → `type:'Retail'`, `isReusable:true`, rawKey persisted via setLicenseKey CF.
  Display: Retail chip + masked/awaiting key + «Копировать».

`isReusable` default in `WorkstationLicenseRepository.createLicense` is already
`input.type === 'OEM' ? false : true`, so Retail naturally becomes reusable.

## Changes

### firebase-engineer (domain + repos + page wiring)
- `src/domain/asset/AssetRepository.ts`: widen `oemLicense` to carry the discriminator:
  `{ kind:'manual'; rawKey:string } | { kind:'oem-digital' } | { existingLicenseId:string } | null`
  (keep backward-compat tolerance is not needed — all call-sites are updated in this pass).
- `firestoreAssetRepository.createAsset` + `inMemoryAssetRepository.createAsset`:
  map `kind:'manual'` → `type:'Retail'` (+rawKey), `kind:'oem-digital'` → `type:'OEM'` (no key),
  `existingLicenseId` → assignLicense. Names: manual → "<brand> <model> — Ключ продукта" / "Лицензия ОС";
  oem-digital → "OEM — <brand> <model>".
- `AssetCreateForm.baseInput()`: emit `{ kind:'oem-digital' }` for digital mode (so digital
  licenses are actually created), `{ kind:'manual', rawKey }` for manual, `{ existingLicenseId }` for pool.
- `AssetCreatePage.handleSubmit`: secret persistence guard updates to `oemLicense.kind === 'manual'`.
- `AssetDetailPage.onAttachLicense`: `new-key` → `type:'Retail'` (+secret), `oem-digital` → `type:'OEM'`.

### react-ui-engineer (LicenseBlock UI — match prototype)
- `LicenseBlock.tsx`: `isOem = lic.type === 'OEM'`.
  - OEM → indigo chip + «Встроен в BIOS». No button.
  - else (Retail/Default/Volume/Subscription) → blue chip + key line + «Копировать» button.
    «Копировать» reveals via existing `revealLicenseKey` callable then copies; when no secret
    exists yet (Blaze pending / CF error) show graceful "ключ появится после настройки" state —
    NEVER «Встроен в BIOS» for a non-OEM license.
  - REMOVE the «Открепить» detach button + `onDetach` prop usage from the bound-license card
    (prototype has none). Keep empty-state «Добавить лицензию».
- Keep `RevealKeyButton` for the Licenses module; asset-detail uses «Копировать».

### locale (ru only)
- Add `detail.license.copy` = "Копировать", `copied` = "Скопировано",
  `keyPending` = "Ключ появится после настройки", `copyFailed` = "Не удалось получить ключ".
- Remove now-unused `detach`/`detachConfirm` only if no other consumer (verify).

## Tests
- manual-key license creates `type:'Retail'` (not OEM), renders «Копировать», not «Встроен в BIOS».
- oem-digital renders «Встроен в BIOS» + OEM chip, no «Копировать».
- detail license block shows «Копировать», not «Открепить».
- Update `AssetDetailPage.license.test.tsx`: NEW KEY → `type:'Retail'`; OEM-DIGITAL → `type:'OEM'`;
  DETACH test removed/replaced (prototype has no detach); permission test keeps no-«Открепить».

## Verify
`npm run typecheck` → 0. `npm run build` → 0. `npm run test` → no NEW failures vs baseline.

## Key-value note
Raw key secret is written by the `setLicenseKey` CF (NOT deployed — Blaze pending). Until then a
manual key has no stored secret; «Копировать» degrades to a "ключ появится после настройки" state.
Post-Blaze the existing `revealLicenseKey` callable powers «Копировать». No new CF dependency added.
