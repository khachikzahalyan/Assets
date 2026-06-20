import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SectionCard } from '@/components/ui/section-card'
import { Icon } from '@/components/ui/icon'

export interface PeopleTileProps {
  employeeCount: number
  pendingUsersCount: number | null
}

export function PeopleTile({ employeeCount, pendingUsersCount }: PeopleTileProps) {
  const { t } = useTranslation('dashboard')
  const hasPending = pendingUsersCount != null && pendingUsersCount > 0

  return (
    <SectionCard noHeader>
      <div className="flex flex-col gap-3">
        <span
          className="w-9 h-9 rounded-md bg-[#22272E] text-[#94A3B8] inline-flex items-center justify-center"
          aria-hidden="true"
        >
          <Icon name="users" size={16} />
        </span>
        <div>
          <div className="text-[12px] text-[#64748B]">
            {t('people.employees', { defaultValue: 'Сотрудники' })}
          </div>
          <div className="text-[22px] font-bold text-[#F8FAFC] tabular-nums">
            {employeeCount}
          </div>
          {hasPending && (
            <Link
              to="/pending-users"
              className="inline-flex items-center gap-1 mt-1 text-[11.5px] text-[#F97316] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#F97316]"
            >
              <Icon name="triangle-alert" size={11} className="text-[#F97316]" />
              <span>{pendingUsersCount}</span>
              <span>{t('people.pending', { defaultValue: 'ожидают подтверждения' })}</span>
            </Link>
          )}
        </div>
      </div>
    </SectionCard>
  )
}
