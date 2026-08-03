import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/lib/i18n'
import { Icon } from '@/components/ui/icon'
import { useDismissOnOutside } from '@/hooks/useDismissOnOutside'

export function LanguageToggle() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation('common')

  useDismissOnOutside([rootRef], () => setOpen(false), open)

  const langs = [
    { id: 'ru', label: t('lang.ru'), short: 'RU' },
    { id: 'en', label: t('lang.en'), short: 'EN' },
    { id: 'hy', label: t('lang.hy'), short: 'HY' },
  ]

  const activeLang = langs.find((l) => i18n.language?.startsWith(l.id)) ?? langs[0]!

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ams-lang-toggle-btn inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-surface hover:border-border-strong text-12 font-semibold text-text-secondary transition-colors"
        title={t('lang.title')}
        aria-label={t('lang.title')}
      >
        <Icon name="globe" size={13} className="text-text-subtle max-md:hidden" />
        {activeLang.short}
        <Icon name="chevron-down" size={12} className="ams-lang-chevron text-text-subtle" />
      </button>
      {open && (
        <div
          className="ams-lang-dropdown absolute right-0 top-full mt-1.5 w-44 bg-surface-2 border border-border rounded-lg anim-dropdown-in overflow-hidden z-[200]"
          style={{ boxShadow: 'var(--shadow-popover)' }}
        >
          {langs.map((l) => {
            const isActive = i18n.language?.startsWith(l.id)
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => { void i18n.changeLanguage(l.id); setOpen(false) }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors ${isActive ? 'bg-accent text-white' : 'hover:bg-surface text-text-secondary'}`}
              >
                <span className="text-12.5 font-semibold min-w-0 truncate">{l.label}</span>
                <span className="flex items-center gap-1.5">
                  <span className={`text-10.5 font-mono ${isActive ? 'text-white/80' : 'text-text-subtle'}`}>{l.short}</span>
                  {isActive && <Icon name="check" size={13} className="text-white" />}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
