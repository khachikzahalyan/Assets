import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Breadcrumbs } from './Breadcrumbs'
import { LanguageToggle } from './LanguageToggle'
import { ProfileMenu } from './ProfileMenu'
import { NotificationBell } from './NotificationBell'

export interface TopBarProps {
  breadcrumbs: string[]
  customContent?: ReactNode
}

export function TopBar({ breadcrumbs, customContent }: TopBarProps) {
  const { role } = useAuth()
  const navigate = useNavigate()
  const canManageReturns = role === 'super_admin' || role === 'asset_admin'

  return (
    <div className="app-shell-topbar flex items-center gap-3 px-4 lg:px-6">
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
