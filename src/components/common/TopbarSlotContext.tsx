import { createContext, useContext, useEffect, type ReactNode } from 'react'

export interface TopbarSlotApi { setNode: (node: ReactNode) => void }
export const TopbarSlotContext = createContext<TopbarSlotApi>({ setNode: () => {} })

/** A page calls this to inject custom topbar content; auto-clears on unmount. */
export function useTopbarSlot(node: ReactNode, deps: unknown[] = []) {
  const { setNode } = useContext(TopbarSlotContext)
  useEffect(() => {
    setNode(node)
    return () => setNode(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
