import type {
  Branch, BranchListQuery, BranchRepository, CreateBranchInput, UpdateBranchInput,
} from '@/domain/branch'
import type { Actor } from '@/domain/asset'
import { EntityInUseError } from '@/domain/shared'
import { withAudit, type AuditContext, createInMemoryAuditStore, inMemoryAuditContext } from '@/lib/audit'

interface BranchRefs {
  assets?: { branchId?: string }[]
  employees?: { branchId?: string | null }[]
  assignments?: { assignedToBranchId?: string | null }[]
}

export class InMemoryBranchRepository implements BranchRepository {
  constructor(
    private readonly branches: Branch[],
    private readonly refs: BranchRefs = {},
    private readonly audit: AuditContext = inMemoryAuditContext(createInMemoryAuditStore()),
  ) {}

  async listBranches(query: BranchListQuery = {}): Promise<Branch[]> {
    const search = (query.search ?? '').trim().toLowerCase()
    return this.branches.filter(b => {
      if (query.type && query.type !== 'all' && b.type !== query.type) return false
      if (search) {
        const hay = [b.name, b.city, b.address].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(search)) return false
      }
      return true
    })
  }

  async getBranch(id: string): Promise<Branch | null> {
    return this.branches.find(b => b.id === id) ?? null
  }

  async isNameTaken(name: string, exceptId?: string): Promise<boolean> {
    const needle = name.trim().toLowerCase()
    return this.branches.some(b => b.name.trim().toLowerCase() === needle && b.id !== exceptId)
  }

  async countReferences(id: string): Promise<number> {
    const a = (this.refs.assets ?? []).filter(x => x.branchId === id).length
    const e = (this.refs.employees ?? []).filter(x => x.branchId === id).length
    const g = (this.refs.assignments ?? []).filter(x => x.assignedToBranchId === id).length
    return a + e + g
  }

  async createBranch(input: CreateBranchInput, actor: Actor) {
    if (await this.isNameTaken(input.name)) throw new Error(`Name already in use: ${input.name}`)
    const now = new Date().toISOString()
    const id = `br_${Math.random().toString(36).slice(2, 10)}`
    const branch: Branch = {
      id, name: input.name.trim(), type: input.type,
      city: input.city ?? null, address: input.address ?? null,
      createdAt: now, updatedAt: now,
    }
    return withAudit(this.audit,
      {
        entityType: 'branch', entityId: id, action: 'created',
        actorUid: actor.uid, actorRole: actor.role,
        after: { id, name: branch.name, type: branch.type } as Record<string, unknown>,
      },
      async () => { this.branches.push(branch); return { value: branch } },
    )
  }

  async updateBranch(id: string, patch: UpdateBranchInput, actor: Actor) {
    const idx = this.branches.findIndex(b => b.id === id)
    if (idx < 0) throw new Error(`Branch not found: ${id}`)
    if (patch.name && await this.isNameTaken(patch.name, id)) throw new Error(`Name already in use: ${patch.name}`)
    const before = this.branches[idx]!
    const next: Branch = { ...before, ...stripUndefined(patch), updatedAt: new Date().toISOString() }
    if (patch.name !== undefined) next.name = patch.name.trim()
    return withAudit(this.audit,
      {
        entityType: 'branch', entityId: id, action: 'updated',
        actorUid: actor.uid, actorRole: actor.role,
        before: { name: before.name, type: before.type } as Record<string, unknown>,
        after: stripUndefined(patch) as Record<string, unknown>,
      },
      async () => { this.branches[idx] = next; return { value: next } },
    )
  }

  async deleteBranch(id: string, actor: Actor) {
    const idx = this.branches.findIndex(b => b.id === id)
    if (idx < 0) throw new Error(`Branch not found: ${id}`)
    const count = await this.countReferences(id)
    if (count > 0) throw new EntityInUseError('branch', id, count)
    const removed = this.branches[idx]!
    return withAudit(this.audit,
      {
        entityType: 'branch', entityId: id, action: 'deleted',
        actorUid: actor.uid, actorRole: actor.role,
        before: { id, name: removed.name } as Record<string, unknown>,
      },
      async () => { this.branches.splice(idx, 1); return { value: { id } } },
    )
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
