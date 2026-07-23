/**
 * ImportPage — fullscreen wizard for the Excel bulk-import flow.
 *
 * State machine:
 *   template → upload (parse + validate) → preview → running → done
 *
 * All Firebase access is injected via getShared*Repository() — no Firebase SDK
 * imports directly in this file. Tests can override via injectable deps.
 */
import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { Btn, Icon, ErrorState, TabStrip } from '@/components/ui'
import type { TabStripItem } from '@/components/ui'
import { PreviewTable } from '@/components/features/import/PreviewTable'
import { ImportProgress } from '@/components/features/import/ImportProgress'
import { ImportReport } from '@/components/features/import/ImportReport'
import {
  getSharedAssetRepository,
  getSharedAssignmentRepository,
  getSharedEmployeeRepository,
} from '@/infra/repositories'
import type {
  ImportPlan,
  ImportProgressEvent,
  ImportResult,
  ValidateContext,
  ImportDeps,
} from '@/lib/importXlsx'
import type { AssetWriteRepository } from '@/domain/asset'
import type { EmployeeRepository } from '@/domain/employee'
import type { AssignmentRepository } from '@/domain/assignment'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStep = 'template' | 'upload' | 'preview' | 'running' | 'done'

type PreviewTab = 'employees' | 'assets'

