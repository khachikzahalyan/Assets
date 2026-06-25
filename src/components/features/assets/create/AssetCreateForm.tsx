import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Field, Input } from './ui'
import { Icon, Chip } from '@/components/ui'
import type { AssetReferenceData, CreateAssetInput, AssetSpecs } from '@/domain/asset'
import type { WorkstationLicenseRepository } from '@/domain/license'
import { CategoryPicker, categoryCapabilities } from './CategoryPicker'
import { QuickAssignment, type QAValue } from './QuickAssignment'
import { HEAD_OFFICE_BRANCH_ID } from '@/domain/asset/transferRules'
import { GroupTabs, type CategoryGroup } from './GroupTabs'
import { SpecsPanel } from './SpecsPanel'
import { ConditionWarranty, type ConditionWarrantyValue } from './ConditionWarranty'
import { GroupStepper, type GroupRow } from './GroupStepper'
import { LicensePicker } from '@/components/features/licenses'
import { isCompleteProductKey } from '@/lib/licenses/productKeyFormatter'
import { todayISO, oneYearFrom, warrantyBeforePurchase } from './warranty'
import { pluralAssets } from './ramStorage'

export type SubMode = 'single' | 'group'

export interface AssetCreateFormProps {
  /** Reference data (statuses/branches/departments/categories/employees). */
  referenceData: AssetReferenceData
  /** Single-asset submit. */
  onSubmit: (input: CreateAssetInput) => Promise<void>
  /** Group submit — receives N inputs sharing every field except invCode/serial. */
  onSubmitBatch?: (inputs: CreateAssetInput[]) => Promise<void>
  submitting: boolean
  error: string | null
  onCancel?: () => void
  licenseRepository?: WorkstationLicenseRepository
}

const EMPTY_SPECS: AssetSpecs = { cpu: '', ram: '', ssd: '', gpu: 'Встроенная' }

