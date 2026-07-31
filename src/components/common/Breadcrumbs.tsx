import { Icon } from '@/components/ui/icon'

export interface BreadcrumbsProps {
  items: string[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1.5 text-12 min-w-0" aria-label="Breadcrumb">
      {items.map((it, i) => {
        const last = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <Icon name="chevron-right" size={11} className="text-border max-md:text-border-strong" />}
            {i === 0 ? (
              <>
                {/* Mobile: brand logo square instead of the "AMS" text root */}
                <span
                  aria-label={it}
                  className="md:hidden w-[26px] h-[26px] rounded-[8px] bg-gradient-to-br from-accent to-accent-dark text-white inline-flex items-center justify-center font-extrabold tracking-tight text-9 shrink-0"
                >
                  AMS
                </span>
                <span className={`max-md:hidden truncate ${last ? 'font-semibold text-text-primary' : 'text-text-subtle'}`}>{it}</span>
              </>
            ) : (
              <span className={`truncate ${last ? 'font-semibold text-text-primary' : 'text-text-subtle'} max-md:text-13`}>{it}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
