import { describe, it, expect, beforeEach, vi } from 'vitest'
import { InMemoryEmployeeRepository } from './inMemoryEmployeeRepository'
import { EmployeeArchiveError, EmployeeEmailTerminatedError } from '@/domain/employee'
import type { Employee } from '@/domain/employee'
import type { Actor } from '@/domain/asset'
import { createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

const ACTOR = { uid: 'admin_1', role: 'asset_admin' as const }

describe('InMemoryEmployeeRepository', () => {
  let emps: Employee[]
  let store: ReturnType<typeof createInMemoryAuditStore>
  let repo: InMemoryEmployeeRepository

  beforeEach(() => {
    emps = []
    store = createInMemoryAuditStore()
    repo = new InMemoryEmployeeRepository(emps, [], inMemoryAuditContext(store))
  })

  it('createEmployee stores uid-keyed doc + writes 1 created audit', async () => {
    const r = await repo.createEmployee(
      { id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', branchId: 'br_1' },
      ACTOR,
    )
    expect(r.value.id).toBe('uid_1')
    expect(r.value.status).toBe('active')
    expect(emps).toHaveLength(1)
    expect(store.logs.filter(l => l.action === 'created' && l.entityType === 'employee')).toHaveLength(1)
  })

  it('createEmployee rejects a duplicate email (case-insensitive)', async () => {
    await repo.createEmployee({ id: 'uid_1', firstName: 'A', lastName: 'B', email: 'i@x.com' }, ACTOR)
    await expect(
      repo.createEmployee({ id: 'uid_2', firstName: 'C', lastName: 'D', email: 'I@X.COM' }, ACTOR),
    ).rejects.toThrow()
  })

  it('createEmployee rejects a duplicate id', async () => {
    await repo.createEmployee({ id: 'uid_1', firstName: 'A', lastName: 'B', email: 'a@x.com' }, ACTOR)
    await expect(
      repo.createEmployee({ id: 'uid_1', firstName: 'C', lastName: 'D', email: 'c@x.com' }, ACTOR),
    ).rejects.toThrow()
  })

  it('updateEmployee patches + writes 1 updated audit; blocks email collision', async () => {
    await repo.createEmployee({ id: 'uid_1', firstName: 'A', lastName: 'B', email: 'a@x.com' }, ACTOR)
    await repo.createEmployee({ id: 'uid_2', firstName: 'C', lastName: 'D', email: 'c@x.com' }, ACTOR)
    const r = await repo.updateEmployee('uid_1', { position: 'Инженер' }, ACTOR)
    expect(r.value.position).toBe('Инженер')
    expect(store.logs.filter(l => l.action === 'updated')).toHaveLength(1)
    await expect(repo.updateEmployee('uid_1', { email: 'c@x.com' }, ACTOR)).rejects.toThrow()
  })

  it('archiveEmployee stamps terminatedAt + writes terminated audit; restoreEmployee clears it', async () => {
    await repo.createEmployee({ id: 'uid_1', firstName: 'A', lastName: 'B', email: 'a@x.com' }, ACTOR)
    const term = await repo.archiveEmployee('uid_1', ACTOR)
    expect(term.value.status).toBe('terminated')
    expect(term.value.terminatedAt).not.toBeNull()
    expect(store.logs.filter(l => l.action === 'terminated')).toHaveLength(1)
    const re = await repo.restoreEmployee('uid_1', ACTOR)
    expect(re.value.terminatedAt).toBeNull()
    expect(store.logs.filter(l => l.action === 'reactivated')).toHaveLength(1)
  })

  it('listEmployees filters by branch/search; archived employees excluded from active list', async () => {
    await repo.createEmployee({ id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', branchId: 'br_1' }, ACTOR)
    await repo.createEmployee({ id: 'uid_2', firstName: 'Анна', lastName: 'Сидорова', email: 'a@x.com', branchId: 'br_2' }, ACTOR)
    // Before archive: both employees visible
    expect(await repo.listEmployees()).toHaveLength(2)
    expect(await repo.listEmployees({ branchId: 'br_1' })).toHaveLength(1)
    expect(await repo.listEmployees({ search: 'петров' })).toHaveLength(1)
    // After archive: uid_2 status flips in-place; active filter excludes it
    await repo.archiveEmployee('uid_2', ACTOR)
    expect(await repo.listEmployees({ status: 'active' })).toHaveLength(1)
    // No filter returns all records (active + terminated) — UI always passes status:'active' by default
    expect(await repo.listEmployees({ status: 'all' })).toHaveLength(2)
    expect(await repo.listFormerEmployees()).toHaveLength(1)
  })

  it('getEmployee returns null for unknown id', async () => {
    expect(await repo.getEmployee('nope')).toBeNull()
  })
})

const ARCHIVE_ACTOR: Actor = { uid: 'admin1', role: 'super_admin' }
function makeEmp(id: string, over: Partial<Employee> = {}): Employee {
  return {
    id, firstName: 'Иван', lastName: 'Петров', email: `${id}@x.am`,
    phone: null, position: null, branchId: null, departmentId: null,
    status: 'active', terminatedAt: null,
    createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z',
    ...over,
  }
}

// ── In-place archive/restore (new semantics) ──────────────────────────────────

describe('InMemoryEmployeeRepository archive/restore (in-place)', () => {
  it('archiveEmployee keeps the record in employees array with status=terminated', async () => {
    const active = [makeEmp('e1'), makeEmp('e2')]
    const former: Employee[] = []
    const repo = new InMemoryEmployeeRepository(active, former)
    await repo.archiveEmployee('e1', ARCHIVE_ACTOR)

    // employees array still has e1 (in-place flip, no splice)
    expect(active).toHaveLength(2)
    expect(active.find(e => e.id === 'e1')?.status).toBe('terminated')
    expect(active.find(e => e.id === 'e1')?.terminatedAt).not.toBeNull()
    // createdAt preserved
    expect(active.find(e => e.id === 'e1')?.createdAt).toBe('2020-01-01T00:00:00.000Z')

    // listEmployees({status:'active'}) excludes it
    const activeList = await repo.listEmployees({ status: 'active' })
    expect(activeList.map(e => e.id)).toEqual(['e2'])

    // listFormerEmployees includes it
    const formerList = await repo.listFormerEmployees()
    expect(formerList.map(e => e.id)).toContain('e1')
    expect(formerList[0]!.status).toBe('terminated')
  })

  it('restoreEmployee flips an in-place terminated doc back to active', async () => {
    const active = [makeEmp('e1'), makeEmp('e2')]
    const repo = new InMemoryEmployeeRepository(active, [])
    await repo.archiveEmployee('e1', ARCHIVE_ACTOR)

    // Restore
    const r = await repo.restoreEmployee('e1', ARCHIVE_ACTOR)
    expect(r.value.status).toBe('active')
    expect(r.value.terminatedAt).toBeNull()

    // employees array has e1 back as active
    expect(active.find(e => e.id === 'e1')?.status).toBe('active')
    expect(active.find(e => e.id === 'e1')?.terminatedAt).toBeNull()

    // listEmployees({status:'active'}) includes e1 again
    const activeList = await repo.listEmployees({ status: 'active' })
    expect(activeList.map(e => e.id)).toContain('e1')

    // listFormerEmployees no longer includes e1
    expect(await repo.listFormerEmployees()).toHaveLength(0)
  })

  it('getEmployee still finds the in-place terminated record', async () => {
    const active = [makeEmp('e1')]
    const repo = new InMemoryEmployeeRepository(active, [])
    await repo.archiveEmployee('e1', ARCHIVE_ACTOR)
    const found = await repo.getEmployee('e1')
    expect(found).not.toBeNull()
    expect(found!.status).toBe('terminated')
  })

  it('listEmployees({status:"all"}) includes both active and terminated', async () => {
    const active = [makeEmp('e1'), makeEmp('e2')]
    const repo = new InMemoryEmployeeRepository(active, [])
    await repo.archiveEmployee('e1', ARCHIVE_ACTOR)
    const all = await repo.listEmployees({ status: 'all' })
    expect(all).toHaveLength(2)
  })

  it('archiving a DIFFERENT employee works and does not affect others', async () => {
    const active = [makeEmp('e1'), makeEmp('e2')]
    const repo = new InMemoryEmployeeRepository(active, [])
    await repo.archiveEmployee('e2', ARCHIVE_ACTOR)
    const activeList = await repo.listEmployees({ status: 'active' })
    expect(activeList.map(e => e.id)).toEqual(['e1'])
    expect(activeList.find(e => e.id === 'e2')).toBeUndefined()
  })

  it('rejects self-archive', async () => {
    const repo = new InMemoryEmployeeRepository([makeEmp('admin1')], [])
    await expect(repo.archiveEmployee('admin1', ARCHIVE_ACTOR)).rejects.toBeInstanceOf(EmployeeArchiveError)
    // Record is unchanged
    expect((await repo.getEmployee('admin1'))?.status).toBe('active')
  })

  it('rejects last super_admin via injected check', async () => {
    const repo = new InMemoryEmployeeRepository([makeEmp('e1')], [], undefined, async () => true)
    const err = await repo.archiveEmployee('e1', ARCHIVE_ACTOR).catch(e => e)
    expect(err).toBeInstanceOf(EmployeeArchiveError)
    expect((err as EmployeeArchiveError).reason).toBe('last-super-admin')
  })

  it('archive writes EXACTLY ONE terminated audit entry; restore writes EXACTLY ONE reactivated entry', async () => {
    const auditStore = createInMemoryAuditStore()
    const active = [makeEmp('e1'), makeEmp('e2')]
    const repo = new InMemoryEmployeeRepository(active, [], inMemoryAuditContext(auditStore))

    const lenBefore = auditStore.logs.length
    await repo.archiveEmployee('e1', ARCHIVE_ACTOR)
    const afterArchive = auditStore.logs.slice(lenBefore)

    expect(afterArchive).toHaveLength(1)
    const termEntry = afterArchive[0]!
    expect(termEntry.entityType).toBe('employee')
    expect(termEntry.entityId).toBe('e1')
    expect(termEntry.action).toBe('terminated')
    expect(termEntry.before).toEqual({ status: 'active' })
    expect(termEntry.after).toEqual({ status: 'terminated' })

    // e1 is still in the active array (in-place)
    expect(active).toHaveLength(2)
    expect(active.find(e => e.id === 'e1')?.status).toBe('terminated')

    const lenBeforeRestore = auditStore.logs.length
    await repo.restoreEmployee('e1', ARCHIVE_ACTOR)
    const afterRestore = auditStore.logs.slice(lenBeforeRestore)

    expect(afterRestore).toHaveLength(1)
    const reactEntry = afterRestore[0]!
    expect(reactEntry.action).toBe('reactivated')
    expect(reactEntry.before).toEqual({ status: 'terminated' })
    expect(reactEntry.after).toEqual({ status: 'active' })
  })
})

// ── Legacy restore path ────────────────────────────────────────────────────────

describe('InMemoryEmployeeRepository legacy restore (from former array)', () => {
  it('restoreEmployee with employee only in former array moves it to employees (legacy path)', async () => {
    const active: Employee[] = []
    const former = [makeEmp('e1', { status: 'terminated', terminatedAt: '2021-01-01T00:00:00.000Z' })]
    const repo = new InMemoryEmployeeRepository(active, former)
    const r = await repo.restoreEmployee('e1', ARCHIVE_ACTOR)
    expect(r.value.status).toBe('active')
    expect(r.value.terminatedAt).toBeNull()

    // Now in active array
    expect(active.map(e => e.id)).toContain('e1')
    expect(active[0]!.status).toBe('active')
    // Removed from former
    expect(former).toHaveLength(0)
  })

  it('listFormerEmployees includes both in-place terminated and legacy former docs; deduplicates by id', async () => {
    // e1 is in employees (in-place terminated); e2 is in former (legacy)
    const active = [makeEmp('e1', { status: 'terminated', terminatedAt: '2021-01-01T00:00:00.000Z' })]
    const former = [
      makeEmp('e2', { status: 'terminated', terminatedAt: '2020-06-01T00:00:00.000Z' }),
      // e1 also in former (simulates data where both exist) — employees doc should win
      makeEmp('e1', { status: 'terminated', terminatedAt: '2019-01-01T00:00:00.000Z', email: 'old@x.am' }),
    ]
    const repo = new InMemoryEmployeeRepository(active, former)
    const list = await repo.listFormerEmployees()
    expect(list).toHaveLength(2)
    // e1 from employees array wins (employees doc has email e1@x.am, not old@x.am)
    const e1Entry = list.find(e => e.id === 'e1')
    expect(e1Entry?.email).toBe('e1@x.am')
    expect(list.find(e => e.id === 'e2')).toBeTruthy()
  })
})

// ── Active-assets guard ────────────────────────────────────────────────────────

describe('InMemoryEmployeeRepository active-assets guard', () => {
  it('archiveEmployee with activeAssetsCheck→true throws EmployeeArchiveError(active-assets)', async () => {
    const repo = new InMemoryEmployeeRepository(
      [makeEmp('e1')], [], undefined, undefined, async () => true,
    )
    const err = await repo.archiveEmployee('e1', ARCHIVE_ACTOR).catch(e => e)
    expect(err).toBeInstanceOf(EmployeeArchiveError)
    expect((err as EmployeeArchiveError).reason).toBe('active-assets')
    // Record is unchanged (still active)
    expect((await repo.getEmployee('e1'))?.status).toBe('active')
  })

  it('archiveEmployee with activeAssetsCheck→false succeeds', async () => {
    const repo = new InMemoryEmployeeRepository(
      [makeEmp('e1')], [], undefined, undefined, async () => false,
    )
    const r = await repo.archiveEmployee('e1', ARCHIVE_ACTOR)
    expect(r.value.status).toBe('terminated')
  })
})

// ── Re-hire: findByEmail + createEmployee with terminated email ───────────────

describe('InMemoryEmployeeRepository findByEmail', () => {
  it('finds active employee by exact email', async () => {
    const repo = new InMemoryEmployeeRepository([makeEmp('e1')])
    const found = await repo.findByEmail('e1@x.am')
    expect(found?.id).toBe('e1')
    expect(found?.status).toBe('active')
  })

  it('finds terminated in-place employee by email', async () => {
    const emp = makeEmp('e1', { status: 'terminated', terminatedAt: '2021-01-01T00:00:00.000Z' })
    const repo = new InMemoryEmployeeRepository([emp])
    const found = await repo.findByEmail('e1@x.am')
    expect(found?.id).toBe('e1')
    expect(found?.status).toBe('terminated')
  })

  it('finds legacy former employee by email when not in employees', async () => {
    const former = [makeEmp('e1', { status: 'terminated' })]
    const repo = new InMemoryEmployeeRepository([], former)
    const found = await repo.findByEmail('e1@x.am')
    expect(found?.id).toBe('e1')
  })

  it('is case-insensitive', async () => {
    const repo = new InMemoryEmployeeRepository([makeEmp('e1')])
    const found = await repo.findByEmail('E1@X.AM')
    expect(found?.id).toBe('e1')
  })

  it('returns null when email is absent', async () => {
    const repo = new InMemoryEmployeeRepository([makeEmp('e1')])
    expect(await repo.findByEmail('nobody@x.am')).toBeNull()
  })
})

describe('InMemoryEmployeeRepository createEmployee with terminated email', () => {
  it('throws EmployeeEmailTerminatedError (instanceof, with employeeId) when email belongs to terminated employee', async () => {
    const terminated = makeEmp('e1', { status: 'terminated', terminatedAt: '2021-01-01T00:00:00.000Z' })
    const repo = new InMemoryEmployeeRepository([terminated])
    const err = await repo.createEmployee(
      { id: 'new_uid', firstName: 'X', lastName: 'Y', email: 'e1@x.am' }, ACTOR,
    ).catch(e => e)
    expect(err).toBeInstanceOf(EmployeeEmailTerminatedError)
    expect((err as EmployeeEmailTerminatedError).employeeId).toBe('e1')
    expect((err as EmployeeEmailTerminatedError).email).toBe('e1@x.am')
  })

  it('throws EmployeeEmailTerminatedError for legacy former array email', async () => {
    const former = [makeEmp('e1', { status: 'terminated' })]
    const repo = new InMemoryEmployeeRepository([], former)
    const err = await repo.createEmployee(
      { id: 'new_uid', firstName: 'X', lastName: 'Y', email: 'e1@x.am' }, ACTOR,
    ).catch(e => e)
    expect(err).toBeInstanceOf(EmployeeEmailTerminatedError)
    expect((err as EmployeeEmailTerminatedError).employeeId).toBe('e1')
  })

  it('throws generic email-in-use error (not EmployeeEmailTerminatedError) for active employee email', async () => {
    const repo = new InMemoryEmployeeRepository([makeEmp('e1')])
    const err = await repo.createEmployee(
      { id: 'new_uid', firstName: 'X', lastName: 'Y', email: 'e1@x.am' }, ACTOR,
    ).catch(e => e)
    expect(err).not.toBeInstanceOf(EmployeeEmailTerminatedError)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toMatch(/Email already in use/i)
  })
})

// ── Task 1: audit before-snapshot covers all patched fields ─────────────────

describe('InMemoryEmployeeRepository updateEmployee — audit before-snapshot', () => {
  it('before contains departmentId (old) and after contains departmentId (new) when changed', async () => {
    const store = createInMemoryAuditStore()
    const emp = makeEmp('e1', { departmentId: 'dept_old', phone: '+1111', position: 'Dev' })
    const repo = new InMemoryEmployeeRepository([emp], [], inMemoryAuditContext(store))

    await repo.updateEmployee('e1', { departmentId: 'dept_new' }, ARCHIVE_ACTOR)

    const entry = store.logs.find(l => l.action === 'updated' && l.entityId === 'e1')
    expect(entry).toBeDefined()
    expect((entry!.before as Record<string, unknown>).departmentId).toBe('dept_old')
    expect((entry!.after as Record<string, unknown>).departmentId).toBe('dept_new')
    // Fields NOT in the patch must not appear in before-snapshot
    expect('email' in (entry!.before as object)).toBe(false)
    expect('position' in (entry!.before as object)).toBe(false)
  })

  it('before contains phone (old) when phone is patched', async () => {
    const store = createInMemoryAuditStore()
    const emp = makeEmp('e1', { phone: '+7000' })
    const repo = new InMemoryEmployeeRepository([emp], [], inMemoryAuditContext(store))

    await repo.updateEmployee('e1', { phone: '+9999' }, ARCHIVE_ACTOR)

    const entry = store.logs.find(l => l.action === 'updated')!
    expect((entry.before as Record<string, unknown>).phone).toBe('+7000')
    expect((entry.after as Record<string, unknown>).phone).toBe('+9999')
  })

  it('before contains all patched fields simultaneously', async () => {
    const store = createInMemoryAuditStore()
    const emp = makeEmp('e1', { departmentId: 'dept_a', phone: '+1', position: 'Eng' })
    const repo = new InMemoryEmployeeRepository([emp], [], inMemoryAuditContext(store))

    await repo.updateEmployee('e1', { departmentId: 'dept_b', phone: '+2', position: 'Senior' }, ARCHIVE_ACTOR)

    const entry = store.logs.find(l => l.action === 'updated')!
    const b = entry.before as Record<string, unknown>
    expect(b.departmentId).toBe('dept_a')
    expect(b.phone).toBe('+1')
    expect(b.position).toBe('Eng')
  })
})

// ── Task 2: dept-change resync callback ──────────────────────────────────────

describe('InMemoryEmployeeRepository updateEmployee — onDeptChange callback', () => {
  it('calls onDeptChange with (employeeId, newDeptId) when departmentId is patched', async () => {
    const onDeptChange = vi.fn().mockResolvedValue(undefined)
    const emp = makeEmp('e1', { departmentId: 'dept_old' })
    const repo = new InMemoryEmployeeRepository(
      [emp], [], undefined, undefined, undefined, onDeptChange,
    )

    await repo.updateEmployee('e1', { departmentId: 'dept_new' }, ARCHIVE_ACTOR)

    expect(onDeptChange).toHaveBeenCalledTimes(1)
    expect(onDeptChange).toHaveBeenCalledWith('e1', 'dept_new')
  })

  it('calls onDeptChange with null when departmentId is cleared', async () => {
    const onDeptChange = vi.fn().mockResolvedValue(undefined)
    const emp = makeEmp('e1', { departmentId: 'dept_old' })
    const repo = new InMemoryEmployeeRepository(
      [emp], [], undefined, undefined, undefined, onDeptChange,
    )

    await repo.updateEmployee('e1', { departmentId: null }, ARCHIVE_ACTOR)

    expect(onDeptChange).toHaveBeenCalledWith('e1', null)
  })

  it('does NOT call onDeptChange when departmentId is not in patch', async () => {
    const onDeptChange = vi.fn().mockResolvedValue(undefined)
    const emp = makeEmp('e1', { departmentId: 'dept_old', phone: '+111' })
    const repo = new InMemoryEmployeeRepository(
      [emp], [], undefined, undefined, undefined, onDeptChange,
    )

    await repo.updateEmployee('e1', { phone: '+999' }, ARCHIVE_ACTOR)

    expect(onDeptChange).not.toHaveBeenCalled()
  })

  it('asset deptId is updated via onDeptChange callback in integration scenario', async () => {
    // Simulate the integration: the callback mutates a shared assets array
    const assets: Array<{ id: string; deptId: string | null }> = [
      { id: 'a1', deptId: 'dept_old' },
      { id: 'a2', deptId: 'dept_old' },
    ]
    const onDeptChange = vi.fn().mockImplementation(async (_empId: string, newDeptId: string | null) => {
      for (const a of assets) a.deptId = newDeptId
    })
    const emp = makeEmp('e1', { departmentId: 'dept_old' })
    const repo = new InMemoryEmployeeRepository(
      [emp], [], undefined, undefined, undefined, onDeptChange,
    )

    await repo.updateEmployee('e1', { departmentId: 'dept_new' }, ARCHIVE_ACTOR)

    expect(assets[0]!.deptId).toBe('dept_new')
    expect(assets[1]!.deptId).toBe('dept_new')
  })
})
