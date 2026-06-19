import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { completeEmailLinkIfPresent, sendEmployeeLink, signInWithGoogle } from '@/lib/auth'
import { Btn } from '@/components/ui/btn'
import { Input } from '@/components/ui/input'
import { Icon } from '@/components/ui/icon'

/** Minimal email validity check — non-empty and contains @. */
function isValidEmail(v: string): boolean {
  return v.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

export function LoginPage() {
  const { t } = useTranslation('login')

  // Email-link completion state
  const [linkCheckError, setLinkCheckError] = useState<string | null>(null)
  const [linkChecking, setLinkChecking] = useState(false)

  // Google sign-in state
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)

  // Employee email-link request state
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkSent, setLinkSent] = useState(false)

  // On mount: complete email link if current URL is a sign-in link
  useEffect(() => {
    let cancelled = false
    setLinkChecking(true)
    void completeEmailLinkIfPresent(t('confirmEmailPrompt'))
      .then(() => {
        if (!cancelled) setLinkChecking(false)
        // Auth state is driven by AuthProvider; no manual navigate needed.
      })
      .catch(() => {
        if (!cancelled) {
          setLinkChecking(false)
          setLinkCheckError(t('error.emailLinkFailed'))
        }
      })
    return () => { cancelled = true }
  // Run once on mount only — t is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleGoogle() {
    setGoogleError(null)
    setGoogleBusy(true)
    try {
      await signInWithGoogle()
      // AuthProvider's onAuthStateChanged takes over from here.
    } catch {
      setGoogleError(t('error.googleFailed'))
    } finally {
      setGoogleBusy(false)
    }
  }

  async function handleSendLink() {
    setEmailError(null)
    setLinkError(null)
    if (!isValidEmail(email)) {
      setEmailError(t('employee.invalidEmail'))
      return
    }
    setLinkBusy(true)
    try {
      await sendEmployeeLink(email.trim())
      setLinkSent(true)
    } catch {
      setLinkError(t('error.linkFailed'))
    } finally {
      setLinkBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0D1117] flex items-center justify-center px-4">
      <div
        className="w-full max-w-sm bg-[#1B1F24] border border-[#2A2F36] rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.4),0 8px 24px rgba(0,0,0,0.4)' }}
      >
        {/* Brand header */}
        <div className="px-8 pt-8 pb-6 text-center border-b border-[#2A2F36]">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#F97316] mb-4">
            <Icon name="package" size={22} className="text-white" />
          </div>
          <h1 className="text-[20px] font-bold text-[#F8FAFC] tracking-tight">
            {t('page.title')}
          </h1>
          <p className="text-[12.5px] text-[#64748B] mt-1">{t('page.subtitle')}</p>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Email-link check error banner */}
          {linkCheckError && !linkChecking && (
            <div
              role="alert"
              className="flex items-start gap-2.5 px-3.5 py-3 bg-rose-950/40 border border-rose-800/50 rounded-lg"
            >
              <Icon name="triangle-alert" size={14} className="text-[#FDA4AF] mt-0.5 flex-shrink-0" />
              <p className="text-[12.5px] text-[#FDA4AF]">{linkCheckError}</p>
            </div>
          )}

          {/* Loading indicator for email link completion */}
          {linkChecking && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Icon name="loader-circle" size={16} className="text-[#64748B] animate-spin" />
              <span className="text-[12.5px] text-[#64748B]">{t('loading')}</span>
            </div>
          )}

          {/* ── Admin section ── */}
          <section aria-labelledby="admin-section-label">
            <p
              id="admin-section-label"
              className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#64748B] mb-3"
            >
              {t('admin.label')}
            </p>
            {googleError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 px-3.5 py-2.5 mb-3 bg-rose-950/40 border border-rose-800/50 rounded-lg"
              >
                <Icon name="triangle-alert" size={14} className="text-[#FDA4AF] mt-0.5 flex-shrink-0" />
                <p className="text-[12.5px] text-[#FDA4AF]">{googleError}</p>
              </div>
            )}
            <Btn
              variant="secondary"
              size="lg"
              onClick={() => { void handleGoogle() }}
              disabled={googleBusy}
              className="w-full"
            >
              {googleBusy ? (
                <Icon name="loader-circle" size={16} className="animate-spin" />
              ) : (
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  className="flex-shrink-0"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              {t('admin.googleBtn')}
            </Btn>
          </section>

          {/* ── Divider ── */}
          <div className="flex items-center gap-3" aria-hidden="true">
            <div className="flex-1 h-px bg-[#2A2F36]" />
            <span className="text-[11px] text-[#475569] font-medium">{t('divider')}</span>
            <div className="flex-1 h-px bg-[#2A2F36]" />
          </div>

          {/* ── Employee section ── */}
          <section aria-labelledby="employee-section-label">
            <p
              id="employee-section-label"
              className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#64748B] mb-3"
            >
              {t('employee.label')}
            </p>

            {linkSent ? (
              /* Success state */
              <div className="flex flex-col items-center text-center gap-2 py-4">
                <span className="w-10 h-10 rounded-full bg-emerald-950/50 border border-emerald-700/40 inline-flex items-center justify-center">
                  <Icon name="mail-check" size={18} className="text-emerald-400" />
                </span>
                <p className="text-[14px] font-semibold text-[#F8FAFC]">{t('employee.successTitle')}</p>
                <p className="text-[12.5px] text-[#64748B] max-w-xs">
                  {t('employee.successDesc', { email: email.trim() })}
                </p>
                <button
                  type="button"
                  onClick={() => { setLinkSent(false); setEmail(''); setLinkError(null) }}
                  className="mt-1 text-[12px] text-[#64748B] underline underline-offset-2 hover:text-[#CBD5E1] transition-colors"
                >
                  {t('employee.tryAnother')}
                </button>
              </div>
            ) : (
              /* Input form */
              <div className="space-y-2.5">
                {linkError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 px-3.5 py-2.5 bg-rose-950/40 border border-rose-800/50 rounded-lg"
                  >
                    <Icon name="triangle-alert" size={14} className="text-[#FDA4AF] mt-0.5 flex-shrink-0" />
                    <p className="text-[12.5px] text-[#FDA4AF]">{linkError}</p>
                  </div>
                )}
                <div>
                  <label htmlFor="employee-email" className="sr-only">
                    {t('employee.emailPlaceholder')}
                  </label>
                  <Input
                    id="employee-email"
                    value={email}
                    onChange={(v) => { setEmail(v); setEmailError(null) }}
                    placeholder={t('employee.emailPlaceholder')}
                    type="email"
                    disabled={linkBusy}
                    autoFocus={false}
                  />
                  {emailError && (
                    <p role="alert" className="mt-1.5 text-[11.5px] text-[#FDA4AF]">
                      {emailError}
                    </p>
                  )}
                </div>
                <Btn
                  variant="primary"
                  size="lg"
                  onClick={() => { void handleSendLink() }}
                  disabled={linkBusy}
                  className="w-full"
                >
                  {linkBusy && (
                    <Icon name="loader-circle" size={16} className="animate-spin" />
                  )}
                  {linkBusy ? t('employee.sending') : t('employee.linkBtn')}
                </Btn>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
