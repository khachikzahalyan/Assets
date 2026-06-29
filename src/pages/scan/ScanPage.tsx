import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Scanner } from '@yudiel/react-qr-scanner'
import { db } from '@/lib/firebase'
import { FirestoreAssetRepository } from '@/infra/repositories/firestoreAssetRepository'
import type { AssetWriteRepository } from '@/domain/asset/AssetRepository'
import { PageHeader } from '@/components/ui/page-header'
import { SectionCard } from '@/components/ui/section-card'
import { Btn } from '@/components/ui/btn'
import { useToast } from '@/contexts/ToastContext'

export interface ScanPageProps {
  /** Test seam — production builds the Firestore repo lazily. */
  repository?: AssetWriteRepository
}

export function ScanPage({ repository }: ScanPageProps) {
  const { t } = useTranslation('scan')
  const navigate = useNavigate()
  const { showToast } = useToast()

  const defaultRepo = useMemo<AssetWriteRepository>(
    () => new FirestoreAssetRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo

  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)

  async function handleScan(codes: { rawValue: string }[]) {
    const code = codes[0]?.rawValue?.trim()
    if (!code || busy.current) return
    busy.current = true
    setResolving(true)
    try {
      const asset = (await repo.findByBarcode(code)) ?? (await repo.findByInvCode(code))
      if (asset) {
        navigate(`/assets/${asset.id}`)
        return
      }
      showToast(t('notFound', { code }))
    } catch {
      showToast(t('cameraError'))
    } finally {
      busy.current = false
      setResolving(false)
    }
  }

  return (
    <div>
      <PageHeader icon="scan-line" title={t('title')} />
      <SectionCard noHeader bodyClassName="max-md:p-2">
        {error ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-text-secondary text-sm">{error}</p>
            <Btn variant="secondary" onClick={() => setError(null)}>
              {t('retry')}
            </Btn>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-md">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-black">
              <Scanner
                formats={['code_128', 'qr_code']}
                onScan={handleScan}
                onError={() => setError(t('permissionDenied'))}
                paused={resolving}
                constraints={{ facingMode: 'environment' }}
              />
            </div>
            <p className="mt-3 text-center text-sm text-text-secondary">
              {resolving ? t('resolving') : t('hint')}
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
