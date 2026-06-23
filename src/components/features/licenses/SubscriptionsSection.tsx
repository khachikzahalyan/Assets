/**
 * SubscriptionsSection — responsive grid of SubscriptionCard.
 * Consumes subRepo.listSubscriptions() passed in as `subs` prop.
 */
import { useTranslation } from 'react-i18next'
import { SectionCard, EmptyState } from '@/components/ui'
import type { Subscription } from '@/domain/subscription'
import type { Employee } from '@/domain/employee'
import { SubscriptionCard } from './SubscriptionCard'

export interface SubscriptionsSectionProps {
  subs: Subscription[]
  employees: Employee[]
  onUpdateAssignees: (subId: string, ids: string[]) => Promise<void>
}

export function SubscriptionsSection({ subs, employees, onUpdateAssignees }: SubscriptionsSectionProps) {
  const { t } = useTranslation('licenses')

  if (subs.length === 0) {
    return (
      <SectionCard title={t('subs.sectionTitle')} icon="boxes">
        <EmptyState
          icon="boxes"
          title={t('subs.emptyTitle')}
          description={t('subs.emptyDesc')}
        />
      </SectionCard>
    )
  }

  return (
    <SectionCard title={t('subs.sectionTitle')} icon="boxes">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {subs.map(s => (
          <SubscriptionCard
            key={s.id}
            sub={s}
            employees={employees}
            onUpdateAssignees={onUpdateAssignees}
          />
        ))}
      </div>
    </SectionCard>
  )
}
