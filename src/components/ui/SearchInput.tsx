import { type InputHTMLAttributes } from 'react'
import { Icon } from './icon'

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string
  onChange: (value: string) => void
  /** Wrapper div className — controls width/visibility (e.g. "w-[280px] hidden md:block"). */
  containerClassName?: string
}

/**
 * Shared toolbar search input — the /assets toolbar look is the etalon for
 * every list page (owner request): h-8 / 13.5px / bg-surface / rounded-lg on
 * desktop, the 9px-radius 11.5px variant on mobile. Extra classes can extend
 * but not fork the style.
 */
export function SearchInput({
  value,
  onChange,
  containerClassName = '',
  className = '',
  ...rest
}: SearchInputProps) {
  return (
    <div className={`relative ${containerClassName}`}>
      <span
        className={[
          'absolute top-1/2 -translate-y-1/2 text-text-subtle pointer-events-none',
          'left-2.5 max-md:left-[10px]',
        ].join(' ')}
      >
        <Icon name="search" size={13} />
      </span>
      <input
        type="search"
        autoComplete="off"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={[
          // Desktop (assets etalon)
          'w-full h-8 pl-8 pr-3 text-[13.5px] bg-surface border border-border rounded-lg',
          'text-text-primary placeholder:text-text-subtle',
          'focus:outline-none focus:border-accent-light focus:ring-2 focus:ring-accent-light/15',
          'transition-all duration-150',
          // Mobile overrides (assets etalon) — height matches the 36px MobileAddButton it pairs with
          'max-md:h-[36px] max-md:rounded-[9px] max-md:py-0 max-md:pl-[30px] max-md:pr-[12px]',
          'max-md:text-[11.5px] max-md:caret-accent',
          className,
        ].join(' ')}
        {...rest}
      />
    </div>
  )
}
