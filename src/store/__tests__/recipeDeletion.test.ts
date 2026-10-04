import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useJournalStore } from '../journal'
import { usePlanStore } from '../plan'
import { recipes } from '@/data/recipes'
import { clone, exportBackup, mergeBackup, parseBackup } from '@/utils/journalPersistence'
import { recipeManagementLists } from '@/utils/recipePhotoManagement'
import { confirmRecipeDeletion } from '@/utils/recipeDeletion'
import { recipePhotoChars } from '@/utils/recipePhotoData'
import { groupEntries } from '@/utils/entryGroups'
import { sumEntries } from '@/utils/nutrition'

const date = '2026-10-05'
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='
const custom = () => ({ ...clone(recipes[0]), id: 'custom_r12', name: '自己的早餐', photo })
let respond: (answer: { confirm: boolean; cancel: boolean }) => void
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 5, 12))
  const storage = new Map<string, string>()
  vi.stubGlobal('uni', {
    getStorageInfoSync: () => ({ keys: [...storage.keys()] }), getStorageSync: (key: string) => storage.get(key),
    setStorageSync: vi.fn((key: string, value: string) => storage.set(key, value)), removeStorageSync: (key: string) => storage.delete(key),
    showModal: vi.fn((options: { success: typeof respond }) => { respond = options.success }),
  })
  setActivePinia(createPinia())
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
function setup() {
  const journal = useJournalStore(), plan = usePlanStore(); journal.refresh(); journal.saveCustomRecipe(custom())
  return { journal, plan }
}
function lists(journal: ReturnType<typeof useJournalStore>) {
  return recipeManagementLists(journal.data.customRecipes, journal.data.hiddenRecipeIds, journal.data.deletedRecipeIds)
}

