import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Icon } from '@/components/ui'

type ToastVariant = 'success' | 'error'

interface ToastState { id: number; text: string; variant: ToastVariant }
interface ToastOpts { variant?: ToastVariant }
interface ToastApi { showToast: (text: string, opts?: ToastOpts) => void }

const Ctx = createContext<ToastApi>({ showToast: () => {} })

export function useToast(): ToastApi { return useContext(Ctx) }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((text: string, opts?: ToastOpts) => {
    setToast({ id: Date.now() + Math.random(), text, variant: opts?.variant ?? 'success' })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[60] pointer-events-none">
        {toast && [toast].map((tt) => (
          <div
            key={tt.id}
            className={
              tt.variant === 'error'
                ? 'anim-toast pointer-events-auto bg-surface border border-rose-500/30 rounded-lg shadow-xl shadow-rose-900/10 px-4 py-3 flex items-center gap-2.5 min-w-[16.25rem] max-w-md'
                : 'anim-toast pointer-events-auto bg-surface border border-emerald-500/30 rounded-lg shadow-xl shadow-emerald-900/10 px-4 py-3 flex items-center gap-2.5 min-w-[16.25rem] max-w-md'
            }
            role={tt.variant === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            <div className={
              tt.variant === 'error'
                ? 'w-7 h-7 rounded-md bg-rose-500/15 text-rose-300 light:text-rose-700 flex items-center justify-center shrink-0'
                : 'w-7 h-7 rounded-md bg-emerald-500/15 text-emerald-300 light:text-emerald-700 flex items-center justify-center shrink-0'
            }>
              <Icon name={tt.variant === 'error' ? 'alert-circle' : 'check'} size={14} />
            </div>
            <div className="text-15 text-text-primary font-semibold tracking-tight">{tt.text}</div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
