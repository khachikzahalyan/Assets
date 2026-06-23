/**
 * Pure utilities for Windows-style product keys.
 *
 * Format: XXXXX-XXXXX-XXXXX-XXXXX-XXXXX
 *   - Exactly 5 groups of 5 alphanumeric characters separated by '-'
 *   - Characters are always uppercase A–Z and 0–9
 *   - Dashes are auto-inserted after every group of 5 chars
 *   - Hard cap at 25 alphanumeric chars (29 chars including dashes)
 */

const MAX_ALNUM = 25

/**
 * Strip a string down to at most MAX_ALNUM uppercase alphanumeric characters.
 * Strips everything else (dashes, spaces, punctuation, non-ASCII).
 */
function sanitize(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, MAX_ALNUM)
}

/**
 * Format a raw string into a canonical Windows product-key string.
 *
 * - Uppercases all letters.
 * - Strips any character that is not A–Z or 0–9 (including existing dashes).
 * - Truncates to 25 alphanumeric characters.
 * - Inserts '-' after every group of 5 characters.
 *
 * Examples:
 *   formatProductKey('yvwgfbxnmchtqyqcpq9966qfc')
 *     → 'YVWGF-BXNMC-HTQYQ-CPQ99-66QFC'
 *
 *   formatProductKey('YVWGF-BXNMC-HTQYQ-CPQ99-66QFCYVWGF-BXNMC-HTQYQ-CPQ99-66QFC')
 *     → 'YVWGF-BXNMC-HTQYQ-CPQ99-66QFC'   (truncated after 25 alnum chars)
 */
export function formatProductKey(raw: string): string {
  const clean = sanitize(raw)
  const groups: string[] = []
  for (let i = 0; i < clean.length; i += 5) {
    groups.push(clean.slice(i, i + 5))
  }
  return groups.join('-')
}

/**
 * Returns true when the value represents a complete product key:
 * exactly 25 alphanumeric characters in 5 groups of 5 (dashes ignored).
 *
 * Accepts both the dashed canonical form and a raw 25-char string.
 */
export function isCompleteProductKey(value: string): boolean {
  const clean = value.replace(/[^A-Z0-9]/gi, '')
  return clean.length === MAX_ALNUM
}
