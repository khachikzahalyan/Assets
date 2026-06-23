import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Icon } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { revealLicenseKey } from '@/lib/licenses/revealKey'

const AUTO_HIDE_MS = 30_000

export interface RevealKeyButtonProps {
  collection: 'licenses' | 'server_licenses'
  licenseId: string
  /** Injectable for tests — defaults to the imported revealLicenseKey CF wrapper. */
  revealFn?: (collection: 'licenses' | 'server_licenses', licenseId: string) => Promise<string>
}

export function RevealKeyButton({ collection, licenseId, revealFn }: RevealKeyButtonProps) {
  const { t } = useTranslation('licenses')
  const { role } = useAuth()
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const autoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copiedRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearAutoHide() {
    if (autoHideRef.current !== null) {
      clearTimeout(autoHideRef.current)
      autoHideRef.current = null
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAutoHide()
      if (copiedRef.current !== null) clearTimeout(copiedRef.current)
    }
  }, [])

  async function handleReveal() {
    if (!window.confirm(t('revealConfirm'))) return
    setLoading(true)
    setError(null)
    try {
      const fn = revealFn ?? revealLicenseKey
      const key = await fn(collection, licenseId)
      setRevealedKey(key)
      clearAutoHide()
      autoHideRef.current = setTimeout(() => {
        setRevealedKey(null)
      }, AUTO_HIDE_MS)
    } catch {
      setError(t('revealError'))
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!revealedKey) return
    try {
      await navigator.clipboard.writeText(revealedKey)
      setCopied(true)
      if (copiedRef.current !== null) clearTimeout(copiedRef.current)
      copiedRef.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard denied — silently ignore
    }
  }

  function handleHide() {
    clearAutoHide()
    setRevealedKey(null)
    setError(null)
  }

  // Defense-in-depth: render nothing unless super_admin (server enforces too).
  // This gate lives AFTER all hooks so the hook order is stable across an
  // in-session role transition (Rules of Hooks).
  if (role !== 'super_admin') return null

  if (error) {
    return (
      <span role="alert" className="text-[11px] text-[#FDA4AF]">{error}</span>
    )
  }

  if (revealedKey !== null) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-mono text-[11px] text-accent bg-bg px-2 py-0.5 rounded border border-border">
          {revealedKey}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={t('copyKey')}
          className="text-[11px] text-text-subtle hover:text-text-primary transition-colors"
        >
          {copied ? t('copied') : t('copyKey')}
        </button>
        <button
          type="button"
          onClick={handleHide}
          aria-label={t('hideKey')}
          className="text-[11px] text-text-subtle hover:text-text-primary transition-colors"
        >
          {t('hideKey')}
        </button>
      </div>
    )
  }

  return (
    <Btn
      variant="ghost"
      size="sm"
      disabled={loading}
      onClick={handleReveal}
      data-testid="reveal-key-btn"
    >
      {loading
        ? <Icon name="loader-circle" size={13} className="animate-spin" />
        : <Icon name="eye" size={13} />}
      {t('actions.reveal')}
    </Btn>
  )
}
