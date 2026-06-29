import { useTranslation } from 'react-i18next'
import type { WorkstationLicenseStats } from '@/domain/dashboard'
import { Icon } from '@/components/ui/icon'

export interface LicensePanelProps {
  stats: WorkstationLicenseStats
  /** Shown only for super_admin; null/undefined hides the row. */
  serverLicenseCount?: number | null
}

export function LicensePanel({ stats, serverLicenseCount }: LicensePanelProps) {
  const { t } = useTranslation('dashboard')
  const usagePct = stats.total > 0 ? Math.round((stats.inUse / stats.total) * 100) : 0

  return (
    <section
      className="bg-surface border border-border rounded-xl overflow-hidden"
      data-testid="section-licenses"
    >
      <header className="flex items-center gap-2.5 px-5 py-3.5 border-b border-border">
        <span className="w-7 h-7 rounded-md bg-violet-500/15 text-violet-300 inline-flex items-center justify-center flex-shrink-0">
          <Icon name="key-round" size={14} />
        </span>
        <h2 className="text-[13px] font-semibold text-text-primary">{t('license.title')}</h2>
      </header>

      <div className="p-5 flex flex-col gap-4">
        {/* 42px aggregate total — never a license key */}
        <div>
          <div className="text-[42px] font-bold leading-none tracking-tight tabular-nums text-text-primary">
            {stats.total}
          </div>
          <div className="text-[11.5px] text-text-subtle mt-1">
            {t('license.totalLabel')}
          </div>
        </div>

        {/* 3-col mini stat boxes */}
        <div className="grid grid-cols-3 gap-2">
          {/* Free */}
          <div className="bg-white/[0.03] border border-border rounded-lg p-2.5 text-center">
            <div className="text-[20px] font-mono font-bold tabular-nums text-success">
              {stats.free}
            </div>
            <div className="text-[10.5px] text-text-subtle mt-0.5">{t('license.free')}</div>
          </div>
          {/* In use — violet highlight */}
          <div className="bg-violet-500/[0.06] border border-violet-500/20 rounded-lg p-2.5 text-center">
            <div className="text-[20px] font-mono font-bold tabular-nums text-violet-300">
              {stats.inUse}
            </div>
            <div className="text-[10.5px] text-text-subtle mt-0.5">{t('license.inUse')}</div>
          </div>
          {/* Retired */}
          <div className="bg-white/[0.03] border border-border rounded-lg p-2.5 text-center">
            <div className="text-[20px] font-mono font-bold tabular-nums text-text-subtle">
              {stats.retired}
            </div>
            <div className="text-[10.5px] text-text-subtle mt-0.5">{t('license.retired')}</div>
          </div>
        </div>

        {/* Usage bar */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] text-text-subtle">{t('license.usage')}</span>
            <span className="text-[11.5px] font-mono text-violet-300">{usagePct}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden" aria-hidden="true">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400/60 transition-all duration-300"
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>

        {/* Server license count — super_admin only */}
        {serverLicenseCount != null && (
          <div
            data-testid="kpi-server-licenses"
            className="flex items-center gap-2 pt-3 border-t border-border"
          >
            <Icon name="server" size={13} className="text-text-subtle flex-shrink-0" />
            <span className="text-[12px] text-text-subtle flex-1">{t('kpi.serverLicenses')}</span>
            <span className="text-[12px] font-mono font-bold text-text-primary">
              {serverLicenseCount}
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
