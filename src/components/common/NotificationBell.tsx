import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/icon'
import { getSharedAssetRepository } from '@/infra/repositories'
import type { AssetRepository } from '@/domain/asset/AssetRepository'
import { useHoldNotifications, useDismissOnOutside } from '@/hooks'
import type { HoldNotification } from '@/domain/asset'

export interface NotificationBellProps {
  /** Injectable for tests; defaults to the Firestore repo. */
  repository?: AssetRepository
  /** Called with the assetId when a notification row is clicked. */
  onSelect: (assetId: string) => void
}

interface Pos { top?: number; bottom?: number; left?: number; right?: number; width: number | string }

function formatShort(iso: string): string {
  const [datePart] = iso.split('T')
  const parts = (datePart ?? '').split('-')
  const m = parts[1]; const d = parts[2]
  return d && m ? `${d}.${m}` : iso
}

export function NotificationBell({ repository, onSelect }: NotificationBellProps) {
  const { t } = useTranslation('notifications')
  const kindLabel = (k: HoldNotification['tempKind']): string => {
    if (k === 'audit') return t('kindAudit')
    if (k === 'intern') return t('kindIntern')
    return t('kindTemp')
  }
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const repo = repository ?? getSharedAssetRepository()
  const { notifications, count, loading, error, reload } = useHoldNotifications(repo)

  useDismissOnOutside([wrapRef, popoverRef], () => setOpen(false), open)

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    if (isMobile) { setPos({ left: 8, right: 8, bottom: 8, width: 'auto' }); return }
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right), width: 340 })
  }, [])

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    updatePos()
  }, [open, updatePos])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open, updatePos])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) reload()
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        title={t('bellTooltip')}
        aria-label={t('bellTooltip')}
        className="relative inline-flex items-center justify-center w-9 h-9 min-w-[44px] min-h-[44px] max-md:w-11 max-md:h-11 rounded-lg text-text-tertiary hover:bg-surface-2 transition-colors"
      >
        <Icon name="bell" size={18} />
        {count > 0 && (
          <span
            data-testid="bell-badge"
            className="absolute top-1 right-1 min-w-[16px] h-4 px-1 inline-flex items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold leading-none"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && pos && ReactDOM.createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed', zIndex: 200, width: pos.width,
            ...(pos.top !== undefined ? { top: pos.top } : {}),
            ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}),
            ...(pos.left !== undefined ? { left: pos.left } : {}),
            ...(pos.right !== undefined ? { right: pos.right } : {}),
          }}
          className="bg-surface-2 border border-border rounded-xl anim-fade-slide-in overflow-hidden"
        >
          <div className="px-3.5 py-3 border-b border-border">
            <div className="text-[13px] font-semibold text-text-primary">{t('title')}</div>
            <div className="text-[11px] text-text-subtle">{t('subtitle')}</div>
          </div>
          {error ? (
            <div className="px-3.5 py-3 text-[12.5px] text-rose-400">
              {t('loadError')}
            </div>
          ) : loading && notifications.length === 0 ? (
            /* Initial fetch / reload with no cached rows — render a skeleton that is
               a pixel copy of the real bell-item row (same wrapper px-3.5 py-2.5,
               same two-line layout) so the «всё прочитано» empty state does NOT
               flash before data arrives. */
            <div data-testid="bell-loading" className="py-1" aria-hidden="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-3.5 py-2.5 flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-[13px] w-[45%] rounded anim-skeleton" />
                    <div className="h-[11px] w-[56px] rounded anim-skeleton shrink-0" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-[11px] w-[40px] rounded anim-skeleton" />
                    <div className="h-[12px] w-[96px] rounded anim-skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
              <Icon name="check-check" size={20} className="text-text-subtle" />
              <div className="text-[13px] text-text-tertiary">{t('empty')}</div>
              <div className="text-[11px] text-text-subtle max-w-[240px]">{t('emptyHint')}</div>
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto py-1">
              {notifications.map((n) => {
                const overdue = n.hold === 'overdue'
                const statusText = overdue
                  ? t('overdue', { date: formatShort(n.expiresAt) })
                  : t('dueSoon', { date: formatShort(n.expiresAt) })
                return (
                  <button
                    key={n.assetId}
                    type="button"
                    data-testid="bell-item"
                    onClick={() => { setOpen(false); onSelect(n.assetId) }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-surface transition-colors flex flex-col gap-0.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] font-semibold text-text-primary truncate">{n.title}</span>
                      <span className="text-[11px] font-mono text-text-subtle shrink-0">{n.invCode}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-text-tertiary">{kindLabel(n.tempKind)}</span>
                      <span className={`text-[12px] font-medium ${overdue ? 'text-rose-400' : 'text-amber-300'}`}>
                        {statusText}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
