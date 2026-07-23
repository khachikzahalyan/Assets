/**
 * Pass-2 runner (plan §6): writes an ImportPlan through injected repositories.
 *
 * Order: employees (sequential) → assets (chunks of ≤100 via createAssetsBatch, with a
 * per-row createAsset fallback when a chunk throws) → assignments (sequential).
 *
 * Audit entries are produced automatically by the repositories — no direct audit
 * writes here. `AssignInput.employeeEmail` / `employeeName` are deliberately NEVER
 * passed: they exist only to enqueue notification mail, and a bulk import must not
 * mass-mail the whole company.
 */
import type { Actor, Asset, CreateAssetInput } from '@/domain/asset'
import type {
  AssetPlanRow, ImportDeps, ImportPlan, ImportProgressEvent, ImportResult, SkippedRow,
} from './types'

/** Matches the repos' atomic-batch cap (createAssetsBatch throws above 100). */
const CHUNK_SIZE = 100

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export async function runImport(
  deps: ImportDeps,
  plan: ImportPlan,
  actor: Actor,
  onProgress: (e: ImportProgressEvent) => void,
): Promise<ImportResult> {
  const newEmployeeId = deps.newEmployeeId ?? (() => `pending_${crypto.randomUUID()}`)
  const skipped: SkippedRow[] = []
  let employeesCreated = 0
  let assetsCreated = 0
  let assignmentsCreated = 0

  // Lower-cased email → employee, seeded from the active employees known at validate
  // time; employees created in phase 1 are layered on top.
  const emailToEmployee = new Map<string, { id: string; departmentId: string | null }>()
  for (const e of deps.activeEmployees) {
    const email = e.email?.trim().toLowerCase()
    if (email) emailToEmployee.set(email, { id: e.id, departmentId: e.departmentId ?? null })
  }

  // ---- Phase 1: employees (sequential; per-row try/catch) -----------------
  const employeeRows = plan.employees.filter(r => r.status === 'ready' && r.input)
  let done = 0
  for (const row of employeeRows) {
    const input = row.input!
    try {
      const id = newEmployeeId()
      await deps.employeeRepo.createEmployee({
        id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        position: input.position,
        branchId: input.branchId,
        departmentId: input.departmentId,
      }, actor)
      employeesCreated++
      emailToEmployee.set(input.email.toLowerCase(), { id, departmentId: input.departmentId })
    } catch (e) {
      // e.g. EmployeeEmailTerminatedError race between preview and run
      skipped.push({ sheet: 'employees', rowNumber: row.rowNumber, reason: errMessage(e) })
    }
    onProgress({ phase: 'employees', done: ++done, total: employeeRows.length })
  }

  // ---- Phase 2: assets (chunks ≤100; per-row fallback on chunk failure) ---
  const assetRows = plan.assets.filter(r => r.status === 'ready' && r.input)
  const createdByRow = new Map<number, Asset>() // rowNumber → created asset
  done = 0
  for (let i = 0; i < assetRows.length; i += CHUNK_SIZE) {
    const chunk = assetRows.slice(i, i + CHUNK_SIZE)
    const inputs: CreateAssetInput[] = chunk.map(r => r.input!)
    try {
      const created = await deps.assetRepo.createAssetsBatch(inputs, actor)
      created.forEach((asset, j) => createdByRow.set(chunk[j]!.rowNumber, asset))
      assetsCreated += created.length
    } catch {
      // A duplicate race (or similar) sinks the atomic batch before any write —
      // retry the chunk row-by-row so one bad row doesn't block the rest.
      for (const row of chunk) {
        try {
          const { value } = await deps.assetRepo.createAsset(row.input!, actor)
          createdByRow.set(row.rowNumber, value)
          assetsCreated++
        } catch (e) {
          skipped.push({ sheet: 'assets', rowNumber: row.rowNumber, reason: errMessage(e) })
        }
      }
    }
    done += chunk.length
    onProgress({ phase: 'assets', done, total: assetRows.length })
  }

  // ---- Phase 3: assignments (sequential; asset stays warehouse on failure) ----
  const toAssign: AssetPlanRow[] = assetRows.filter(r => r.assigneeEmail && createdByRow.has(r.rowNumber))
  done = 0
  for (const row of toAssign) {
    const asset = createdByRow.get(row.rowNumber)!
    const employee = emailToEmployee.get(row.assigneeEmail!)
    if (!employee) {
      // Referenced employee row failed in phase 1 — the asset exists but stays on the warehouse.
      skipped.push({
        sheet: 'assets', rowNumber: row.rowNumber,
        reason: `актив создан, но не выдан: сотрудник ${row.assigneeEmail} не создан`,
      })
    } else {
      try {
        // NOTE: employeeEmail/employeeName OMITTED — mail suppression (see module JSDoc).
        await deps.asnRepo.assign({
          assetId: asset.id,
          mode: 'employee',
          employeeId: employee.id,
          deptId: employee.departmentId ?? null,
          transferComment: row.comment ?? null,
          actStoragePath: null,
        }, actor)
        assignmentsCreated++
      } catch (e) {
        skipped.push({
          sheet: 'assets', rowNumber: row.rowNumber,
          reason: `актив создан, но не выдан: ${errMessage(e)}`,
        })
      }
    }
    onProgress({ phase: 'assignments', done: ++done, total: toAssign.length })
  }

  return { employeesCreated, assetsCreated, assignmentsCreated, skipped }
}
