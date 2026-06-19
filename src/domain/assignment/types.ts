export const ASSIGNMENT_MODES = ['employee', 'branch'] as const
export type AssignmentMode = (typeof ASSIGNMENT_MODES)[number]

export function isAssignmentMode(v: string): v is AssignmentMode {
  return (ASSIGNMENT_MODES as readonly string[]).includes(v)
}

/** Immutable history doc. Mirrors Firestore assignments/{id}. Timestamps are ISO strings in the domain. */
export interface Assignment {
  id: string
  assetId: string
  mode: AssignmentMode
  assignedToEmployeeId: string | null
  assignedToBranchId: string | null
  startedAt: string
  endedAt: string | null
  actStoragePath: string | null
  transferComment: string | null
  createdBy: string
  createdAt: string
}
