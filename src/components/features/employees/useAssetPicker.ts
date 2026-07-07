import { useState, useMemo, useEffect } from 'react'
import type { PickerStockRow, StepKind } from './assetPickerTypes'

export interface AssetPickerHookState {
  step: StepKind
  groupId: string | null
  catName: string | null
  query: string
  cart: Set<string>
  pendingClose: boolean
  groupCounts: Record<string, number>
  categoriesInGroup: { name: string; icon: string; count: number }[]
  itemsInCategory: PickerStockRow[]
  cartRows: PickerStockRow[]
  cartByCat: { name: string; icon: string; rows: PickerStockRow[] }[]
  setQuery: (q: string) => void
  setPendingClose: (v: boolean) => void
  toggle: (id: string) => void
  removeFromCart: (id: string) => void
  selectGroup: (id: string) => void
  selectCategory: (name: string) => void
  goToGroupStep: () => void
  goToCategoryStep: () => void
  goToReviewStep: () => void
  requestClose: () => void
}

export function useAssetPicker(
  open: boolean,
  stock: PickerStockRow[],
  onClose: () => void,
): AssetPickerHookState {
  const [step, setStep] = useState<StepKind>('group')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [catName, setCatName] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<Set<string>>(new Set())
  const [pendingClose, setPendingClose] = useState(false)

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setStep('group')
      setGroupId(null)
      setCatName(null)
      setQuery('')
      setCart(new Set())
      setPendingClose(false)
    }
  }, [open])

  // ── Derived data from injected stock ────────────────────────────────────

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    stock.forEach((a) => {
      counts[a.group] = (counts[a.group] ?? 0) + 1
    })
    return counts
  }, [stock])

  const categoriesInGroup = useMemo(() => {
    if (!groupId) return []
    const map = new Map<string, { name: string; icon: string; count: number }>()
    stock
      .filter((a) => a.group === groupId)
      .forEach((a) => {
        if (!map.has(a.cat)) map.set(a.cat, { name: a.cat, icon: a.icon, count: 0 })
        map.get(a.cat)!.count += 1
      })
    return Array.from(map.values())
  }, [stock, groupId])

  const itemsInCategory = useMemo(() => {
    if (!groupId || !catName) return []
    const list = stock.filter((a) => a.group === groupId && a.cat === catName)
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (a) =>
        a.title.toLowerCase().includes(q) || a.invCode.toLowerCase().includes(q),
    )
  }, [stock, groupId, catName, query])

  const cartRows = useMemo(() => {
    const byId = new Map(stock.map((a) => [a.id, a]))
    return Array.from(cart)
      .map((id) => byId.get(id))
      .filter((a): a is PickerStockRow => a !== undefined)
  }, [cart, stock])

  const cartByCat = useMemo(() => {
    const map = new Map<string, { name: string; icon: string; rows: PickerStockRow[] }>()
    cartRows.forEach((a) => {
      if (!map.has(a.cat)) map.set(a.cat, { name: a.cat, icon: a.icon, rows: [] })
      map.get(a.cat)!.rows.push(a)
    })
    return Array.from(map.values())
  }, [cartRows])

  const toggle = (id: string) => {
    setCart((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const goToGroupStep = () => {
    setStep('group')
    setGroupId(null)
    setCatName(null)
    setQuery('')
  }
  const goToCategoryStep = () => {
    setStep('category')
    setCatName(null)
    setQuery('')
  }
  const goToReviewStep = () => {
    setStep('review')
    setQuery('')
  }

  const requestClose = () => {
    if (cart.size > 0) setPendingClose(true)
    else onClose()
  }

  const selectGroup = (id: string) => {
    setGroupId(id)
    setStep('category')
  }

  const selectCategory = (name: string) => {
    setCatName(name)
    setStep('items')
    setQuery('')
  }

  return {
    step,
    groupId,
    catName,
    query,
    cart,
    pendingClose,
    groupCounts,
    categoriesInGroup,
    itemsInCategory,
    cartRows,
    cartByCat,
    setQuery,
    setPendingClose,
    toggle,
    removeFromCart,
    selectGroup,
    selectCategory,
    goToGroupStep,
    goToCategoryStep,
    goToReviewStep,
    requestClose,
  }
}
