import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * cn — merge Tailwind class names, resolving conflicts via tailwind-merge.
 * Used by shadcn/ui primitives and all AMS components.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
