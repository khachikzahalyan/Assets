import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { Btn } from '@/components/ui/btn'
import { Icon } from '@/components/ui/icon'

export function AccessPendingPage() {
  const { t } = useTranslation('access-pending')
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-[#0D1117] flex items-center justify-center px-4">
      <div
        className="w-full max-w-sm bg-[#1B1F24] border border-[#2A2F36] rounded-2xl overflow-hidden text-center"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.4),0 8px 24px rgba(0,0,0,0.4)' }}
      >
        <div className="px-8 py-8 space-y-5">
          {/* Icon */}
          <div className="flex justify-center">
            <span className="w-14 h-14 rounded-2xl bg-amber-950/40 border border-amber-700/40 inline-flex items-center justify-center">
              <Icon name="clock" size={24} className="text-amber-400" />
            </span>
          </div>

          {/* Copy */}
          <div className="space-y-2">
            <h1 className="text-[17px] font-bold text-[#F8FAFC] tracking-tight">
              {t('title')}
            </h1>
            <p className="text-[13px] text-[#64748B] leading-relaxed">
              {t('desc')}
            </p>
          </div>

          {/* Signed-in as */}
          <div className="px-3.5 py-2.5 bg-[#111315] border border-[#2A2F36] rounded-lg text-left">
            <p className="text-[11px] text-[#475569] mb-0.5">{t('signedInAs')}</p>
            <p className="text-[13px] font-medium text-[#F8FAFC] truncate">{user.email}</p>
          </div>

          {/* Contact note */}
          <p className="text-[12px] text-[#475569]">{t('contact')}</p>

          {/* Sign-out */}
          <Btn
            variant="danger"
            size="md"
            onClick={signOut}
            className="w-full"
          >
            <Icon name="log-out" size={14} />
            {t('signOut')}
          </Btn>
        </div>
      </div>
    </div>
  )
}
