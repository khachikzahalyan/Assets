import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui'
import { AuthSettingsPanel } from '@/components/features/settings'
import type { AuthSettingsRepository } from '@/domain/settings'
import { FirestoreAuthSettingsRepository } from '@/infra/repositories'
import { db } from '@/lib/firebase'

export interface SettingsPageProps { repository?: AuthSettingsRepository }

export function SettingsPage({ repository }: SettingsPageProps) {
  const { t } = useTranslation('settings')
  const defaultRepo = useMemo<AuthSettingsRepository>(
    () => new FirestoreAuthSettingsRepository(db()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const repo = repository ?? defaultRepo
  return (
    <div className="space-y-5">
      <PageHeader icon="settings" title={t('title')} />
      <AuthSettingsPanel repository={repo} />
    </div>
  )
}
