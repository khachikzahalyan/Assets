/**
 * AssetPickerSheet — 4-step wizard for linking warehouse stock to an employee.
 *
 * Ported from Warehouse/prototypes/employees.html lines 2161-2532.
 * All data injected via props — no globals, no window.AMS_MOCK.
 *
 * Steps: group → category → items → review.
 * Cart persists across navigation within the wizard.
 * Cancelling with non-empty cart shows an in-modal confirm overlay.
 */
import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, Btn } from '@/components/ui'
import { EmployeeModalShell } from './EmployeeModalShell'
import { employeeInitials, employeeAvatarColor } from './employeeFormat'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PickerStockRow {
  id: string
  title: string
  invCode: string
  cat: string
  icon: string
  group: string
}

export interface AssetPickerSheetProps {
  open: boolean
  emp: {
    id: string
    firstName: string
    lastName: string
    position: string | null
    departmentName: string | null
    branchName: string | null
  } | null
  stock: PickerStockRow[]
  onConfirm: (assetIds: string[]) => void
  onClose: () => void
}

// ── Asset groups config ───────────────────────────────────────────────────────

const ASSET_GROUPS = [
  { id: 'devices', label: 'Устройства', icon: 'laptop', tone: 'indigo' },
  { id: 'network', label: 'Сетевые устройства', icon: 'router', tone: 'sky' },
  { id: 'furniture', label: 'Мебель', icon: 'armchair', tone: 'emerald' },
] as const

type GroupToneKey = 'indigo' | 'sky' | 'emerald'

const ASSET_GROUP_BY_ID = Object.fromEntries(ASSET_GROUPS.map((g) => [g.id, g]))

const ASSET_GROUP_TONES: Record<
  GroupToneKey,
  { tile: string; border: string; hoverBorder: string; hoverBg: string }
> = {
  indigo: {
    tile: 'bg-[#F97316]/10 text-[#F97316]',
    border: 'border-[#F97316]',
    hoverBorder: 'hover:border-[#F97316]',
    hoverBg: 'hover:bg-[#F97316]/10',
  },
  sky: {
    tile: 'bg-sky-500/10 text-sky-300',
    border: 'border-sky-500/30',
    hoverBorder: 'hover:border-sky-500/40',
    hoverBg: 'hover:bg-sky-500/10',
  },
  emerald: {
    tile: 'bg-emerald-500/10 text-emerald-300',
    border: 'border-emerald-500/30',
    hoverBorder: 'hover:border-emerald-500/40',
    hoverBg: 'hover:bg-emerald-500/10',
  },
}

type StepKind = 'group' | 'category' | 'items' | 'review'

// ── Component ─────────────────────────────────────────────────────────────────

