import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { navForRole } from '@/config'
import { Icon } from '@/components/ui/icon'

export interface BottomNavProps {
  currentRoute: string
  onNavigate: (route: string) => void
}

/**
 * Fixed bottom tab bar — mobile only (hidden on lg+).
 * Renders ALL of the role's nav items in a horizontally-scrollable strip
 * (the full set won't fit on one screen, so it scrolls left↔right).
 * Active item gets accent pill styling; inactive items use subtle text color.
 * Safe-area bottom padding respects iOS home indicator via env(safe-area-inset-bottom).
 */
export function BottomNav({ currentRoute, onNavigate }: BottomNavProps) {
  const { role } = useAuth()
  const { t } = useTranslation('nav')
  const items = useMemo(() => navForRole(role).flatMap((g) => g.items), [role])

  return (
    <nav
      className={[
        'fixed bottom-0 inset-x-0 z-40 lg:hidden',
        'bg-surface border-t border-border',
        // Horizontal scroll strip — all items reachable by swiping left↔right.
        'flex items-stretch gap-1 overflow-x-auto no-scrollbar px-2',
        'pt-2',
        // Safe-area bottom — Tailwind arbitrary value, underscores → spaces in CSS output:
        // pb: calc(6px + env(safe-area-inset-bottom, 0px))
        'pb-[calc(6px_+_env(safe-area-inset-bottom,_0px))]',
      ].join(' ')}
    >
      {items.map((item) => {
        const active = currentRoute === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={active ? 'page' : undefined}
            className={[
              'flex flex-shrink-0 flex-col items-center gap-1 px-3 py-1.5 rounded-[10px] transition-colors',
              active
                ? 'bg-accent/12 text-accent'
                : 'text-text-subtle hover:text-text-secondary hover:bg-surface-2',
            ].join(' ')}
          >
            <Icon name={item.icon} size={20} />
            <span
              className={[
                'text-[10px] leading-tight whitespace-nowrap',
                active ? 'font-bold' : 'font-medium',
              ].join(' ')}
            >
              {t('items.' + item.id)}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
