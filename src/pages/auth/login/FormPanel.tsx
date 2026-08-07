import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/icon'
import { ErrorBanner } from './ErrorBanner'
import { useLoginForm } from './useLoginForm'

// Public demo credentials — a permanent guest super_admin so anyone can sign in
// and explore the project. Kept in sync with scripts/create-admin-login.ts.
const DEMO_LOGIN = 'superadmin'
const DEMO_PASSWORD = 'ams123'

/** Left form panel: login+password and Google sign-in (unified for all roles). */
export function FormPanel() {
  const { t } = useTranslation('login')
  const {
    googleError,
    googleBusy,
    login,
    setLogin,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    pwBusy,
    pwError,
    setPwError,
    forgotHint,
    handleForgotPassword,
    handlePasswordSignIn,
    handleGoogle,
  } = useLoginForm()

  const [showPassword, setShowPassword] = useState(false)

  function fillDemo() {
    setLogin(DEMO_LOGIN)
    setPassword(DEMO_PASSWORD)
    setPwError(null)
  }

  // Split footer note on newline for <br/> rendering
  const footerLines = t('footer.note').split('\n')

  return (
    <div
      className="w-full lg:w-[44%] relative flex lg:items-center lg:justify-center lg:px-16 lg:py-[3.75rem] max-lg:flex-1 max-lg:flex-col max-lg:px-6 max-lg:pt-7 max-lg:pb-5 max-lg:min-h-0 max-lg:overflow-y-auto"
    >

      {/* Form content — full-width column on mobile; max-25rem centered on desktop */}
      <div
        className="w-full lg:max-w-[25rem] max-lg:flex-1 max-lg:flex max-lg:flex-col"
        style={{ animation: 'fadeInUp .6s ease .1s both' }}
      >

        {/* Title block */}
        <div className="lg:mb-10 max-lg:mb-5">
          <h1
            className="max-lg:text-22 lg:text-display-sm text-white light:text-text-primary"
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
            className="max-lg:text-13 lg:text-14 text-[#6b7280] light:text-text-secondary"
            style={{ lineHeight: 1.5 }}
          >
            {t('page.subtitle')}
          </p>
        </div>

        {/* ── Sign-in section: login+password, then Google (unified for all roles) ── */}
        <section aria-label={t('page.title')}>
          {/* Login + password credentials — real Firebase email/password sign-in */}
          <form
            className="lg:mb-5 max-lg:mb-4"
            onSubmit={(e) => { e.preventDefault(); void handlePasswordSignIn() }}
          >
            {pwError && <div className="mb-3"><ErrorBanner message={pwError} /></div>}

            {/* Login field */}
            <div className="mb-4">
              <label htmlFor="admin-login" className="block mb-1.5 text-13 font-medium text-[#c8ccd6] light:text-text-secondary">
                {t('admin.loginLabel')}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-0 bottom-0 flex items-center text-[#6b7280] light:text-text-tertiary pointer-events-none">
                  <Icon name="user" size={17} />
                </span>
                <input
                  id="admin-login"
                  type="text"
                  autoComplete="username"
                  value={login}
                  onChange={(e) => { setLogin(e.target.value); setPwError(null) }}
                  placeholder={t('admin.loginPlaceholder')}
                  disabled={pwBusy}
                  className="w-full placeholder:text-[#4a5065] light:placeholder:text-text-subtle outline-none block border text-[#e5e7eb] light:text-text-primary text-14 pl-11 pr-4
                    lg:bg-[#131620] lg:border-[#2e3347] lg:rounded-[10px] lg:py-[0.8125rem]
                    max-lg:bg-[#13151f] max-lg:border-[#252940] max-lg:rounded-[12px] max-lg:py-3.5
                    light:lg:bg-surface light:lg:border-border-strong
                    light:max-lg:bg-surface light:max-lg:border-border-strong"
                  style={{ boxSizing: 'border-box', opacity: pwBusy ? 0.5 : 1, transition: 'border-color 0.15s, box-shadow 0.15s' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#E8692A'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(232,105,42,0.2)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
            </div>

            {/* Password field — label row with "forgot password" link */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="admin-password" className="text-13 font-medium text-[#c8ccd6] light:text-text-secondary">
                  {t('admin.passwordLabel')}
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-12 font-medium text-accent hover:text-accent-hover transition-colors"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {t('admin.forgotPassword')}
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-0 bottom-0 flex items-center text-[#6b7280] light:text-text-tertiary pointer-events-none">
                  <Icon name="lock" size={17} />
                </span>
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPwError(null) }}
                  placeholder={t('admin.passwordPlaceholder')}
                  disabled={pwBusy}
                  className="w-full placeholder:text-[#4a5065] light:placeholder:text-text-subtle outline-none block border text-[#e5e7eb] light:text-text-primary text-14 pl-11 pr-11
                    lg:bg-[#131620] lg:border-[#2e3347] lg:rounded-[10px] lg:py-[0.8125rem]
                    max-lg:bg-[#13151f] max-lg:border-[#252940] max-lg:rounded-[12px] max-lg:py-3.5
                    light:lg:bg-surface light:lg:border-border-strong
                    light:max-lg:bg-surface light:max-lg:border-border-strong"
                  style={{ boxSizing: 'border-box', opacity: pwBusy ? 0.5 : 1, transition: 'border-color 0.15s, box-shadow 0.15s' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#E8692A'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(232,105,42,0.2)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={pwBusy}
                  aria-label={t(showPassword ? 'admin.hidePassword' : 'admin.showPassword')}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                  className="absolute right-0 top-0 bottom-0 flex items-center justify-center w-11 text-[#6b7280] light:text-text-tertiary transition-colors hover:text-[#e5e7eb] light:hover:text-text-primary disabled:opacity-50"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                </button>
              </div>
              {forgotHint && (
                <p className="mt-1.5 text-11.5 text-[#c8ccd6]/70 light:text-text-tertiary">
                  {forgotHint}
                </p>
              )}
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2 mb-5 cursor-pointer select-none w-fit">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={pwBusy}
                className="w-4 h-4 rounded accent-accent cursor-pointer"
              />
              <span className="text-12.5 text-[#c8ccd6] light:text-text-secondary">
                {t('admin.rememberMe')}
              </span>
            </label>

            <button
              type="submit"
              disabled={pwBusy}
              className="w-full flex items-center justify-center gap-2 bg-accent text-white text-14 font-semibold disabled:opacity-60 transition-colors duration-150 cursor-pointer border-0 px-5
                shadow-[0_10px_28px_-8px_rgba(232,105,42,0.65)] hover:shadow-[0_12px_32px_-6px_rgba(232,105,42,0.75)]
                max-lg:rounded-[12px] max-lg:py-3.5 max-lg:hover:bg-accent-hover
                lg:rounded-[10px] lg:py-[0.8125rem] lg:hover:bg-accent-hover"
              style={{ letterSpacing: '.2px', transition: 'background-color .15s, box-shadow .15s' }}
            >
              {pwBusy && <Icon name="loader-circle" size={16} className="animate-spin" />}
              {pwBusy ? t('admin.signingIn') : t('admin.signInBtn')}
            </button>
          </form>

          {/* ── Divider ── */}
          <div className="flex items-center gap-3 lg:mb-5 max-lg:mb-4" aria-hidden="true">
            <div className="flex-1 h-px lg:bg-[#22263a] max-lg:bg-[#1e2235] light:bg-border" />
            <span className="max-lg:text-11 lg:text-12 max-lg:text-[#2e3450] lg:text-[#3a3f55] light:text-text-subtle">
              {t('divider')}
            </span>
            <div className="flex-1 h-px lg:bg-[#22263a] max-lg:bg-[#1e2235] light:bg-border" />
          </div>

          {googleError && (
            <div style={{ marginBottom: '12px' }}>
              <ErrorBanner message={googleError} />
            </div>
          )}

          <button
            type="button"
            onClick={() => { void handleGoogle() }}
            disabled={googleBusy}
            className="w-full flex items-center justify-center gap-2.5 text-[#e5e7eb] light:text-text-primary text-14 font-medium disabled:opacity-50 transition-colors duration-150 cursor-pointer border px-5
              lg:bg-[#1e2130] lg:border-[#2e3347] lg:rounded-[10px] lg:py-[0.8125rem] lg:hover:bg-[#2a2d38] lg:hover:border-[#4a5065]
              max-lg:bg-[#1a1e2e] max-lg:border-[#252940] max-lg:rounded-[12px] max-lg:py-3.5 max-lg:hover:bg-[#22263a]
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

          {/* Demo access hint — permanent guest super_admin for exploring the project */}
          <div className="mt-4 flex items-center justify-between gap-3 rounded-[10px] border border-dashed px-3.5 py-2.5
            lg:border-[#2e3347] lg:bg-[#131620]/40
            max-lg:border-[#252940] max-lg:bg-[#13151f]/40
            light:border-border-strong light:bg-surface">
            <div className="min-w-0">
              <p className="text-10 font-semibold uppercase text-[#6b7280] light:text-text-tertiary" style={{ letterSpacing: '1px' }}>
                {t('demo.label')}
              </p>
              <p className="text-12.5 font-mono truncate text-[#c8ccd6] light:text-text-secondary">
                {DEMO_LOGIN} / {DEMO_PASSWORD}
              </p>
            </div>
            <button
              type="button"
              onClick={fillDemo}
              className="flex-shrink-0 text-12 font-semibold text-accent hover:text-accent-hover transition-colors"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {t('demo.fill')}
            </button>
          </div>
        </section>

        {/* Footer note — mt-auto pushes it to bottom of column on mobile */}
        <p
          className="text-center max-lg:mt-auto max-lg:pt-3 max-lg:text-11 max-lg:text-[#2a3048] lg:mt-9 lg:text-12 lg:text-[#3a4055] light:text-text-subtle"
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
