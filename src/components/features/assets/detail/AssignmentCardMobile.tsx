import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset, AssetReferenceData } from '@/domain/asset'
import type { CategoryCapabilities } from '@/components/features/assets/create/CategoryPicker'
import type { TransferPatch } from '@/domain/asset/transferRules'
import { Icon } from '@/components/ui'
import { avatarColor, initials } from './detailFormat'
import { TransferPanel } from './TransferPanel'

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

    if (!ass || ass.mode === 'warehouse') {
      return (
        <div className={`${baseCard} ${innerPad}`}>
          <div className="w-9 h-9 rounded-[10px] bg-surface-2 text-text-tertiary flex items-center justify-center shrink-0">
            <Icon name="warehouse" size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-text-primary leading-tight">
              {t('detail.assignment.warehouse')}
            </p>
            <p className="text-[11px] text-text-tertiary">{t('assignee.warehouse')}</p>
          </div>
        </div>
      )
    }

    if (ass.mode === 'employee') {
      const emp = refData.employees.find(e => e.id === ass.employeeId)
      const dept = emp?.departmentId
        ? refData.departments.find(d => d.id === emp.departmentId)
        : undefined
      const empName = emp ? [emp.firstName, emp.lastName].filter(Boolean).join(' ') : '—'
      const subline = [emp?.position, dept?.name].filter(Boolean).join(' · ')
      const ac = avatarColor(ass.employeeId)
      return (
        <div className={`${baseCard} ${innerPad}`}>
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 text-white text-[12px] font-extrabold"
            style={{ backgroundColor: ac }}
          >
            {initials(empName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-text-primary truncate leading-tight">{empName}</p>
            {subline && <p className="text-[11px] text-text-tertiary truncate">{subline}</p>}
          </div>
          <span className="w-[7px] h-[7px] rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
        </div>
      )
    }

    if (ass.mode === 'department') {
      const dept = refData.departments.find(d => d.id === ass.departmentId)
      return (
        <div className={`${baseCard} ${innerPad}`}>
          <div className="w-9 h-9 rounded-[10px] bg-amber-500/15 text-amber-300 flex items-center justify-center shrink-0">
            <Icon name="layout-list" size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-text-primary truncate leading-tight">{dept?.name ?? '—'}</p>
            <p className="text-[11px] text-text-tertiary">{t('detail.location.dept')}</p>
          </div>
        </div>
      )
    }

    if (ass.mode === 'branch') {
      const br = refData.branches.find(b => b.id === ass.branchId)
      return (
        <div className={`${baseCard} ${innerPad}`}>
          <div className="w-9 h-9 rounded-[10px] bg-teal-500/15 text-teal-300 flex items-center justify-center shrink-0">
            <Icon name="git-branch" size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-text-primary truncate leading-tight">{br?.name ?? '—'}</p>
            <p className="text-[11px] text-text-tertiary">{t('detail.location.branch')}</p>
          </div>
        </div>
      )
    }

    if (ass.mode === 'temporary') {
      const kindLabel = ass.tempKind === 'audit'
        ? t('detail.transfer.kindAudit')
        : t('detail.transfer.kindIntern')
      return (
        <div className={`${baseCard} ${innerPad} bg-rose-500/10 border-rose-500/30`}>
          <div className="w-9 h-9 rounded-[10px] bg-rose-500/15 text-rose-300 flex items-center justify-center shrink-0">
            <Icon name="timer" size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-text-primary leading-tight truncate">
              {t('assignee.temp')} — {kindLabel}
            </p>
            {ass.expiresAt && (
              <p className="text-[11px] text-rose-300 inline-flex items-center gap-1">
                <Icon name="clock" size={10} />
                {ass.expiresAt}
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
        <div className="w-[26px] h-[26px] rounded-lg bg-sky-500/12 flex items-center justify-center shrink-0">
          <Icon name="user-check" size={13} className="text-sky-300" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[1.4px] text-text-secondary">
          {t('detail.assignment.title')}
        </span>
      </div>

      {/* Current assignee — padded row with border-b */}
      <div className="px-4 py-[11px] border-b border-border/50">
        {renderAssignee()}
      </div>

      {/* Transfer picker — always visible when canAssign; key resets on commit */}
      {canAssign && (
        <div className="px-4 py-[13px]">
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
