import type { ReactNode } from 'react'
import { MiniDropdown } from './MiniDropdown'

export interface SelectOption {
  value: string
  label: string
  /** Optional leading node (e.g. a RoleIcon badge) shown in the trigger + option row. */
  icon?: ReactNode
}

export interface SelectProps {
  id?: string
  value?: string
  onChange?: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * Form-field select. Visible UI is the shared MiniDropdown (custom styled
 * popup — native <select> popups can't be themed and broke the dark design).
 *
 * A visually-hidden native <select> renders FIRST in the DOM (ServiceRecordModal
 * pattern) so that:
 *  - a wrapping <label> / getByLabelText still resolves to a real combobox;
 *  - tests keep driving the field via user.selectOptions / getByRole('combobox');
 *  - form semantics (value submission) stay native.
 * It is removed from the tab order — keyboard users interact with the styled
 * trigger, which has full arrow/enter/escape handling.
 */
export function Select({
  id,
  value,
  onChange,
  options,
  placeholder,
  className = '',
  disabled,
}: SelectProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        id={id}
        value={value ?? ''}
        onChange={e => onChange && onChange(e.target.value)}
        disabled={disabled}
        tabIndex={-1}
        className="sr-only"
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <MiniDropdown
        value={value ?? ''}
        onChange={v => onChange && onChange(v)}
        options={options}
        {...(placeholder !== undefined ? { placeholder } : {})}
        disabled={disabled ?? false}
        triggerClassName="h-9 py-0 text-sm"
      />
    </div>
  )
}
