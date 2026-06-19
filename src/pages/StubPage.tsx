import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui/page-header'
import { SectionCard } from '@/components/ui/section-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Chip } from '@/components/ui/chip'
import { ADMIN_NAV, EMPLOYEE_NAV } from '@/config'
import type { NavItem } from '@/config'

// Build a route-id → icon lookup from nav config (DRY, stays in sync with nav.ts)
const ROUTE_ICON: Record<string, string> = {}
;[...ADMIN_NAV, ...EMPLOYEE_NAV].forEach((group) => {
  group.items.forEach((item: NavItem) => {
    ROUTE_ICON[item.id] = item.icon
  })
})

export interface StubPageProps {
  routeId: string
}

export function StubPage({ routeId }: StubPageProps) {
  const { t } = useTranslation(['common', 'nav'])
  const icon = ROUTE_ICON[routeId] ?? 'inbox'

  return (
    <div className="anim-content-enter">
      <PageHeader
        icon={icon}
        title={t('items.' + routeId, { ns: 'nav' })}
      />
      <SectionCard noHeader>
        <EmptyState
          icon="inbox"
          title={t('stub.title', { ns: 'common' })}
          description={t('stub.desc', { ns: 'common' })}
          action={
            <Chip color="amber" size="sm">
              {t('stub.soon', { ns: 'common' })}
            </Chip>
          }
        />
      </SectionCard>
    </div>
  )
}
