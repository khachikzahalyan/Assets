import { expectTypeOf } from 'vitest'
import type { ServerLicense } from './ServerLicense'
import type { WorkstationLicense } from './WorkstationLicense'

// ServerLicense must, by construction, carry no assignment surface.
expectTypeOf<ServerLicense>().not.toHaveProperty('assignedToEmployeeId')
expectTypeOf<ServerLicense>().not.toHaveProperty('assignedToAssetId')
expectTypeOf<ServerLicense>().not.toHaveProperty('assignmentType')

// A WorkstationLicense is NOT a ServerLicense — strict separation, no shared base.
// @ts-expect-error WorkstationLicense is not assignable to ServerLicense
const s: ServerLicense = {} as WorkstationLicense
void s
