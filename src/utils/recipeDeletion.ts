import type { useJournalStore } from '@/store/journal'
import { recipes } from '@/data/recipes'

function confirmDeletion(journal: ReturnType<typeof useJournalStore>, ids: string[], onDeleted: (ids: string[]) => void, onError: ((message: string) => void) | undefined, customOnly: boolean) {
  const selected = [...new Set(ids)]
  if (!selected.length) return
  const revision = journal.revision
  const name = selected.length === 1 ? [...recipes, ...journal.data.customRecipes].find(recipe => recipe.id === selected[0])?.name : ''
  const fail = (message: string) => onError ? onError(message) : uni.showToast({ title: message, icon: 'none' })
  uni.showModal({ title: '删除菜谱？', content: `${name ? '「' + name + '」' : selected.length + ' 份菜谱'}将从本机食谱列表永久移除，不进入隐藏列表。自建菜谱的文字、配料和自选照片同时删除。已有计划和已吃记录保留，不能直接撤销；需要还原时可完整恢复删除前的备份。`, confirmText: '删除菜谱', confirmColor: '#9e543f', success: result => {
    if (!result.confirm) return
    if (revision !== journal.revision) { fail('数据已变化，请重新选择要删除的菜谱'); return }
    try { customOnly ? journal.deleteCustomRecipes(selected) : journal.deleteRecipes(selected) }
    catch (error) { fail(error instanceof Error ? error.message : '删除未保存，原数据保留，请重试'); return }
    onDeleted(selected)
  } })
}

export function confirmRecipeDeletion(journal: ReturnType<typeof useJournalStore>, ids: string[], onDeleted: (ids: string[]) => void, onError?: (message: string) => void) {
  confirmDeletion(journal, ids, onDeleted, onError, false)
}

export function confirmCustomRecipeDeletion(journal: ReturnType<typeof useJournalStore>, ids: string[], onDeleted: (ids: string[]) => void, onError?: (message: string) => void) {
  confirmDeletion(journal, ids, onDeleted, onError, true)
}