describe('delete any local recipe without touching historical intake', () => {
  it('removes a preset from both catalogs and persists its deletion across reload and backup', () => {
    const { journal } = setup(), catalog = clone(recipes)
    journal.deleteRecipes([recipes[0].id])
    expect(lists(journal).existing.some(item => item.id === recipes[0].id)).toBe(false)
    expect(lists(journal).hidden).toEqual([])
    expect(journal.data.customRecipes).toHaveLength(1)
    expect(recipes).toEqual(catalog)
    const saved = parseBackup(exportBackup(journal.data))
    expect(saved.deletedRecipeIds).toEqual([recipes[0].id])
    setActivePinia(createPinia()); const loaded = useJournalStore(); loaded.refresh()
    expect(loaded.data).toEqual(saved)
    expect(lists(loaded).existing.some(item => item.id === recipes[0].id)).toBe(false)
  })
  it('deletes hidden presets and custom recipes together, including photos and hidden markers, in one write', () => {
    const { journal } = setup(); journal.hideRecipes([recipes[0].id, recipes[1].id, custom().id])
    vi.mocked(uni.setStorageSync).mockClear()
    journal.deleteRecipes([recipes[0].id, custom().id, recipes[0].id])
    expect(journal.data.customRecipes).toEqual([]); expect(recipePhotoChars(journal.data.customRecipes)).toBe(0)
    expect(journal.data.deletedRecipeIds).toEqual([recipes[0].id])
    expect(journal.data.hiddenRecipeIds).toEqual([recipes[1].id])
    expect(lists(journal).hidden.map(item => item.id)).toEqual([recipes[1].id])
    expect(uni.setStorageSync).toHaveBeenCalledTimes(1)
  })
  it('keeps two servings, separate food, older dates, profile and grams memory unchanged after mixed deletion', () => {
    const { journal, plan } = setup()
    plan.addRecipeGroup(recipes[0].name, recipes[0].ingredients, recipes[0].id)
    plan.addRecipeGroup(recipes[0].name, recipes[0].ingredients, recipes[0].id)
    journal.planAction(date, journal.todayDay.plans.map(item => item.id), 'eat')
    journal.addEntry(date, journal.allFoods.find(food => food.id === 33)!, 100)
    journal.addEntry('2026-10-04', journal.allFoods[0], 125); plan.rememberGrams(9, 62.5)
    const before = clone(journal.data), groups = clone(groupEntries(journal.todayDay.entries, journal.todayDay.plans))
    journal.deleteRecipes([recipes[0].id, custom().id])
    expect(journal.data.days).toEqual(before.days); expect(journal.data.profile).toEqual(before.profile)
    expect(journal.data.gramsMemory).toEqual(before.gramsMemory); expect(journal.data.startDate).toBe(before.startDate)
    expect(groupEntries(journal.todayDay.entries, journal.todayDay.plans)).toEqual(groups)
    expect(groups.map(group => group.entries.length)).toEqual([3, 3, 1])
  })
  it('still allows pending confirmation, precise gram editing, undo and plan removal after preset deletion', () => {
    const { journal, plan } = setup(); const source = recipes[0]
    plan.addRecipeGroup(source.name, source.ingredients, source.id)
    const ids = journal.todayDay.plans.map(item => item.id)
    journal.deleteRecipes([source.id]); journal.planAction(date, ids, 'eat')
    const before = clone(journal.todayDay), total = sumEntries(before.entries)
    journal.updateEntry(date, before.entries[0].id, 62.5)
    expect(sumEntries(journal.todayDay.entries).kcal).not.toBe(total.kcal)
    journal.undoDay(); expect(journal.todayDay).toEqual(before)
    journal.planAction(date, ids, 'remove')
    expect(journal.todayDay.entries).toEqual(before.entries)
    expect(groupEntries(journal.todayDay.entries)[0].name).toBe(source.name)
    expect(sumEntries(journal.todayDay.entries)).toEqual(total)
  })
  it('cannot resurrect a deleted preset by restoring or hiding it', () => {
    const { journal } = setup(); journal.hideRecipes([recipes[0].id]); journal.deleteRecipes([recipes[0].id])
    journal.restoreRecipes([recipes[0].id])
    expect(lists(journal).existing.some(item => item.id === recipes[0].id)).toBe(false)
    expect(() => journal.hideRecipes([recipes[0].id, recipes[1].id])).toThrow('已删除')
    expect(journal.data.hiddenRecipeIds).toEqual([])
  })
  it('atomically rejects unknown or already-deleted targets in a mixed selection', () => {
    const { journal } = setup(), before = clone(journal.data)
    expect(() => journal.deleteRecipes([custom().id, 'missing'])).toThrow('已变化')
    expect(journal.data).toEqual(before)
    journal.deleteRecipes([recipes[0].id]); const after = clone(journal.data)
    expect(() => journal.deleteRecipes([recipes[0].id, custom().id])).toThrow('已变化')
    expect(journal.data).toEqual(after)
  })
  it('keeps persisted and in-memory data, revision and retry selection untouched when storage fails', () => {
    const { journal } = setup(), before = clone(journal.data), stored = uni.getStorageSync('journal-v2'), revision = journal.revision
    vi.mocked(uni.setStorageSync).mockImplementation(() => { throw new Error('full') })
    expect(() => journal.deleteRecipes([recipes[0].id, custom().id])).toThrow('数据未保存')
    expect(journal.data).toEqual(before); expect(uni.getStorageSync('journal-v2')).toBe(stored); expect(journal.revision).toBe(revision)
  })
  it('does not write for an empty selection', () => {
    const { journal } = setup(); vi.mocked(uni.setStorageSync).mockClear()
    journal.deleteRecipes([]); expect(uni.setStorageSync).not.toHaveBeenCalled()
  })
  it('counts a mixed confirmation once per recipe and cancelling leaves all data intact', () => {
    const { journal } = setup(), before = clone(journal.data), deleted = vi.fn()
    confirmRecipeDeletion(journal, [recipes[0].id, custom().id, recipes[0].id], deleted)
    expect(vi.mocked(uni.showModal).mock.calls[0][0]?.content).toContain('2 份菜谱')
    respond({ confirm: false, cancel: true }); expect(journal.data).toEqual(before); expect(deleted).not.toHaveBeenCalled()
  })
  it('confirms deletion of a preset by name and invokes feedback only after successful persistence', () => {
    const { journal } = setup(), deleted = vi.fn()
    confirmRecipeDeletion(journal, [recipes[0].id], deleted)
    expect(vi.mocked(uni.showModal).mock.calls[0][0]?.content).toContain(recipes[0].name)
    respond({ confirm: true, cancel: false }); expect(journal.data.deletedRecipeIds).toEqual([recipes[0].id])
    expect(deleted).toHaveBeenCalledWith([recipes[0].id])
  })
  it('blocks stale or failed confirmation without claiming success', () => {
    const { journal } = setup(), deleted = vi.fn(), failed = vi.fn()
    confirmRecipeDeletion(journal, [recipes[0].id], deleted, failed)
    journal.hideRecipes([recipes[1].id]); respond({ confirm: true, cancel: false })
    expect(failed).toHaveBeenCalledWith(expect.stringContaining('数据已变化')); expect(deleted).not.toHaveBeenCalled()
    confirmRecipeDeletion(journal, [recipes[0].id], deleted, failed)
    vi.mocked(uni.setStorageSync).mockImplementation(() => { throw new Error('full') })
    respond({ confirm: true, cancel: false }); expect(journal.data.deletedRecipeIds).toBeUndefined()
    expect(failed).toHaveBeenLastCalledWith(expect.stringContaining('数据未保存')); expect(deleted).not.toHaveBeenCalled()
  })
})

