import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import type { CategoryGroup, CategoryGroupRepository } from '@/domain/category'
import { type CategoryGroupFormValues } from '@/components/features/categories'
import { EntityInUseError } from '@/domain/shared'

export function useCategoryGroupCrud(
  groupRepo: CategoryGroupRepository,
  load: () => Promise<void>,
  setPageError: (msg: string | null) => void,
) {
  const { t } = useTranslation('categories')
  const { user, role } = useAuth()

  const [groupEditing, setGroupEditing]       = useState<CategoryGroup | 'new' | null>(null)
  const [groupSubmitting, setGroupSubmitting] = useState(false)
  const [groupSaveError, setGroupSaveError]   = useState<string | null>(null)
  const [groupDeleting, setGroupDeleting]     = useState<CategoryGroup | null>(null)
  const [groupBlockedMsg, setGroupBlockedMsg] = useState<string | null>(null)
  const [groupDelBusy, setGroupDelBusy]       = useState(false)

  async function handleGroupSubmit(v: CategoryGroupFormValues) {
    setGroupSubmitting(true); setGroupSaveError(null)
    const actor = { uid: user.id, role }
    try {
      if (groupEditing && groupEditing !== 'new') {
        await groupRepo.updateCategoryGroup(groupEditing.id, v, actor)
      } else {
        await groupRepo.createCategoryGroup(v, actor)
      }
      setGroupEditing(null); await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setGroupSaveError(
        /name already in use/i.test(msg) ? t('validation.nameTaken') : t('validation.saveFailed'),
      )
    } finally { setGroupSubmitting(false) }
  }

  async function askDeleteGroup(g: CategoryGroup) {
    setGroupBlockedMsg(null)
    try {
      const n = await groupRepo.countReferences(g.id)
      if (n > 0) setGroupBlockedMsg(t('groupDelete.inUse', { count: n }))
    } catch { /* fall through; confirmDeleteGroup re-guards */ }
    setGroupDeleting(g)
  }

  async function confirmDeleteGroup() {
    if (!groupDeleting) return
    setGroupDelBusy(true)
    try {
      await groupRepo.deleteCategoryGroup(groupDeleting.id, { uid: user.id, role })
      setGroupDeleting(null); setGroupBlockedMsg(null); await load()
    } catch (e) {
      if (e instanceof EntityInUseError) {
        setGroupBlockedMsg(t('groupDelete.inUse', { count: e.count }))
      } else {
        setGroupDeleting(null); setPageError(t('validation.saveFailed'))
      }
    } finally { setGroupDelBusy(false) }
  }

  return {
    groupEditing, setGroupEditing,
    groupSubmitting,
    groupSaveError, setGroupSaveError,
    groupDeleting, setGroupDeleting,
    groupBlockedMsg, setGroupBlockedMsg,
    groupDelBusy,
    handleGroupSubmit, askDeleteGroup, confirmDeleteGroup,
  }
}
