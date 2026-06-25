/**
 * HandoverModal — "Приёмка техники" 2-step modal wizard.
 *
 * Ported from Warehouse/prototypes/employees.html lines 1801-2113.
 * All data injected via props — no globals.
 *
 * Step 1 (receive): asset checkbox rows; all must be checked before advancing.
 * Step 2 (route): read-only rows + DestPicker chip per row.
 */
import { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Icon, Btn, MODAL_BACKDROP_ABS, MODAL_SHEET } from '@/components/ui'
import { useModalA11y } from '@/components/ui/useModalA11y'
import { employeeInitials, employeeAvatarColor } from './employeeFormat'
import { DestPicker } from './DestPicker'
import type { Destination } from './DestPicker'

// ── Types ─────────────────────────────────────────────────────────────────────

export type { Destination }

export interface HandoverAsset {
  id: string
  icon: string
  title: string
  invCode: string
  sn: string
}

export interface HandoverModalProps {
  open: boolean
  emp: {
    id: string
    firstName: string
    lastName: string
    position: string | null
    departmentName: string | null
  } | null
  assets: HandoverAsset[]
  employees: { id: string; name: string; status: string }[]
  departments: { id: string; name: string }[]
  branches: { id: string; name: string }[]
  onConfirm: (rows: { id: string; received: boolean; destination: Destination }[]) => void
  onClose: () => void
}

// ── Internal row shape ────────────────────────────────────────────────────────

interface HandoverRow extends HandoverAsset {
  received: boolean
  destination: Destination
}

// ── Icon tile colour by asset icon name ──────────────────────────────────────

