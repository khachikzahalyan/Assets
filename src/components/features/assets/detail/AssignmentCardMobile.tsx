import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset, AssetReferenceData } from '@/domain/asset'
import type { CategoryCapabilities } from '@/components/features/assets/create/CategoryPicker'
import type { TransferPatch } from '@/domain/asset/transferRules'
import { Icon } from '@/components/ui'
import { RoleIcon } from '@/components/ui/RoleIcon'
import { TransferPanel } from './TransferPanel'
import { resolveAssignment } from './assignmentHelpers'

/**
 * Mobile-only Назначение card for Asset Detail (≤767px).
 *
 * Structure matches prototype §857–931:
 *   ┌────────────────────────────────────────────────┐
 *   │  [blue-icon]  НАЗНАЧЕНИЕ          (no button)  │  ← header
 *   ├────────────────────────────────────────────────┤
 *   │  [avatar]  Name · Dept         ● (green dot)   │  ← current assignee
 *   ├────────────────────────────────────────────────┤
 *   │    КОМУ ПЕРЕДАТЬ (centered overline)            │
 *   │  [○ Склад] [○ Сотрудник] [○ Филиал] …          │  ← 46px circles
 *   │  <sub-form when target selected>                │
 *   │  [Отмена (auto)]     [Передать (flex-1)]        │  ← footer
 *   └────────────────────────────────────────────────┘
 *
 * Key differences from desktop AssignmentCard:
 *   – No toggle: the transfer picker is always visible.
 *   – «Отмена» resets mode selection (doesn't close section).
 *   – No «Передать» action button in the header.
 *   – Uses raw div card (not SectionCard) for exact prototype layout.
 *   – After each successful commit, TransferPanel is key-remounted so state resets.
 *
 * Desktop AssignmentCard and TransferPanel desktop behavior are unchanged.
 * This file is imported only by AssetDetailMobileView.
 */

interface AssignmentCardMobileProps {
  asset: Asset
  refData: AssetReferenceData
  caps: CategoryCapabilities | null
  canAssign: boolean
  busy: boolean
  onCommit: (patch: TransferPatch) => void
}

export function AssignmentCardMobile({
  asset,
  refData,
  caps,
  canAssign,
  busy,
  onCommit,
}: AssignmentCardMobileProps) {
  const { t } = useTranslation('assets')
  const ass = asset.assignment

  // Increment after each successful commit → remounts TransferPanel → resets local mode state
  const [transferKey, setTransferKey] = useState(0)

  function handleCommit(patch: TransferPatch) {
    onCommit(patch)
    setTransferKey(k => k + 1)
  }

  // ── Current assignee renderer (mobile-styled: rounded-[10px] avatar, compact) ──

  function renderAssignee() {
    const baseCard = 'bg-bg border border-border rounded-xl flex items-center gap-2.5'
    const innerPad = 'p-[10px_13px]'
    const resolved = resolveAssignment(ass, refData)

    if (resolved.mode === 'warehouse') {
      return (
        <div className={`${baseCard} ${innerPad}`}>
          <div className="w-9 h-9 rounded-[10px] bg-surface-2 text-text-tertiary flex items-center justify-center shrink-0">
            <Icon name="warehouse" size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-13.5 font-bold text-text-primary leading-tight">
              {t('detail.assignment.warehouse')}
            </p>
            <p className="text-11 text-text-tertiary">{t('assignee.warehouse')}</p>
          </div>
        </div>
      )
    }

    if (resolved.mode === 'employee') {
      return (
        <div className={`${baseCard} ${innerPad}`}>
          <RoleIcon role="employee" size={36} className="flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-13.5 font-bold text-text-primary truncate leading-tight">{resolved.primaryLabel}</p>
            {resolved.secondaryLabel && <p className="text-11 text-text-tertiary truncate">{resolved.secondaryLabel}</p>}
          </div>
          <span className="w-[7px] h-[7px] rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
        </div>
      )
    }

    if (resolved.mode === 'department') {
      return (
        <div className={`${baseCard} ${innerPad}`}>
          <div className="w-9 h-9 rounded-[10px] bg-amber-500/15 text-amber-300 light:text-amber-700 flex items-center justify-center shrink-0">
            <Icon name="layout-list" size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-13.5 font-bold text-text-primary truncate leading-tight">{resolved.primaryLabel}</p>
            <p className="text-11 text-text-tertiary">{t('detail.location.dept')}</p>
          </div>
        </div>
      )
    }

    if (resolved.mode === 'branch') {
      return (
        <div className={`${baseCard} ${innerPad}`}>
          <div className="w-9 h-9 rounded-[10px] bg-teal-500/15 text-teal-300 light:text-teal-700 flex items-center justify-center shrink-0">
            <Icon name="git-branch" size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-13.5 font-bold text-text-primary truncate leading-tight">{resolved.primaryLabel}</p>
            <p className="text-11 text-text-tertiary">{t('detail.location.branch')}</p>
          </div>
        </div>
      )
    }

    if (resolved.mode === 'temporary') {
      const kindLabel = resolved.tempKind === 'audit'
        ? t('detail.transfer.kindAudit')
        : t('detail.transfer.kindIntern')
      return (
        <div className={`${baseCard} ${innerPad} bg-rose-500/10 light:bg-rose-50 border-rose-500/30 light:border-rose-200`}>
          <div className="w-9 h-9 rounded-[10px] bg-rose-500/15 text-rose-300 light:text-rose-700 flex items-center justify-center shrink-0">
            <Icon name="timer" size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-13.5 font-bold text-text-primary leading-tight truncate">
              {t('assignee.temp')} — {kindLabel}
            </p>
            {resolved.expiresAt && (
              <p className="text-11 text-rose-300 light:text-rose-700 inline-flex items-center gap-1">
                <Icon name="clock" size={10} />
                {resolved.expiresAt}
              </p>
            )}
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="bg-surface rounded-[14px] border border-border overflow-hidden">

      {/* Header — blue icon + «НАЗНАЧЕНИЕ» label, no action button */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/60">
        <div className="w-[26px] h-[26px] rounded-lg bg-sky-500/[0.12] flex items-center justify-center shrink-0">
          <Icon name="user-check" size={13} className="text-sky-300 light:text-sky-700" />
        </div>
        {/* leading-none — centers the caps-only label against the icon box (same fix as SectionCard) */}
        <span className="text-10 font-bold uppercase tracking-[1.4px] leading-none text-text-secondary">
          {t('detail.assignment.title')}
        </span>
      </div>

      {/* Current assignee — padded row with border-b */}
      <div className="px-4 py-[0.6875rem] border-b border-border/50">
        {renderAssignee()}
      </div>

      {/* Transfer picker — always visible when canAssign; key resets on commit */}
      {canAssign && (
        <div className="px-4 py-[0.8125rem]">
          <TransferPanel
            key={transferKey}
            asset={asset}
            refData={refData}
            caps={caps}
            busy={busy}
            onCommit={handleCommit}
            onCancel={() => { /* no-op: mobileInline handles Отмена internally */ }}
            mobileInline
          />
        </div>
      )}
    </div>
  )
}
