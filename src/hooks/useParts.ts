import { useEffect, useState, useCallback, useMemo } from 'react'
import type { PartRepository, PartWriteRepository, PartReferenceData, ReceiveItem, InstallInput, UninstallInput, CreateGpuInput, ServiceRecordInput } from '@/domain/part/PartRepository'
import type { PartMovement, Part } from '@/domain/part/types'
import type { AuditedResult } from '@/domain/audit'
import type { Actor } from '@/domain/asset/AssetRepository'
import { useAuth } from '@/contexts/AuthContext'

export interface UsePartsResult {
  ref: PartReferenceData | null
  loading: boolean
  error: Error | null
  reload: () => void
  receiveParts: (items: ReceiveItem[]) => Promise<AuditedResult<PartMovement[]>>
  installPart: (input: InstallInput) => Promise<AuditedResult<PartMovement>>
  uninstallPart: (input: UninstallInput) => Promise<AuditedResult<PartMovement>>
  recordService: (input: ServiceRecordInput) => Promise<AuditedResult<PartMovement>>
  createGpu: (input: CreateGpuInput) => Promise<AuditedResult<Part>>
}

/**
 * Loads the parts reference data (SKU catalog + movement journal + upgradeable assets)
 * and exposes bound write methods.
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

  const actor = useMemo<Actor>(() => ({ uid: user.id, role }), [user.id, role])

  const [ref, setRef] = useState<PartReferenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const data = await repo.loadReferenceData()
        if (!active) return
        setRef(data)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [repo, tick])

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

  const createGpu = useCallback(
    async (input: CreateGpuInput): Promise<AuditedResult<Part>> => {
      const result = await repo.createGpu(input, actor)
      reload()
      return result
    },
    [repo, actor, reload],
  )

  return { ref, loading, error, reload, receiveParts, installPart, uninstallPart, recordService, createGpu }
}
