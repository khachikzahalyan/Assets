export const BRANCH_TYPES = ['branch', 'warehouse'] as const
export type BranchType = (typeof BRANCH_TYPES)[number]

export function isBranchType(v: string): v is BranchType {
  return (BRANCH_TYPES as readonly string[]).includes(v)
}

export interface Branch {
  id: string
  name: string
  type: BranchType
  city: string | null
  address: string | null
  createdAt: string
  updatedAt: string
}

export interface BranchListQuery {
  type?: BranchType | 'all'
  search?: string
}
