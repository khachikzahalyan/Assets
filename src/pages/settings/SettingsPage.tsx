import { AuthSettingsPanel } from '@/components/features/settings'
import type { AuthSettingsRepository } from '@/domain/settings'
import { getSharedAuthSettingsRepository } from '@/infra/repositories'

export interface SettingsPageProps { repository?: AuthSettingsRepository }

export function SettingsPage({ repository }: SettingsPageProps) {
  const repo = repository ?? getSharedAuthSettingsRepository()
  // No PageHeader — the breadcrumb in the top bar already names the page (owner request).
  return (
    <div className="space-y-5">
      <AuthSettingsPanel repository={repo} />
    </div>
  )
}