function iconTileCls(iconName: string): string {
  const map: Record<string, string> = {
    laptop: 'bg-accent/10 text-accent',
    desktop: 'bg-accent/10 text-accent',
    monitor: 'bg-accent/10 text-accent',
    computer: 'bg-accent/10 text-accent',
    smartphone: 'bg-violet-500/10 text-violet-300',
    tablet: 'bg-violet-500/10 text-violet-300',
    printer: 'bg-bg text-text-tertiary',
    keyboard: 'bg-sky-500/10 text-sky-300',
    mouse: 'bg-sky-500/10 text-sky-300',
    armchair: 'bg-amber-500/10 text-amber-300',
  }
  return map[iconName] ?? 'bg-bg text-text-tertiary'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HandoverModal({
  open,
  emp,
  assets,
  employees,
  departments,
  branches,
  onConfirm,
  onClose,
}: HandoverModalProps) {
  const { t } = useTranslation('employees')
  const [rows, setRows] = useState<HandoverRow[]>([])
  const [step, setStep] = useState<'receive' | 'route'>('receive')
  const [scrolledFromTop, setScrolledFromTop] = useState(false)
  const [scrolledFromBottom, setScrolledFromBottom] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  useModalA11y(open, containerRef)

  // Reset rows and step whenever the modal opens
  useEffect(() => {
    if (open && assets) {
      setRows(
        assets.map((a) => ({ ...a, received: false, destination: { kind: 'warehouse' } })),
      )
      setScrolledFromTop(false)
      setScrolledFromBottom(false)
      setStep('receive')
    }
  }, [open, assets])

  // ESC key
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !emp) return null

  const checkedCount = rows.filter((r) => r.received).length
  const total = rows.length
  const allDone = checkedCount === total && total > 0
  const remaining = total - checkedCount

  const warehouseCount = rows.filter((r) => r.destination.kind === 'warehouse').length
  const redirectedCount = rows.filter((r) => r.destination.kind !== 'warehouse').length

  const toggleRow = (idx: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, received: !r.received } : r)),
    )
  }

  const toggleAll = () => {
    const next = checkedCount < total
    setRows((prev) => prev.map((r) => ({ ...r, received: next })))
  }

  const setDest = (idx: number, dest: Destination) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, destination: dest } : r)))
  }

  const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    setScrolledFromTop(el.scrollTop > 4)
    setScrolledFromBottom(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
  }

  const empName = `${emp.firstName} ${emp.lastName}`
  const avatarCls = employeeAvatarColor(emp.id)
  const initials = employeeInitials(emp.firstName, emp.lastName)

  // ── Step indicator strip ─────────────────────────────────────────────────
  const StepIndicator = () => (
    <div className="px-6 py-2.5 bg-bg/60 border-b border-border flex items-center gap-3 shrink-0">
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
            step === 'receive' ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
        />
        <span className="h-px bg-border" style={{ width: 80 }} />
        <span
          className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
            step === 'route' ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
        />
      </div>
      <span className="text-[13.5px] font-medium text-text-primary tabular-nums">
        {step === 'receive' ? t('handover.step1') : t('handover.step2')}
      </span>
    </div>
  )

  // ── Progress block ───────────────────────────────────────────────────────
  const ProgressBlock = () => (
    <div className="ams-handover-progress flex flex-col gap-1.5 min-w-0 w-full max-w-[280px]">
      {/* Row 1: counter + bulk toggle + breakdown */}
      <div className="ams-handover-progress-row1 flex items-center gap-3 flex-wrap">
        <span
          className={`ams-handover-progress-counter text-[14px] font-semibold tabular-nums ${
            step === 'route' || allDone ? 'text-emerald-300' : 'text-text-primary'
          }`}
        >
          {t('handover.received')} {step === 'route' ? total : checkedCount}/{total}
        </span>
        {step === 'receive' && (
          <button
            type="button"
            onClick={toggleAll}
            className="ams-handover-toggle-all inline-flex items-center gap-1 text-[13.5px] font-semibold text-accent hover:text-accent hover:underline underline-offset-4 decoration-accent-light/60 transition-colors duration-100"
          >
            <Icon name={checkedCount < total ? 'check-check' : 'square'} size={11} />
            <span className="ams-handover-toggle-all-label">
              {checkedCount < total ? t('handover.markAll') : t('handover.unmarkAll')}
            </span>
          </button>
        )}
        {redirectedCount > 0 && (
          <span className="ams-handover-progress-breakdown text-[13px] text-text-tertiary tabular-nums">
            · → {t('dest.warehouse')}: {warehouseCount} · Перенаправлено: {redirectedCount}
          </span>
        )}
      </div>
      {/* Row 2: segmented progress bar */}
      <div className="ams-handover-progress-bar flex gap-[3px] rounded-full overflow-hidden ring-1 ring-emerald-500/30 shadow-sm shadow-emerald-500/10 w-full">
        {rows.map((r) => (
          <div
            key={r.id}
            style={{ height: 6, flex: 1 }}
            className={`rounded-full transition-colors duration-200 ${
              step === 'route'
                ? 'bg-emerald-500'
                : r.received
                  ? 'bg-emerald-500'
                  : 'bg-border'
            }`}
          />
        ))}
      </div>
      {/* Row 3: keyboard hint — only in step 1 */}
      {step === 'receive' && (
        <span className="ams-handover-progress-kbhint text-[12.5px] text-text-subtle font-mono leading-none">
          {t('handover.kbHint')}
        </span>
      )}
    </div>
  )

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 max-md:items-end max-md:p-0">
      <div
        className={MODAL_BACKDROP_ABS}
        onClick={onClose}
      />
      <div
        ref={containerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-3xl bg-surface rounded-2xl shadow-2xl shadow-slate-900/20 border border-border/60 anim-modal-pop flex flex-col ${MODAL_SHEET}`}
        style={{ minHeight: 'min(680px, 92vh)', maxHeight: '92vh' }}
      >
        {/* Pull-handle — mobile only */}
        <div className="max-md:block hidden mx-auto h-1 w-9 rounded-full bg-white/20 mb-3 mt-2" />
        {/* Sticky header */}
        <div
          className={`px-5 pt-4 pb-3 border-b border-border flex items-center gap-3 shrink-0 transition-shadow duration-200 ${
            scrolledFromTop
              ? 'shadow-[0_1px_0_0_rgba(15,23,42,0.04),0_4px_8px_-6px_rgba(15,23,42,0.12)]'
              : ''
          }`}
        >
          {/* Avatar */}
          <span
            className={`w-10 h-10 rounded-full ${avatarCls} text-white text-[15px] font-bold flex items-center justify-center shrink-0`}
          >
            {initials}
          </span>
          {/* Title block */}
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-bold text-text-primary tracking-tight leading-tight">
              {t('handover.title')}
            </div>
            <div className="text-[15.5px] font-semibold text-text-primary leading-snug truncate">
              {empName} · {total} активов ·{' '}
              {step === 'receive' ? 'отметьте полученные' : 'выберите назначение'}
            </div>
            {(emp.position || emp.departmentName) && (
              <div className="text-[13.5px] text-text-secondary leading-snug truncate">
                {[emp.position, emp.departmentName].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            title={t('handover.cancel')}
            aria-label={t('handover.cancel')}
            className="w-8 h-8 rounded-md text-text-subtle hover:text-text-secondary hover:bg-surface-2 flex items-center justify-center transition-colors shrink-0"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <StepIndicator />

        {/* Step 2 helper hint */}
        {step === 'route' && (
          <div className="px-6 pt-3 pb-0 flex items-center gap-1.5 shrink-0">
            <Icon name="info" size={11} className="text-text-subtle shrink-0" />
            <span className="text-[13.5px] text-text-primary">{t('handover.destInfo')}</span>
          </div>
        )}

        {/* Scrollable body — key changes with step to trigger animation */}
        <div
          key={step}
          onScroll={handleBodyScroll}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-2.5 anim-fade-slide-in"
        >
          {step === 'receive' ? (
            /* STEP 1: checkbox rows */
            rows.map((row, idx) => (
              <div
                key={row.id}
                role="button"
                tabIndex={0}
                aria-pressed={row.received}
                aria-label={`${row.received ? 'Снять отметку приёма' : 'Отметить как принят'}: ${row.title}`}
                onClick={() => toggleRow(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleRow(idx)
                  }
                }}
                className={`ams-handover-row rounded-xl ring-1 p-3 flex items-center gap-3 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-1 ${
                  row.received
                    ? 'bg-emerald-500/10 ring-emerald-500/30 hover:ring-emerald-500/30'
                    : 'bg-surface ring-border hover:bg-surface-2/80 hover:ring-border'
                }`}
              >
                {/* Checkbox */}
                <div className="relative flex items-center shrink-0">
                  <span
                    className={`ams-handover-check w-5 h-5 rounded-md border-2 transition-colors duration-150 flex items-center justify-center ${
                      row.received
                        ? 'border-emerald-500 bg-emerald-500'
                        : 'border-border-strong'
                    }`}
                  >
                    {row.received && <Icon name="check" size={12} className="text-white" />}
                  </span>
                </div>

                {/* Category-tinted icon tile */}
                <span
                  className={`ams-handover-icontile w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconTileCls(row.icon)}`}
                >
                  <Icon name={row.icon} size={16} />
                </span>

                {/* Title + meta */}
                <div className="flex-1 min-w-0 pr-2">
                  <div
                    className={`text-[15px] font-medium truncate transition-colors duration-150 ${
                      row.received ? 'text-emerald-300' : 'text-text-primary'
                    }`}
                  >
                    {row.title}
                  </div>
                  <div className="ams-handover-meta flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="ams-handover-inv inline-flex items-center px-1.5 h-4.5 rounded bg-surface-2 text-text-tertiary font-mono text-[13px] tabular-nums">
                      {row.invCode}
                    </span>
                    <span className="ams-handover-sn text-[13px] text-text-secondary">
                      SN: {row.sn}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            /* STEP 2: read-only rows + DestPicker */
            rows.map((row, idx) => (
              <div
                key={row.id}
                className="ams-handover-row rounded-xl ring-1 bg-emerald-500/10 ring-emerald-500/30 p-3 flex items-center gap-3"
              >
                {/* Emerald check-tile */}
                <span className="ams-handover-check w-5 h-5 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <Icon name="check" size={14} className="text-emerald-300" />
                </span>

                {/* Category-tinted icon tile */}
                <span
                  className={`ams-handover-icontile w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconTileCls(row.icon)}`}
                >
                  <Icon name={row.icon} size={16} />
                </span>

                {/* Title + meta */}
                <div className="flex-1 min-w-0 pr-2">
                  <div className="text-[15px] font-medium truncate text-emerald-300">
                    {row.title}
                  </div>
                  <div className="ams-handover-meta flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="ams-handover-inv inline-flex items-center px-1.5 h-4.5 rounded bg-surface-2 text-text-tertiary font-mono text-[13px] tabular-nums">
                      {row.invCode}
                    </span>
                    <span className="ams-handover-sn text-[13px] text-text-secondary">
                      SN: {row.sn}
                    </span>
                  </div>
                </div>

                {/* Destination picker — stop propagation */}
                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  <DestPicker
                    value={row.destination}
                    onChange={(dest) => setDest(idx, dest)}
                    currentEmpId={emp.id}
                    employees={employees}
                    departments={departments}
                    branches={branches}
                    forceDropUp={idx >= rows.length - 2}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sticky footer */}
        <div
          className={`ams-handover-footer border-t border-border px-5 py-3 flex items-center gap-3 shrink-0 transition-shadow duration-200 ${
            scrolledFromBottom
              ? 'shadow-[0_-1px_0_0_rgba(15,23,42,0.04),0_-4px_8px_-6px_rgba(15,23,42,0.12)]'
              : ''
          }`}
        >
          {/* LEFT zone */}
          <div className="ams-handover-footer-left flex items-center gap-3 shrink-0 min-w-0">
            {step === 'route' && (
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => setStep('receive')}
                className="ams-handover-back-btn"
              >
                <Icon name="arrow-left" size={13} />
                <span className="ams-handover-back-label">{t('handover.back')}</span>
              </Btn>
            )}
            <ProgressBlock />
          </div>

          {/* Spacer */}
          <div className="flex-1 min-w-0" />

          {/* RIGHT zone */}
          <div className="ams-handover-footer-right flex items-center gap-2 shrink-0">
            <Btn
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="ams-handover-cancel-btn"
            >
              {t('handover.cancel')}
            </Btn>

            {step === 'receive' ? (
              <>
                {!allDone && (
                  <span className="ams-handover-remaining-hint text-[13.5px] text-text-tertiary select-none whitespace-nowrap">
                    ← {t('handover.remaining')} {remaining}
                  </span>
                )}
                <Btn
                  variant="primary"
                  size="sm"
                  disabled={!allDone}
                  onClick={() => setStep('route')}
                  className="bg-gradient-to-b from-emerald-500 to-emerald-600 shadow-emerald-500/20 hover:shadow-emerald-500/30 ring-emerald-700/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ams-handover-next-btn"
                >
                  {t('handover.next')}
                  <Icon name="arrow-right" size={14} />
                </Btn>
              </>
            ) : (
              <Btn
                variant="primary"
                size="sm"
                onClick={() => onConfirm(rows)}
                className="bg-gradient-to-b from-emerald-500 to-emerald-600 shadow-emerald-500/20 hover:shadow-emerald-500/30 ring-emerald-700/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ams-handover-confirm-btn"
              >
                <Icon name="check-circle" size={14} />
                {t('handover.finish')}
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
