/**
 * Create-form local primitives — Field + Input
 *
 * The prototype's create form ("Регистрация актива") uses:
 *   - Field labels: 13px, uppercase, tracking-[0.07em], font-semibold, #94A3B8
 *   - Asterisk:     #F97316 (not rose)
 *   - Input style:  UNDERLINE (border-b only, no border-radius, no bg)
 *
 * The shared @/components/ui Field/Input intentionally use a BOXED style that
 * is reused by other dialogs/pages. This file exports create-local versions
 * with the same prop API so create-form components can swap imports without
 * changing any call sites.
 */

import { type ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Field
// ---------------------------------------------------------------------------

export interface FieldProps {
  label?: string
  required?: boolean
  hint?: string
  children: ReactNode
}

export function Field({ label, required, hint, children }: FieldProps) {
  return (
    <label className="block">
      {label && (
        <div className="text-[13px] max-lg:text-[9.5px] uppercase tracking-[0.07em] max-lg:tracking-[1.4px] font-semibold max-lg:font-bold text-text-tertiary max-lg:text-text-subtle mb-1.5 flex items-center gap-1">
          {label}{required && <span className="text-accent ml-0.5">*</span>}
        </div>
      )}
      {children}
      {hint && <div className="text-[13px] text-text-subtle mt-1 leading-snug">{hint}</div>}
    </label>
  )
}

// ---------------------------------------------------------------------------
// Input — underline style
// ---------------------------------------------------------------------------

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
  /** Pass-through for number inputs (type="number"). */
  min?: number | string
  /** Pass-through for number inputs (type="number"). */
  max?: number | string
  /** When true, the underline turns red (required-but-empty signal). Clears on input. */
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
  min,
  max,
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
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      min={min}
      max={max}
      className={`w-full px-0 py-2.5 text-[15px] border-b ${invalid ? 'border-error' : 'border-border'} bg-transparent rounded-none text-text-primary placeholder:text-text-subtle outline-none shadow-none focus:border-accent focus:shadow-[0_2px_8px_rgba(217,119,87,0.1)] disabled:opacity-50 disabled:cursor-not-allowed transition-[border-color,box-shadow] duration-200${mono ? ' font-mono tracking-tight' : ''} ${className}`}
    />
  )
}
