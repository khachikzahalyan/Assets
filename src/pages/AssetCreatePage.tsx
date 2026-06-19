import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader, LoadingState, ErrorState } from '@/components/ui'
import { AssetCreateForm } from '@/components/features/assets/create/AssetCreateForm'
import { useAuth } from '@/contexts/AuthContext'
import type { Asset, AssetReferenceData, CreateAssetInput } from '@/domain/asset'
import type { AssetRepository, AssetWriteRepository } from '@/domain/asset'
import { FirestoreAssetRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'

export interface AssetCreatePageProps {
  repository?: AssetRepository & AssetWriteRepository
  onCreated?: (a: Asset) => void
}

export function AssetCreatePage({ repository, onCreated }: AssetCreatePageProps) {
  const { t } = useTranslation('assets')
  const { user, role } = useAuth()

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
      const { value } = await (repo as AssetWriteRepository).createAsset(input, {
        uid: user.id,
        role,
      })
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
      />
    </div>
  )
}
