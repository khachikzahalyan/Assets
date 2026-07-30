import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/icon'
import { useTheme } from '@/contexts/ThemeContext'

/**
 * Topbar theme switcher — sun/moon ghost button, sits in the right cluster
 * next to NotificationBell / LanguageToggle / ProfileMenu.
 * One click flips dark ↔ light (ThemeContext persists to localStorage).
 */
export function ThemeToggle() {
  const { t } = useTranslation('common')
  const { theme, toggleTheme } = useTheme()
  const label = theme === 'dark' ? t('theme.toLight') : t('theme.toDark')

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      className="inline-flex items-center justify-center w-9 h-9 min-w-[44px] min-h-[44px] max-md:w-11 max-md:h-11 rounded-lg text-text-tertiary hover:bg-surface-2 transition-colors"
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
    </button>
  )
}
