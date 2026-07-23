import { describe, it, expect } from 'vitest'
import { runImport } from './run'
import type {
  AssetPlanRow, EmployeePlanRow, ImportDeps, ImportPlan, ImportProgressEvent,
} from './types'
import type { Actor, Asset, CreateAssetInput } from '@/domain/asset'
import type { CreateEmployeeInput, Employee } from '@/domain/employee'
import type { AssignInput, Assignment } from '@/domain/assignment'

const actor: Actor = { uid: 'u1', role: 'asset_admin', displayName: 'Импортёр' }

function empPlanRow(rowNumber: number, email: string, over: Partial<EmployeePlanRow> = {}): EmployeePlanRow {
  return {
    rowNumber, status: 'ready', errors: [], warnings: [],
    input: { firstName: 'Имя', lastName: 'Фамилия', email, phone: null, position: null, branchId: null, departmentId: 'dep_new' },
    ...over,
  }
}

function assetPlanRow(
  rowNumber: number, invCode: string,
  over: { assigneeEmail?: string | null; comment?: string | null; status?: 'ready' | 'error' } = {},
): AssetPlanRow {
  const status = over.status ?? 'ready'
  return {
    rowNumber, status, errors: [], warnings: [], invCodeGenerated: false, invCode,
    assigneeEmail: over.assigneeEmail ?? null,
    comment: over.comment ?? null,
    ...(status === 'ready' ? {
      input: {
        categoryId: 'cat_laptop', brand: 'Dell', model: 'X', type: null, invCode,
        serial: null, branchId: 'br_main', assignment: null, deptId: null,
      },
    } : {}),
  }
}

function plan(employees: EmployeePlanRow[], assets: AssetPlanRow[]): ImportPlan {
  const readyEmployees = employees.filter(e => e.status === 'ready').length
  const readyAssets = assets.filter(a => a.status === 'ready').length
  return {
    employees, assets,
    readyEmployees, errorEmployees: employees.length - readyEmployees,
    readyAssets, errorAssets: assets.length - readyAssets,
  }
}

interface StubOptions {
  batchThrows?: (call: number) => boolean
  createAssetThrowsFor?: string          // invCode
  createEmployeeThrowsFor?: string       // email
  assignThrowsFor?: string               // assetId
}

function makeDeps(opts: StubOptions = {}) {
  const employeeCalls: CreateEmployeeInput[] = []
  const batchCalls: CreateAssetInput[][] = []
  const singleCalls: CreateAssetInput[] = []
  const assignCalls: AssignInput[] = []
  let assetSeq = 0
  let empSeq = 0
  let batchCallCount = 0

  const toAsset = (input: CreateAssetInput): Asset => ({
    id: `a_${++assetSeq}`, categoryId: input.categoryId, brand: input.brand, model: input.model,
    invCode: input.invCode, serial: input.serial, statusId: 'st_warehouse', assignment: null,
    branchId: input.branchId, deptId: null, updatedAt: '2026-01-01T00:00:00.000Z',
  })
  const toEmployee = (input: CreateEmployeeInput): Employee => ({
    id: input.id, firstName: input.firstName, lastName: input.lastName, email: input.email,
    phone: input.phone ?? null, position: input.position ?? null,
    branchId: input.branchId ?? null, departmentId: input.departmentId ?? null,
    status: 'active', terminatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  })
  const toAssignment = (input: AssignInput): Assignment => ({
    id: `asn_${input.assetId}`, assetId: input.assetId, mode: 'employee',
    assignedToEmployeeId: input.employeeId ?? null, assignedToBranchId: null,
    startedAt: '2026-01-01T00:00:00.000Z', endedAt: null,
    actStoragePath: input.actStoragePath ?? null, transferComment: input.transferComment ?? null,
    createdBy: actor.uid, createdAt: '2026-01-01T00:00:00.000Z',
  })

  const deps: ImportDeps = {
    employeeRepo: {
      createEmployee: async (input) => {
        if (opts.createEmployeeThrowsFor === input.email) throw new Error(`email conflict: ${input.email}`)
        employeeCalls.push(input)
        return { value: toEmployee(input), auditId: `au_e${++empSeq}` }
      },
    },
    assetRepo: {
      createAssetsBatch: async (inputs) => {
        batchCallCount++
        if (opts.batchThrows?.(batchCallCount)) throw new Error('duplicate race in batch')
        batchCalls.push(inputs)
        return inputs.map(toAsset)
      },
      createAsset: async (input) => {
        if (opts.createAssetThrowsFor === input.invCode) throw new Error(`inv taken: ${input.invCode}`)
        singleCalls.push(input)
        return { value: toAsset(input), auditId: 'au_a' }
      },
    },
    asnRepo: {
      assign: async (input) => {
        if (opts.assignThrowsFor === input.assetId) throw new Error('asset not on warehouse')
        assignCalls.push(input)
        return { value: toAssignment(input), auditId: 'au_asn' }
      },
    },
    newEmployeeId: () => `pending_test_${++empSeq}`,
    activeEmployees: [{ id: 'e_active', email: 'active@corp.am', departmentId: 'dep_it' }],
  }
  return { deps, employeeCalls, batchCalls, singleCalls, assignCalls }
}

