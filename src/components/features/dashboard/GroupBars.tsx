import { useTranslation } from 'react-i18next'
import type { GroupCount } from '@/domain/dashboard'
import { ASSET_GROUPS } from '@/domain/dashboard'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/utils'

/** Icon + token colour config per asset group. */
const GROUP_CFG: Record<string, { icon: string; iconBox: string; bar: string }> = {
  devices:   { icon: 'monitor',   iconBox: 'bg-accent/15 text-accent',   bar: 'from-accent to-accent/25' },
  network:   { icon: 'wifi',      iconBox: 'bg-info/15 text-info',       bar: 'from-info to-info/25' },
  furniture: { icon: 'briefcase', iconBox: 'bg-success/15 text-success', bar: 'from-success to-success/25' },
}
const DEFAULT_GROUP_CFG = GROUP_CFG['devices'] as { icon: string; iconBox: string; bar: string }

export interface GroupBarsProps {
  byGroup: GroupCount[]
}

export function GroupBars({ byGroup }: GroupBarsProps) {
  const { t } = useTranslation('dashboard')
  const groupMap = new Map(byGroup.map(g => [g.group, g.count]))
  const maxCount = Math.max(...byGroup.map(g => g.count), 1)

  return (
    <section className="bg-surface border border-border rounded-xl overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-md bg-accent/15 text-accent inline-flex items-center justify-center flex-shrink-0">
            <Icon name="tags" size={14} />
          </span>
          <h2 className="text-[13px] font-semibold text-text-primary">{t('groups.title')}</h2>
        </div>
        <span className="text-[11px] text-text-subtle">
          {t('groups.categoryCaption', { count: ASSET_GROUPS.length })}
        </span>
      </header>

      <div className="p-5 flex flex-col gap-3.5">
        {ASSET_GROUPS.map(group => {
          const count = groupMap.get(group) ?? 0
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
          const cfg = GROUP_CFG[group] ?? DEFAULT_GROUP_CFG

          return (
            <div key={group} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {/* Small leading icon per group */}
                <span
                  className={cn(
                    'w-5 h-5 rounded flex-shrink-0 inline-flex items-center justify-center',
                    cfg.iconBox,
                  )}
                  aria-hidden="true"
                >
                  <Icon name={cfg.icon} size={11} />
                </span>
                <span className="flex-1 text-[12.5px] text-text-secondary truncate">
                  {t(`groups.${group}`)}
                </span>
                <span className="text-[12.5px] font-mono tabular-nums text-text-primary ml-1">
                  {count}
                </span>
              </div>
              {/* Gradient progress bar */}
              <div
                className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden"
                aria-hidden="true"
              >
                <div
                  className={cn(
                    'h-full rounded-full bg-gradient-to-r transition-all duration-300',
                    cfg.bar,
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
