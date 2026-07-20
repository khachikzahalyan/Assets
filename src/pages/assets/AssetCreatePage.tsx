import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Icon, ErrorState } from '@/components/ui'
import { AssetCreateForm } from '@/components/features/assets/create/AssetCreateForm'
import { useAuth } from '@/contexts/AuthContext'
import type { Asset, AssetReferenceData, CreateAssetInput } from '@/domain/asset'
import type { AssetRepository, AssetWriteRepository } from '@/domain/asset'
import type { WorkstationLicenseRepository } from '@/domain/license'
import { FirestoreAssetRepository, FirestoreWorkstationLicenseRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'
import { setLicenseKey } from '@/lib/licenses/revealKey'

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

  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [oemKeyWarning, setOemKeyWarning] = useState<string | null>(null)

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

  async function handleSubmit(input: CreateAssetInput) {
    setSubmitting(true)
    setSaveError(null)
    setOemKeyWarning(null)
    try {
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
      navigate('/assets')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/inv/i.test(msg)) setSaveError(t('validation.invTaken'))
      else if (/serial/i.test(msg)) setSaveError(t('validation.serialTaken'))
      else setSaveError(t('validation.saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitBatch(inputs: CreateAssetInput[]) {
    setSubmitting(true)
    setSaveError(null)
    setOemKeyWarning(null)
    try {
      const actor = { uid: user.id, role }
      const created = await (repo as AssetWriteRepository).createAssetsBatch(inputs, actor)
      onCreated?.(created[0] ?? (undefined as unknown as Asset))
      navigate('/assets')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/inv/i.test(msg)) setSaveError(t('validation.invTaken'))
      else if (/serial/i.test(msg)) setSaveError(t('validation.serialTaken'))
      else setSaveError(t('validation.saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    // Mirror AssetCreateForm outer wrapper exactly — no PageHeader (loaded branch has none).
    // Header chrome (AMS pill + title + close) is static and always real.
    // Category grid and form fields are async-driven → shimmer bars.
    return (
      <div className="space-y-5">
        <div className="bg-surface rounded-2xl ring-1 ring-[#2A2F36]/50 overflow-hidden w-full max-w-[1600px] mx-auto">
          {/* In-card header — static chrome rendered real */}
          <div className="flex items-center justify-between max-md:px-3 max-md:pt-2.5 max-md:pb-2.5 px-5 py-3 border-b border-[#2A2F36]/60 gap-2 overflow-hidden">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="inline-flex items-center bg-[#F97316]/15 text-accent text-[11px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-md ring-1 ring-[#F97316]/30 shrink-0">
                AMS
              </span>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-text-primary leading-tight truncate">
                  {t('form.createTitle')}
                </h2>
                <p className="text-[13px] text-text-subtle mt-0.5 truncate">
                  {t('form.subtitleCat', { cat: '—' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Mode toggle placeholder — grayed out during load */}
              <div className="inline-flex bg-[#22272E]/80 rounded-xl ring-1 ring-[#2A2F36]/60 p-0.5 opacity-40">
                <div className="w-7 h-7 rounded-lg" />
                <div className="w-7 h-7 rounded-lg" />
              </div>
              {/* Functional close button */}
              <button
                type="button"
                onClick={() => navigate('/assets')}
                aria-label={t('form.close')}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text-subtle hover:text-text-primary hover:bg-border transition-colors"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          </div>
          {/* Grid body — shimmer both columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 max-lg:pb-28">
            {/* Left column: group tabs + category picker */}
            <section className="max-md:px-[14px] px-6 py-5 lg:border-r lg:border-[#2A2F36]/80">
              <div className="space-y-4">
                {/* GroupTabs shimmer */}
                <div className="flex gap-1.5">
                  {[72, 88, 80].map(w => (
                    <div key={w} style={{ width: w }} className="h-8 rounded-lg anim-skeleton" />
                  ))}
                </div>
                {/* CategoryPicker shimmer — 2-col card grid */}
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-[56px] rounded-xl anim-skeleton" />
                  ))}
                </div>
              </div>
            </section>
            {/* Right column: form fields */}
            <section className="max-md:px-[14px] px-6 py-5">
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-9 rounded-lg anim-skeleton" />
                ))}
              </div>
            </section>
          </div>
        </div>
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
    </div>
  )
}