const noProgress = () => {}

describe('runImport — happy path', () => {
  it('creates employees, then assets, then assignments; resolves new + existing employees', async () => {
    const { deps, employeeCalls, batchCalls, assignCalls } = makeDeps()
    const result = await runImport(deps, plan(
      [empPlanRow(2, 'new1@corp.am'), empPlanRow(3, 'new2@corp.am')],
      [
        assetPlanRow(2, 'LAP/1', { assigneeEmail: 'new1@corp.am', comment: 'комментарий из файла' }),
        assetPlanRow(3, 'LAP/2', { assigneeEmail: 'active@corp.am' }),
        assetPlanRow(4, 'LAP/3'),
      ],
    ), actor, noProgress)

    expect(result).toEqual({ employeesCreated: 2, assetsCreated: 3, assignmentsCreated: 2, skipped: [] })
    expect(employeeCalls.map(c => c.email)).toEqual(['new1@corp.am', 'new2@corp.am'])
    expect(batchCalls).toHaveLength(1)
    expect(batchCalls[0]!.map(i => i.invCode)).toEqual(['LAP/1', 'LAP/2', 'LAP/3'])

    expect(assignCalls).toHaveLength(2)
    // New employee from the same file: id comes from newEmployeeId, dept from the plan row input
    expect(assignCalls[0]).toMatchObject({
      mode: 'employee', employeeId: employeeCalls[0]!.id, deptId: 'dep_new',
      transferComment: 'комментарий из файла', actStoragePath: null,
    })
    // Existing active employee: id + departmentId from deps.activeEmployees
    expect(assignCalls[1]).toMatchObject({ mode: 'employee', employeeId: 'e_active', deptId: 'dep_it', transferComment: null })
  })

  it('MAIL SUPPRESSION: assign is called WITHOUT employeeEmail / employeeName', async () => {
    const { deps, assignCalls } = makeDeps()
    await runImport(deps, plan(
      [empPlanRow(2, 'new1@corp.am')],
      [assetPlanRow(2, 'LAP/1', { assigneeEmail: 'new1@corp.am' })],
    ), actor, noProgress)
    expect(assignCalls).toHaveLength(1)
    expect('employeeEmail' in assignCalls[0]!).toBe(false)
    expect('employeeName' in assignCalls[0]!).toBe(false)
  })

  it('skips error rows entirely', async () => {
    const { deps, employeeCalls, batchCalls } = makeDeps()
    const result = await runImport(deps, plan(
      [empPlanRow(2, 'bad@corp.am', { status: 'error', errors: [{ key: 'errors.emailTaken' }] })],
      [assetPlanRow(2, 'LAP/1', { status: 'error' }), assetPlanRow(3, 'LAP/2')],
    ), actor, noProgress)
    expect(employeeCalls).toHaveLength(0)
    expect(batchCalls[0]!).toHaveLength(1)
    expect(result).toMatchObject({ employeesCreated: 0, assetsCreated: 1 })
  })

  it('uses the default pending_ id factory when newEmployeeId is not provided', async () => {
    const { deps, employeeCalls } = makeDeps()
    delete (deps as { newEmployeeId?: () => string }).newEmployeeId
    await runImport(deps, plan([empPlanRow(2, 'new1@corp.am')], []), actor, noProgress)
    expect(employeeCalls[0]!.id.startsWith('pending_')).toBe(true)
    expect(employeeCalls[0]!.id.length).toBeGreaterThan('pending_'.length)
  })
})

