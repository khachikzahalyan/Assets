import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { navForRole } from '@/config'
import { Icon } from '@/components/ui/icon'

// Role-filtered nav is UX only — NOT a security control.

export interface SidebarProps {
  currentRoute: string
  onNavigate: (route: string) => void
}

/**
 * Hex color (#rrggbb or #rgb) → CSS rgba() string with given 0–1 alpha.
 * Used to compute per-group accent alpha variants as inline CSS values.
 */
function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * Fallback accent for groups that carry no accent field (employee group).
 * Matches the project's primary orange so the icon chip always renders.
 */
const FALLBACK_ACCENT = '#F97316'

export function Sidebar({ currentRoute, onNavigate }: SidebarProps) {
  const { role } = useAuth()
  const nav = useMemo(() => navForRole(role), [role])
  const { t } = useTranslation(['nav', 'common'])

  return (
    <aside className="app-shell-sidebar">
      {/* ── Brand row ──────────────────────────────────────────────── */}
      <div className="sidebar-brand">
        <span className="sidebar-brand-logo">
          {/* Slightly smaller than the 32px box so the wordmark has breathing
              room on all sides (owner: «немного отступы padding внутри»). */}
          <span className="text-11 font-extrabold tracking-tight leading-none select-none">
            AMS
          </span>
        </span>
        <div className="leading-tight min-w-0">
          <div className="text-15.5 font-bold text-text-primary truncate">
            {t('app.name', { ns: 'common' })}
          </div>
          <div className="text-11 text-text-subtle -mt-0.5 truncate">
            {t('app.title', { ns: 'common' })}
          </div>
        </div>
      </div>

      {/* ── Navigation — scrollable so short viewports still reach bottom items ── */}
      <nav className="flex-1 min-h-0 overflow-y-auto no-scrollbar sidebar-nav">
        {nav.map((group, groupIdx) => {
          const accent = group.accent ?? FALLBACK_ACCENT

          return (
            <div
              key={group.id}
              className={groupIdx === 0 ? 'sidebar-nav-group sidebar-nav-group--first' : 'sidebar-nav-group'}
            >
              {group.labelKey != null && (
                <div className="sidebar-group-label">
                  {t(group.labelKey, { ns: 'nav' })}
                </div>
              )}

              {group.items.map((item) => {
                const active = currentRoute === item.id

                /*
                 * Inline CSS custom properties carry per-group accent so CSS
                 * can reference var(--nav-accent) / var(--nav-icon-bg) etc.
                 * Alpha variants are pre-computed as rgba() strings here so we
                 * avoid 5× new global CSS variables per group.
                 */
                const itemStyle = {
                  '--nav-accent':        accent,
                  '--nav-accent-bg':     active ? hexAlpha(accent, 0.15) : 'transparent',
                  // Faint border — owner 2026-08-06: «не надо так хорошо
                  // подчёркивать», the active row reads by its bg tint alone.
                  '--nav-accent-border': active ? hexAlpha(accent, 0.14) : 'transparent',
                  '--nav-icon-bg':       hexAlpha(accent, active ? 0.27 : 0.13),
                } as React.CSSProperties

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`sidebar-item${active ? ' is-active' : ''}`}
                    style={itemStyle}
                    aria-current={active ? 'page' : undefined}
                  >
                    {/* Icon chip — 26×26px square with rounded corners */}
                    <span className="sidebar-item-icon-chip" aria-hidden="true">
                      <Icon name={item.icon} size={15} />
                    </span>
                    <span className="flex-1 truncate">
                      {t(item.labelKey, { ns: 'nav' })}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
