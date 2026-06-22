import { useParams } from 'react-router-dom'
import type { EmployeeRepository } from '@/domain/employee'
import type { AssetRepository, RefRow } from '@/domain/asset'
import type { AssignmentRepository } from '@/domain/assignment'
import { EmployeesPage } from './EmployeesPage'

export interface EmployeeDetailPageProps {
  repository?: EmployeeRepository
  assetRepository?: AssetRepository
  assignmentRepository?: AssignmentRepository
  loadRefData?: () => Promise<{ branches: RefRow[]; departments: RefRow[] }>
}

/**
 * Deep-link stub: /employees/:id
 * Renders EmployeesPage with the detail drawer pre-opened for the given id.
 * Keeps the route alive for navigation and back-link compatibility.
 */
export function EmployeeDetailPage({
  repository,
  assetRepository,
  assignmentRepository,
  loadRefData,
}: EmployeeDetailPageProps) {
  const { id } = useParams<{ id: string }>()

  return (
    <EmployeesPage
      {...(repository !== undefined ? { repository } : {})}
      {...(assetRepository !== undefined ? { assetRepository } : {})}
      {...(assignmentRepository !== undefined ? { assignmentRepository } : {})}
      {...(loadRefData !== undefined ? { loadRefData } : {})}
      {...(id !== undefined ? { initialDetailId: id } : {})}
    />
  )
}
