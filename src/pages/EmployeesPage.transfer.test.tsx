import { describe, it, expect } from 'vitest'
import { buildTransferPatch } from '@/domain/asset'
import type { Destination } from '@/components/features/employees/DestPicker'

describe('temporary transfer patch contract', () => {
  it('buildTransferPatch temporary yields an isTemporary assignment with expiresAt + tempKind', () => {
    const dest: Destination = { kind: 'temporary', tempKind: 'intern', expiresAt: '2026-07-01', label: 'x' }
    const patch = buildTransferPatch({
      mode: 'temporary',
      tempKind: dest.kind === 'temporary' ? dest.tempKind : 'audit',
      expiresAt: dest.kind === 'temporary' ? dest.expiresAt : '',
    })
    expect(patch.toStatusId).toBe('st_assigned')
    expect(patch.assignment).toMatchObject({
      mode: 'temporary', tempKind: 'intern', expiresAt: '2026-07-01', isTemporary: true,
    })
    expect(patch.branchId).toBe('br_main')
    expect(patch.deptId).toBeNull()
  })
})
