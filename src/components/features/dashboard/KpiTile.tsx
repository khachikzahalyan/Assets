import { Link } from 'react-router-dom'
import { SectionCard } from '@/components/ui/section-card'
import { Icon } from '@/components/ui/icon'

export interface KpiTileProps {
  icon: string
  label: string
  value: number | string
  to: string
  sub?: string
}

export function KpiTile({ icon, label, value, to, sub }: KpiTileProps) {
  return (
    <Link
      to={to}
      className="block rounded-xl transition-opacity duration-150 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316]"
    >
      <SectionCard noHeader>
        <div className="flex flex-col gap-3">
          <span
            className="w-9 h-9 rounded-md bg-[#22272E] text-[#94A3B8] inline-flex items-center justify-center"
            aria-hidden="true"
          >
            <Icon name={icon} size={16} />
          </span>
          <div>
            <div className="text-[12px] text-[#64748B]">{label}</div>
            <div className="text-[22px] font-bold text-[#F8FAFC] tabular-nums">
              {value}
            </div>
            {sub != null && (
              <div className="text-[11px] text-[#64748B] mt-0.5">{sub}</div>
            )}
          </div>
        </div>
      </SectionCard>
    </Link>
  )
}
