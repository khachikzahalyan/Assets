import { useMemo, useCallback } from 'react'
import type {
  PartRepository, PartWriteRepository, PartReferenceData,
  ReceiveItem, InstallInput, UninstallInput,
  CreateModelSkuInput, ServiceRecordInput,
} from '@/domain/part/PartRepository'
import type { PartMovement, Part } from '@/domain/part/types'
import type { AuditedResult } from '@/domain/audit'
import type { Actor } from '@/domain/asset/AssetRepository'
import type { PartCategoryDef } from '@/domain/part/partCategory-types'
import { DEFAULT_PART_CATEGORY_DEFS } from '@/domain/part/partCategoryDefaults'
import { useAuth } from '@/contexts/AuthContext'
import { useCachedResource, cacheIdentity } from './useCachedResource'

export interface UsePartsResult {
  ref: PartReferenceData | null
  partCategories: PartCategoryDef[]
  loading: boolean
  error: Error | null
  reload: () => void
  receiveParts: (items: ReceiveItem[]) => Promise<AuditedResult<PartMovement[]>>
  installPart: (input: InstallInput) => Promise<AuditedResult<PartMovement>>
  uninstallPart: (input: UninstallInput) => Promise<AuditedResult<PartMovement>>
  recordService: (input: ServiceRecordInput) => Promise<AuditedResult<PartMovement>>
  createModelSku: (input: CreateModelSkuInput) => Promise<AuditedResult<Part>>
}

/**
 * Loads the parts reference data (SKU catalog + movement journal + upgradeable assets)
 * and exposes bound write methods. SWR-cached: repeat visits render instantly.
 *
 * Pattern mirrors useAssets.ts: load on mount, expose reload(), call reload() after
 * every successful write (no onSnapshot in MVP — matches the load-then-reload approach).
 *
 * The repo is injected as a parameter (composition root pattern — the caller, PartsPage,
 * instantiates the concrete factory). This keeps src/hooks/** free of src/infra/** imports
 * and allows test callers to pass an in-memory stub without mocking the whole module.
 *
 * deleteGpu is intentionally NOT exposed in this hook's return type.
 * The Firestore adapter throws "not supported in MVP" (rules deny client delete),
 * so surfacing a hard-delete button would always error for real users. The GPU create
 * flow stays; deletion is deferred to a Phase-2 Cloud Function.
 */
export function useParts(repo: PartRepository & PartWriteRepository): UsePartsResult {
  const { user, role } = useAuth()

  const actor = useMemo<Actor>(() => ({ uid: user.id, role, displayName: user.name }), [user.id, role, user.name])

  const { data: ref, loading, error, reload } = useCachedResource(
    `parts:${cacheIdentity(repo)}`,
    () => repo.loadReferenceData(),
  )

  // Derive partCategories with graceful fallback to defaults
  const partCategories = useMemo<PartCategoryDef[]>(
    () => {
      const cats = ref?.partCategories
      if (!cats || cats.length === 0) {
        return (DEFAULT_PART_CATEGORY_DEFS as unknown as PartCategoryDef[])
      }
      return cats
    },
    [ref],
  )

  const receiveParts = useCallback(
    async (items: ReceiveItem[]): Promise<AuditedResult<PartMovement[]>> => {
      const result = await repo.receiveParts(items, actor)
      reload()
      return result
    },
    [repo, actor, reload],
  )

  const installPart = useCallback(
    async (input: InstallInput): Promise<AuditedResult<PartMovement>> => {
      const result = await repo.installPart(input, actor)
      reload()
      return result
    },
    [repo, actor, reload],
  )

  const uninstallPart = useCallback(
    async (input: UninstallInput): Promise<AuditedResult<PartMovement>> => {
      const result = await repo.uninstallPart(input, actor)
      reload()
      return result
    },
    [repo, actor, reload],
  )

  const recordService = useCallback(
    async (input: ServiceRecordInput): Promise<AuditedResult<PartMovement>> => {
      const result = await repo.recordService(input, actor)
      reload()
      return result
    },
    [repo, actor, reload],
  )

  const createModelSku = useCallback(
    async (input: CreateModelSkuInput): Promise<AuditedResult<Part>> => {
      const result = await repo.createModelSku(input, actor)
      reload()
      return result
    },
    [repo, actor, reload],
  )

  return { ref, partCategories, loading, error, reload, receiveParts, installPart, uninstallPart, recordService, createModelSku }
}
