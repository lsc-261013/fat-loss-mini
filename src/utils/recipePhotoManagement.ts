import { recipes, type Recipe } from '@/data/recipes'
import type { useJournalStore } from '@/store/journal'

export type RecipeManagementCategory = 'hidden' | 'existing'
export function recipeManagementLists(custom: readonly Recipe[], hiddenIds: readonly string[]) {
  const hidden = new Set(hiddenIds)
  const catalog = [...recipes, ...custom]
  return {
    hidden: [...hidden].map(id => ({ id, recipe: catalog.find(recipe => recipe.id === id) })),
    existing: catalog.filter(recipe => !hidden.has(recipe.id)).map(recipe => ({ id: recipe.id, recipe })),
  }
}
export function photoCleanupCategory(custom: readonly Recipe[], hiddenIds: readonly string[]): RecipeManagementCategory {
  const hidden = new Set(hiddenIds)
  if (custom.some(recipe => recipe.photo && !hidden.has(recipe.id))) return 'existing'
  return custom.some(recipe => recipe.photo && hidden.has(recipe.id)) ? 'hidden' : 'existing'
}
export const formatPhotoSpace = (chars: number) => (chars / 1024).toFixed(chars ? 1 : 0)

export function confirmRecipeHiding(journal: ReturnType<typeof useJournalStore>, ids: string[], onHidden: (ids: string[]) => void, onError: (message: string) => void) {
  const targets = [...new Set(ids)], revision = journal.revision
  if (!targets.length) return
  uni.showModal({ title: '移到隐藏食谱？', content: `隐藏选中的 ${targets.length} 份食谱？内置和自建都可恢复，照片仍占空间；已有计划和已吃保留。`, confirmText: '隐藏', success: result => {
    if (!result.confirm) return
    if (revision !== journal.revision) { onError('数据已变化，请重新选择'); return }
    const existing = new Set(recipeManagementLists(journal.data.customRecipes, journal.data.hiddenRecipeIds).existing.map(item => item.id))
    if (targets.some(id => !existing.has(id))) { onError('部分食谱已变化，请重新选择'); return }
    try { journal.hideRecipes(targets) } catch (error) { onError(error instanceof Error ? error.message : '隐藏未保存，请重试'); return }
    onHidden(targets)
  } })
}

export function confirmRecipePhotoRemoval(journal: ReturnType<typeof useJournalStore>, recipe: Recipe, onRemoved: () => void, onError: (message: string) => void) {
  const id = recipe.id, revision = journal.revision
  uni.showModal({ title: '移除这份菜谱的照片？', content: `「${recipe.name}」会改用默认图，释放约 ${formatPhotoSpace(recipe.photo?.length || 0)} KB。只移除这张自选照片，菜谱文字、配料、隐藏状态、计划和已吃的记录数值保留，关联计划配图改用默认图。照片不能直接撤销；已有外部备份不会被擦除。`, confirmText: '移除照片', confirmColor: '#9e543f', success: result => {
    if (!result.confirm) return
    if (revision !== journal.revision) { onError('数据已变化，请重新选择要清理的照片。'); return }
    try { journal.removeRecipePhoto(id) }
    catch (error) { onError(error instanceof Error ? error.message : '照片未移除，原数据保留，请重试'); return }
    onRemoved()
  } })
}
