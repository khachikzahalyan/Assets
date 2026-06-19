import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { ROLES } from '@/config'
import { Avatar } from '@/components/ui/avatar'
import { Icon } from '@/components/ui/icon'
import { Chip } from '@/components/ui/chip'

export function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const { user, role, setRole, signOut } = useAuth()
  const { t } = useTranslation(['common', 'nav'])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ams-profile-trigger inline-flex items-center gap-2 h-9 pl-1 pr-2.5 rounded-lg hover:bg-[#22272E] transition-colors"
        title={user.name}
      >
        <Avatar user={user} size="sm" />
        <span className="ams-profile-name-text hidden sm:flex flex-col items-start leading-tight">
          <span className="text-[12px] font-semibold text-[#F8FAFC] truncate max-w-[120px]">{user.name}</span>
          <span className="text-[10px] text-[#64748B]">{t(`roles.${role}`, { ns: 'nav' })}</span>
        </span>
        <Icon name="chevron-down" size={12} className="text-[#64748B]" />
      </button>

      {open && (
        <div
          className="ams-profile-dropdown absolute right-0 top-full mt-1.5 w-64 bg-[#22272E] border border-[#2A2F36] rounded-xl anim-dropdown-in overflow-hidden z-[50]"
          style={{ boxShadow: '0 12px 32px rgba(0,0,0,0.55)' }}
        >
          {/* User header */}
          <div className="flex items-center gap-3 px-3.5 py-3 border-b border-[#2A2F36]">
            <div className="ams-profile-dropdown-avatar flex-shrink-0">
              <Avatar user={user} size="md" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[#F8FAFC] truncate">{user.name}</div>
              <div className="text-[11px] text-[#64748B] truncate">{user.email}</div>
              <div className="mt-1">
                <Chip color="indigo" size="sm" dot>{t(`roles.${role}`, { ns: 'nav' })}</Chip>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[12.5px] text-[#CBD5E1] hover:bg-[#1B1F24] transition-colors"
            >
              <Icon name="user-circle" size={14} className="text-[#64748B]" />
              {t('actions.profile')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[12.5px] text-[#CBD5E1] hover:bg-[#1B1F24] transition-colors"
            >
              <Icon name="settings" size={14} className="text-[#64748B]" />
              {t('actions.settings')}
            </button>
          </div>

          {/* Sign-out */}
          <div className="border-t border-[#2A2F36] py-1">
            <button
              type="button"
              onClick={() => { setOpen(false); signOut() }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[12.5px] text-[#FDA4AF] hover:bg-rose-950/40 transition-colors"
            >
              <Icon name="log-out" size={14} />
              {t('actions.signOut')}
            </button>
          </div>

          {/* DEV-only role switcher */}
          {import.meta.env.DEV && (
            <div className="border-t border-[#2A2F36] py-1">
              <div className="px-3.5 py-1.5 flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[#64748B]">{t('roleSwitcher.label')}</span>
                <Chip color="orange" size="sm">{t('roleSwitcher.dev')}</Chip>
              </div>
              {ROLES.map((r) => {
                const isActiveRole = r.id === role
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setRole(r.id); setOpen(false) }}
                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-1.5 text-left transition-colors ${isActiveRole ? 'bg-[#F97316] text-white' : 'hover:bg-[#1B1F24] text-[#CBD5E1]'}`}
                  >
                    <span className="text-[12px] font-medium">{t(`roles.${r.id}`, { ns: 'nav' })}</span>
                    <span className={`text-[10px] font-mono ${isActiveRole ? 'text-white/80' : 'text-[#64748B]'}`}>{r.short}</span>
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
