import type { InputHTMLAttributes, KeyboardEvent } from 'react'

export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  // Override with our higher-level signatures:
  | 'onChange'
  | 'onBlur'
  | 'onKeyDown'
  // We expose these via top-level props so callers don't need to touch InputHTMLAttributes:
  | 'className'
  | 'disabled'
  | 'autoFocus'
  | 'id'
  | 'type'
  | 'value'
  | 'placeholder'
  // aria-label is re-exposed as ariaLabel (camelCase convenience alias) below:
  | 'aria-label'
> {
  value?: string
  /** Fires with the raw string value (not the event) — keeps call sites clean. */
  onChange?: (v: string) => void
  placeholder?: string
  type?: string
  /** When true renders in font-mono + tracking-tight (for inventory codes, etc.). */
  mono?: boolean
  className?: string
  disabled?: boolean
  autoFocus?: boolean
  /** HTML id forwarded to the underlying <input> — required for <label htmlFor> association. */
  id?: string
  /** Optional keydown handler (e.g. Enter-to-confirm in the group stepper). */
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  /** Optional blur handler — used to mark a field as touched for validation timing. */
  onBlur?: () => void
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
  onBlur,
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
      {...(onBlur && { onBlur })}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      className={`w-full h-9 px-3 text-sm bg-bg border ${invalid ? 'border-error' : 'border-border'} rounded-lg text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-accent focus:ring-2 focus:ring-[rgba(249,115,22,0.40)] transition-all duration-150 disabled:bg-surface disabled:text-text-subtle ${mono ? 'font-mono tracking-tight' : ''} ${className}`}
    />
  )
}
