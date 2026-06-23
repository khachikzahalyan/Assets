/**
 * ProductKeyInput — Windows-style product-key input.
 *
 * Format: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX
 *
 * Behaviour:
 *  - Allow ONLY A–Z and 0–9. Everything else (spaces, lowercase, punctuation) is stripped.
 *  - ALWAYS UPPERCASE — typing a lowercase letter inserts its uppercase form.
 *  - Auto-inserts '-' after every group of 5 alphanumeric characters.
 *  - HARD CAP at 25 alphanumeric chars (29 chars total including dashes).
 *  - PASTE handling: sanitize (uppercase, strip non-alnum, drop existing dashes,
 *    truncate to 25) then re-format with dashes.
 *  - value / onChange use the DASHED canonical form XXXXX-XXXXX-XXXXX-XXXXX-XXXXX.
 */

import { useRef } from 'react'
import { formatProductKey, isCompleteProductKey } from '@/lib/licenses/productKeyFormatter'

export interface ProductKeyInputProps {
  /** Current value in dashed canonical form. */
  value: string
  /** Called with the new dashed canonical value on every change. */
  onChange: (value: string) => void
  /** HTML id — required for <label htmlFor> association. */
  id?: string
  /** aria-label for cases where there is no visible <label>. */
  ariaLabel?: string
  disabled?: boolean
  autoFocus?: boolean
  className?: string
  /** Called when the user presses Enter. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

/** Max length of the dashed canonical string: 29 chars (25 alnum + 4 dashes). */
const MAX_DISPLAY_LENGTH = 29

export function ProductKeyInput({
  value,
  onChange,
  id,
  ariaLabel,
  disabled,
  autoFocus,
  className = '',
  onKeyDown,
}: ProductKeyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const formatted = formatProductKey(raw)
    onChange(formatted)

    // Restore caret position after React re-render.
    // We schedule it after the next paint so the controlled value has been applied.
    const selectionEnd = e.target.selectionEnd ?? raw.length

    // Count how many alnum chars are before the caret in the raw (pre-format) value
    const alnumBeforeCaret = raw.slice(0, selectionEnd).replace(/[^A-Z0-9]/gi, '').length

    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      // Map back: walk formatted string counting alnum chars until we reach alnumBeforeCaret
      let count = 0
      let caretPos = 0
      for (let i = 0; i < formatted.length; i++) {
        if (/[A-Z0-9]/.test(formatted[i] ?? '')) {
          count++
        }
        if (count === alnumBeforeCaret) {
          caretPos = i + 1
          break
        }
      }
      // If we're in an insertion past all chars, put caret at end
      if (alnumBeforeCaret > count) {
        caretPos = formatted.length
      }
      el.setSelectionRange(caretPos, caretPos)
    })
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text')
    // Merge with existing selection: replace the selected range
    const el = inputRef.current
    const start = el?.selectionStart ?? 0
    const end = el?.selectionEnd ?? value.length
    const before = value.slice(0, start)
    const after = value.slice(end)
    const merged = before + pasted + after
    const formatted = formatProductKey(merged)
    onChange(formatted)
  }

  const isComplete = isCompleteProductKey(value)

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="text"
      autoCapitalize="characters"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      value={value}
      onChange={handleChange}
      onPaste={handlePaste}
      onKeyDown={onKeyDown}
      aria-label={ariaLabel}
      placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
      maxLength={MAX_DISPLAY_LENGTH}
      disabled={disabled}
      autoFocus={autoFocus}
      data-complete={isComplete ? 'true' : 'false'}
      className={`w-full h-9 px-3 text-sm bg-bg border rounded-lg font-mono tracking-wider text-text-primary placeholder:text-text-subtle focus:outline-none focus:ring-2 transition-all duration-150 disabled:bg-surface disabled:text-text-subtle ${
        isComplete
          ? 'border-emerald-500/60 focus:border-emerald-500 focus:ring-emerald-500/30'
          : 'border-border focus:border-accent focus:ring-[rgba(249,115,22,0.40)]'
      } ${className}`}
    />
  )
}

export { isCompleteProductKey } from '@/lib/licenses/productKeyFormatter'
