import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui'
import { AuthSettingsPanel } from '@/components/features/settings'
import type { AuthSettingsRepository } from '@/domain/settings'
import { getSharedAuthSettingsRepository } from '@/infra/repositories'

export interface SettingsPageProps { repository?: AuthSettingsRepository }

export function SettingsPage({ repository }: SettingsPageProps) {
  const { t } = useTranslation('settings')
  const repo = repository ?? getSharedAuthSettingsRepository()
  return (
    <div className="space-y-5">
      <PageHeader icon="settings" title={t('title')} />
      <AuthSettingsPanel repository={repo} />
    </div>
  )
}
