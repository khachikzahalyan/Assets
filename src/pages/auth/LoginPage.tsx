import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { completeEmailLinkIfPresent, sendEmployeeLink, signInWithGoogle } from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/input'
import { Icon } from '@/components/ui/icon'

/** Minimal email validity check — non-empty and contains @. */
function isValidEmail(v: string): boolean {
  return v.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

// ── Decorative network SVG for the right panel ────────────────────────────────
function NetworkVisual() {
  const ringStyle = (delay: string, color: string): React.CSSProperties => ({
    animation: 'pulse-ring 2.6s ease-out infinite',
    transformBox: 'fill-box',
    transformOrigin: 'center',
    animationDelay: delay,
    stroke: color,
  })

  return (
    <svg
      viewBox="0 0 560 420"
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        {/* Node fill gradients */}
        <radialGradient id="ng-orange" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FF8C42" />
          <stop offset="100%" stopColor="#C85820" />
        </radialGradient>
        <radialGradient id="ng-blue" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#7DD3FC" />
          <stop offset="100%" stopColor="#2980B9" />
        </radialGradient>
        <radialGradient id="ng-dim" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#3C4A5E" />
          <stop offset="100%" stopColor="#1E2532" />
        </radialGradient>
        <radialGradient id="ng-center" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FF9A50" />
          <stop offset="100%" stopColor="#E8692A" />
        </radialGradient>

        {/* Glow filters */}
        <filter id="gf-orange" x="-80%" y="-80%" width="360%" height="360%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feFlood floodColor="#E8692A" floodOpacity="0.7" result="fc" />
          <feComposite in="fc" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="gf-blue" x="-80%" y="-80%" width="360%" height="360%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feFlood floodColor="#38BDF8" floodOpacity="0.7" result="fc" />
          <feComposite in="fc" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="gf-center" x="-100%" y="-100%" width="400%" height="400%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
          <feFlood floodColor="#E8692A" floodOpacity="0.6" result="fc" />
          <feComposite in="fc" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Connection lines */}
      <g stroke="rgba(255,255,255,0.07)" strokeWidth="1" fill="none">
        <line x1="280" y1="210" x2="110" y2="105" />
        <line x1="280" y1="210" x2="450" y2="90" />
        <line x1="280" y1="210" x2="90" y2="305" />
        <line x1="280" y1="210" x2="470" y2="320" />
        <line x1="280" y1="210" x2="185" y2="215" />
        <line x1="280" y1="210" x2="400" y2="200" />
        <line x1="280" y1="210" x2="330" y2="335" />
        <line x1="110" y1="105" x2="90" y2="305" />
        <line x1="110" y1="105" x2="185" y2="215" />
        <line x1="450" y1="90" x2="400" y2="200" />
        <line x1="450" y1="90" x2="470" y2="320" />
        <line x1="470" y1="320" x2="330" y2="335" />
        <line x1="90" y1="305" x2="330" y2="335" />
      </g>

      {/* Pulse rings — 3 animated, on orange + 2 blue nodes */}
      <circle cx="110" cy="105" r="20" fill="none" strokeWidth="1"
        style={ringStyle('0s', '#E8692A')} />
      <circle cx="450" cy="90" r="20" fill="none" strokeWidth="1"
        style={ringStyle('0.87s', '#38BDF8')} />
      <circle cx="470" cy="320" r="20" fill="none" strokeWidth="1"
        style={ringStyle('1.74s', '#38BDF8')} />

      {/* Dim nodes */}
      <circle cx="90" cy="305" r="7" fill="url(#ng-dim)" />
      <circle cx="185" cy="215" r="6" fill="url(#ng-dim)" />
      <circle cx="400" cy="200" r="6" fill="url(#ng-dim)" />
      <circle cx="330" cy="335" r="5" fill="url(#ng-dim)" opacity="0.7" />

      {/* Blue nodes */}
      <circle cx="450" cy="90" r="12" fill="url(#ng-blue)" filter="url(#gf-blue)" />
      <circle cx="470" cy="320" r="12" fill="url(#ng-blue)" filter="url(#gf-blue)" />

      {/* Orange node */}
      <circle cx="110" cy="105" r="12" fill="url(#ng-orange)" filter="url(#gf-orange)" />

      {/* Center node — box/package icon at (280,210), rect offset by half-size */}
      <g transform="translate(254, 184)" filter="url(#gf-center)">
        <rect width="52" height="52" rx="12" fill="url(#ng-center)" />
        {/* Lucide package icon (24×24), centered in 52×52 rect via translate(14,14) */}
        <g transform="translate(14,14)" fill="none"
          stroke="rgba(255,255,255,0.92)" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 1 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27,6.96 12,12.01 20.73,6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </g>
      </g>
    </svg>
  )
}