export function AssetPickerSheet({
  open,
  emp,
  stock,
  onConfirm,
  onClose,
}: AssetPickerSheetProps) {
  const { t } = useTranslation('employees')
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

  if (!emp) return null

  const count = cart.size
  const empName = `${emp.firstName} ${emp.lastName}`
  const avatarCls = employeeAvatarColor(emp.id)
  const initials = employeeInitials(emp.firstName, emp.lastName)
  const group = groupId ? ASSET_GROUP_BY_ID[groupId] : null

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

  // Breadcrumb
  const crumbs: { label: string; onClick: () => void; active: boolean }[] = []
  if (step === 'review') {
    crumbs.push({ label: t('picker.review'), onClick: () => {}, active: true })
  } else {
    crumbs.push({
      label: 'Категория',
      onClick: goToGroupStep,
      active: step === 'group',
    })
    if (group) {
      crumbs.push({
        label: group.label,
        onClick: goToCategoryStep,
        active: step === 'category',
      })
    }
    if (catName) {
      crumbs.push({ label: catName, onClick: () => {}, active: step === 'items' })
    }
  }

  return (
    <EmployeeModalShell open={open} onClose={requestClose} width="max-w-2xl">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-[#2A2F36]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`w-10 h-10 rounded-full ${avatarCls} text-white text-[14px] font-bold flex items-center justify-center shrink-0`}
            >
              {initials}
            </span>
            <div className="min-w-0">
              <div className="text-[17px] font-bold text-[#F8FAFC] tracking-tight truncate">
                {t('picker.title')} {empName}
              </div>
              <div className="text-[14px] text-[#F8FAFC] mt-0.5 truncate">
                {[emp.position, emp.departmentName, emp.branchName]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Cart pill — visible when cart has items and not on review step */}
            {count > 0 && step !== 'review' && (
              <button
                type="button"
                onClick={goToReviewStep}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/70 text-[13.5px] font-semibold tracking-tight hover:bg-[#F97316]/15 transition-colors"
              >
                <Icon name="shopping-cart" size={12} />
                {t('picker.cart')} <span className="tabular-nums">{count}</span>
              </button>
            )}
            <button
              type="button"
              onClick={requestClose}
              aria-label={t('picker.back')}
              className="w-8 h-8 rounded-md text-[#64748B] hover:text-[#CBD5E1] hover:bg-[#22272E] flex items-center justify-center transition-colors"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>
        {/* Breadcrumb */}
        <div className="mt-3.5 flex items-center gap-1 text-[14px]">
          {crumbs.map((c, i) => (
            <span key={i} className="inline-flex items-center">
              {i > 0 && (
                <Icon name="chevron-right" size={12} className="text-[#64748B] mx-0.5" />
              )}
              <button
                type="button"
                onClick={c.onClick}
                disabled={c.active}
                className={`px-1.5 py-0.5 rounded font-medium tracking-tight transition-colors ${
                  c.active
                    ? 'text-[#F8FAFC] cursor-default'
                    : 'text-[#F8FAFC] hover:text-[#F97316] hover:bg-[#F97316]/10'
                }`}
              >
                {c.label}
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Step 1 — Group selection */}
      {step === 'group' && (
        <div className="px-6 py-5">
          <div className="text-[14px] text-[#F8FAFC] mb-3">{t('picker.intro')}</div>
          <div className="grid grid-cols-3 gap-3">
            {ASSET_GROUPS.map((g) => {
              const tone = ASSET_GROUP_TONES[g.tone as GroupToneKey]
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setGroupId(g.id)
                    setStep('category')
                  }}
                  className={`group flex flex-col items-start gap-3 p-4 rounded-xl bg-[#1B1F24] border ${tone.border} ${tone.hoverBorder} ${tone.hoverBg} shadow-sm hover:shadow-md transition-all duration-150 text-left`}
                >
                  <span
                    className={`w-11 h-11 rounded-lg ${tone.tile} flex items-center justify-center`}
                  >
                    <Icon name={g.icon} size={20} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[15.5px] font-bold text-[#F8FAFC] tracking-tight">
                      {g.id === 'devices'
                        ? t('picker.groupDevices')
                        : g.id === 'network'
                          ? t('picker.groupNetwork')
                          : t('picker.groupFurniture')}
                    </div>
                    <div className="text-[13px] text-[#F8FAFC] mt-0.5 tabular-nums">
                      {groupCounts[g.id] ?? 0} {t('picker.inStock')}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Step 2 — Subcategory selection */}
      {step === 'category' && group && (
        <div className="px-6 py-5">
          <div className="text-[14px] text-[#F8FAFC] mb-3">
            Подкатегория в группе «
            <span className="text-[#F8FAFC] font-semibold">{group.label}</span>».
          </div>
          {categoriesInGroup.length === 0 ? (
            <div className="py-10 text-center text-[14.5px] text-[#94A3B8]">
              Подкатегорий нет
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {categoriesInGroup.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => {
                    setCatName(c.name)
                    setStep('items')
                    setQuery('')
                  }}
                  className="group flex items-center gap-3 p-3 rounded-lg bg-[#1B1F24] border border-[#2A2F36]/80 hover:border-[#F97316] hover:bg-[#F97316]/10 hover:shadow-sm transition-all duration-150 text-left"
                >
                  <span className="w-9 h-9 rounded-md bg-[#22272E] group-hover:bg-[#F97316]/15 text-[#94A3B8] group-hover:text-[#F97316] flex items-center justify-center shrink-0 transition-colors">
                    <Icon name={c.icon} size={15} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold text-[#F8FAFC] truncate tracking-tight">
                      {c.name}
                    </div>
                    <div className="text-[13px] text-[#F8FAFC] tabular-nums">
                      {c.count} {c.count === 1 ? 'актив' : 'активов'}
                    </div>
                  </div>
                  <Icon
                    name="chevron-right"
                    size={14}
                    className="text-[#64748B] group-hover:text-[#FB923C] transition-colors shrink-0"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Specific items in subcategory */}
      {step === 'items' && group && catName && (
        <>
          <div className="px-6 pt-4 pb-3">
            {/* Inline search — no SearchInput export exists, inline matching prototype */}
            <div className="flex items-center gap-2 bg-[#111315] rounded-xl px-3 py-2 ring-1 ring-[#2A2F36]">
              <Icon name="search" size={14} className="text-[#64748B] shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Поиск в «${catName}»…`}
                aria-label={`Поиск в «${catName}»`}
                className="flex-1 text-[14px] bg-transparent border-none outline-none placeholder:text-[#64748B] text-[#F8FAFC] min-w-0"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-[#64748B] hover:text-[#94A3B8] transition-colors"
                  aria-label="Очистить поиск"
                >
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[340px] overflow-y-auto border-t border-[#2A2F36]">
            {itemsInCategory.length === 0 ? (
              <div className="px-6 py-12 text-center text-[14.5px] text-[#94A3B8]">
                {t('picker.notFound')}
              </div>
            ) : (
              <ul className="divide-y divide-[#2A2F36]">
                {itemsInCategory.map((a) => {
                  const isSel = cart.has(a.id)
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => toggle(a.id)}
                        className={`w-full flex items-center gap-3 px-6 py-2.5 text-left transition-colors duration-100 ${
                          isSel ? 'bg-[#F97316]/10' : 'hover:bg-[#111315]'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                            isSel
                              ? 'bg-[#F97316] border-[#F97316] text-white'
                              : 'border-[#3A4048] bg-[#1B1F24]'
                          }`}
                        >
                          {isSel && <Icon name="check" size={11} />}
                        </span>
                        <span className="w-8 h-8 rounded-md bg-[#22272E] text-[#94A3B8] flex items-center justify-center shrink-0">
                          <Icon name={a.icon} size={13} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[15px] font-semibold text-[#F8FAFC] truncate tracking-tight">
                            {a.title}
                          </div>
                          <div className="text-[13px] text-[#F8FAFC] truncate">{a.cat}</div>
                        </div>
                        <span className="font-mono text-[13.5px] font-medium text-[#F8FAFC] bg-[#111315] border border-[#2A2F36]/80 rounded px-1.5 py-0.5 shrink-0">
                          {a.invCode}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Step 4 — Review (cart contents) */}
      {step === 'review' && (
        <div className="max-h-[420px] overflow-y-auto">
          {cartRows.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#22272E] text-[#64748B] flex items-center justify-center mb-3">
                <Icon name="shopping-cart" size={20} />
              </div>
              <div className="text-[15px] font-semibold text-[#F8FAFC] mb-1">
                {t('picker.empty')}
              </div>
              <div className="text-[14px] text-[#94A3B8] mb-4">{t('picker.emptyHint')}</div>
              <Btn variant="secondary" onClick={goToGroupStep}>
                <Icon name="chevron-left" size={14} /> {t('picker.toSelection')}
              </Btn>
            </div>
          ) : (
            <div className="px-6 py-4 space-y-4">
              {cartByCat.map((grp) => (
                <div key={grp.name}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[12.5px] font-semibold text-[#94A3B8] tracking-[0.06em] uppercase">
                      {grp.name}
                    </span>
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#22272E] text-[#94A3B8] text-[12.5px] font-semibold tabular-nums">
                      {grp.rows.length}
                    </span>
                  </div>
                  <ul className="divide-y divide-[#2A2F36] rounded-lg border border-[#2A2F36]/70 overflow-hidden bg-[#1B1F24]">
                    {grp.rows.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                        <span className="w-8 h-8 rounded-md bg-[#22272E] text-[#94A3B8] flex items-center justify-center shrink-0">
                          <Icon name={a.icon} size={13} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[15px] font-semibold text-[#F8FAFC] truncate tracking-tight">
                            {a.title}
                          </div>
                          <div className="text-[13px] text-[#94A3B8] truncate">{a.cat}</div>
                        </div>
                        <span className="font-mono text-[13.5px] font-medium text-[#F8FAFC] bg-[#111315] border border-[#2A2F36]/80 rounded px-1.5 py-0.5 shrink-0">
                          {a.invCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(a.id)}
                          title="Убрать из корзины"
                          className="w-7 h-7 rounded-md text-[#64748B] hover:text-rose-300 hover:bg-rose-500/10 flex items-center justify-center transition-colors shrink-0"
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-3.5 bg-[#111315]/60 border-t border-[#2A2F36] flex items-center justify-between gap-2">
        <div className="text-[13.5px] text-[#F8FAFC] min-w-0 truncate">
          {step === 'items' && count > 0 ? (
            <>
              В корзине:{' '}
              <span className="font-semibold text-[#F8FAFC] tabular-nums">{count}</span> · статус
              станет <span className="font-semibold text-[#F8FAFC]">Выдано</span>
            </>
          ) : step === 'review' && count > 0 ? (
            <>
              {t('picker.willLink')}{' '}
              <span className="font-semibold text-[#F8FAFC] tabular-nums">{count}</span> к{' '}
              <span className="font-semibold text-[#F8FAFC]">{empName}</span>
            </>
          ) : step === 'review' ? (
            <>{t('picker.empty')}</>
          ) : (
            <>
              {t('picker.branchOnly')}{' '}
              <span className="font-semibold text-[#F8FAFC]">{emp.branchName}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {step === 'category' && (
            <Btn variant="ghost" onClick={goToGroupStep}>
              <Icon name="chevron-left" size={14} /> {t('picker.back')}
            </Btn>
          )}
          {step === 'items' && (
            <Btn variant="ghost" onClick={goToCategoryStep}>
              <Icon name="chevron-left" size={14} /> {t('picker.back')}
            </Btn>
          )}
          {step === 'review' && (
            <Btn variant="ghost" onClick={goToGroupStep}>
              <Icon name="chevron-left" size={14} /> {t('picker.toSelection')}
            </Btn>
          )}
          <Btn variant="ghost" onClick={requestClose}>
            Отмена
          </Btn>
          {(step === 'group' || step === 'category') && count > 0 && (
            <Btn variant="primary" onClick={goToReviewStep}>
              <Icon name="shopping-cart" size={14} />
              {t('picker.cart')} ({count})
            </Btn>
          )}
          {step === 'items' && (
            <Btn variant="primary" onClick={goToReviewStep} disabled={count === 0}>
              {t('picker.done')} ({count})
              <Icon name="chevron-right" size={14} />
            </Btn>
          )}
          {step === 'review' && (
            <Btn
              variant="primary"
              onClick={() => onConfirm(Array.from(cart))}
              disabled={count === 0}
            >
              <Icon name="link-2" size={14} />
              {t('picker.confirm')} ({count})
            </Btn>
          )}
        </div>
      </div>

      {/* Cancel-with-cart confirmation overlay */}
      {pendingClose && (
        <div className="absolute inset-0 bg-[#1B1F24]/85 backdrop-blur-[1px] flex items-center justify-center p-6 rounded-2xl">
          <div className="w-full max-w-sm bg-[#1B1F24] rounded-xl border border-[#2A2F36] shadow-xl shadow-black/40 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-300 flex items-center justify-center shrink-0">
                <Icon name="alert-triangle" size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[16px] font-bold text-[#F8FAFC] tracking-tight">
                  {t('picker.cancelTitle')}
                </div>
                <div className="text-[14.5px] text-[#94A3B8] mt-1 leading-relaxed">
                  В корзине{' '}
                  <span className="font-semibold text-[#F8FAFC] tabular-nums">{count}</span>{' '}
                  {count === 1 ? 'актив' : count < 5 ? 'актива' : 'активов'}. Без подтверждения
                  они не будут привязаны.
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Btn variant="ghost" size="sm" onClick={() => setPendingClose(false)}>
                {t('picker.back')}
              </Btn>
              <Btn
                variant="danger"
                size="sm"
                onClick={() => {
                  setPendingClose(false)
                  onClose()
                }}
              >
                {t('picker.cancelConfirm')}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </EmployeeModalShell>
  )
}