describe('optional preset deletion markers and backup compatibility', () => {
  it('reads old backups without markers and rejects malformed or duplicate markers', () => {
    const { journal } = setup(); expect(parseBackup(exportBackup(journal.data)).deletedRecipeIds).toBeUndefined()
    for (const markers of ['r1', [42], [''], ['r1', 'r1']]) {
      const invalid = { ...clone(journal.data), deletedRecipeIds: markers }
      expect(() => parseBackup(JSON.stringify({ format: 'yikou-backup', version: 2, data: invalid }))).toThrow()
    }
  })
  it('ignores conflicting hidden markers for deleted recipes and keeps unknown old hidden markers manageable', () => {
    const result = recipeManagementLists([], [recipes[0].id, 'legacy_missing'], [recipes[0].id])
    expect(result.hidden).toEqual([{ id: 'legacy_missing', recipe: undefined }])
    expect(result.existing.some(item => item.id === recipes[0].id)).toBe(false)
  })
  it('retains local deletion preferences when merging an older backup and imports its missing history', () => {
    const { journal } = setup(), old = clone(journal.data)
    journal.addEntry('2026-10-04', journal.allFoods[0], 125); const incoming = clone(journal.data)
    journal.importData(old, 'replace'); journal.deleteRecipes([recipes[0].id])
    const merged = mergeBackup(journal.data, incoming)
    expect(merged.deletedRecipeIds).toEqual([recipes[0].id]); expect(merged.days['2026-10-04']).toEqual(incoming.days['2026-10-04'])
    journal.importData(incoming, 'merge'); expect(lists(journal).existing.some(item => item.id === recipes[0].id)).toBe(false)
  })
  it('keeps local catalog preferences rather than deleting local presets during an incoming merge', () => {
    const { journal } = setup(), local = clone(journal.data)
    journal.deleteRecipes([recipes[0].id])
    const merged = mergeBackup(local, journal.data)
    expect(merged.deletedRecipeIds).toBeUndefined()
    expect(recipeManagementLists(merged.customRecipes, merged.hiddenRecipeIds, merged.deletedRecipeIds).existing.some(item => item.id === recipes[0].id)).toBe(true)
  })
  it('restores deletion preferences on full replace and can undo importing an older pre-deletion backup', () => {
    const { journal } = setup(), before = clone(journal.data)
    journal.deleteRecipes([recipes[0].id]); const deleted = parseBackup(exportBackup(journal.data))
    journal.importData(before, 'replace'); expect(lists(journal).existing.some(item => item.id === recipes[0].id)).toBe(true)
    journal.undoImport(); expect(journal.data).toEqual(deleted)
    journal.importData(before, 'replace'); journal.importData(deleted, 'replace')
    expect(lists(journal).existing.some(item => item.id === recipes[0].id)).toBe(false)
  })
})