// ── Main page component ───────────────────────────────────────────────────────
export function LoginPage() {
  const { t } = useTranslation('login')
  const { status } = useAuth()

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

  // Already authenticated → leave the public login route.
  if (status === 'ready' || status === 'no-role') {
    return <Navigate to="/" replace />
  }

  // ── Shared error banner ────────────────────────────────────────────────────
  function ErrorBanner({ message }: { message: string }) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl"
        style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.28)' }}
      >
        <Icon name="triangle-alert" size={14} className="text-[#FDA4AF] mt-0.5 flex-shrink-0" />
        <p className="text-[12.5px] text-[#FDA4AF]">{message}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#1C1F26' }}>

      {/* ── LEFT: Form panel ─────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[44%] flex flex-col py-10 px-8 lg:px-14 xl:px-20">

        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#E8692A' }}
          >
            <Icon name="package" size={18} className="text-white" />
          </div>
          <span className="font-bold text-[15px] tracking-tight text-white">AMS</span>
        </div>

        {/* Form area — vertically centered in remaining space */}
        <div className="flex-1 flex flex-col justify-center py-8">
          <div
            className="w-full max-w-[360px]"
            style={{ animation: 'fadeInUp 0.45s ease both' }}
          >

            {/* Title */}
            <div className="mb-8">
              <h1 className="text-[26px] font-bold text-white leading-tight tracking-tight mb-1.5">
                {t('page.title')}
              </h1>
              <p className="text-[13.5px]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                {t('page.subtitle')}
              </p>
            </div>

            {/* Email-link check error banner */}
            {linkCheckError && !linkChecking && (
              <div className="mb-5">
                <ErrorBanner message={linkCheckError} />
              </div>
            )}

            {/* Loading indicator for email link completion */}
            {linkChecking && (
              <div className="flex items-center gap-2 py-2 mb-4">
                <Icon name="loader-circle" size={16} className="animate-spin text-[#E8692A]" />
                <span className="text-[12.5px]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                  {t('loading')}
                </span>
              </div>
            )}

            {/* ── Admin section ── */}
            <section aria-labelledby="admin-section-lbl" className="mb-5">
              <p
                id="admin-section-lbl"
                className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-3"
                style={{ color: 'rgba(255,255,255,0.32)' }}
              >
                {t('admin.label')}
              </p>

              {googleError && (
                <div className="mb-3">
                  <ErrorBanner message={googleError} />
                </div>
              )}

              <button
                type="button"
                onClick={() => { void handleGoogle() }}
                disabled={googleBusy}
                className="w-full h-11 flex items-center justify-center gap-3 rounded-xl font-medium text-[14px] text-white transition-opacity duration-150 disabled:opacity-50 hover:opacity-90"
                style={{
                  background: '#1e2130',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {googleBusy ? (
                  <Icon name="loader-circle" size={16} className="animate-spin text-white" />
                ) : (
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" className="flex-shrink-0">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                {t('admin.googleBtn')}
              </button>
            </section>

            {/* ── Divider ── */}
            <div className="flex items-center gap-3 mb-5" aria-hidden="true">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.28)' }}>
                {t('divider')}
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* ── Employee section ── */}
            <section aria-labelledby="employee-section-lbl">
              <p
                id="employee-section-lbl"
                className="text-[10.5px] font-semibold uppercase tracking-[0.08em] mb-3"
                style={{ color: 'rgba(255,255,255,0.32)' }}
              >
                {t('employee.label')}
              </p>

              {linkSent ? (
                /* Success state */
                <div className="flex flex-col items-center text-center gap-2.5 py-5">
                  <span
                    className="w-11 h-11 rounded-full inline-flex items-center justify-center"
                    style={{
                      background: 'rgba(16,185,129,0.1)',
                      border: '1px solid rgba(16,185,129,0.3)',
                    }}
                  >
                    <Icon name="mail-check" size={20} className="text-emerald-400" />
                  </span>
                  <p className="text-[14.5px] font-semibold text-white">
                    {t('employee.successTitle')}
                  </p>
                  <p className="text-[12.5px] max-w-xs" style={{ color: 'rgba(255,255,255,0.42)' }}>
                    {t('employee.successDesc', { email: email.trim() })}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setLinkSent(false); setEmail(''); setLinkError(null) }}
                    className="mt-1 text-[12px] underline underline-offset-2 transition-opacity hover:opacity-70"
                    style={{ color: 'rgba(255,255,255,0.38)' }}
                  >
                    {t('employee.tryAnother')}
                  </button>
                </div>
              ) : (
                /* Input form */
                <div className="space-y-3">
                  {linkError && <ErrorBanner message={linkError} />}

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
                      className="bg-[#131620] border-white/10 text-white placeholder:text-white/25 focus:border-[#E8692A] focus:ring-[rgba(232,105,42,0.25)]"
                    />
                    {emailError && (
                      <p role="alert" className="mt-1.5 text-[11.5px] text-[#FDA4AF]">
                        {emailError}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => { void handleSendLink() }}
                    disabled={linkBusy}
                    className="w-full h-11 flex items-center justify-center gap-2 rounded-xl font-semibold text-[14px] text-white transition-opacity duration-150 disabled:opacity-50 hover:opacity-90"
                    style={{ background: '#E8692A' }}
                  >
                    {linkBusy && (
                      <Icon name="loader-circle" size={16} className="animate-spin" />
                    )}
                    {linkBusy ? t('employee.sending') : t('employee.linkBtn')}
                  </button>
                </div>
              )}
            </section>

          </div>
        </div>

        {/* Footer note */}
        <p
          className="text-[11px] flex-shrink-0 whitespace-pre-line"
          style={{ color: 'rgba(255,255,255,0.18)' }}
        >
          {t('footer.note')}
        </p>

      </div>

      {/* ── RIGHT: Decorative panel (desktop only) ───────────────────────────── */}
      <div
        className="hidden lg:flex flex-1 relative overflow-hidden"
        style={{ background: '#0f111a' }}
        aria-hidden="true"
      >

        {/* Radial glows */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              'radial-gradient(ellipse 65% 55% at 72% 18%, rgba(232,105,42,0.20) 0%, transparent 70%)',
              'radial-gradient(ellipse 55% 55% at 22% 82%, rgba(56,189,248,0.13) 0%, transparent 70%)',
            ].join(', '),
          }}
        />

        {/* Dot-grid pattern */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ opacity: 0.5 }}
        >
          <defs>
            <pattern id="dot-grid-lg" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.055)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-grid-lg)" />
        </svg>

        {/* Giant "AMS" letterform */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          style={{
            fontSize: 'clamp(180px, 22vw, 300px)',
            fontWeight: 900,
            color: 'rgba(255,255,255,0.025)',
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}
        >
          AMS
        </div>

        {/* Network SVG — fills the panel */}
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <NetworkVisual />
        </div>

        {/* Animated scan line */}
        <div
          className="absolute left-0 right-0 h-[1px] pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(232,105,42,0.55) 50%, transparent 100%)',
            animation: 'scan 5s linear infinite',
            top: 0,
          }}
        />

        {/* Stats cards — top-right */}
        <div className="absolute top-8 right-8 flex flex-col gap-3 z-10">
          <div
            className="px-4 py-3 rounded-xl min-w-[140px]"
            style={{
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <div
              className="text-[22px] font-bold leading-none mb-1"
              style={{ color: '#E8692A' }}
            >
              {t('visual.rolesValue')}
            </div>
            <div className="text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.38)' }}>
              {t('visual.rolesDesc')}
            </div>
          </div>

          <div
            className="px-4 py-3 rounded-xl min-w-[140px]"
            style={{
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <div
              className="text-[22px] font-bold leading-none mb-1"
              style={{ color: '#38BDF8' }}
            >
              {t('visual.qrValue')}
            </div>
            <div className="text-[11px] leading-snug" style={{ color: 'rgba(255,255,255,0.38)' }}>
              {t('visual.qrDesc')}
            </div>
          </div>
        </div>

        {/* Glassmorphism info card — bottom-left */}
        <div
          className="absolute bottom-8 left-8 max-w-[272px] rounded-2xl p-5 z-10"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {/* Online status */}
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: '#10B981', boxShadow: '0 0 6px rgba(16,185,129,0.8)' }}
            />
            <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {t('visual.statusOnline')}
            </span>
          </div>

          <h3 className="text-[13px] font-semibold text-white mb-1.5 leading-snug">
            {t('visual.infoTitle')}
          </h3>
          <p className="text-[11.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.42)' }}>
            {t('visual.infoDesc')}
          </p>
        </div>

      </div>
    </div>
  )
}
