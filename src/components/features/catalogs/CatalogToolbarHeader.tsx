import { Btn, Icon, MobileAddButton } from '@/components/ui'

export interface CatalogToolbarHeaderProps {
  icon: string
  title: string
  /** Row count; pass undefined while loading to hide the counter. */
  count?: number
  canMutate: boolean
  isMobile: boolean
  createLabel: string
  /** Icon inside the desktop create button; defaults to `icon`. */
  buttonIcon?: string
  onCreate: () => void
}

export function CatalogToolbarHeader({
  icon, title, count, canMutate, isMobile, createLabel, buttonIcon, onCreate,
}: CatalogToolbarHeaderProps) {
  const btnIcon = buttonIcon ?? icon
  return (
    <>
      <div className="flex items-center justify-between gap-3 px-5 py-3 max-md:px-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon name={icon} size={16} className="text-text-tertiary flex-shrink-0" />
          <h1 className="text-[15px] font-semibold text-text-primary">{title}</h1>
          {count !== undefined && (
            <span className="text-[13px] text-text-tertiary tabular-nums">{count}</span>
          )}
        </div>
        {canMutate && (
          isMobile ? (
            <MobileAddButton
              onClick={onCreate}
              ariaLabel={createLabel}
            />
          ) : (
            <Btn variant="primary" size="md" onClick={onCreate}>
              <Icon name={btnIcon} size={14} />{createLabel}
            </Btn>
          )
        )}
      </div>
      <div className="border-t border-border" />
    </>
  )
}
