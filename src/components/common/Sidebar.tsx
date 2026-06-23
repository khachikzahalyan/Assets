import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { navForRole } from '@/config'
import { Icon } from '@/components/ui/icon'
import { IconBtn } from '@/components/ui/icon-btn'
import { Chip } from '@/components/ui/chip'

// Role-filtered nav is UX only — NOT a security control.

export interface SidebarProps {
  currentRoute: string
  onNavigate: (route: string) => void
  mobile?: boolean
  onClose?: () => void
}

export function Sidebar({ currentRoute, onNavigate, mobile = false, onClose }: SidebarProps) {
  const { role } = useAuth()
  const nav = useMemo(() => navForRole(role), [role])
  const { t } = useTranslation(['nav', 'common'])

  return (
    <aside className={mobile ? 'sidebar-drawer anim-drawer-slide' : 'app-shell-sidebar'}>
      {/* Brand row */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-dark text-white inline-flex items-center justify-center font-extrabold tracking-tight text-[14px] shadow-md shadow-accent/25">
            AMS
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-text-primary">{t('app.name', { ns: 'common' })}</div>
            <div className="text-[11px] text-text-subtle -mt-0.5">{t('app.brandSub', { ns: 'common' })}</div>
          </div>
        </div>
        {mobile && (
          <IconBtn
            icon="x"
            {...(onClose != null ? { onClick: onClose } : {})}
            size="sm"
            title={t('actions.close', { ns: 'common' })}
          />
        )}
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 py-2 overflow-hidden">
        {nav.map((group) => (
          <div key={group.id} className="mb-0.5">
            {group.labelKey != null && (
              <div className="sidebar-section-label">{t(group.labelKey, { ns: 'nav' })}</div>
            )}
            {group.items.map((item) => {
              const active = currentRoute === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`sidebar-item w-full text-left ${active ? 'is-active' : ''}`}
                >
                  <Icon name={item.icon} size={18} />
                  <span className="flex-1 truncate">{t(item.labelKey, { ns: 'nav' })}</span>
                  {item.phase != null && (
                    <Chip color="gray" size="sm">{t('stub.soon', { ns: 'common' })}</Chip>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
