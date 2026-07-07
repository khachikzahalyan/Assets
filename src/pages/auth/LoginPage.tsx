import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { MobileHero } from './login/MobileHero'
import { FormPanel } from './login/FormPanel'
import { DesktopDecorPanel } from './login/DesktopDecorPanel'

// ── Main page component ───────────────────────────────────────────────────────
export function LoginPage() {
  const { status } = useAuth()

  // Already authenticated → leave the public login route.
  if (status === 'ready' || status === 'no-role') {
    return <Navigate to="/" replace />
  }

  return (
    <div
      className="flex max-lg:flex-col max-lg:h-[100dvh] max-lg:overflow-hidden lg:min-h-screen"
      style={{ background: '#1C1F26', fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <MobileHero />
      <FormPanel />
      <DesktopDecorPanel />
    </div>
  )
}
