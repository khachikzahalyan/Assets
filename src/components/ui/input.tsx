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
}: InputProps) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={e => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      className={`w-full h-9 px-3 text-sm bg-[#111315] border border-[#2A2F36] rounded-lg text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[rgba(249,115,22,0.40)] transition-all duration-150 disabled:bg-[#1B1F24] disabled:text-[#64748B] ${mono ? 'font-mono tracking-tight' : ''} ${className}`}
    />
  )
}
