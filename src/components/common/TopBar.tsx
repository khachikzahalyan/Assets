import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/icon'
import { Breadcrumbs } from './Breadcrumbs'
import { LanguageToggle } from './LanguageToggle'
import { ProfileMenu } from './ProfileMenu'

export interface TopBarProps {
  breadcrumbs: string[]
  customContent?: ReactNode
  onOpenSidebar: () => void
}

export function TopBar({ breadcrumbs, customContent, onOpenSidebar }: TopBarProps) {
  const { t } = useTranslation('common')

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

      {/* Right cluster: language toggle + profile */}
      <div className="flex items-center gap-2">
        <LanguageToggle />
        <ProfileMenu />
      </div>
    </div>
  )
}