export interface ImportPageProps {
  /** Injectable for testing — omit in production to use shared singletons. */
  assetRepo?: AssetWriteRepository
  employeeRepo?: EmployeeRepository
  assignmentRepo?: AssignmentRepository
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS: WizardStep[] = ['template', 'upload', 'preview', 'running', 'done']

function StepIndicator({ current, t }: { current: WizardStep; t: (k: string) => string }) {
  const currentIdx = STEPS.indexOf(current)
  return (
    <div className="flex items-center gap-0 overflow-x-auto no-scrollbar">
      {STEPS.map((step, idx) => {
        const isDone = idx < currentIdx
        const isActive = idx === currentIdx
        return (
          <div key={step} className="flex items-center">
            <div
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium whitespace-nowrap transition-colors',
                isActive
                  ? 'bg-accent/15 text-accent-light'
                  : isDone
                    ? 'text-emerald-400'
                    : 'text-text-subtle',
              ].join(' ')}
            >
              {isDone ? (
                <Icon name="check" size={12} />
              ) : (
                <span className={[
                  'w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold',
                  isActive ? 'bg-accent text-white' : 'bg-surface-2 text-text-subtle',
                ].join(' ')}>
                  {idx + 1}
                </span>
              )}
              {t(`steps.${step}`)}
            </div>
            {idx < STEPS.length - 1 && (
              <Icon name="chevron-right" size={12} className="text-text-subtle mx-0.5 flex-shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ImportPage
// ---------------------------------------------------------------------------

export function ImportPage({ assetRepo, employeeRepo, assignmentRepo }: ImportPageProps) {
  const { t } = useTranslation('import')
  const navigate = useNavigate()
  const { user } = useAuth()

  // --- Step state
  const [step, setStep] = useState<WizardStep>('template')
  const [previewTab, setPreviewTab] = useState<PreviewTab>('employees')

  // --- Data state
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [progressEvent, setProgressEvent] = useState<ImportProgressEvent | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  // --- Error state
  const [loadError, setLoadError] = useState(false)
  const [parseError, setParseError] = useState(false)

  // --- Template step state
  const [downloading, setDownloading] = useState(false)

  // --- Upload step state
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'parsing' | 'validating'>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // --- Ref data cache (loaded once when user picks file)
  const refDataRef = useRef<ValidateContext | null>(null)

  // --- Repositories
  const getAssetRepo = useCallback((): AssetWriteRepository => {
    return assetRepo ?? getSharedAssetRepository()
  }, [assetRepo])
  const getEmpRepo = useCallback((): EmployeeRepository => {
    return employeeRepo ?? getSharedEmployeeRepository()
  }, [employeeRepo])
  const getAsnRepo = useCallback((): AssignmentRepository => {
    return assignmentRepo ?? getSharedAssignmentRepository()
  }, [assignmentRepo])

  // ---------------------------------------------------------------------------
  // Template step — download
  // ---------------------------------------------------------------------------

  const handleDownloadTemplate = useCallback(async () => {
    setDownloading(true)
    setLoadError(false)
    try {
      const assetR = getSharedAssetRepository()
      const empR = getSharedEmployeeRepository()
      const [ref, employees] = await Promise.all([
        assetR.loadReferenceData(),
        empR.listEmployees({ status: 'active' }),
      ])
      void employees // just pre-warm; not needed for template shape
      const { downloadImportTemplate } = await import('@/lib/importXlsx')
      downloadImportTemplate({
        categories: ref.categories.map(c => c.name),
        departments: ref.departments.map(d => d.name),
        branches: ref.branches.map(b => b.name),
      })
    } catch {
      setLoadError(true)
    } finally {
      setDownloading(false)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Upload step — parse + validate
  // ---------------------------------------------------------------------------

  const loadRefData = useCallback(async (): Promise<ValidateContext | null> => {
    if (refDataRef.current) return refDataRef.current
    setLoadError(false)
    try {
      const assetR = getSharedAssetRepository()
      const empR = getSharedEmployeeRepository()
      const [ref, allAssets, activeEmps, formerEmps] = await Promise.all([
        assetR.loadReferenceData(),
        assetR.listAssets({}),
        empR.listEmployees({ status: 'active' }),
        empR.listFormerEmployees(),
      ])
      const ctx: ValidateContext = {
        categories: ref.categories,
        branches: ref.branches,
        departments: ref.departments,
        activeEmployees: activeEmps.map(e => ({
          id: e.id,
          email: e.email,
          departmentId: e.departmentId ?? null,
        })),
        formerEmails: formerEmps.map(e => e.email.trim().toLowerCase()),
        existingAssets: allAssets.map(a => ({
          invCode: a.invCode,
          serial: a.serial,
          categoryId: a.categoryId,
        })),
        today: new Date().toISOString().slice(0, 10),
      }
      refDataRef.current = ctx
      return ctx
    } catch {
      setLoadError(true)
      return null
    }
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''

    setParseError(false)
    setLoadError(false)
    setStep('upload')
    setUploadPhase('parsing')

    try {
      // Lazy-import xlsx-heavy module
      const { parseImportWorkbook, validateImport } = await import('@/lib/importXlsx')
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: false })

      let parsed
      try {
        parsed = parseImportWorkbook(wb)
      } catch {
        setParseError(true)
        setStep('template')
        setUploadPhase('idle')
        return
      }

      setUploadPhase('validating')
      const ctx = await loadRefData()
      if (!ctx) {
        setStep('template')
        setUploadPhase('idle')
        return
      }

      const importPlan = validateImport(parsed, ctx)
      setPlan(importPlan)
      setPreviewTab(importPlan.employees.length > 0 ? 'employees' : 'assets')
      setStep('preview')
      setUploadPhase('idle')
    } catch {
      setParseError(true)
      setStep('template')
      setUploadPhase('idle')
    }
  }, [loadRefData])

  const handleChooseFile = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // ---------------------------------------------------------------------------
  // Preview step — start import
  // ---------------------------------------------------------------------------

  const handleStartImport = useCallback(async () => {
    if (!plan) return
    setStep('running')
    setProgressEvent(null)

    try {
      const ctx = refDataRef.current
      const { runImport } = await import('@/lib/importXlsx')

      const deps: ImportDeps = {
        employeeRepo: getEmpRepo(),
        assetRepo: getAssetRepo(),
        asnRepo: getAsnRepo(),
        activeEmployees: ctx?.activeEmployees ?? [],
      }

      const actor = { uid: user.id, email: user.email, role: user.role }
      const importResult = await runImport(deps, plan, actor, (ev) => {
        setProgressEvent({ ...ev })
      })

      setResult(importResult)
      setStep('done')
    } catch {
      // Unexpected failure — go back to preview
      setStep('preview')
    }
  }, [plan, user, getEmpRepo, getAssetRepo, getAsnRepo])

  // ---------------------------------------------------------------------------
  // Report step
  // ---------------------------------------------------------------------------

  const handleToAssets = useCallback(() => {
    navigate('/assets')
  }, [navigate])

  const handleImportMore = useCallback(() => {
    // Full reset
    setPlan(null)
    setResult(null)
    setProgressEvent(null)
    setParseError(false)
    setLoadError(false)
    refDataRef.current = null
    setStep('template')
    setUploadPhase('idle')
  }, [])

  // ---------------------------------------------------------------------------
  // Preview tab strip
  // ---------------------------------------------------------------------------

  const previewTabs: TabStripItem<PreviewTab>[] = [
    {
      id: 'employees',
      label: t('preview.tabEmployees'),
      count: plan?.employees.length ?? 0,
    },
    {
      id: 'assets',
      label: t('preview.tabAssets'),
      count: plan?.assets.length ?? 0,
    },
  ]

  const readyCount =
    step === 'preview' && plan
      ? plan.readyEmployees + plan.readyAssets
      : 0

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col min-h-0 flex-1 bg-bg">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-surface shrink-0">
        <button
          type="button"
          onClick={() => navigate('/assets')}
          className="text-text-subtle hover:text-text-primary transition-colors"
          aria-label={t('back')}
        >
          <Icon name="arrow-left" size={18} />
        </button>
        <h1 className="text-[15px] font-semibold text-text-primary">{t('title')}</h1>
        <div className="ml-auto">
          <StepIndicator current={step} t={t} />
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8">

          {/* ── TEMPLATE STEP ─────────────────────────────────────────────── */}
          {(step === 'template' || step === 'upload') && (
            <div className="space-y-6">
              {/* Error banners */}
              {loadError && (
                <div className="bg-rose-950/20 border border-rose-800/30 rounded-xl px-4 py-3 text-[13px] text-rose-400">
                  {t('error.loadRefFailed')}
                </div>
              )}
              {parseError && (
                <div className="bg-rose-950/20 border border-rose-800/30 rounded-xl px-4 py-3 text-[13px] text-rose-400">
                  {t('error.parseFailed')}
                </div>
              )}

              {/* Step 1: Template */}
              <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-accent/15 inline-flex items-center justify-center text-[11px] font-bold text-accent-light">
                    1
                  </span>
                  <h2 className="text-[14px] font-semibold text-text-primary">{t('template.heading')}</h2>
                </div>
                <p className="text-[13px] text-text-secondary">{t('template.desc')}</p>
                <Btn
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  disabled={downloading}
                >
                  <Icon name={downloading ? 'loader-2' : 'file-down'} size={14} className={downloading ? 'animate-spin' : ''} />
                  {downloading ? t('template.downloading') : t('template.download')}
                </Btn>
              </div>

              {/* Step 2: Upload */}
              <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-accent/15 inline-flex items-center justify-center text-[11px] font-bold text-accent-light">
                    2
                  </span>
                  <h2 className="text-[14px] font-semibold text-text-primary">{t('upload.heading')}</h2>
                </div>
                <p className="text-[13px] text-text-secondary">{t('upload.desc')}</p>

                {step === 'upload' && uploadPhase !== 'idle' ? (
                  <div className="flex items-center gap-2 text-[13px] text-text-tertiary">
                    <Icon name="loader-2" size={14} className="animate-spin text-accent" />
                    {uploadPhase === 'parsing' ? t('upload.parsing') : t('upload.validating')}
                  </div>
                ) : (
                  <Btn variant="secondary" size="sm" onClick={handleChooseFile}>
                    <Icon name="file-up" size={14} />
                    {t('upload.choose')}
                  </Btn>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  aria-hidden="true"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          )}

          {/* ── PREVIEW STEP ──────────────────────────────────────────────── */}
          {step === 'preview' && plan && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-text-primary">{t('preview.heading')}</h2>
                <div className="flex items-center gap-2 text-[12.5px]">
                  <span className="text-emerald-400 font-medium">
                    {t('preview.readyCount', { count: plan.readyEmployees + plan.readyAssets })}
                  </span>
                  {(plan.errorEmployees + plan.errorAssets) > 0 && (
                    <span className="text-rose-400 font-medium">
                      {t('preview.errorCount', { count: plan.errorEmployees + plan.errorAssets })}
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="border-b border-border px-3">
                  <TabStrip
                    tabs={previewTabs}
                    active={previewTab}
                    onChange={setPreviewTab}
                    size="sm"
                  />
                </div>
                <div>
                  {previewTab === 'employees' ? (
                    <PreviewTable sheet="employees" rows={plan.employees} />
                  ) : (
                    <PreviewTable sheet="assets" rows={plan.assets} />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 justify-between">
                <Btn
                  variant="secondary"
                  size="sm"
                  onClick={handleImportMore}
                >
                  <Icon name="arrow-left" size={13} />
                  {t('back')}
                </Btn>
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={handleStartImport}
                  disabled={readyCount === 0}
                >
                  <Icon name="upload" size={13} />
                  {readyCount > 0
                    ? t('preview.importN', { count: readyCount })
                    : t('preview.noRows')}
                </Btn>
              </div>
            </div>
          )}

          {/* ── RUNNING STEP ──────────────────────────────────────────────── */}
          {step === 'running' && (
            <ImportProgress event={progressEvent} />
          )}

          {/* ── DONE STEP ─────────────────────────────────────────────────── */}
          {step === 'done' && result && (
            <ImportReport
              result={result}
              onToAssets={handleToAssets}
              onImportMore={handleImportMore}
            />
          )}

          {/* ── FALLBACK: unexpected error ────────────────────────────────── */}
          {step === 'done' && !result && (
            <ErrorState onRetry={handleImportMore} />
          )}
        </div>
      </div>
    </div>
  )
}