export function AssetCreateForm({ referenceData: refData, onSubmit, onSubmitBatch, submitting, error, onCancel, licenseRepository }: AssetCreateFormProps) {
  const { t } = useTranslation('assets')

  const [subMode, setSubMode] = useState<SubMode>('single')

  // Identity
  const [categoryId, setCategoryId] = useState('')
  const [group, setGroup] = useState<CategoryGroup | null>(null)
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [typeField, setTypeField] = useState('')
  const [invCode, setInvCode] = useState('')
  const [serial, setSerial] = useState('')

  // Specs
  const [specs, setSpecs] = useState<AssetSpecs>({ ...EMPTY_SPECS })

  // Condition + warranty
  const [warranty, setWarranty] = useState<ConditionWarrantyValue>({
    condition: 'new', purchaseDate: todayISO(), warrantyEndsAt: oneYearFrom(todayISO()),
  })

  // OEM license — B3: card toggle mode
  const [licenseMode, setLicenseMode] = useState<'oem_digital' | 'manual'>('manual')
  const [oemRawKey, setOemRawKey] = useState('')
  const [oemPickId, setOemPickId] = useState('')
  const [oemPool, setOemPool] = useState<{ id: string; name: string; vendor: string | null }[]>([])

  // Quick assignment — B6: default to warehouse
  const [qa, setQa] = useState<QAValue>({ picked: 'warehouse', assignment: null })

  // Group mode
  const [quantity, setQuantity] = useState(10)
  const [rows, setRows] = useState<GroupRow[]>([])

  const selectedCategory = refData.categories.find(c => c.id === categoryId) ?? null
  const caps = selectedCategory ? categoryCapabilities(selectedCategory) : null

  // Default warehouse/location branch is the Head Office (br_main), not the first
  // branch in the list. Fall back to the first branch only if br_main is absent.
  const headBranchId =
    refData.branches.find(b => b.id === HEAD_OFFICE_BRANCH_ID)?.id ??
    refData.branches[0]?.id ??
    ''
  const showOemKey = caps?.hasOemLicense === true
  const isGroup = subMode === 'group'

  function resetDependentFields() {
    setBrand(''); setModel(''); setTypeField(''); setInvCode(''); setSerial('')
    setSpecs({ ...EMPTY_SPECS })
    setOemRawKey(''); setOemPickId(''); setOemPool([])
    setLicenseMode('manual')
    setRows([])
    setQa({ picked: 'warehouse', assignment: null })
  }

  function handleCategoryChange(id: string) {
    setCategoryId(id)
    const c = refData.categories.find(x => x.id === id)
    if (c) setGroup(c.group)
    resetDependentFields()
  }

  function handleGroupTab(g: CategoryGroup) {
    setGroup(g)
    if (selectedCategory && selectedCategory.group !== g) {
      setCategoryId('')
      resetDependentFields()
    }
  }

  function handleSubMode(next: SubMode) {
    if (next === subMode) return
    setSubMode(next)
    setRows([])
    setInvCode(''); setSerial('')
    if (next === 'group') setQa({ picked: 'warehouse', assignment: null })
  }

  // Pre-select a default category on mount so the full form renders immediately.
  // Resolution order:
  //   1. First category with hasOemLicense (gives license + specs sections immediately).
  //   2. First category in the 'devices' group.
  //   3. First category in any group.
  //   4. '' (no categories seeded yet — graceful no-op).
  // Only fires once; subsequent user changes to category/group are unaffected.
  const defaultCategoryInitialized = useRef(false)
  useEffect(() => {
    if (defaultCategoryInitialized.current) return
    defaultCategoryInitialized.current = true
    const cats = refData.categories
    if (cats.length === 0) return
    // Prefer first category whose resolved caps include hasOemLicense.
    const oemCat = cats.find(c => categoryCapabilities(c).hasOemLicense)
    const devicesCat = cats.find(c => c.group === 'devices')
    const defaultCat = oemCat ?? devicesCat ?? cats[0]!
    setCategoryId(defaultCat.id)
    setGroup(defaultCat.group)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lazily load the free OEM pool for the picker.
  // categoryId is included in deps so the pool reloads whenever an OEM category is
  // (re-)selected — this covers the case where resetDependentFields clears oemPool
  // on a same-category re-selection without showOemKey changing.
  useEffect(() => {
    if (!showOemKey || !licenseRepository) return
    let cancelled = false
    licenseRepository.listAssignablePool()
      .then(all => {
        if (cancelled) return
        const freeOem = all.filter(l => l.type === 'OEM' && l.assignmentType === 'unassigned' && l.lifecycleStatus === 'active')
        setOemPool(freeOem.map(l => ({ id: l.id, name: l.name, vendor: l.vendor })))
      })
      .catch(() => { if (!cancelled) setOemPool([]) })
    return () => { cancelled = true }
  }, [showOemKey, licenseRepository, categoryId])

  // ---- Validation -----------------------------------------------------------
  const identityMissing: string[] = []
  if (caps && !isGroup) {
    if (!invCode.trim()) identityMissing.push(t('validation.invRequired'))
    // B7: split brand/model save-disabled reasons
    if (caps.hasBrandModel && !brand.trim()) identityMissing.push(t('validation.brandRequired'))
    if (caps.hasBrandModel && !model.trim()) identityMissing.push(t('validation.modelRequired'))
    if (caps.hasTypeField && !typeField.trim()) identityMissing.push(t('validation.typeRequired'))
    if (caps.requiresSerial && !serial.trim()) identityMissing.push(t('validation.serialRequired'))
  }
  if (caps && isGroup) {
    if (caps.hasBrandModel && !brand.trim()) identityMissing.push(t('validation.brandRequired'))
    if (caps.hasBrandModel && !model.trim()) identityMissing.push(t('validation.modelRequired'))
    if (caps.hasTypeField && !typeField.trim()) identityMissing.push(t('validation.typeRequired'))
  }

  const warrantyInvalid = warranty.condition === 'new' && warrantyBeforePurchase(warranty.purchaseDate, warranty.warrantyEndsAt)
  const groupIncomplete = isGroup && (rows.length < Math.max(2, quantity))

  const categoryChosen = Boolean(categoryId)
  const identityComplete = caps !== null && identityMissing.length === 0
  // B6: default is warehouse, so recipientPicked is always satisfied

  // When OEM-capable category is in manual-key mode (no pool pick), require a complete key.
  // Group mode never carries a license (oemLicense is set to null for each batch row),
  // so skip the key validation entirely when isGroup is true.
  const manualKeyValid =
    isGroup ||
    !showOemKey ||
    licenseMode !== 'manual' ||
    Boolean(oemPickId) ||
    isCompleteProductKey(oemRawKey)

  const canSave = categoryChosen && identityComplete && !warrantyInvalid && !groupIncomplete && !submitting && manualKeyValid

  const saveDisabledReason = warrantyInvalid
    ? t('validation.warrantyBeforePurchase')  // B7: use validation key (shorter prototype wording)
    : identityMissing.length > 0
      ? identityMissing[0]!
      : groupIncomplete
        ? t('groupMode.incomplete', { total: Math.max(2, quantity), done: rows.length, noun: pluralAssets(Math.max(2, quantity)) })
        : !manualKeyValid
            ? t('validation.licenseKeyRequired')
            : null

  // ---- Build inputs ---------------------------------------------------------
  function buildSpecs(): AssetSpecs | null {
    if (!caps?.hasSpecs) return null
    const out: AssetSpecs = {}
    if (specs.cpu?.trim()) out.cpu = specs.cpu.trim()
    if (specs.ram?.trim()) out.ram = specs.ram.trim()
    if (specs.ssd?.trim()) out.ssd = specs.ssd.trim()
    if (specs.gpu?.trim()) out.gpu = specs.gpu.trim()
    return Object.keys(out).length > 0 ? out : null
  }

  function baseInput(): Omit<CreateAssetInput, 'invCode' | 'serial' | 'assignment' | 'branchId' | 'deptId'> {
    // B3: oemLicense based on licenseMode + mutual exclusivity
    let oemLicense: CreateAssetInput['oemLicense'] = null
    if (showOemKey) {
      if (oemPickId) {
        oemLicense = { existingLicenseId: oemPickId }
      } else if (licenseMode === 'manual' && oemRawKey.trim()) {
        oemLicense = { kind: 'manual', rawKey: oemRawKey.trim() }
      } else if (licenseMode === 'oem_digital') {
        oemLicense = { kind: 'oem-digital' }
      }
    }
    return {
      categoryId,
      brand: caps?.hasBrandModel ? (brand.trim() || null) : null,
      model: caps?.hasBrandModel ? (model.trim() || null) : null,
      type: caps?.hasTypeField ? (typeField.trim() || null) : null,
      currentSpecs: buildSpecs(),
      condition: warranty.condition,
      purchaseDate: warranty.condition === 'new' ? warranty.purchaseDate : null,
      warrantyEndsAt: warranty.condition === 'new' ? warranty.warrantyEndsAt : null,
      oemLicense,
    }
  }

  async function handleSave() {
    if (!canSave || !caps || !categoryId) return

    if (isGroup) {
      const base = baseInput()
      const inputs: CreateAssetInput[] = rows.map(r => ({
        ...base,
        invCode: r.invCode,
        serial: caps.requiresSerial ? (r.serial || null) : null,
        assignment: null,
        branchId: headBranchId,
        deptId: null,
        oemLicense: null,
      }))
      await onSubmitBatch?.(inputs)
      return
    }

    const branchId = qa.picked === 'branch' && qa.assignment?.branchId
      ? qa.assignment.branchId
      : headBranchId
    const deptId = qa.picked === 'department' && qa.assignment?.departmentId
      ? qa.assignment.departmentId
      : null

    const input: CreateAssetInput = {
      ...baseInput(),
      invCode: invCode.trim(),
      serial: caps.requiresSerial ? (serial.trim() || null) : null,
      assignment: qa.assignment,
      branchId,
      deptId,
    }
    await onSubmit(input)
  }

  // ---- Render ---------------------------------------------------------------
  return (
    <div className="bg-surface rounded-2xl ring-1 ring-[#2A2F36]/50 overflow-hidden w-full max-w-[1600px] mx-auto">
      {/* B1: In-card header row with AMS pill+title on left, toggle+X on right */}
      <div className="flex items-center justify-between max-md:px-3 max-md:pt-2.5 max-md:pb-2.5 px-5 py-3 border-b border-[#2A2F36]/60 gap-2 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* AMS pill badge */}
          <span className="inline-flex items-center bg-[#F97316]/15 text-accent text-[11px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-md ring-1 ring-[#F97316]/30 shrink-0">AMS</span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-text-primary leading-tight truncate">
              {isGroup ? t('form.createTitleGroup') : t('form.createTitle')}
            </h2>
            <p className="text-[13px] text-text-subtle mt-0.5 truncate">{t('form.subtitleCat', { cat: selectedCategory?.name ?? '—' })}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Sub-mode toggle — desktop: text+icon; mobile: icon-only 28×28 */}
          <div className="inline-flex bg-[#22272E]/80 rounded-xl ring-1 ring-[#2A2F36]/60 p-0.5 gap-0.5" role="group" aria-label="Режим регистрации">
            {(['single', 'group'] as const).map(m => {
              const active = subMode === m
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleSubMode(m)}
                  className={`max-md:w-7 max-md:h-7 max-md:px-0 max-md:justify-center px-3 py-1.5 text-[14px] font-semibold rounded-lg transition-all duration-150 flex items-center gap-1.5
                    ${active ? 'bg-surface text-accent-hover shadow-sm ring-1 ring-[#F97316]/40' : 'text-text-primary hover:text-text-primary'}`}
                >
                  <Icon name={m === 'single' ? 'file-plus-2' : 'copy-plus'} size={12} />
                  <span className="max-md:hidden">{t(m === 'single' ? 'groupMode.single' : 'groupMode.group')}</span>
                </button>
              )
            })}
          </div>
          {/* X close button — B1 */}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              aria-label={t('form.close')}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-subtle hover:text-text-primary hover:bg-border transition-colors"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      </div>

      {/* MOBILE: add bottom padding to clear fixed save bar (~64px bar + safe-area) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 max-md:pb-[calc(72px+env(safe-area-inset-bottom,0px))]">
        {/* LEFT column — borderless section matching prototype .ams-sec-asset */}
        <section className="max-md:px-[14px] px-6 py-5 lg:border-r lg:border-[#2A2F36]/80 max-w-full overflow-x-hidden">
          <div className="space-y-4">
            <GroupTabs categories={refData.categories} selected={group} onSelect={handleGroupTab} />

            <CategoryPicker
              categories={refData.categories}
              value={categoryId}
              onChange={handleCategoryChange}
              group={group}
            />

            {caps && (
              <div className="space-y-4 anim-fade-slide-in">
                {caps.hasTypeField && (
                  <Field label={t('form.type')} required>
                    <Input id="asset-type" value={typeField} onChange={setTypeField} placeholder={t('placeholders.type')} />
                  </Field>
                )}

                {caps.hasBrandModel && (
                  <div className="grid grid-cols-2 max-md:grid-cols-1 gap-6 max-md:gap-4">
                    <Field label={t('form.brand')} required>
                      <Input id="asset-brand" value={brand} onChange={setBrand} placeholder={t('placeholders.brand')} />
                    </Field>
                    <Field label={t('form.model')} required>
                      <Input id="asset-model" value={model} onChange={setModel} placeholder={t('placeholders.model')} />
                    </Field>
                  </div>
                )}

                {isGroup ? (
                  <GroupStepper
                    requiresSerial={caps.requiresSerial}
                    quantity={quantity}
                    setQuantity={setQuantity}
                    rows={rows}
                    setRows={setRows}
                    invPlaceholder={caps.hasTypeField ? t('placeholders.invCodeFurniture') : t('placeholders.invCode')}
                  />
                ) : (
                  <div className={`grid gap-6 max-md:gap-4 ${caps.requiresSerial ? 'grid-cols-2 max-md:grid-cols-1' : 'grid-cols-1'}`}>
                    <Field label={t('form.invCode')} required>
                      <Input id="asset-inv-code" value={invCode} onChange={setInvCode} placeholder={t('placeholders.invCode')} mono />
                    </Field>
                    {caps.requiresSerial && (
                      <Field label={t('form.serial')} required>
                        <Input id="asset-serial" value={serial} onChange={setSerial} placeholder={t('placeholders.serial')} mono />
                      </Field>
                    )}
                  </div>
                )}

                {!caps.hasTypeField && (
                  <ConditionWarranty value={warranty} onChange={setWarranty} />
                )}

                {showOemKey && !isGroup && (
                  /* B3: OS License card-toggle section */
                  <div className="space-y-3">
                    <div className="text-[13px] font-semibold text-text-tertiary tracking-[0.06em] uppercase">{t('osLicense.title')}</div>
                    <LicensePicker
                      value={{ licenseMode, rawKey: oemRawKey, pickId: oemPickId }}
                      onChange={v => {
                        setLicenseMode(v.licenseMode)
                        setOemRawKey(v.rawKey)
                        setOemPickId(v.pickId)
                      }}
                      pool={oemPool}
                      showDigital
                      idPrefix="asset-oem"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT column */}
        <div className="max-w-full overflow-x-hidden">
          {caps?.hasSpecs && (
            /* Specs section — borderless, no title (SpecsPanel renders its own header) */
            <section className="max-md:px-[14px] px-6 py-5">
              <SpecsPanel specs={specs} onChange={setSpecs} isServer={caps.isServer} />
            </section>
          )}

          {/* Quick Assignment section — borderless titled section */}
          <section className={`max-md:px-[14px] px-6 py-5${caps?.hasSpecs ? ' border-t border-[#2A2F36]/80' : ''}`}>
            <div className="text-[13px] font-semibold text-text-tertiary tracking-[0.06em] uppercase mb-4">
              {t('qa.title')}
            </div>
            {isGroup ? (
              <div className="bg-[#111315]/60 border border-[#2A2F36]/70 rounded-lg px-3.5 py-2.5 text-[14px] text-text-primary flex items-center gap-2">
                <Icon name="lock" size={13} className="text-text-subtle shrink-0" />
                <span>{t('groupMode.batchHint')}</span>
              </div>
            ) : (
              <QuickAssignment
                value={qa}
                onChange={setQa}
                employees={refData.employees}
                departments={refData.departments}
                branches={refData.branches}
                mainBranchId={headBranchId}
                statuses={refData.statuses}
                isLaptop={caps?.isLaptop ?? false}
                isNetwork={caps?.isNetwork ?? false}
              />
            )}
          </section>
        </div>
      </div>

      {/* Footer — desktop: inline in flow; mobile: fixed to bottom of viewport */}
      <div className="
        max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:z-50
        max-md:pb-[env(safe-area-inset-bottom,0px)]
        px-6 max-md:px-3 py-4 max-md:py-0
        border-t border-[#2A2F36]/80 bg-surface
        flex items-center justify-between gap-3
        max-md:flex-col max-md:items-stretch max-md:gap-0
      ">
        {/* Hint/error row — desktop: inline left; mobile: compact strip above buttons, hidden when empty */}
        {(error || saveDisabledReason) && (
          <div className="max-w-[55%] max-md:max-w-full max-md:pt-2 max-md:pb-0 max-md:px-0">
            {error && <p role="alert" className="text-[12px] text-[#FDA4AF]">{error}</p>}
            {saveDisabledReason && !error && (
              <Chip color="amber">
                <Icon name="triangle-alert" size={13} className="shrink-0" />
                {saveDisabledReason}
              </Chip>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 max-md:gap-2 max-md:pb-2 max-md:pt-2 md:ml-auto">
          {/* Cancel — prototype style */}
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 max-md:flex-1 max-md:py-2.5 max-md:px-3 max-md:min-h-[44px] text-[15px] max-md:text-[14px] font-medium text-text-primary hover:text-text-primary bg-[#111315]/50 border border-[#2A2F36]/60 rounded-xl transition-all duration-150"
          >
            <Icon name="x" size={14} />
            {t('form.cancel')}
          </button>
          {/* Save — gradient prototype style */}
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            title={saveDisabledReason ?? undefined}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2 max-md:flex-1 max-md:py-2.5 max-md:px-3 max-md:min-h-[44px] text-[15px] max-md:text-[14px] font-semibold text-white bg-gradient-to-r from-accent to-accent-light rounded-xl shadow-[0_4px_16px_rgba(217,119,87,0.24)] hover:shadow-[0_6px_24px_rgba(217,119,87,0.32)] hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <Icon name="save" size={14} />
            {isGroup
              ? t('groupMode.createN', { count: rows.length || Math.max(2, quantity), noun: pluralAssets(rows.length || Math.max(2, quantity)) })
              : t('form.createAsset')}
          </button>
        </div>
      </div>
    </div>
  )
}
