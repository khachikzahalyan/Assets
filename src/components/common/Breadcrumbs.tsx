import { Icon } from '@/components/ui/icon'

export interface BreadcrumbsProps {
  items: string[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1.5 text-[12px] min-w-0" aria-label="Breadcrumb">
      {items.map((it, i) => {
        const last = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <Icon name="chevron-right" size={11} className="text-[#2A2F36]" />}
            <span className={`truncate ${last ? 'font-semibold text-[#F8FAFC]' : 'text-[#64748B]'}`}>{it}</span>
          </span>
        )
      })}
    </nav>
  )
}
