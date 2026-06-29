export interface InputProps {
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  type?: string
  mono?: boolean
  className?: string
  disabled?: boolean
  autoFocus?: boolean
  /** HTML id forwarded to the underlying <input> — required for <label htmlFor> association. */
  id?: string
  /** Optional keydown handler (e.g. Enter-to-confirm in the group stepper). */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  /** Optional aria-label when no visible <label> is associated. */
  ariaLabel?: string
  /** When true, the field shows a red border (required-but-empty signal). Clears on input. */
  invalid?: boolean
}

export function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  mono = false,
  className = '',
  disabled,
  autoFocus,
  id,
  onKeyDown,
  ariaLabel,
  invalid = false,
}: InputProps) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={e => onChange && onChange(e.target.value)}
      onKeyDown={onKeyDown}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      className={`w-full h-9 px-3 text-sm bg-bg border ${invalid ? 'border-error' : 'border-border'} rounded-lg text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-[rgba(249,115,22,0.40)] transition-all duration-150 disabled:bg-surface disabled:text-text-subtle ${mono ? 'font-mono tracking-tight' : ''} ${className}`}
    />
  )
}
