export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  value?: string
  onChange?: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  className = '',
  disabled,
}: SelectProps) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange && onChange(e.target.value)}
      disabled={disabled}
      className={`w-full h-9 px-3 pr-9 text-sm bg-[#111315] border border-[#2A2F36] rounded-lg text-[#F8FAFC] appearance-none focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[rgba(249,115,22,0.40)] transition-all duration-150 disabled:bg-[#1B1F24] ${className}`}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
