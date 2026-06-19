import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Field, Input, SectionCard, Btn } from '@/components/ui'
import type { AssetReferenceData, CreateAssetInput } from '@/domain/asset'
import { CategoryPicker, categoryCapabilities } from './CategoryPicker'
import { QuickAssignment } from './QuickAssignment'
import type { QAValue } from './QuickAssignment'
import { maskLicenseKey } from '@/lib/audit/maskSecrets'

export interface AssetCreateFormProps {
  ref: AssetReferenceData
  onSubmit: (input: CreateAssetInput) => Promise<void>
  submitting: boolean
  error: string | null
  onCancel?: () => void
}

export function AssetCreateForm({ ref: refData, onSubmit, submitting, error, onCancel }: AssetCreateFormProps) {
  const { t } = useTranslation('assets')

  // Identity fields
  const [categoryId, setCategoryId] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [typeField, setTypeField] = useState('')
  const [invCode, setInvCode] = useState('')
  const [serial, setSerial] = useState('')

  // Specs
  const [cpu, setCpu] = useState('')
  const [ram, setRam] = useState('')
  const [ssd, setSsd] = useState('')
  const [gpu, setGpu] = useState('')

  // OEM License key (only shown when selectedCategory.hasOemLicense === true)
  const [oemRawKey, setOemRawKey] = useState('')

  // Quick Assignment
  const [qa, setQa] = useState<QAValue>({ picked: null, assignment: null })

  // Resolve selected category
  const selectedCategory = refData.categories.find(c => c.id === categoryId) ?? null
  const caps = selectedCategory ? categoryCapabilities(selectedCategory) : null
  const showOemKey = selectedCategory?.hasOemLicense === true

  // Save gating
  const identityMissing: string[] = []
  if (caps) {
    if (!invCode.trim()) identityMissing.push(t('validation.invRequired'))
    if (caps.hasBrandModel && (!brand.trim() || !model.trim())) identityMissing.push(t('validation.brandModelRequired'))
    if (caps.hasTypeField && !typeField.trim()) identityMissing.push(t('validation.typeRequired'))
    if (caps.requiresSerial && !serial.trim()) identityMissing.push(t('validation.serialRequired'))
  }

  const categoryChosen = Boolean(categoryId)
  const identityComplete = caps !== null && identityMissing.length === 0
  const recipientPicked = qa.picked !== null

  const canSave = categoryChosen && identityComplete && recipientPicked && !submitting

  // Save disabled reason — only show identity issues, not missing recipient
  const saveDisabledReason = identityMissing.length > 0 ? identityMissing[0] : null

  async function handleSave() {
    if (!canSave || !caps || !categoryId) return

    const currentSpecs =
      caps.hasSpecs && (cpu || ram || ssd || gpu)
        ? {
            ...(cpu ? { cpu } : {}),
            ...(ram ? { ram } : {}),
            ...(ssd ? { ssd } : {}),
            ...(gpu ? { gpu } : {}),
          }
        : null

    const branchId =
      qa.picked === 'branch' && qa.assignment?.branchId
        ? qa.assignment.branchId
        : refData.branches[0]?.id ?? ''

    const deptId =
      qa.picked === 'department' && qa.assignment?.departmentId
        ? qa.assignment.departmentId
        : null

    // OEM license: only included when the category has hasOemLicense and a key was typed
    // TODO(D): free-key picker for existing pool licenses (existingLicenseId path)
    const oemLicense: CreateAssetInput['oemLicense'] = showOemKey && oemRawKey.trim()
      ? { rawKey: oemRawKey.trim() }
      : null

    const input: CreateAssetInput = {
      categoryId,
      brand: caps.hasBrandModel ? brand.trim() || null : null,
      model: caps.hasBrandModel ? model.trim() || null : null,
      type: caps.hasTypeField ? typeField.trim() || null : null,
      invCode: invCode.trim(),
      serial: caps.requiresSerial ? serial.trim() || null : null,
      assignment: qa.assignment,
      branchId,
      deptId,
      currentSpecs,
      oemLicense,
    }

    await onSubmit(input)
  }

  return (
    <SectionCard noHeader>
      <div className="space-y-5">

        {/* Category picker */}
        <Field label={t('form.category')} required>
          <CategoryPicker
            categories={refData.categories}
            value={categoryId}
            onChange={id => {
              setCategoryId(id)
              // Reset identity fields on category change
              setBrand('')
              setModel('')
              setTypeField('')
              setInvCode('')
              setSerial('')
              setCpu(''); setRam(''); setSsd(''); setGpu('')
              setOemRawKey('')
            }}
          />
        </Field>

        {/* Identity fields — revealed once a category is chosen */}
        {caps && (
          <>
            {/* Device / Network shape: Brand + Model */}
            {caps.hasBrandModel && (
              <div className="grid grid-cols-2 gap-4">
                <Field label={t('form.brand')} required>
                  <Input
                    id="asset-brand"
                    value={brand}
                    onChange={setBrand}
                    placeholder={t('placeholders.brand')}
                  />
                </Field>
                <Field label={t('form.model')} required>
                  <Input
                    id="asset-model"
                    value={model}
                    onChange={setModel}
                    placeholder={t('placeholders.model')}
                  />
                </Field>
              </div>
            )}

            {/* Furniture shape: Type field replacing Brand+Model */}
            {caps.hasTypeField && (
              <Field label={t('form.type')} required>
                <Input
                  id="asset-type"
                  value={typeField}
                  onChange={setTypeField}
                  placeholder={t('placeholders.type')}
                />
              </Field>
            )}

            {/* Inventory Code */}
            <Field label={t('form.invCode')} required>
              <Input
                id="asset-inv-code"
                value={invCode}
                onChange={setInvCode}
                placeholder={t('placeholders.invCode')}
                mono
              />
            </Field>

            {/* Serial — shown only when category requires it */}
            {caps.requiresSerial && (
              <Field label={t('form.serial')} required>
                <Input
                  id="asset-serial"
                  value={serial}
                  onChange={setSerial}
                  placeholder={t('placeholders.serial')}
                />
              </Field>
            )}

            {/* Specs sub-card */}
            {caps.hasSpecs && (
              <SectionCard title={t('form.specs')} icon="cpu">
                <div className="grid grid-cols-2 gap-4">
                  <Field label={t('form.specCpu')}>
                    <Input
                      id="asset-spec-cpu"
                      value={cpu}
                      onChange={setCpu}
                      placeholder={t('placeholders.spec')}
                    />
                  </Field>
                  <Field label={t('form.specRam')}>
                    <Input
                      id="asset-spec-ram"
                      value={ram}
                      onChange={setRam}
                      placeholder={t('placeholders.spec')}
                    />
                  </Field>
                  <Field label={t('form.specSsd')}>
                    <Input
                      id="asset-spec-ssd"
                      value={ssd}
                      onChange={setSsd}
                      placeholder={t('placeholders.spec')}
                    />
                  </Field>
                  <Field label={t('form.specGpu')}>
                    <Input
                      id="asset-spec-gpu"
                      value={gpu}
                      onChange={setGpu}
                      placeholder={t('placeholders.spec')}
                    />
                  </Field>
                </div>
              </SectionCard>
            )}
          {/* OEM License Key — shown only for hasOemLicense categories */}
          {showOemKey && (
            <SectionCard title={t('oem.sectionTitle')} icon="key-round">
              <div className="space-y-2">
                <Field label={t('oem.keyLabel')}>
                  <Input
                    id="asset-oem-key"
                    value={oemRawKey}
                    onChange={setOemRawKey}
                    placeholder={t('oem.keyPlaceholder')}
                    mono
                  />
                </Field>
                {oemRawKey && (
                  <p className="text-[11px] font-mono text-[#64748B]">
                    {maskLicenseKey(oemRawKey)}
                  </p>
                )}
                <p className="text-[11px] text-[#64748B]">
                  {t('oem.secureHint')}
                </p>
              </div>
            </SectionCard>
          )}
        </>
        )}

        {/* Quick Assignment — rendered outside <Field> (which uses <label>)
            because placing buttons inside a <label> corrupts their ARIA names. */}
        <div>
          <span className="block mb-2 text-[11px] uppercase tracking-[0.06em] font-semibold text-[#64748B]">
            {t('qa.title')}
          </span>
          <QuickAssignment
            value={qa}
            onChange={setQa}
            employees={refData.employees}
            departments={refData.departments}
            branches={refData.branches}
            mainBranchId={refData.branches[0]?.id ?? ''}
            statuses={refData.statuses}
          />
        </div>

        {/* Error message */}
        {error && (
          <p role="alert" className="text-[12px] text-[#FDA4AF]">
            {error}
          </p>
        )}

        {/* Save disabled reason — only identity issues */}
        {saveDisabledReason && !error && (
          <p className="text-[12px] text-[#64748B]">{saveDisabledReason}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <Btn
            variant="primary"
            size="md"
            disabled={!canSave}
            onClick={handleSave}
            type="button"
          >
            {t('form.save')}
          </Btn>
          <Btn variant="ghost" size="md" type="button" {...(onCancel ? { onClick: onCancel } : {})}>
            {t('form.cancel')}
          </Btn>
        </div>
      </div>
    </SectionCard>
  )
}
