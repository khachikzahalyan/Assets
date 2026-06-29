import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PageHeader, LoadingState, ErrorState } from '@/components/ui'
import { AssetCreateForm } from '@/components/features/assets/create/AssetCreateForm'
import { LabelPreviewDialog } from '@/components/features/assets/label/LabelPreviewDialog'
import { useAuth } from '@/contexts/AuthContext'
import type { Asset, AssetReferenceData, CreateAssetInput } from '@/domain/asset'
import type { AssetRepository, AssetWriteRepository } from '@/domain/asset'
import type { WorkstationLicenseRepository } from '@/domain/license'
import { FirestoreAssetRepository, FirestoreWorkstationLicenseRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'
import { setLicenseKey } from '@/lib/licenses/revealKey'
import { generateBarcodeCandidate } from '@/domain/asset/barcode'

/** Builds a non-persisted draft Asset for the preview dialog. Only invCode + barcode are
 *  shown on the label, but a full Asset is returned to satisfy the type. */
function toDraftAsset(input: CreateAssetInput): Asset {
  return {
    id: 'draft', categoryId: input.categoryId, brand: input.brand, model: input.model,
    type: input.type ?? null, invCode: input.invCode, serial: input.serial,
    barcode: input.barcode ?? null, statusId: 'st_warehouse', assignment: input.assignment,
    branchId: input.branchId, deptId: input.deptId, updatedAt: new Date().toISOString(),
  }
}

export interface AssetCreatePageProps {
  repository?: AssetRepository & AssetWriteRepository
  /** Injected license repository used to resolve the licenseId after create (test path). */
  licenseRepository?: WorkstationLicenseRepository
  onCreated?: (a: Asset) => void
  /**
   * Optional hook to persist the raw OEM key to the secrets store after asset creation.
   * Defaults to the `setLicenseKey` Cloud Function via httpsCallable.
   * Inject a stub in tests to avoid calling Firebase Functions.
   *
   * NOTE: The raw key must never reach Firestore directly — it is routed through the
   * Cloud Function which writes to `licenses/{id}/secrets/current` under admin SDK
   * (Firestore client rules deny client writes to secrets/*).
   */
  onPersistOemSecret?: (licenseId: string, rawKey: string) => Promise<void>
}

export function AssetCreatePage({ repository, licenseRepository, onCreated, onPersistOemSecret }: AssetCreatePageProps) {
  const { t } = useTranslation('assets')
  const { user, role } = useAuth()
  const navigate = useNavigate()

  // Build the default Firestore repo lazily — only when no test repo is injected.
  // The useMemo factory only executes if repository is undefined at mount time.
  const defaultRepo = useMemo<AssetRepository & AssetWriteRepository | null>(
    () => (repository ? null : new FirestoreAssetRepository(db(), new FirestoreWorkstationLicenseRepository(db()))),
    // repository identity is stable across renders (passed from parent or undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? (defaultRepo as AssetRepository & AssetWriteRepository)

  // Stable license repo for the OEM picker — mirrors defaultRepo pattern.
  // When licenseRepository is injected (test path) use it directly; otherwise build
  // Firestore one only when no non-Firestore asset repo is injected (production path).
  const defaultLicenseRepo = useMemo<WorkstationLicenseRepository | null>(
    () => (licenseRepository || repository ? null : new FirestoreWorkstationLicenseRepository(db())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const resolvedLicenseRepo = licenseRepository ?? (defaultLicenseRepo ?? undefined)

  const [refData, setRefData] = useState<AssetReferenceData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // `submitting` stays wired to the form for prop stability; under the deferred-save flow
  // the form submit no longer performs async work, so it never toggles to true.
  const [submitting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [oemKeyWarning, setOemKeyWarning] = useState<string | null>(null)
  const [previewAssets, setPreviewAssets] = useState<Asset[]>([])
  const [pendingInputs, setPendingInputs] = useState<CreateAssetInput[]>([])
  const [pendingMode, setPendingMode] = useState<'single' | 'batch'>('single')

  function loadRef() {
    setLoading(true)
    setLoadError(null)
    repo
      .loadReferenceData()
      .then(data => {
        setRefData(data)
        setLoading(false)
      })
      .catch(() => {
        setLoadError(t('validation.saveFailed'))
        setLoading(false)
      })
  }

  // Load on mount
  useEffect(() => {
    loadRef()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Form submit: build drafts only — NOTHING is saved until «Печать» ───────────
  // Each input gets a client-side barcode candidate so the preview shows the SAME
  // barcode that will print. The real save is deferred to commitPending() (below),
  // invoked by the dialog's onPrint.
  // async only to satisfy the form's Promise<void> handler signature — no awaited work here.
  async function handleSubmit(input: CreateAssetInput): Promise<void> {
    setSaveError(null)
    setOemKeyWarning(null)
    const withBarcode = { ...input, barcode: generateBarcodeCandidate() }
    setPendingInputs([withBarcode])
    setPendingMode('single')
    setPreviewAssets([toDraftAsset(withBarcode)])
  }

  async function handleSubmitBatch(inputs: CreateAssetInput[]): Promise<void> {
    setSaveError(null)
    setOemKeyWarning(null)
    const withBarcodes = inputs.map(i => ({ ...i, barcode: generateBarcodeCandidate() }))
    setPendingInputs(withBarcodes)
    setPendingMode('batch')
    setPreviewAssets(withBarcodes.map(toDraftAsset))
  }

  // ── Commit: actually persist on «Печать», returning the saved asset(s) to print ─
  async function commitSingle(input: CreateAssetInput): Promise<Asset> {
    const actor = { uid: user.id, role }
    const { value } = await (repo as AssetWriteRepository).createAsset(input, actor)

    // OEM secret persistence — only when the input carried a rawKey.
    // The repo already created the license DOC (without the secret). Now we must
    // persist the raw secret via the setLicenseKey callable (admin SDK writes to
    // secrets/current; client SDK rules block direct writes).
    if (input.oemLicense && 'kind' in input.oemLicense && input.oemLicense.kind === 'manual' && input.oemLicense.rawKey) {
      const rawKey = input.oemLicense.rawKey
      try {
        if (onPersistOemSecret) {
          // Resolve the real licenseId before calling the injected stub — never
          // pass an empty string. Use the injected licenseRepository if available
          // (test path), otherwise fall back to Firestore.
          const licRepo = licenseRepository ?? (!repository ? new FirestoreWorkstationLicenseRepository(db()) : null)
          const resolvedLicenseId = licRepo ? (await licRepo.listForAsset(value.id))[0]?.id : undefined
          if (!resolvedLicenseId) {
            // Cannot resolve licenseId — non-fatal warning; asset + license doc exist.
            setOemKeyWarning(t('validation.oemKeyNotStored'))
          } else {
            await onPersistOemSecret(resolvedLicenseId, rawKey)
          }
        } else if (!repository) {
          // Production Firestore path: look up the newly created license by asset id.
          // This is a best-effort call — the asset + license DOC already exist; only
          // the secret write could fail.
          const licRepo = new FirestoreWorkstationLicenseRepository(db())
          const bound = await licRepo.listForAsset(value.id)
          const licenseId = bound[0]?.id
          if (licenseId) {
            await setLicenseKey('licenses', licenseId, rawKey)
          } else {
            // License doc created but ID could not be resolved — non-fatal warning.
            setOemKeyWarning(t('validation.oemKeyNotStored'))
          }
        }
        // If repository prop IS injected (non-Firestore) but no onPersistOemSecret
        // was provided — the InMemory repo handles secret storage internally, nothing to do.
      } catch {
        // Non-fatal: the asset + license DOC exist. Surface a warning to the user
        // so they know to rotate the key via the license management UI.
        setOemKeyWarning(t('validation.oemKeyNotStored'))
      }
    }

    onCreated?.(value)
    return value
  }

  async function commitBatch(inputs: CreateAssetInput[]): Promise<Asset[]> {
    const actor = { uid: user.id, role }
    const created = await (repo as AssetWriteRepository).createAssetsBatch(inputs, actor)
    onCreated?.(created[0] ?? (undefined as unknown as Asset))
    return created
  }

  async function commitPending(): Promise<Asset[]> {
    if (pendingMode === 'single') return [await commitSingle(pendingInputs[0]!)]
    return commitBatch(pendingInputs)
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader icon="package-plus" title={t('form.createTitle')} />
        <LoadingState rows={5} />
      </div>
    )
  }

  if (loadError || !refData) {
    return (
      <div className="space-y-5">
        <PageHeader icon="package-plus" title={t('form.createTitle')} />
        <ErrorState onRetry={loadRef} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {oemKeyWarning && (
        <p role="alert" className="text-[12px] text-[#FCD34D] px-1">{oemKeyWarning}</p>
      )}
      <AssetCreateForm
        referenceData={refData}
        onSubmit={handleSubmit}
        onSubmitBatch={handleSubmitBatch}
        submitting={submitting}
        error={saveError}
        onCancel={() => navigate('/assets')}
        {...(resolvedLicenseRepo ? { licenseRepository: resolvedLicenseRepo } : {})}
      />
      {previewAssets.length > 0 && (
        <LabelPreviewDialog
          assets={previewAssets}
          onPrint={commitPending}
          onClose={() => { setPreviewAssets([]); setPendingInputs([]) }}
        />
      )}
    </div>
  )
}
