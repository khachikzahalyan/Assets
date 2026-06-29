import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryEmployeeRepository } from './inMemoryEmployeeRepository'
import { EmployeeArchiveError } from '@/domain/employee'
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

  it('listEmployees filters by branch/search; archived employees leave the list', async () => {
    await repo.createEmployee({ id: 'uid_1', firstName: 'Иван', lastName: 'Петров', email: 'i@x.com', branchId: 'br_1' }, ACTOR)
    await repo.createEmployee({ id: 'uid_2', firstName: 'Анна', lastName: 'Сидорова', email: 'a@x.com', branchId: 'br_2' }, ACTOR)
    // Before archive: both employees visible
    expect(await repo.listEmployees()).toHaveLength(2)
    expect(await repo.listEmployees({ branchId: 'br_1' })).toHaveLength(1)
    expect(await repo.listEmployees({ search: 'петров' })).toHaveLength(1)
    // After archive: uid_2 moves to former
    await repo.archiveEmployee('uid_2', ACTOR)
    expect(await repo.listEmployees({ status: 'active' })).toHaveLength(1)
    expect(await repo.listEmployees()).toHaveLength(1)
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

describe('InMemoryEmployeeRepository archive/restore (move)', () => {
  it('archive MOVES the doc out of employees into former', async () => {
    const active = [makeEmp('e1'), makeEmp('e2')]
    const former: Employee[] = []
    const repo = new InMemoryEmployeeRepository(active, former)
    await repo.archiveEmployee('e1', ARCHIVE_ACTOR)
    expect((await repo.listEmployees()).map(e => e.id)).toEqual(['e2'])
    const formerList = await repo.listFormerEmployees()
    expect(formerList.map(e => e.id)).toEqual(['e1'])
    expect(formerList[0]!.status).toBe('terminated')
    expect(formerList[0]!.terminatedAt).not.toBeNull()
    expect(formerList[0]!.createdAt).toBe('2020-01-01T00:00:00.000Z')
  })

  it('restore MOVES the doc back into employees', async () => {
    const active: Employee[] = []
    const former = [makeEmp('e1', { status: 'terminated', terminatedAt: '2021-01-01T00:00:00.000Z' })]
    const repo = new InMemoryEmployeeRepository(active, former)
    await repo.restoreEmployee('e1', ARCHIVE_ACTOR)
    expect((await repo.listEmployees()).map(e => e.id)).toEqual(['e1'])
    expect(await repo.listFormerEmployees()).toEqual([])
    expect((await repo.listEmployees())[0]!.status).toBe('active')
    expect((await repo.listEmployees())[0]!.terminatedAt).toBeNull()
  })

  it('archiving a DIFFERENT employee works', async () => {
    const repo = new InMemoryEmployeeRepository([makeEmp('e1'), makeEmp('e2')], [])
    await repo.archiveEmployee('e2', ARCHIVE_ACTOR)
    expect((await repo.listEmployees()).map(e => e.id)).toEqual(['e1'])
  })

  it('rejects self-archive', async () => {
    const repo = new InMemoryEmployeeRepository([makeEmp('admin1')], [])
    await expect(repo.archiveEmployee('admin1', ARCHIVE_ACTOR)).rejects.toBeInstanceOf(EmployeeArchiveError)
    expect((await repo.listEmployees()).map(e => e.id)).toEqual(['admin1'])
  })

  it('rejects last super_admin via injected check', async () => {
    const repo = new InMemoryEmployeeRepository([makeEmp('e1')], [], undefined, async () => true)
    await expect(repo.archiveEmployee('e1', ARCHIVE_ACTOR)).rejects.toBeInstanceOf(EmployeeArchiveError)
  })

  it('archive writes EXACTLY ONE terminated audit entry with minimal { status } payload; restore writes EXACTLY ONE reactivated entry', async () => {
    // Arrange — explicit audit store so we can inspect every entry written
    const auditStore = createInMemoryAuditStore()
    const active = [makeEmp('e1'), makeEmp('e2')]
    const former: Employee[] = []
    const repo = new InMemoryEmployeeRepository(active, former, inMemoryAuditContext(auditStore))

    // Act — archive e1
    const auditLenBefore = auditStore.logs.length
    await repo.archiveEmployee('e1', ARCHIVE_ACTOR)
    const afterArchive = auditStore.logs.slice(auditLenBefore)

    // Assert — exactly one audit entry, correct entity/action, NO PII in payload
    expect(afterArchive).toHaveLength(1)
    const termEntry = afterArchive[0]!
    expect(termEntry.entityType).toBe('employee')
    expect(termEntry.entityId).toBe('e1')
    expect(termEntry.action).toBe('terminated')
    // Audit payload contains ONLY status — no name/email/phone/PII
    expect(termEntry.before).toEqual({ status: 'active' })
    expect(termEntry.after).toEqual({ status: 'terminated' })
    // The two employee arrays are the ONLY state changed: e1 left employees, entered former
    expect(active.map(e => e.id)).toEqual(['e2'])
    expect(former.map(e => e.id)).toEqual(['e1'])

    // Act — restore e1
    const auditLenBeforeRestore = auditStore.logs.length
    await repo.restoreEmployee('e1', ARCHIVE_ACTOR)
    const afterRestore = auditStore.logs.slice(auditLenBeforeRestore)

    // Assert — exactly one reactivated entry, minimal payload
    expect(afterRestore).toHaveLength(1)
    const reactEntry = afterRestore[0]!
    expect(reactEntry.entityType).toBe('employee')
    expect(reactEntry.entityId).toBe('e1')
    expect(reactEntry.action).toBe('reactivated')
    expect(reactEntry.before).toEqual({ status: 'terminated' })
    expect(reactEntry.after).toEqual({ status: 'active' })

    // NOTE: terminatedBy persistence is a Firestore-impl concern — the field is written in
    // firestoreEmployeeRepository.ts:archiveEmployee as `terminatedBy: actor.uid` on the
    // former_employees/{id} doc. It is NOT part of the domain Employee type, so it does not
    // appear in the inMemory adapter and has no coverage here. It must be verified by a
    // Firestore-emulator-backed integration test (requires Java / CI emulator environment).
  })
})