describe('runImport — progress events', () => {
  it('emits after every employee, every asset chunk, and every assignment', async () => {
    const events: ImportProgressEvent[] = []
    const { deps } = makeDeps()
    await runImport(deps, plan(
      [empPlanRow(2, 'new1@corp.am')],
      [
        assetPlanRow(2, 'LAP/1', { assigneeEmail: 'new1@corp.am' }),
        assetPlanRow(3, 'LAP/2'),
      ],
    ), actor, e => events.push(e))
    expect(events).toEqual([
      { phase: 'employees', done: 1, total: 1 },
      { phase: 'assets', done: 2, total: 2 },
      { phase: 'assignments', done: 1, total: 1 },
    ])
  })

  it('chunks assets into groups of ≤100 and emits per chunk', async () => {
    const events: ImportProgressEvent[] = []
    const { deps, batchCalls } = makeDeps()
    const rows = Array.from({ length: 150 }, (_, i) => assetPlanRow(i + 2, `LAP/${i + 1}`))
    const result = await runImport(deps, plan([], rows), actor, e => events.push(e))
    expect(batchCalls.map(c => c.length)).toEqual([100, 50])
    expect(events.filter(e => e.phase === 'assets')).toEqual([
      { phase: 'assets', done: 100, total: 150 },
      { phase: 'assets', done: 150, total: 150 },
    ])
    expect(result.assetsCreated).toBe(150)
  })
})

describe('runImport — failure handling', () => {
  it('batch throw → per-row fallback creates all but the failing row', async () => {
    const { deps, singleCalls } = makeDeps({ batchThrows: () => true, createAssetThrowsFor: 'LAP/2' })
    const result = await runImport(deps, plan([], [
      assetPlanRow(2, 'LAP/1'),
      assetPlanRow(3, 'LAP/2'),
      assetPlanRow(4, 'LAP/3'),
    ]), actor, noProgress)
    expect(singleCalls.map(i => i.invCode)).toEqual(['LAP/1', 'LAP/3'])
    expect(result.assetsCreated).toBe(2)
    expect(result.skipped).toEqual([
      { sheet: 'assets', rowNumber: 3, reason: 'inv taken: LAP/2' },
    ])
  })

  it('employee failure → skipped; dependent asset is still created but its assignment is skipped', async () => {
    const { deps, assignCalls } = makeDeps({ createEmployeeThrowsFor: 'new1@corp.am' })
    const result = await runImport(deps, plan(
      [empPlanRow(2, 'new1@corp.am')],
      [assetPlanRow(2, 'LAP/1', { assigneeEmail: 'new1@corp.am' })],
    ), actor, noProgress)
    expect(result.employeesCreated).toBe(0)
    expect(result.assetsCreated).toBe(1)
    expect(result.assignmentsCreated).toBe(0)
    expect(assignCalls).toHaveLength(0)
    expect(result.skipped).toHaveLength(2)
    expect(result.skipped[0]).toEqual({ sheet: 'employees', rowNumber: 2, reason: 'email conflict: new1@corp.am' })
    expect(result.skipped[1]!.sheet).toBe('assets')
    expect(result.skipped[1]!.rowNumber).toBe(2)
    expect(result.skipped[1]!.reason).toContain('актив создан, но не выдан')
  })

  it('assignment failure → skipped entry, asset still counted', async () => {
    const { deps } = makeDeps({ assignThrowsFor: 'a_1' })
    const result = await runImport(deps, plan(
      [],
      [assetPlanRow(2, 'LAP/1', { assigneeEmail: 'active@corp.am' })],
    ), actor, noProgress)
    expect(result.assetsCreated).toBe(1)
    expect(result.assignmentsCreated).toBe(0)
    expect(result.skipped).toEqual([
      { sheet: 'assets', rowNumber: 2, reason: 'актив создан, но не выдан: asset not on warehouse' },
    ])
  })
})
