import { useLayoutEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { MobileHero } from './login/MobileHero'
import { FormPanel } from './login/FormPanel'
import { DesktopDecorPanel } from './login/DesktopDecorPanel'

// ── Main page component ───────────────────────────────────────────────────────
export function LoginPage() {
  const { status } = useAuth()

  // The login screen is ALWAYS dark, regardless of the app's light/dark theme.
  // The `.light` class on <html> gates every `light:` variant, so we drop it while
  // this page is mounted and restore it on leave — the authenticated app keeps the
  // user's chosen theme. useLayoutEffect runs before paint, so there's no flash.
  useLayoutEffect(() => {
    const html = document.documentElement
    if (!html.classList.contains('light')) return
    html.classList.remove('light')
    const meta = document.querySelector('meta[name="theme-color"]')
    const prevColor = meta?.getAttribute('content') ?? null
    meta?.setAttribute('content', '#111315')
    return () => {
      html.classList.add('light')
      if (prevColor !== null) meta?.setAttribute('content', prevColor)
    }
  }, [])

  // Already authenticated → leave the public login route.
  if (status === 'ready' || status === 'no-role') {
    return <Navigate to="/" replace />
  }

  return (
    <div
      className="flex max-lg:flex-col max-lg:h-[100dvh] max-lg:overflow-hidden lg:min-h-screen bg-[#1C1F26] light:bg-bg"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <MobileHero />
      <FormPanel />
      <DesktopDecorPanel />
    </div>
  )
}
