import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PageHeader, LoadingState, ErrorState } from '@/components/ui'
import { AssetCreateForm } from '@/components/features/assets/create/AssetCreateForm'
import { useAuth } from '@/contexts/AuthContext'
import type { Asset, AssetReferenceData, CreateAssetInput } from '@/domain/asset'
import type { AssetRepository, AssetWriteRepository } from '@/domain/asset'
import { FirestoreAssetRepository, FirestoreWorkstationLicenseRepository } from '@/infra/repositories'
import { db, functions } from '@/lib/firebase'
import { httpsCallable } from 'firebase/functions'

export interface AssetCreatePageProps {
  repository?: AssetRepository & AssetWriteRepository
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

export function AssetCreatePage({ repository, onCreated, onPersistOemSecret }: AssetCreatePageProps) {
  const { t } = useTranslation('assets')
  const { user, role } = useAuth()
  const navigate = useNavigate()

  // Build the default Firestore repo lazily — only when no test repo is injected.
  // The useMemo factory only executes if repository is undefined at mount time.
  const defaultRepo = useMemo<AssetRepository & AssetWriteRepository | null>(
    () => (repository ? null : new FirestoreAssetRepository(db())),
    // repository identity is stable across renders (passed from parent or undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? (defaultRepo as AssetRepository & AssetWriteRepository)

  const [refData, setRefData] = useState<AssetReferenceData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

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
    try {
      const actor = { uid: user.id, role }
      const { value } = await (repo as AssetWriteRepository).createAsset(input, actor)

      // OEM secret persistence — only when the input carried a rawKey.
      // The repo already created the license DOC (without the secret). Now we must
      // persist the raw secret via the setLicenseKey callable (admin SDK writes to
      // secrets/current; client SDK rules block direct writes).
      //
      // GUARD: skip when a test repository was injected — the InMemory repo stores
      // secrets in-process already, and calling a callable from tests would fail.
      if (input.oemLicense && 'rawKey' in input.oemLicense && input.oemLicense.rawKey) {
        const rawKey = input.oemLicense.rawKey
        try {
          if (onPersistOemSecret) {
            // Test path (or custom injection): the caller provided a stub.
            await onPersistOemSecret('', rawKey) // licenseId resolved below when repo is Firestore
          } else if (!repository) {
            // Production Firestore path: look up the newly created license by asset id.
            // This is a best-effort call — the asset + license DOC already exist; only
            // the secret write could fail.
            const licRepo = new FirestoreWorkstationLicenseRepository(db())
            const bound = await licRepo.listForAsset(value.id)
            const licenseId = bound[0]?.id
            if (licenseId) {
              const setLicenseKey = httpsCallable<
                { collection: string; licenseId: string; rawKey: string },
                void
              >(functions(), 'setLicenseKey')
              await setLicenseKey({ collection: 'licenses', licenseId, rawKey })
            }
          }
          // If repository prop IS injected (non-Firestore) but no onPersistOemSecret
          // was provided — the InMemory repo handles secret storage internally, nothing to do.
        } catch {
          // Non-fatal: the asset + license DOC exist. Warn in console — an admin
          // can rotate the key later via the license management UI.
          console.warn('[AMS] OEM secret persist failed — rotate the key manually via the license page.')
        }
      }

      onCreated?.(value)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/inv/i.test(msg)) {
        setSaveError(t('validation.invTaken'))
      } else if (/serial/i.test(msg)) {
        setSaveError(t('validation.serialTaken'))
      } else {
        setSaveError(t('validation.saveFailed'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="anim-content-enter space-y-5">
        <PageHeader icon="package-plus" title={t('form.createTitle')} />
        <LoadingState rows={5} />
      </div>
    )
  }

  if (loadError || !refData) {
    return (
      <div className="anim-content-enter space-y-5">
        <PageHeader icon="package-plus" title={t('form.createTitle')} />
        <ErrorState onRetry={loadRef} />
      </div>
    )
  }

  return (
    <div className="anim-content-enter space-y-5">
      <PageHeader icon="package-plus" title={t('form.createTitle')} />
      <AssetCreateForm
        ref={refData}
        onSubmit={handleSubmit}
        submitting={submitting}
        error={saveError}
        onCancel={() => navigate('/assets')}
      />
    </div>
  )
}
