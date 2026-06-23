# Plan — Asset Create Form: maximum visual parity with prototype

Source of truth: `C:/Users/DELL/Desktop/Warehouse/prototypes/preview.html` (the dark/orange "Регистрация актива" 2-column form).
Target: `/assets/new` in `C:/Users/DELL/Desktop/assets-crm`.

Hard rule: VISUAL ONLY. No logic / validation / data-flow / nav changes. Russian-only. Data from Firestore. Component-first.

## Visual-delta inventory (app vs prototype)

### Shared primitives are widely reused → DO NOT mutate globally
`Field` and `Input` from `@/components/ui` are used by many dialogs/pages that intentionally use the BOXED style. The prototype's create form uses larger labels + UNDERLINE inputs. Therefore the create form needs its OWN local primitives, not a global primitive rewrite.

### D1 — Field labels too small/dim + wrong asterisk color (HIGH)
App `Field`: label `text-[11px] text-[#64748B]`, asterisk `text-[#FDA4AF]`, hint `text-[11px]`.
Prototype `Field`: label `text-[13px] uppercase tracking-[0.07em] font-semibold text-[#94A3B8] mb-1.5`, asterisk `text-[#F97316] ml-0.5`, hint `text-[13px] text-[#64748B] mt-1 leading-snug`.
Fix: local `Field` in create folder (`create/ui.tsx`) matching prototype; use it inside all create components.

### D2 — Inputs are BOXED, prototype is UNDERLINE (CRITICAL, most visible)
App `Input`: `h-9 px-3 bg-[#111315] border rounded-lg focus:ring-2`.
Prototype `Input`: `px-0 py-2.5 text-[15px] border-b border-[#2A2F36] bg-transparent rounded-none focus:border-[#F97316] focus:shadow-[0_2px_8px_rgba(217,119,87,0.1)]`.
Affects: brand, model, inv code, serial, type, GPU, group-stepper inputs.
Fix: local underline `Input` in create folder, same prop API (`value/onChange/placeholder/mono/className/disabled/autoFocus/id/onKeyDown/ariaLabel/type/min/max`). Swap create-form usages.

### D3 — Container layout: separate cards vs ONE unified card (HIGH)
Prototype: outer `ams-reg-card--split` grid (AssetCard col1 rows1-2; SpecsCard + QA col2) inside ONE `rounded-[24px]` card; internal `SectionCard` = `px-6 py-5 border-t first:border-t-0` (no per-section border/shadow). AssetCard has a vertical separator on the right (`border-right` on `.ams-sec-asset`).
App: each `SectionCard` is its own bordered+shadowed card; QA section uses the boxed header.
Fix: in create form, use a local section wrapper that renders `px-6 py-5 border-t border-[#2A2F36]/80 first:border-t-0` (no outer border/shadow). Keep the existing 2-col grid + `lg:border-r` divider on the left column. Make the QA header a borderless section header (`text-[13px] uppercase tracking-[0.06em] text-[#94A3B8] mb-4`), not the boxed SectionCard header.

### D4 — Save button is flat, prototype is gradient (MED)
Prototype primary save: `bg-gradient-to-r from-[#F97316] to-[#FB923C] rounded-xl shadow-[0_4px_16px_rgba(217,119,87,0.24)] hover:shadow ... hover:scale-[1.02]`, `px-5 py-2 text-[15px] font-semibold`.
App footer Создать: flat `Btn variant=primary`.
Fix: render the footer Создать/Cancel buttons with prototype's exact button markup (local, not via Btn primary). Cancel = `px-4 py-2 text-[15px] text-[#F8FAFC] bg-[#111315]/50 border border-[#2A2F36]/60 rounded-xl`.

### D5 — Group tabs styling (MED)
Prototype GroupCards: `rounded-2xl px-4 py-2`, left-aligned `flex items-center gap-2`, label `text-[15px] font-medium`, count `text-[14px]`, active icon `text-[#F97316]`, active border `#F4CFB8`.
App GroupTabs: `rounded-xl px-3 py-2.5`, centered, label `text-[14px]`, count `text-[13px]`.
Fix: restyle GroupTabs to match GroupCards (keep `role=tab` for the parity test; keep counts/labels/onSelect logic).

### D6 — OEM/License card sizing nuance (LOW)
Prototype OemSubSection cards: `px-3 py-3 rounded-xl`, active `border-2 border-[#F97316] ring-1`, label `text-[15px]`, desc `text-[13px] text-[#F8FAFC]`, check is absolute top-right `w-5 h-5`. Icon `w-7 h-7 rounded-lg`.
App LicensePicker cards: `p-3 rounded-xl`, label `text-[13px]`, desc `text-[11px] text-[#64748B]`, check inline, icon `w-7 h-7 rounded-md`.
Fix: align LicensePicker card styling to prototype (label 15px, desc 13px lighter, icon rounded-lg, active border-2 + ring, check absolute). Keep hidden sr-only inputs + logic intact. NOTE: prototype shows only the manual product-key field (no digital sub-field) — app already matches behavior.

### D7 — Section header for Specs/OEM/Condition consistency (LOW)
Prototype sub-section headers: `text-[13px] font-semibold text-[#94A3B8] tracking-[0.06em] uppercase`. App SpecsPanel/ConditionWarranty/OEM already use `text-[13px] ... text-[#94A3B8]` — OK. Verify Specs label column `8rem` + `text-[16px] text-[#94A3B8]` — already matches.

### D8 — Header rhythm (LOW)
Keep the new back button (chevron-left → /assets). Prototype has no in-card title bar — title lives in a separate header ABOVE the card. App renders the title row INSIDE the card. Keep app's in-card header (it carries back+title+toggle+X) but match the prototype's typography: title `text-[17px] font-semibold`, subtitle `text-[14.5px] text-[#CBD5E1]` (app uses `text-[12px] text-[#64748B]` — bump to match). Sub-mode toggle already matches prototype (`bg-[#22272E]/80 rounded-xl ring-1 ... active bg-[#1B1F24] text-[#EA580C] ring-1 ring-[#F4CFB8]`).

## Tasks (sequential, react-ui-engineer)
1. Create `create/ui.tsx` exporting create-local `Field` (D1) + `Input` (D2) matching prototype, same prop API.
2. Swap all `@/components/ui` `Field`/`Input` imports inside `create/*` (AssetCreateForm, GroupStepper, ConditionWarranty) + LicensePicker product-key Field to the local ones. SpecsPanel GPU input already hand-codes underline — align to local Input. SpecCombobox already underline — leave.
3. Restyle GroupTabs → GroupCards visual (D5).
4. AssetCreateForm container: unified-card sections (D3), gradient footer buttons (D4), header typography (D8). Make QA section a borderless titled section.
5. LicensePicker card polish (D6).
6. Verify subtitle/labels use ru only.

## Verification
- `npm run typecheck` exit 0
- `npm run build` exit 0
- `npm run test` no NEW failures vs baseline (114 files / 1073 green; ignore known-flaky AssetCreateForm.freekey timeout).
- Manual: back button → /assets; license digital/manual toggle; auto-category default; underline inputs; gradient save.
