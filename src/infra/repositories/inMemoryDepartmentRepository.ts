import type {
  Department, DepartmentListQuery, DepartmentRepository, CreateDepartmentInput, UpdateDepartmentInput,
} from '@/domain/department'
import type { Actor } from '@/domain/asset'
import { EntityInUseError } from '@/domain/shared'
import { withAudit, type AuditContext, createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

interface DepartmentRefs {
  assets?: { deptId?: string }[]
  employees?: { departmentId?: string | null }[]
}

export class InMemoryDepartmentRepository implements DepartmentRepository {
  constructor(
    private readonly departments: Department[],
    private readonly refs: DepartmentRefs = {},
    private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
  ) {}

  async listDepartments(query: DepartmentListQuery = {}): Promise<Department[]> {
    const search = (query.search ?? '').trim().toLowerCase()
    return this.departments.filter(d => {
      if (search) {
        if (!d.name.toLowerCase().includes(search)) return false
      }
      return true
    })
  }

  async getDepartment(id: string): Promise<Department | null> {
    return this.departments.find(d => d.id === id) ?? null
  }

  async isNameTaken(name: string, exceptId?: string): Promise<boolean> {
    const needle = name.trim().toLowerCase()
    return this.departments.some(d => d.name.trim().toLowerCase() === needle && d.id !== exceptId)
  }

  async countReferences(id: string): Promise<number> {
    const a = (this.refs.assets ?? []).filter(x => x.deptId === id).length
    const e = (this.refs.employees ?? []).filter(x => x.departmentId === id).length
    return a + e
  }

  async createDepartment(input: CreateDepartmentInput, actor: Actor) {
    if (await this.isNameTaken(input.name)) throw new Error(`Name already in use: ${input.name}`)
    const now = new Date().toISOString()
    const id = `dp_${Math.random().toString(36).slice(2, 10)}`
    const department: Department = {
      id, name: input.name.trim(),
      createdAt: now, updatedAt: now,
    }
    return withAudit(this.audit,
      {
        entityType: 'department', entityId: id, action: 'created',
        actorUid: actor.uid, actorRole: actor.role,
        after: { id, name: department.name } as Record<string, unknown>,
      },
      async () => { this.departments.push(department); return { value: department } },
    )
  }

  async updateDepartment(id: string, patch: UpdateDepartmentInput, actor: Actor) {
    const idx = this.departments.findIndex(d => d.id === id)
    if (idx < 0) throw new Error(`Department not found: ${id}`)
    if (patch.name && await this.isNameTaken(patch.name, id)) throw new Error(`Name already in use: ${patch.name}`)
    const before = this.departments[idx]!
    const next: Department = { ...before, ...stripUndefined(patch), updatedAt: new Date().toISOString() }
    if (patch.name !== undefined) next.name = patch.name.trim()
    return withAudit(this.audit,
      {
        entityType: 'department', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { name: before.name } as Record<string, unknown>,
        after: stripUndefined(patch) as Record<string, unknown>,
      },
      async () => { this.departments[idx] = next; return { value: next } },
    )
  }

  async deleteDepartment(id: string, actor: Actor) {
    const idx = this.departments.findIndex(d => d.id === id)
    if (idx < 0) throw new Error(`Department not found: ${id}`)
    const count = await this.countReferences(id)
    if (count > 0) throw new EntityInUseError('department', id, count)
    const removed = this.departments[idx]!
    return withAudit(this.audit,
      {
        entityType: 'department', entityId: id, action: 'deleted',
        actorUid: actor.uid, actorRole: actor.role,
        before: { id, name: removed.name } as Record<string, unknown>,
      },
      async () => { this.departments.splice(idx, 1); return { value: { id } } },
    )
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
