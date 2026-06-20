import { describe, it, expect } from 'vitest'
import { InMemoryUserRepository } from './inMemoryUserRepository'
import { RoleLockoutError } from '@/domain/user'
import type { User } from '@/domain/user'
import type { Employee } from '@/domain/employee'

function seed(): User[] {
  return [
    { id: 'su1', email: 'su1@x.io', displayName: 'Super One', role: 'super_admin', status: 'active', createdAt: '2026-01-03T00:00:00.000Z' },
    { id: 'su2', email: 'su2@x.io', displayName: 'Super Two', role: 'super_admin', status: 'active', createdAt: '2026-01-02T00:00:00.000Z' },
    { id: 'aa1', email: 'aa1@x.io', displayName: 'Asset Admin', role: 'asset_admin', status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'np1', email: 'np1@x.io', displayName: 'No Role', role: null, status: 'no-role', createdAt: '2026-01-04T00:00:00.000Z' },
  ]
}
const SUPER = { uid: 'su1', role: 'super_admin' } as const

describe('InMemoryUserRepository.listUsers', () => {
  it('returns all users newest-first', async () => {
    const repo = new InMemoryUserRepository(seed())
    const all = await repo.listUsers()
    expect(all.map(u => u.id)).toEqual(['np1', 'su1', 'su2', 'aa1'])
  })
  it('filters by role', async () => {
    const repo = new InMemoryUserRepository(seed())
    expect((await repo.listUsers({ role: 'super_admin' })).map(u => u.id)).toEqual(['su1', 'su2'])
  })
  it('filters role:no-role (role === null)', async () => {
    const repo = new InMemoryUserRepository(seed())
    expect((await repo.listUsers({ role: 'no-role' })).map(u => u.id)).toEqual(['np1'])
  })
  it('filters by status', async () => {
    const repo = new InMemoryUserRepository(seed())
    expect((await repo.listUsers({ status: 'no-role' })).map(u => u.id)).toEqual(['np1'])
  })
})

describe('InMemoryUserRepository.assignRole lockout guard', () => {
  it('blocks a super_admin demoting THEIR OWN role', async () => {
    const repo = new InMemoryUserRepository(seed())
    await expect(repo.assignRole({ uid: 'su1', role: 'asset_admin' }, SUPER))
      .rejects.toBeInstanceOf(RoleLockoutError)
  })
  it('allows self-change that keeps super_admin (no-op role)', async () => {
    const repo = new InMemoryUserRepository(seed())
    const r = await repo.assignRole({ uid: 'su1', role: 'super_admin' }, SUPER)
    expect(r.value.role).toBe('super_admin')
  })
  it('blocks demoting the LAST super_admin (another actor)', async () => {
    const users: User[] = [
      { id: 'only', email: 'o@x.io', displayName: 'Only Super', role: 'super_admin', status: 'active', createdAt: null },
      { id: 'su1', email: 'su1@x.io', displayName: 'S', role: 'super_admin', status: 'active', createdAt: null },
    ]
    // Demote 'only' while su1 is actor → still one super left → OK
    const repo = new InMemoryUserRepository(users)
    await repo.assignRole({ uid: 'only', role: 'tech_admin' }, SUPER)
    // Now su1 is the last super; demoting su1 (by itself) is self-demotion AND last-super
    await expect(repo.assignRole({ uid: 'su1', role: 'tech_admin' }, SUPER))
      .rejects.toBeInstanceOf(RoleLockoutError)
  })
  it('promoting a non-super to a role still audits (regression)', async () => {
    const employees: Employee[] = []
    const repo = new InMemoryUserRepository(seed(), employees)
    const r = await repo.assignRole({ uid: 'np1', role: 'tech_admin' }, SUPER)
    expect(r.value.role).toBe('tech_admin')
    expect(r.auditId).toBeTruthy()
  })

  it('allows demoting a super_admin when other active supers remain (not self)', async () => {
    // su1 (actor) demotes su2 (different user); su1 still active → guard should pass
    const repo = new InMemoryUserRepository(seed())
    const r = await repo.assignRole({ uid: 'su2', role: 'asset_admin' }, SUPER)
    expect(r.value.role).toBe('asset_admin')
    expect(r.auditId).toBeTruthy()
  })

  it('does not count a terminated super_admin toward the active-super total', async () => {
    // 'term' is super_admin but terminated; 'su1' is the only ACTIVE super.
    // Demoting 'su1' by itself is self-demotion, so use a separate actor uid.
    const users: User[] = [
      { id: 'term', email: 't@x.io', displayName: 'Terminated Super', role: 'super_admin', status: 'terminated', createdAt: null },
      { id: 'su1',  email: 'su1@x.io', displayName: 'Active Super', role: 'super_admin', status: 'active',     createdAt: null },
      { id: 'su2',  email: 'su2@x.io', displayName: 'Other Super',  role: 'super_admin', status: 'active',     createdAt: null },
    ]
    const repo = new InMemoryUserRepository(users)
    // Demote su1 (not the actor su2); su2 is active, term is terminated → countSuperAdmins(su1) = 1
    const actor = { uid: 'su2', role: 'super_admin' } as const
    const r = await repo.assignRole({ uid: 'su1', role: 'tech_admin' }, actor)
    expect(r.value.role).toBe('tech_admin')
    // Now only su2 is active super; demoting su2 (self) should be self-demotion not last-super
    // — but the terminated super must NOT rescue the count
    const users2: User[] = [
      { id: 'term', email: 't@x.io', displayName: 'Terminated Super', role: 'super_admin', status: 'terminated', createdAt: null },
      { id: 'su2',  email: 'su2@x.io', displayName: 'Only Active Super', role: 'super_admin', status: 'active', createdAt: null },
    ]
    const repo2 = new InMemoryUserRepository(users2)
    // A third party tries to demote su2 → should fail as last-super (term doesn't count)
    const actor3 = { uid: 'other', role: 'super_admin' } as const
    await expect(repo2.assignRole({ uid: 'su2', role: 'tech_admin' }, actor3))
      .rejects.toBeInstanceOf(RoleLockoutError)
  })

  it('promoting a no-role user to super_admin succeeds and audits', async () => {
    const repo = new InMemoryUserRepository(seed())
    const r = await repo.assignRole({ uid: 'np1', role: 'super_admin' }, SUPER)
    expect(r.value.role).toBe('super_admin')
    expect(r.value.status).toBe('active')
    expect(r.auditId).toBeTruthy()
  })
})
