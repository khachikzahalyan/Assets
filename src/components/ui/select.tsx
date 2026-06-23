export interface SelectOption {
  value: string
  label: string
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
    <select
      id={id}
      value={value ?? ''}
      onChange={e => onChange && onChange(e.target.value)}
      disabled={disabled}
      className={`w-full h-9 px-3 pr-9 text-sm bg-bg border border-border rounded-lg text-text-primary appearance-none focus:outline-none focus:border-accent focus:ring-2 focus:ring-[rgba(249,115,22,0.40)] transition-all duration-150 disabled:bg-surface ${className}`}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
