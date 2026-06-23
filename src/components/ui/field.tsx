import { type ReactNode } from 'react'

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
        <span className="block mb-1 text-[11px] uppercase tracking-[0.06em] font-semibold text-text-subtle">
          {label}{required && <span className="text-[#FDA4AF] ml-0.5">*</span>}
        </span>
      )}
      {children}
      {hint && <span className="block mt-1 text-[11px] text-text-subtle">{hint}</span>}
    </label>
  )
}
