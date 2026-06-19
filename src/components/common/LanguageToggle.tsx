import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/lib/i18n'
import { Icon } from '@/components/ui/icon'

export function LanguageToggle() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation('common')

  const langs = [
    { id: 'ru', label: t('lang.ru'), short: 'RU' },
    { id: 'en', label: t('lang.en'), short: 'EN' },
    { id: 'hy', label: t('lang.hy'), short: 'HY' },
  ]

  const activeLang = langs.find((l) => i18n.language?.startsWith(l.id)) ?? langs[0]!

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-[#2A2F36] bg-[#1B1F24] hover:border-[#3A4048] text-[12px] font-semibold text-[#CBD5E1] transition-colors"
        title={t('lang.title')}
      >
        <Icon name="globe" size={13} className="text-[#64748B]" />
        {activeLang.short}
        <Icon name="chevron-down" size={12} className="text-[#64748B]" />
      </button>
      {open && (
        <div
          className="ams-lang-dropdown absolute right-0 top-full mt-1.5 w-44 bg-[#22272E] border border-[#2A2F36] rounded-lg anim-dropdown-in overflow-hidden z-[50]"
          style={{ boxShadow: '0 12px 32px rgba(0,0,0,0.55)' }}
        >
          {langs.map((l) => {
            const isActive = i18n.language?.startsWith(l.id)
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => { void i18n.changeLanguage(l.id); setOpen(false) }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors ${isActive ? 'bg-[#F97316] text-white' : 'hover:bg-[#1B1F24] text-[#CBD5E1]'}`}
              >
                <span className="text-[12.5px] font-semibold">{l.label}</span>
                <span className="flex items-center gap-1.5">
                  <span className={`text-[10.5px] font-mono ${isActive ? 'text-white/80' : 'text-[#64748B]'}`}>{l.short}</span>
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
