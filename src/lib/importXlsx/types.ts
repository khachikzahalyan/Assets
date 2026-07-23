/**
 * Type contract for the Excel importer (plan: docs/superpowers/plans/excel-import.md §3, §6).
 *
 * Layers:
 *  - parse.ts    : XLSX.WorkBook → ParsedFile (raw trimmed strings, 1-based Excel row numbers)
 *  - validate.ts : ParsedFile + ValidateContext → ImportPlan (pure; every rule = i18n key)
 *  - run.ts      : ImportPlan + ImportDeps → ImportResult (writes via injected repositories)
 */
import type { CategoryRow, RefRow, CreateAssetInput } from '@/domain/asset'
import type { AssetWriteRepository } from '@/domain/asset'
import type { EmployeeRepository } from '@/domain/employee'
import type { AssignmentRepository } from '@/domain/assignment'

// ---------------------------------------------------------------------------
// parse.ts output
// ---------------------------------------------------------------------------

export interface RawEmployeeRow { rowNumber: number; firstName: string; lastName: string; email: string; phone: string; position: string; department: string; branch: string }
export interface RawAssetRow { rowNumber: number; category: string; brand: string; model: string; serial: string; invCode: string; branch: string; assigneeEmail: string; price: string; purchaseDate: string; warrantyEndsAt: string; comment: string }
export interface ParsedFile { employees: RawEmployeeRow[]; assets: RawAssetRow[] }

// ---------------------------------------------------------------------------
// validate.ts output
// ---------------------------------------------------------------------------

/** i18n key into import.json `errors.*` / `warnings.*` (keys only — locale files live with the UI). */
export type RowIssue = { key: string; params?: Record<string, string | number> }

export interface EmployeePlanRow {
  rowNumber: number
  status: 'ready' | 'error'
  errors: RowIssue[]
  warnings: RowIssue[]
  input?: { firstName: string; lastName: string; email: string; phone: string | null; position: string | null; branchId: string | null; departmentId: string | null }
}

export interface AssetPlanRow {
  rowNumber: number
  status: 'ready' | 'error'
  errors: RowIssue[]
  warnings: RowIssue[]
  /** true when auto-generated (preview shows «авто» chip). */
  invCodeGenerated: boolean
  invCode?: string
  /** Normalized lower-case; resolved to an employee id at run time. */
  assigneeEmail?: string | null
  comment?: string | null
  input?: Omit<CreateAssetInput, 'assignment' | 'deptId'> & { deptId: null; assignment: null }
}

export interface ImportPlan {
  employees: EmployeePlanRow[]
  assets: AssetPlanRow[]
  readyEmployees: number; errorEmployees: number
  readyAssets: number; errorAssets: number
}

export interface ValidateContext {
  categories: CategoryRow[]            // from loadReferenceData
  branches: RefRow[]
  departments: RefRow[]
  activeEmployees: { id: string; email: string | null; departmentId?: string | null }[]
  formerEmails: string[]               // lower-cased emails of terminated employees
  existingAssets: { invCode: string; serial: string | null; categoryId: string }[]
  today: string                        // ISO YYYY-MM-DD, injected for testability
}

// ---------------------------------------------------------------------------
// run.ts contract
// ---------------------------------------------------------------------------

export interface ImportDeps {
  employeeRepo: Pick<EmployeeRepository, 'createEmployee'>
  assetRepo: Pick<AssetWriteRepository, 'createAssetsBatch' | 'createAsset'>
  asnRepo: Pick<AssignmentRepository, 'assign'>
  /** Employee doc id factory. Default: () => 'pending_' + crypto.randomUUID() (admin-created record pattern). */
  newEmployeeId?: () => string
  /**
   * Active employees known at validate time (same list as ValidateContext.activeEmployees).
   * Seeds the lower-cased email → { id, departmentId } map used to resolve `assigneeEmail`
   * during the assignments phase; employees newly created in phase 1 are added on top.
   */
  activeEmployees: { id: string; email: string | null; departmentId?: string | null }[]
}

export type ImportPhase = 'employees' | 'assets' | 'assignments'
export interface ImportProgressEvent { phase: ImportPhase; done: number; total: number }
export interface SkippedRow { sheet: 'employees' | 'assets'; rowNumber: number; reason: string }
export interface ImportResult {
  employeesCreated: number
  assetsCreated: number
  assignmentsCreated: number
  skipped: SkippedRow[]
}
