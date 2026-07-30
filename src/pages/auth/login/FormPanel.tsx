import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/icon'
import { ErrorBanner } from './ErrorBanner'
import { useLoginForm } from './useLoginForm'

/** Left form panel: logo, employee email-link form, admin Google sign-in. */
export function FormPanel() {
  const { t } = useTranslation('login')
  const {
    linkCheckError,
    linkChecking,
    googleError,
    googleBusy,
    email,
    setEmail,
    emailError,
    setEmailError,
    linkBusy,
    linkError,
    setLinkError,
    linkSent,
    setLinkSent,
    handleGoogle,
    handleSendLink,
  } = useLoginForm()

  // Split footer note on newline for <br/> rendering
  const footerLines = t('footer.note').split('\n')

  return (
    <div
      className="w-full lg:w-[44%] relative flex lg:items-center lg:justify-center lg:px-16 lg:py-[60px] max-lg:flex-1 max-lg:flex-col max-lg:px-6 max-lg:pt-7 max-lg:pb-5 max-lg:min-h-0 max-lg:overflow-y-auto"
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
        <span className="text-white light:text-text-primary" style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '.3px' }}>
          AMS
        </span>
      </div>

      {/* Form content — full-width column on mobile; max-400px centered on desktop */}
      <div
        className="w-full lg:max-w-[400px] max-lg:flex-1 max-lg:flex max-lg:flex-col"
        style={{ animation: 'fadeInUp .6s ease .1s both' }}
      >

        {/* Title block */}
        <div className="lg:mb-[40px] max-lg:mb-5">
          <h1
            className="max-lg:text-[22px] lg:text-[28px] text-white light:text-text-primary"
            style={{
              fontWeight: 700,
              letterSpacing: '-.5px',
              marginBottom: '8px',
              lineHeight: 1.2,
            }}
          >
            {t('page.title')}
          </h1>
          <p
            className="max-lg:text-[13px] lg:text-[14px] text-[#6b7280] light:text-text-secondary"
            style={{ lineHeight: 1.5 }}
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
            <Icon name="loader-circle" size={16} className="animate-spin text-accent" />
            <span className="text-[12.5px] text-white/40 light:text-text-tertiary">
              {t('loading')}
            </span>
          </div>
        )}

        {/* ── Employee section (moved above admin per request) ── */}
        <section aria-labelledby="employee-section-lbl" className="lg:mb-7 max-lg:mb-5">
          <p
            id="employee-section-lbl"
            className="max-lg:text-[9px] lg:text-[10px] max-lg:mb-[10px] lg:mb-3 max-lg:text-[#3a4055] lg:text-[#4a5065] light:text-text-tertiary"
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
                className="w-11 h-11 rounded-full inline-flex items-center justify-center bg-emerald-500/10 border border-emerald-500/30 light:bg-emerald-50 light:border-emerald-200"
              >
                <Icon name="mail-check" size={20} className="text-emerald-400 light:text-emerald-700" />
              </span>
              <p className="text-[14.5px] font-semibold text-white light:text-text-primary">
                {t('employee.successTitle')}
              </p>
              <p className="text-[12.5px] max-w-xs text-white/40 light:text-text-tertiary">
                {t('employee.successDesc', { email: email.trim() })}
              </p>
              <button
                type="button"
                onClick={() => { setLinkSent(false); setEmail(''); setLinkError(null) }}
                className="mt-1 text-[12px] underline underline-offset-2 transition-opacity hover:opacity-70 text-white/35 light:text-text-subtle"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
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
                  className="w-full placeholder:text-[#4a5065] light:placeholder:text-text-subtle outline-none block border text-[#e5e7eb] light:text-text-primary text-[14px] px-4
                    lg:bg-[#131620] lg:border-[#2e3347] lg:rounded-[10px] lg:py-[13px]
                    max-lg:bg-[#13151f] max-lg:border-[#252940] max-lg:rounded-[12px] max-lg:py-[14px]
                    light:lg:bg-surface light:lg:border-border-strong
                    light:max-lg:bg-surface light:max-lg:border-border-strong"
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
                  <p role="alert" className="mt-1.5 text-[11.5px] text-[#FDA4AF] light:text-rose-700">
                    {emailError}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => { void handleSendLink() }}
                disabled={linkBusy}
                className="w-full flex items-center justify-center gap-2 bg-accent text-white text-[14px] font-semibold disabled:opacity-60 transition-colors duration-150 cursor-pointer border-0 px-5
                  max-lg:rounded-[12px] max-lg:py-[14px] max-lg:hover:bg-accent-hover
                  lg:rounded-[10px] lg:py-[13px] lg:hover:bg-accent-hover"
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

        {/* ── Divider ── */}
        <div
          className="flex items-center gap-3 lg:mb-7 max-lg:mb-5"
          aria-hidden="true"
        >
          <div className="flex-1 h-px lg:bg-[#22263a] max-lg:bg-[#1e2235] light:bg-border" />
          <span
            className="max-lg:text-[11px] lg:text-[12px] max-lg:text-[#2e3450] lg:text-[#3a3f55] light:text-text-subtle"
          >
            {t('divider')}
          </span>
          <div className="flex-1 h-px lg:bg-[#22263a] max-lg:bg-[#1e2235] light:bg-border" />
        </div>

        {/* ── Admin section (moved below employee per request) ── */}
        <section aria-labelledby="admin-section-lbl">
          <p
            id="admin-section-lbl"
            className="max-lg:text-[9px] lg:text-[10px] max-lg:mb-[10px] lg:mb-3 max-lg:text-[#3a4055] lg:text-[#4a5065] light:text-text-tertiary"
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
            className="w-full flex items-center justify-center gap-[10px] text-[#e5e7eb] light:text-text-primary text-[14px] font-medium disabled:opacity-50 transition-colors duration-150 cursor-pointer border px-5
              lg:bg-[#1e2130] lg:border-[#2e3347] lg:rounded-[10px] lg:py-[13px] lg:hover:bg-[#2a2d38] lg:hover:border-[#4a5065]
              max-lg:bg-[#1a1e2e] max-lg:border-[#252940] max-lg:rounded-[12px] max-lg:py-[14px] max-lg:hover:bg-[#22263a]
              light:bg-surface light:border-border-strong light:hover:bg-surface-2 light:hover:border-border"
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

        {/* Footer note — mt-auto pushes it to bottom of column on mobile */}
        <p
          className="text-center max-lg:mt-auto max-lg:pt-3 max-lg:text-[11px] max-lg:text-[#2a3048] lg:mt-[36px] lg:text-[12px] lg:text-[#3a4055] light:text-text-subtle"
          style={{ lineHeight: 1.6 }}
        >
          {footerLines[0]}
          {footerLines.length > 1 && (
            <><br />{footerLines[1]}</>
          )}
        </p>

      </div>
    </div>
  )
}
