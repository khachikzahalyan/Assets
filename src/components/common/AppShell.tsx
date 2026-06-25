import { useState, useMemo, useEffect, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { defaultRouteForRole } from '@/config'
import { TopbarSlotContext } from './TopbarSlotContext'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { SearchPalette } from './SearchPalette'

export interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { role } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation(['common', 'nav'])

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [topbarNode, setTopbarNode] = useState<ReactNode>(null)

  // Derive currentRoute from location pathname
  const seg = location.pathname.replace(/^\/+/, '').split('/')[0] ?? ''
  const currentRoute = seg !== '' ? seg : defaultRouteForRole(role)

  const onNavigate = (route: string) => navigate('/' + route)

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Cmd+K / Ctrl+K → open SearchPalette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const topbarSlotApi = useMemo(() => ({ setNode: setTopbarNode }), [])

  const breadcrumbs = [
    t(role === 'employee' ? 'breadcrumb.personal' : 'breadcrumb.root', { ns: 'common' }),
    t('items.' + currentRoute, { ns: 'nav' }),
  ]

  return (
    <TopbarSlotContext.Provider value={topbarSlotApi}>
      <div className="app-shell-root app-shell-bg">
        <div className="app-shell-body">
          {/* Desktop sidebar */}
          <div className="hidden lg:block">
            <Sidebar currentRoute={currentRoute} onNavigate={onNavigate} />
          </div>

          {/* Mobile drawer */}
          {sidebarOpen && (
            <>
              <div
                className="lg:hidden sidebar-overlay anim-backdrop-fade"
                onClick={() => setSidebarOpen(false)}
              />
              <div className="lg:hidden">
                <Sidebar
                  mobile
                  currentRoute={currentRoute}
                  onNavigate={(r) => { onNavigate(r); setSidebarOpen(false) }}
                  onClose={() => setSidebarOpen(false)}
                />
              </div>
            </>
          )}

          {/* Main column */}
          <main className="app-shell-main">
            <TopBar
              breadcrumbs={breadcrumbs}
              customContent={topbarNode ?? undefined}
              onOpenSidebar={() => setSidebarOpen(true)}
            />
            <div className={`app-shell-content${currentRoute === 'assets' ? ' app-shell-content-flush' : ''}`}>{children}</div>
          </main>
        </div>
      </div>

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPick={(r) => { if (r.route) navigate('/' + r.route) }}
      />
    </TopbarSlotContext.Provider>
  )
}
