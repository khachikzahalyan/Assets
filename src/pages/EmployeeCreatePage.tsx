import type { EmployeeRepository } from '@/domain/employee'
import type { AssetRepository, RefRow } from '@/domain/asset'
import type { AssignmentRepository } from '@/domain/assignment'
import { EmployeesPage } from './EmployeesPage'

export interface EmployeeCreatePageProps {
  repository?: EmployeeRepository
  assetRepository?: AssetRepository
  assignmentRepository?: AssignmentRepository
  loadRefData?: () => Promise<{ branches: RefRow[]; departments: RefRow[] }>
}

/**
 * Deep-link stub: /employees/new
 * Renders EmployeesPage with the create modal pre-opened.
 * Keeps the route alive for navigation compatibility.
 */
export function EmployeeCreatePage({
  repository,
  assetRepository,
  assignmentRepository,
  loadRefData,
}: EmployeeCreatePageProps) {
  return (
    <EmployeesPage
      {...(repository !== undefined ? { repository } : {})}
      {...(assetRepository !== undefined ? { assetRepository } : {})}
      {...(assignmentRepository !== undefined ? { assignmentRepository } : {})}
      {...(loadRefData !== undefined ? { loadRefData } : {})}
      initialModal="create"
    />
  )
}
