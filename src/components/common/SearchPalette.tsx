import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { canAccess } from '@/config/access'
import { Icon } from '@/components/ui/icon'
import { Chip } from '@/components/ui/chip'
import { useSearchPaletteData } from '@/hooks/useSearchPaletteData'
import { assetTitle, deriveDisplayStatusId } from '@/components/features/assets/assetFormat'

/** Maximum results shown per entity type. */
const MAX_PER_TYPE = 6

export interface SearchResult {
  id: string
  type: 'asset' | 'employee' | 'branch' | 'department'
  label: string
  hint: string
  icon: string
  /** Full navigation path including the entity id where applicable. */
  to: string
}

export interface SearchPaletteProps {
  open: boolean
  onClose: () => void
  onPick: (r: SearchResult) => void
}

export function SearchPalette({ open, onClose, onPick }: SearchPaletteProps) {
  const [query, setQuery]   = useState('')
  const { t }               = useTranslation('common')
  const { role }            = useAuth()
  const dataState           = useSearchPaletteData(open)

  // ESC to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Reset query on close
  useEffect(() => { if (!open) setQuery('') }, [open])

  // Build results from real data (memoised — runs on every keystroke over in-memory data)
  const filtered = useMemo<SearchResult[]>(() => {
    if (dataState.status !== 'ready') return []

    const { data } = dataState
    const q = query.trim().toLowerCase()
    const results: SearchResult[] = []

    // --- Assets ---
    if (canAccess(role, 'assets')) {
      const { assets, ref } = data
      let matched = 0
      for (const a of assets) {
        if (matched >= MAX_PER_TYPE) break
        const label = assetTitle(
          a,
          ref.categories.find(c => c.id === a.categoryId)?.name,
          ref.categories.find(c => c.id === a.categoryId)?.group,
        )
        const searchable = [label, a.invCode, a.serial, a.barcode]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (q && !searchable.includes(q)) continue

        const statusId   = deriveDisplayStatusId(a)
        const statusName = ref.statuses.find(s => s.id === statusId)?.name ?? statusId
        const holder     = a.assignment?.employeeId
          ? (() => {
              const emp = ref.employees.find(e => e.id === a.assignment!.employeeId)
              return emp
                ? `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim()
                : null
            })()
          : null
        const hintParts = [a.invCode, statusName, ...(holder ? [holder] : [])]

        results.push({
          id:    a.id,
          type:  'asset',
          label,
          hint:  hintParts.join(' · '),
          icon:  'package',
          to:    `/assets/${a.id}`,
        })
        matched++
      }
    }

    // --- Employees ---
    if (canAccess(role, 'employees')) {
      const { employees, ref } = data
      let matched = 0
      for (const e of employees) {
        if (matched >= MAX_PER_TYPE) break
        const fullName    = `${e.firstName} ${e.lastName}`.trim()
        const searchable  = [fullName, e.email, e.position].filter(Boolean).join(' ').toLowerCase()
        if (q && !searchable.includes(q)) continue

        const deptName  = e.departmentId
          ? ref.departments.find(d => d.id === e.departmentId)?.name ?? null
          : null
        const hintParts = [e.position, deptName ?? e.email].filter(Boolean)

        results.push({
          id:    e.id,
          type:  'employee',
          label: fullName,
          hint:  hintParts.join(' · '),
          icon:  'user',
          to:    `/employees/${e.id}`,
        })
        matched++
      }
    }

    // --- Branches ---
    if (canAccess(role, 'branches')) {
      const { branches } = data
      let matched = 0
      for (const b of branches) {
        if (matched >= MAX_PER_TYPE) break
        const searchable = [b.name, b.city, b.address].filter(Boolean).join(' ').toLowerCase()
        if (q && !searchable.includes(q)) continue

        results.push({
          id:    b.id,
          type:  'branch',
          label: b.name,
          hint:  b.city ?? '',
          icon:  'building',
          to:    '/branches',
        })
        matched++
      }
    }

    // --- Departments (from ref, no per-id route — navigate to list) ---
    if (canAccess(role, 'departments') && dataState.status === 'ready') {
      const { ref } = data
      let matched = 0
      for (const d of ref.departments) {
        if (matched >= MAX_PER_TYPE) break
        if (q && !d.name.toLowerCase().includes(q)) continue

        results.push({
          id:    d.id,
          type:  'department',
          label: d.name,
          hint:  '',
          icon:  'layers',
          to:    '/departments',
        })
        matched++
      }
    }

    return results
  }, [query, dataState, role])

  if (!open) return null

  const kindLabel = (type: SearchResult['type']) => {
    if (type === 'asset')      return t('search.kindAsset')
    if (type === 'employee')   return t('search.kindEmployee')
    if (type === 'branch')     return t('search.kindBranch')
    return t('search.kindDepartment')
  }

  const isLoading = dataState.status === 'idle' || dataState.status === 'loading'

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4 max-md:items-end max-md:pt-0 max-md:px-0">
      <div className="absolute inset-0 bg-black/60 light:bg-slate-900/35 anim-backdrop-fade" onClick={onClose} />
      <div
        className="relative w-full max-w-xl bg-surface rounded-xl border border-border anim-modal-pop overflow-hidden max-md:rounded-t-[18px] max-md:rounded-b-none max-md:max-w-full max-md:max-h-[90dvh] max-md:flex max-md:flex-col"
        style={{ boxShadow: 'var(--shadow-popover)' }}
      >
        {/* Pull handle — mobile only */}
        <div className="hidden max-md:block mx-auto h-1 w-9 rounded-full bg-white/20 light:bg-black/10 mt-2 mb-1 flex-shrink-0" />
        {/* Search input row */}
        <div className="flex items-center gap-2 px-4 h-12 border-b border-border">
          <Icon name="search" size={16} className="text-text-subtle" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            className="flex-1 h-full bg-transparent outline-none text-sm text-text-primary placeholder:text-text-subtle"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-semibold rounded border border-border bg-surface-2 text-text-tertiary">ESC</kbd>
        </div>

        {/* Results — max-height uses dvh-aware value; on mobile flex-1 so sheet controls height */}
        <div className="max-h-[360px] overflow-y-auto py-1.5 max-md:max-h-none max-md:flex-1 max-md:min-h-0">
          {isLoading && (
            <div className="px-4 py-6 text-center text-[12.5px] text-text-subtle">
              {t('search.loading')}
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-[12.5px] text-text-subtle">
              {t('search.empty')}
            </div>
          )}
          {!isLoading && filtered.map((r) => (
            <button
              key={r.id + ':' + r.type}
              type="button"
              onClick={() => { onPick(r); onClose() }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-surface-2 transition-colors"
            >
              <span className="w-7 h-7 rounded-md bg-surface-2 text-text-tertiary inline-flex items-center justify-center">
                <Icon name={r.icon} size={14} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold text-text-primary truncate">{r.label}</div>
                {r.hint && (
                  <div className="text-[10.5px] text-text-subtle truncate">{r.hint}</div>
                )}
              </div>
              <Chip color="gray" size="sm">{kindLabel(r.type)}</Chip>
            </button>
          ))}
        </div>

        {/* Footer hint — hidden on mobile/touch (keyboard shortcuts irrelevant) */}
        <div className="max-md:hidden flex items-center justify-between px-4 py-2 border-t border-border bg-surface-2/60 text-[10.5px] text-text-subtle">
          <span>{t('search.hint')}</span>
          <span className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 font-semibold rounded border border-border bg-surface">↑↓</kbd>
            {t('search.navigate')}
            <kbd className="px-1.5 py-0.5 font-semibold rounded border border-border bg-surface">↵</kbd>
            {t('search.select')}
          </span>
        </div>
      </div>
    </div>,
    document.body
  )
}
