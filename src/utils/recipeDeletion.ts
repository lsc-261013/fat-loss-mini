import type { useJournalStore } from '@/store/journal'

export function confirmCustomRecipeDeletion(journal: ReturnType<typeof useJournalStore>, ids: string[], onDeleted: (ids: string[]) => void, onError?: (message: string) => void) {
  const selected = [...new Set(ids)]
  if (!selected.length) return
  const revision = journal.revision
  const name = selected.length === 1 ? journal.data.customRecipes.find(recipe => recipe.id === selected[0])?.name : ''
  const fail = (message: string) => onError ? onError(message) : uni.showToast({ title: message, icon: 'none' })
  uni.showModal({ title: '完整删除自建菜谱？', content: `${name ? '「' + name + '」' : selected.length + ' 份自建菜谱'}的名称、配料、照片和隐藏标记会从本机菜谱库删除，不能直接撤销。已有计划和已吃记录保留；删除后计划改用默认图。旧备份仍可能包含菜谱，需恢复时可使用备份。`, confirmText: '删除菜谱', confirmColor: '#9e543f', success: result => {
    if (!result.confirm) return
    if (revision !== journal.revision) { fail('数据已变化，请重新选择要删除的菜谱'); return }
    try { journal.deleteCustomRecipes(selected) }
    catch (error) { fail(error instanceof Error ? error.message : '删除未保存，原数据保留，请重试'); return }
    onDeleted(selected)
  } })
}
