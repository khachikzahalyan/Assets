import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/ui/icon'
import { getSharedAssetRepository, getSharedNotificationRepository } from '@/infra/repositories'
import type { AssetRepository } from '@/domain/asset/AssetRepository'
import type { NotificationRepository, NotificationAudience } from '@/domain/notification'
import { useHoldNotifications, useAppNotifications, useDismissOnOutside } from '@/hooks'
import { useAuth } from '@/contexts/AuthContext'
import type { HoldNotification } from '@/domain/asset'

export interface NotificationBellProps {
  /** Injectable for tests; defaults to the Firestore repo. */
  repository?: AssetRepository
  /** Injectable for tests; defaults to the Firestore /notifications repo. */
  notificationRepository?: NotificationRepository
  /** Called with the assetId when a hold or receipt-confirmed row is clicked. */
  onSelect: (assetId: string) => void
  /** Called when a role_activated row is clicked (→ Роли и доступ). */
  onSelectRoles?: () => void
}

interface Pos { top?: number; bottom?: number; left?: number; right?: number; width: number | string }

function formatShort(iso: string): string {
  const [datePart] = iso.split('T')
  const parts = (datePart ?? '').split('-')
  const m = parts[1]; const d = parts[2]
  return d && m ? `${d}.${m}` : iso
}

export function NotificationBell({ repository, notificationRepository, onSelect, onSelectRoles }: NotificationBellProps) {
  const { t } = useTranslation('notifications')
  const { t: tNav } = useTranslation('nav')
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

  // Persistent bell events (/notifications), audience-scoped by role:
  // super_admin also sees role_activated; other admins only 'admins' events;
  // non-admin roles query nothing.
  const { user, role } = useAuth()
  const audiences = useMemo<NotificationAudience[]>(() => {
    if (role === 'super_admin') return ['admins', 'super_admin']
    if (role === 'asset_admin' || role === 'tech_admin') return ['admins']
    return []
  }, [role])
  const notifRepo = useMemo<NotificationRepository | null>(
    () => notificationRepository ?? (audiences.length > 0 ? getSharedNotificationRepository() : null),
    [notificationRepository, audiences],
  )
  const {
    events, freshIds, unreadCount, loading: evLoading, reload: reloadEvents, markAllRead,
  } = useAppNotifications(notifRepo, audiences, user.id)

  // Owner decision (2026-08-04): opening the bell marks all visible events read.
  useEffect(() => {
    if (open && !evLoading && unreadCount > 0) markAllRead()
  }, [open, evLoading, unreadCount, markAllRead])

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
    if (next) { reload(); reloadEvents() }
  }

  const badgeCount = count + unreadCount

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        title={t('bellTooltip')}
        aria-label={t('bellTooltip')}
        className="relative inline-flex items-center justify-center w-9 h-9 min-w-[2.75rem] min-h-[2.75rem] max-md:w-11 max-md:h-11 max-md:min-w-[44px] max-md:min-h-[44px] rounded-lg text-text-tertiary hover:bg-surface-2 transition-colors"
      >
        <Icon name="bell" size={18} />
        {badgeCount > 0 && (
          <span
            data-testid="bell-badge"
            className="absolute top-1 right-1 min-w-[16px] h-4 px-1 inline-flex items-center justify-center rounded-full bg-accent text-white text-10 font-bold leading-none"
          >
            {badgeCount > 99 ? '99+' : badgeCount}
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
            <div className="text-13 font-semibold text-text-primary">{t('title')}</div>
            <div className="text-11 text-text-subtle">{t('subtitle')}</div>
          </div>
          {error ? (
            <div className="px-3.5 py-3 text-12.5 text-rose-400 light:text-rose-700">
              {t('loadError')}
            </div>
          ) : (loading || evLoading) && notifications.length === 0 && events.length === 0 ? (
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
          ) : notifications.length === 0 && events.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
              <Icon name="check-check" size={20} className="text-text-subtle" />
              <div className="text-13 text-text-tertiary">{t('empty')}</div>
              <div className="text-11 text-text-subtle max-w-[240px]">{t('emptyHint')}</div>
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto py-1">
              {notifications.length > 0 && (
                <div className="px-3.5 pt-2 pb-1 text-10 font-bold uppercase tracking-[0.08em] text-text-subtle">
                  {t('holdsSection')}
                </div>
              )}
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
                      <span className="text-13 font-semibold text-text-primary truncate">{n.title}</span>
                      <span className="text-11 font-mono text-text-subtle shrink-0">{n.invCode}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-11 text-text-tertiary">{kindLabel(n.tempKind)}</span>
                      <span className={`text-12 font-medium ${overdue ? 'text-rose-400 light:text-rose-700' : 'text-amber-300 light:text-amber-700'}`}>
                        {statusText}
                      </span>
                    </div>
                  </button>
                )
              })}

              {events.length > 0 && (
                <div className={`px-3.5 pt-2 pb-1 text-10 font-bold uppercase tracking-[0.08em] text-text-subtle ${
                  notifications.length > 0 ? 'border-t border-border mt-1' : ''
                }`}>
                  {t('eventsSection')}
                </div>
              )}
              {events.map((n) => {
                const isRole = n.type === 'role_activated'
                const who = (isRole ? n.userName : n.employeeName) || '—'
                const action = isRole ? t('eventRole') : t('eventReceipt')
                const fresh = freshIds.has(n.id)
                return (
                  <button
                    key={n.id}
                    type="button"
                    data-testid="bell-event"
                    onClick={() => {
                      setOpen(false)
                      if (isRole) onSelectRoles?.()
                      else if (n.assetId) onSelect(n.assetId)
                    }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-surface transition-colors flex items-start gap-2"
                  >
                    <span
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                        isRole ? 'bg-violet-400' : 'bg-emerald-400'
                      } ${fresh ? '' : 'opacity-30'}`}
                      aria-hidden="true"
                    />
                    <span className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-13 text-text-primary truncate">
                          <b className="font-semibold">{who}</b> {action}
                        </span>
                        <span className="text-11 text-text-subtle shrink-0 ml-auto">{formatShort(n.createdAt)}</span>
                      </span>
                      <span className="flex items-center gap-2 min-w-0">
                        {isRole ? (
                          <span className="text-11 text-text-tertiary truncate">
                            {n.roleId ? tNav(`roles.${n.roleId}`) : n.userEmail}
                          </span>
                        ) : (
                          <>
                            <span className="text-11 text-text-tertiary truncate">{n.assetTitle || '—'}</span>
                            {n.invCode && <span className="text-11 font-mono text-text-subtle shrink-0">{n.invCode}</span>}
                          </>
                        )}
                      </span>
                    </span>
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
