import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Icon } from '@/components/ui/icon'
import { Breadcrumbs } from './Breadcrumbs'
import { LanguageToggle } from './LanguageToggle'
import { ProfileMenu } from './ProfileMenu'
import { NotificationBell } from './NotificationBell'

export interface TopBarProps {
  breadcrumbs: string[]
  customContent?: ReactNode
  onOpenSidebar: () => void
}

export function TopBar({ breadcrumbs, customContent, onOpenSidebar }: TopBarProps) {
  const { t } = useTranslation('common')
  const { role } = useAuth()
  const navigate = useNavigate()
  const canManageReturns = role === 'super_admin' || role === 'asset_admin'

  return (
    <div className="app-shell-topbar flex items-center gap-3 px-4 lg:px-6">
      {/* Hamburger — mobile only */}
      <button
        type="button"
        onClick={onOpenSidebar}
        className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-[#94A3B8] hover:bg-[#22272E] transition-colors"
        title={t('actions.openMenu')}
      >
        <Icon name="menu" size={18} />
      </button>

      {/* Topbar slot — page-supplied chips, else default breadcrumbs */}
      <div className="flex-1 min-w-0">
        {customContent != null ? customContent : <Breadcrumbs items={breadcrumbs} />}
      </div>

      {/* Right cluster: bell (admins) + language toggle + profile */}
      <div className="flex items-center gap-2">
        {canManageReturns && (
          <NotificationBell onSelect={(assetId) => navigate(`/assets/${assetId}`)} />
        )}
        <LanguageToggle />
        <ProfileMenu />
      </div>
    </div>
  )
}
