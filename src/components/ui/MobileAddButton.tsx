import { Icon } from './icon'

export interface MobileAddButtonProps {
  onClick: () => void
  /** Accessible label (e.g. «Создать актив», «Добавить запчасти»). */
  ariaLabel: string
  /** Extra classes merged onto the button (e.g. `md:hidden`, margins). */
  className?: string
}

/**
 * MobileAddButton — the single mobile «+» primary action button used across
 * pages (assets toolbar, parts tab strip, …): 36×36 square, rounded-[9px],
 * accent bg with soft accent shadow. One component so every screen renders
 * the identical control.
 */
export function MobileAddButton({ onClick, ariaLabel, className = '' }: MobileAddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={[
        'w-[var(--ctl-h-md)] h-[var(--ctl-h-md)] min-w-[var(--ctl-h-md)] flex-shrink-0',
        'rounded-[9px] bg-accent text-white',
        'inline-flex items-center justify-center',
        'shadow-[0_2px_10px] shadow-accent/35',
        'transition-colors duration-150 hover:bg-accent-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        className,
      ].filter(Boolean).join(' ')}
    >
      <Icon name="plus" size={15} />
    </button>
  )
}
