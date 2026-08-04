import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * AMS custom font-size tokens (tailwind.config.ts theme.extend.fontSize).
 * Default tailwind-merge classifies unknown `text-<value>` classes into the
 * text-COLOR group, so `cn('text-11', 'text-accent')` would drop `text-11`.
 * Every token added to the config fontSize scale MUST also be listed here.
 */
const CUSTOM_FONT_SIZE_CLASSES = [
  '9', '10', '10.5', '11', '11.5', '12', '12.5', '13', '13.5',
  '14', '14.5', '15', '15.5', '16', '17', '18', '20', '22',
  'display-sm', 'display-md', 'display-lg',
]

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: CUSTOM_FONT_SIZE_CLASSES }],
    },
  },
})

/**
 * cn — merge Tailwind class names, resolving conflicts via tailwind-merge.
 * Used by shadcn/ui primitives and all AMS components.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
