import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Icon } from '@/components/ui'

interface ToastState { id: number; text: string }
interface ToastApi { showToast: (text: string) => void }

const Ctx = createContext<ToastApi>({ showToast: () => {} })

export function useToast(): ToastApi { return useContext(Ctx) }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((text: string) => {
    setToast({ id: Date.now() + Math.random(), text })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] pointer-events-none">
          <div
            key={toast.id}
            className="anim-toast pointer-events-auto bg-[#1B1F24] border border-emerald-500/30 rounded-lg shadow-xl shadow-emerald-900/10 px-4 py-3 flex items-center gap-2.5 min-w-[260px] max-w-md"
            role="status"
            aria-live="polite"
          >
            <div className="w-7 h-7 rounded-md bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0">
              <Icon name="check" size={14} />
            </div>
            <div className="text-[15px] text-[#F8FAFC] font-semibold tracking-tight">{toast.text}</div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
