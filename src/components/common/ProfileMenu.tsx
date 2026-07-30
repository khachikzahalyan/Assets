import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { ROLES } from '@/config'
import { canAccess } from '@/config/access'
import { RoleIcon } from '@/components/ui/RoleIcon'
import { Avatar } from '@/components/ui/avatar'
import { Icon } from '@/components/ui/icon'
import { Chip } from '@/components/ui/chip'
import { useDismissOnOutside } from '@/hooks/useDismissOnOutside'

export function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const { user, role, setRole, signOut } = useAuth()
  const { t } = useTranslation(['common', 'nav'])
  const navigate = useNavigate()

  useDismissOnOutside([rootRef], () => setOpen(false), open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ams-profile-trigger inline-flex items-center gap-2 h-9 pl-1 pr-2.5 rounded-lg hover:bg-surface-2 transition-colors max-md:w-9 max-md:gap-0 max-md:px-0 max-md:justify-center"
        title={user.name}
      >
        {/* Mobile (prototype): 28px rounded-square avatar, no chevron. Desktop unchanged. */}
        <span className="inline-flex max-md:[&>span]:rounded-lg">
          <Avatar user={user} size="sm" role={role} />
        </span>
        <span className="ams-profile-name-text hidden sm:flex flex-col items-start leading-tight">
          <span className="text-[12px] font-semibold text-text-primary truncate max-w-[120px]">{user.name}</span>
          <span className="text-[10px] text-text-subtle">
              {t(`roles.${role}`, { ns: 'nav' })}
            </span>
        </span>
        <Icon name="chevron-down" size={12} className="text-text-subtle max-md:hidden" />
      </button>

      {open && (
        <div
          /* Mobile (owner devtools mock): fixed to the viewport top-right just under
             the topbar (top 49px / right 2px), 220px wide, 14px radius — instead of
             the anchored absolute dropdown used on desktop. */
          className="ams-profile-dropdown absolute right-0 top-full mt-1.5 w-64 max-md:fixed max-md:top-[49px] max-md:right-[2px] max-md:left-auto max-md:bottom-auto max-md:mt-0 max-md:w-[220px] max-md:rounded-[14px] bg-surface-2 border border-border rounded-xl anim-dropdown-in overflow-hidden z-[200]"
          style={{ boxShadow: 'var(--shadow-popover)' }}
        >
          {/* User header — compact centered profile card: everything on the
              vertical axis, tight spacing so the menu stays short. */}
          <div className="flex flex-col items-center text-center px-3.5 pt-3 pb-2.5 border-b border-border">
            <div className="ams-profile-dropdown-avatar mb-1.5">
              <Avatar user={user} size="md" role={role} />
            </div>
            <div className="w-full text-[13px] font-semibold text-text-primary truncate leading-tight">{user.name}</div>
            <div className="w-full text-[11px] text-text-subtle truncate leading-tight">{user.email}</div>
            <div className="mt-1.5">
              <Chip color="indigo" size="sm" dot>
                {t(`roles.${role}`, { ns: 'nav' })}
              </Chip>
            </div>
          </div>

          {/* Menu items — rendered only when the current role can reach the route */}
          <div className="py-1">
            {canAccess(role, 'profile') && (
              <button
                type="button"
                onClick={() => { setOpen(false); navigate('/profile') }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[12.5px] text-text-secondary hover:bg-surface transition-colors"
              >
                <Icon name="user-circle" size={14} className="text-text-subtle" />
                {t('actions.profile')}
              </button>
            )}
            {canAccess(role, 'settings') && (
              <button
                type="button"
                onClick={() => { setOpen(false); navigate('/settings') }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[12.5px] text-text-secondary hover:bg-surface transition-colors"
              >
                <Icon name="settings" size={14} className="text-text-subtle" />
                {t('actions.settings')}
              </button>
            )}
          </div>

          {/* Sign-out */}
          <div className="border-t border-border py-1">
            <button
              type="button"
              onClick={() => { setOpen(false); signOut() }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[12.5px] text-[#FDA4AF] light:text-rose-700 hover:bg-rose-950/40 light:hover:bg-rose-50 transition-colors"
            >
              <Icon name="log-out" size={14} />
              {t('actions.signOut')}
            </button>
          </div>

          {/* DEV-only role switcher */}
          {import.meta.env.DEV && (
            <div className="border-t border-border py-1">
              <div className="px-3.5 py-1.5 flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-text-subtle">{t('roleSwitcher.label')}</span>
                <Chip color="orange" size="sm">{t('roleSwitcher.dev')}</Chip>
              </div>
              {ROLES.map((r) => {
                const isActiveRole = r.id === role
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setRole(r.id); setOpen(false) }}
                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-1.5 text-left transition-colors ${isActiveRole ? 'bg-accent text-white' : 'hover:bg-surface text-text-secondary'}`}
                  >
                    <span className="inline-flex items-center gap-1 text-[12px] font-medium">
                      <RoleIcon role={r.id} size={16} />
                      {t(`roles.${r.id}`, { ns: 'nav' })}
                    </span>
                    <span className={`text-[10px] font-mono ${isActiveRole ? 'text-white/80' : 'text-text-subtle'}`}>{r.short}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
