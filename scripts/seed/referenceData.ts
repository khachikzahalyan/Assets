// scripts/seed/referenceData.ts
// Pure reference data for the AMS seeder. NO Firebase imports.
// Shapes mirror the production domain types (timestamps added by the writer).

export interface StatusSeed {
  id: string; name: string; color: string; isFinal: boolean; isSystem: boolean; sortOrder: number
}
export interface BranchSeed {
  id: string; name: string; type: 'branch' | 'warehouse'; city: string | null; address: string | null
}
export interface DepartmentSeed { id: string; name: string }
export interface CategorySeed {
  id: string; name: string; group: 'devices' | 'network' | 'furniture'; prefix: string;
  hasSpecs: boolean; lucideIcon: string
}

export const STATUS_SEED: StatusSeed[] = [
  { id: 'st_warehouse', name: 'На складе', color: 'gray',   isFinal: false, isSystem: true, sortOrder: 0 },
  { id: 'st_assigned',  name: 'Выдано',    color: 'green',  isFinal: false, isSystem: true, sortOrder: 1 },
  { id: 'st_repair',    name: 'В ремонте', color: 'orange', isFinal: false, isSystem: true, sortOrder: 2 },
  { id: 'st_disposed',  name: 'Списано',   color: 'red',    isFinal: true,  isSystem: true, sortOrder: 3 },
]

export const BRANCH_SEED: BranchSeed[] = [
  { id: 'br_main',      name: 'Головной офис',   type: 'warehouse', city: null, address: null },
  { id: 'br_yerevan_2', name: 'Филиал Ереван-2', type: 'branch',    city: null, address: null },
  { id: 'br_yerevan_3', name: 'Филиал Ереван-3', type: 'branch',    city: null, address: null },
  { id: 'br_gyumri',    name: 'Филиал Гюмри',    type: 'branch',    city: null, address: null },
  { id: 'br_vanadzor',  name: 'Филиал Ванадзор', type: 'branch',    city: null, address: null },
]

export const DEPARTMENT_SEED: DepartmentSeed[] = [
  { id: 'dep_it',      name: 'ИТ'       },
  { id: 'dep_hr',      name: 'HR'       },
  { id: 'dep_sales',   name: 'Продажи'  },
  { id: 'dep_finance', name: 'Финансы'  },
  { id: 'dep_legal',   name: 'Юристы'   },
  { id: 'dep_ops',     name: 'Операции' },
]
