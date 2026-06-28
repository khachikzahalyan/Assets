import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { completeEmailLinkIfPresent, sendEmployeeLink, signInWithGoogle } from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'
import { Icon } from '@/components/ui/icon'

/** Minimal email validity check — non-empty and contains @. */
function isValidEmail(v: string): boolean {
  return v.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
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

  // Split footer note on newline for <br/> rendering
  const footerLines = t('footer.note').split('\n')

  return (
    <div
      className="min-h-screen flex max-lg:flex-col"
      style={{ background: '#1C1F26', fontFamily: "'Inter', system-ui, sans-serif" }}
    >

      {/* ── HERO — mobile only ────────────────────────────────────────────────── */}
      <div
        className="lg:hidden flex-shrink-0 relative"
        aria-hidden="true"
        style={{ height: '300px', background: '#0f111a', overflow: 'hidden' }}
      >
        {/* Orange glow — centered */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            width: '380px',
            height: '380px',
            background: 'radial-gradient(circle, rgba(232,105,42,0.22) 0%, rgba(232,105,42,0.06) 40%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        {/* Blue accent — top-right */}
        <div
          style={{
            position: 'absolute',
            top: '-60px',
            right: '-60px',
            width: '260px',
            height: '260px',
            background: 'radial-gradient(circle, rgba(56,130,220,0.14) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        {/* Dot grid */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            opacity: 0.12,
          }}
          aria-hidden="true"
        >
          <defs>
            <pattern id="mdots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#4a5a7a" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mdots)" />
        </svg>
        {/* Network SVG — viewBox 393×300, slice */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
          }}
          viewBox="0 0 393 300"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <filter id="mg-orange">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="mg-blue">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="mno" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E8692A" />
              <stop offset="100%" stopColor="#c45520" />
            </radialGradient>
            <radialGradient id="mnb" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#4a9eff" />
              <stop offset="100%" stopColor="#2d6fd4" />
            </radialGradient>
            <radialGradient id="mnd" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#2e3a55" />
              <stop offset="100%" stopColor="#1e2840" />
            </radialGradient>
          </defs>
          {/* Orange connection lines */}
          <g stroke="#E8692A" strokeWidth="0.8" fill="none" opacity="0.22">
            <line x1="196" y1="150" x2="100" y2="80" />
            <line x1="196" y1="150" x2="290" y2="85" />
            <line x1="196" y1="150" x2="300" y2="210" />
            <line x1="196" y1="150" x2="95" y2="220" />
            <line x1="196" y1="150" x2="196" y2="55" />
            <line x1="100" y1="80" x2="44" y2="110" />
            <line x1="100" y1="80" x2="136" y2="28" />
            <line x1="290" y1="85" x2="348" y2="50" />
            <line x1="290" y1="85" x2="355" y2="130" />
            <line x1="300" y1="210" x2="362" y2="195" />
            <line x1="95" y1="220" x2="38" y2="255" />
            <line x1="95" y1="220" x2="50" y2="170" />
          </g>
          {/* Blue secondary lines */}
          <g stroke="#3a82dc" strokeWidth="0.6" fill="none" opacity="0.15">
            <line x1="44" y1="110" x2="50" y2="170" />
            <line x1="348" y1="50" x2="355" y2="130" />
            <line x1="362" y1="195" x2="38" y2="255" />
          </g>
          {/* Dim leaf nodes */}
          <g opacity="0.45">
            <circle cx="44" cy="110" r="3.5" fill="url(#mnd)" />
            <circle cx="136" cy="28" r="3.5" fill="url(#mnd)" />
            <circle cx="348" cy="50" r="3.5" fill="url(#mnd)" />
            <circle cx="355" cy="130" r="3.5" fill="url(#mnd)" />
            <circle cx="362" cy="195" r="3.5" fill="url(#mnd)" />
            <circle cx="38" cy="255" r="3.5" fill="url(#mnd)" />
            <circle cx="50" cy="170" r="3.5" fill="url(#mnd)" />
            <circle cx="196" cy="55" r="3.5" fill="url(#mnd)" />
          </g>
          {/* Blue intermediate nodes */}
          <g filter="url(#mg-blue)">
            <circle cx="100" cy="80" r="5.5" fill="url(#mnb)" opacity="0.85" />
            <circle cx="290" cy="85" r="5.5" fill="url(#mnb)" opacity="0.85" />
            <circle cx="300" cy="210" r="5.5" fill="url(#mnb)" opacity="0.85" />
            <circle cx="95" cy="220" r="5.5" fill="url(#mnb)" opacity="0.85" />
          </g>
          {/* Pulse rings on center node (196,150) — prototype breathing pulse */}
          <circle
            cx="196"
            cy="150"
            r="28"
            fill="none"
            stroke="#E8692A"
            strokeWidth="1"
            style={{
              opacity: 0,
              animation: 'pulse-ring-m 3s ease-in-out infinite',
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
          />
          <circle
            cx="196"
            cy="150"
            r="42"
            fill="none"
            stroke="#E8692A"
            strokeWidth=".7"
            style={{
              opacity: 0,
              animation: 'pulse-ring-m 3s ease-in-out .9s infinite',
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
          />
          {/* Center node */}
          <g filter="url(#mg-orange)">
            <circle cx="196" cy="150" r="18" fill="#1a1e2a" stroke="#E8692A" strokeWidth="1.2" opacity="0.9" />
            <circle cx="196" cy="150" r="9" fill="url(#mno)" />
            <g
              transform="translate(191,145)"
              fill="none"
              stroke="white"
              strokeWidth="1"
              strokeLinejoin="round"
            >
              <path d="M5 0.5L0 3l5 2.5 5-2.5L5 0.5z" />
              <path d="M0 8l5 2.5 5-2.5" />
              <path d="M0 5.5l5 2.5 5-2.5" />
            </g>
          </g>
        </svg>
        {/* Scan line — sweeps hero top→bottom via global `scan` keyframe */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: '1.5px',
            background: 'linear-gradient(90deg,transparent,rgba(232,105,42,0.45),transparent)',
            pointerEvents: 'none',
            animation: 'scan 5s ease-in-out infinite',
          }}
        />
        {/* AMS label overlay — bottom of hero */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '16px 24px',
            background: 'linear-gradient(to top,#0f111a 0%,transparent 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                background: '#E8692A',
                borderRadius: '7px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p style={{ color: '#fff', fontSize: '13px', fontWeight: 700, lineHeight: 1.1 }}>AMS</p>
              <p style={{ color: '#4a5065', fontSize: '10px', lineHeight: 1.1 }}>{t('hero.brand')}</p>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 6px #22c55e',
                }}
              />
              <span style={{ color: '#22c55e', fontSize: '10px', fontWeight: 500 }}>{t('hero.online')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── LEFT: Form panel ─────────────────────────────────────────────────── */}
      <div
        className="w-full lg:w-[44%] relative flex lg:items-center lg:justify-center lg:px-16 lg:py-[60px] max-lg:flex-1 max-lg:flex-col max-lg:px-6 max-lg:pt-12 max-lg:pb-8"
      >

        {/* Logo — desktop only: position:absolute top-left, out of flex flow */}
        <div
          className="hidden lg:flex absolute top-9 left-12"
          style={{
            alignItems: 'center',
            gap: '10px',
            animation: 'fadeInUp .5s ease both',
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              background: '#E8692A',
              borderRadius: '9px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ color: 'white', fontSize: '15px', fontWeight: 600, letterSpacing: '.3px' }}>
            AMS
          </span>
        </div>

        {/* Form content — full-width column on mobile; max-400px centered on desktop */}
        <div
          className="w-full lg:max-w-[400px] max-lg:flex-1 max-lg:flex max-lg:flex-col"
          style={{ animation: 'fadeInUp .6s ease .1s both' }}
        >

          {/* Title block */}
          <div className="lg:mb-[40px] max-lg:mb-7">
            <h1
              className="max-lg:text-[22px] lg:text-[28px]"
              style={{
                color: '#ffffff',
                fontWeight: 700,
                letterSpacing: '-.5px',
                marginBottom: '8px',
                lineHeight: 1.2,
              }}
            >
              {t('page.title')}
            </h1>
            <p
              className="max-lg:text-[13px] lg:text-[14px]"
              style={{ color: '#6b7280', lineHeight: 1.5 }}
            >
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
          <section aria-labelledby="admin-section-lbl" className="lg:mb-7 max-lg:mb-5">
            <p
              id="admin-section-lbl"
              className="max-lg:text-[9px] lg:text-[10px] max-lg:mb-[10px] lg:mb-3 max-lg:text-[#3a4055] lg:text-[#4a5065]"
              style={{
                fontWeight: 600,
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
              }}
            >
              {t('admin.label')}
            </p>

            {googleError && (
              <div style={{ marginBottom: '12px' }}>
                <ErrorBanner message={googleError} />
              </div>
            )}

            <button
              type="button"
              onClick={() => { void handleGoogle() }}
              disabled={googleBusy}
              className="w-full flex items-center justify-center gap-[10px] text-[#e5e7eb] text-[14px] font-medium disabled:opacity-50 transition-colors duration-150 cursor-pointer border px-5
                lg:bg-[#1e2130] lg:border-[#2e3347] lg:rounded-[10px] lg:py-[13px] lg:hover:bg-[#2a2d38] lg:hover:border-[#4a5065]
                max-lg:bg-[#1a1e2e] max-lg:border-[#252940] max-lg:rounded-[12px] max-lg:py-[14px] max-lg:hover:bg-[#22263a]"
            >
              {googleBusy ? (
                <Icon name="loader-circle" size={18} className="animate-spin text-[#e5e7eb]" />
              ) : (
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" className="flex-shrink-0">
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
          <div
            className="flex items-center gap-3 lg:mb-7 max-lg:mb-5"
            aria-hidden="true"
          >
            <div className="flex-1 h-px lg:bg-[#22263a] max-lg:bg-[#1e2235]" />
            <span
              className="max-lg:text-[11px] lg:text-[12px] max-lg:text-[#2e3450] lg:text-[#3a3f55]"
            >
              {t('divider')}
            </span>
            <div className="flex-1 h-px lg:bg-[#22263a] max-lg:bg-[#1e2235]" />
          </div>

          {/* ── Employee section ── */}
          <section aria-labelledby="employee-section-lbl">
            <p
              id="employee-section-lbl"
              className="max-lg:text-[9px] lg:text-[10px] max-lg:mb-[10px] lg:mb-3 max-lg:text-[#3a4055] lg:text-[#4a5065]"
              style={{
                fontWeight: 600,
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
              }}
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
                  style={{ color: 'rgba(255,255,255,0.38)', background: 'none', border: 'none', cursor: 'pointer' }}
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
                  <input
                    id="employee-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(null) }}
                    placeholder={t('employee.emailPlaceholder')}
                    disabled={linkBusy}
                    className="w-full placeholder:text-[#4a5065] outline-none block border text-[#e5e7eb] text-[14px] px-4
                      lg:bg-[#131620] lg:border-[#2e3347] lg:rounded-[10px] lg:py-[13px]
                      max-lg:bg-[#13151f] max-lg:border-[#252940] max-lg:rounded-[12px] max-lg:py-[14px]"
                    style={{
                      boxSizing: 'border-box',
                      opacity: linkBusy ? 0.5 : 1,
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#E8692A'
                      e.currentTarget.style.boxShadow = '0 0 0 2px rgba(232,105,42,0.2)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = ''
                      e.currentTarget.style.boxShadow = 'none'
                    }}
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
                  className="w-full flex items-center justify-center gap-2 bg-[#E8692A] text-white text-[14px] font-semibold disabled:opacity-60 transition-colors duration-150 cursor-pointer border-0 px-5
                    max-lg:rounded-[12px] max-lg:py-[14px] max-lg:hover:bg-[#d45e22]
                    lg:rounded-[10px] lg:py-[13px] lg:hover:bg-[#cf5a1f]"
                  style={{ letterSpacing: '.2px' }}
                >
                  {linkBusy && (
                    <Icon name="loader-circle" size={16} className="animate-spin" />
                  )}
                  {linkBusy ? t('employee.sending') : t('employee.linkBtn')}
                </button>
              </div>
            )}
          </section>

          {/* Footer note — mt-auto pushes it to bottom of column on mobile */}
          <p
            className="text-center max-lg:mt-auto max-lg:pt-6 max-lg:text-[11px] max-lg:text-[#2a3048] lg:mt-[36px] lg:text-[12px] lg:text-[#3a4055]"
            style={{ lineHeight: 1.6 }}
          >
            {footerLines[0]}
            {footerLines.length > 1 && (
              <><br />{footerLines[1]}</>
            )}
          </p>

        </div>
      </div>

      {/* ── RIGHT: Decorative panel (desktop only) ───────────────────────────── */}
      <div
        className="hidden lg:flex flex-1 relative overflow-hidden"
        style={{ background: '#0f111a' }}
        aria-hidden="true"
      >

        {/* 1. Orange radial glow — CENTERED */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '40%',
            transform: 'translate(-50%, -50%)',
            width: '700px',
            height: '700px',
            background: 'radial-gradient(circle, rgba(232,105,42,0.18) 0%, rgba(232,105,42,0.05) 40%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* 2. Blue glow — TOP-RIGHT */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-80px',
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(56,130,220,0.12) 0%, transparent 65%)',
            pointerEvents: 'none',
          }}
        />

        {/* 3. Dot grid */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            opacity: 0.15,
          }}
          aria-hidden="true"
        >
          <defs>
            <pattern id="dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#4a5a7a" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {/* 4. Network SVG — full cover, viewBox 800×600, slice */}
        <svg
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
          viewBox="0 0 800 600"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <filter id="glow-orange">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-blue">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="node-orange" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E8692A" />
              <stop offset="100%" stopColor="#c45520" />
            </radialGradient>
            <radialGradient id="node-blue" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#4a9eff" />
              <stop offset="100%" stopColor="#2d6fd4" />
            </radialGradient>
            <radialGradient id="node-dim" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#2e3a55" />
              <stop offset="100%" stopColor="#1e2840" />
            </radialGradient>
          </defs>

          {/* Orange connection lines */}
          <g stroke="#E8692A" strokeWidth="1" fill="none" opacity="0.25">
            <line x1="400" y1="300" x2="220" y2="160" />
            <line x1="400" y1="300" x2="580" y2="180" />
            <line x1="400" y1="300" x2="600" y2="400" />
            <line x1="400" y1="300" x2="240" y2="430" />
            <line x1="400" y1="300" x2="400" y2="130" />
            <line x1="220" y1="160" x2="100" y2="220" />
            <line x1="220" y1="160" x2="290" y2="60" />
            <line x1="580" y1="180" x2="690" y2="100" />
            <line x1="580" y1="180" x2="700" y2="240" />
            <line x1="600" y1="400" x2="730" y2="380" />
            <line x1="600" y1="400" x2="660" y2="490" />
            <line x1="240" y1="430" x2="130" y2="490" />
            <line x1="240" y1="430" x2="160" y2="340" />
            <line x1="400" y1="130" x2="490" y2="60" />
            <line x1="400" y1="130" x2="310" y2="55" />
          </g>

          {/* Blue secondary lines */}
          <g stroke="#3a82dc" strokeWidth="0.8" fill="none" opacity="0.2">
            <line x1="100" y1="220" x2="160" y2="340" />
            <line x1="290" y1="60" x2="310" y2="55" />
            <line x1="690" y1="100" x2="700" y2="240" />
            <line x1="730" y1="380" x2="660" y2="490" />
            <line x1="130" y1="490" x2="160" y2="340" />
          </g>

          {/* Dim leaf nodes */}
          <g opacity="0.5">
            <circle cx="100" cy="220" r="5" fill="url(#node-dim)" />
            <circle cx="290" cy="60" r="5" fill="url(#node-dim)" />
            <circle cx="690" cy="100" r="5" fill="url(#node-dim)" />
            <circle cx="700" cy="240" r="5" fill="url(#node-dim)" />
            <circle cx="730" cy="380" r="5" fill="url(#node-dim)" />
            <circle cx="660" cy="490" r="5" fill="url(#node-dim)" />
            <circle cx="130" cy="490" r="5" fill="url(#node-dim)" />
            <circle cx="160" cy="340" r="5" fill="url(#node-dim)" />
            <circle cx="490" cy="60" r="5" fill="url(#node-dim)" />
            <circle cx="310" cy="55" r="5" fill="url(#node-dim)" />
          </g>

          {/* Blue intermediate nodes */}
          <g filter="url(#glow-blue)">
            <circle cx="220" cy="160" r="8" fill="url(#node-blue)" opacity="0.85" />
            <circle cx="580" cy="180" r="8" fill="url(#node-blue)" opacity="0.85" />
            <circle cx="600" cy="400" r="8" fill="url(#node-blue)" opacity="0.85" />
            <circle cx="240" cy="430" r="8" fill="url(#node-blue)" opacity="0.85" />
            <circle cx="400" cy="130" r="7" fill="url(#node-blue)" opacity="0.7" />
          </g>

          {/* Pulse rings on CENTER node (400,300) — prototype breathing pulse */}
          <circle
            cx="400" cy="300" r="42" fill="none" stroke="#E8692A" strokeWidth="1.5"
            style={{
              opacity: 0,
              animation: 'pulse-ring 3s ease-in-out infinite',
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
          />
          <circle
            cx="400" cy="300" r="64" fill="none" stroke="#E8692A" strokeWidth="1"
            style={{
              opacity: 0,
              animation: 'pulse-ring 3s ease-in-out .8s infinite',
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
          />
          <circle
            cx="400" cy="300" r="88" fill="none" stroke="#E8692A" strokeWidth="0.7"
            style={{
              opacity: 0,
              animation: 'pulse-ring 3s ease-in-out 1.6s infinite',
              transformBox: 'fill-box',
              transformOrigin: 'center',
            }}
          />

          {/* Center node: concentric circles + layers icon */}
          <g filter="url(#glow-orange)">
            <circle cx="400" cy="300" r="26" fill="#1a1e2a" stroke="#E8692A" strokeWidth="1.5" opacity="0.9" />
            <circle cx="400" cy="300" r="14" fill="url(#node-orange)" />
            <g
              transform="translate(392,292)"
              fill="none"
              stroke="white"
              strokeWidth="1.3"
              strokeLinejoin="round"
            >
              <path d="M8 1L1 4.5l7 3.5 7-3.5L8 1z" />
              <path d="M1 11.5l7 3.5 7-3.5" />
              <path d="M1 8l7 3.5 7-3.5" />
            </g>
          </g>
        </svg>

        {/* 5. Giant AMS — anchored BOTTOM-RIGHT */}
        <div
          style={{
            position: 'absolute',
            bottom: '-40px',
            right: '-30px',
            fontSize: '280px',
            fontWeight: 800,
            color: 'rgba(255,255,255,0.025)',
            letterSpacing: '-10px',
            lineHeight: 1,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          AMS
        </div>

        {/* 6. Scan line */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(232,105,42,0.4), transparent)',
            animation: 'scan 6s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />

        {/* 7. Info card — bottom-left */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '40px',
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '14px',
            padding: '20px 24px',
            maxWidth: '280px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 8px #22c55e',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                color: '#6b7280',
                fontSize: '11px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '.8px',
              }}
            >
              {t('visual.statusOnline')}
            </span>
          </div>
          <p style={{ color: '#e5e7eb', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
            {t('visual.infoTitle')}
          </p>
          <p style={{ color: '#4a5065', fontSize: '12px', lineHeight: 1.5 }}>
            {t('visual.infoDesc')}
          </p>
        </div>

        {/* 8. Stats cards — top-right, right-aligned text */}
        <div
          style={{
            position: 'absolute',
            top: '40px',
            right: '40px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'flex-end',
          }}
        >
          {/* Roles card — orange tinted */}
          <div
            style={{
              background: 'rgba(232,105,42,0.12)',
              border: '1px solid rgba(232,105,42,0.25)',
              borderRadius: '10px',
              padding: '10px 16px',
              textAlign: 'right',
            }}
          >
            <p style={{ color: '#E8692A', fontSize: '18px', fontWeight: 700, lineHeight: 1 }}>
              {t('visual.rolesValue')}
            </p>
            <p style={{ color: '#4a5065', fontSize: '11px', marginTop: '2px' }}>
              {t('visual.rolesDesc')}
            </p>
          </div>

          {/* QR card — neutral */}
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '10px',
              padding: '10px 16px',
              textAlign: 'right',
            }}
          >
            <p style={{ color: '#e5e7eb', fontSize: '18px', fontWeight: 700, lineHeight: 1 }}>
              {t('visual.qrValue')}
            </p>
            <p style={{ color: '#4a5065', fontSize: '11px', marginTop: '2px' }}>
              {t('visual.qrDesc')}
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
