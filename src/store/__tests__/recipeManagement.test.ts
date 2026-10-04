import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useJournalStore } from '../journal'
import { usePlanStore } from '../plan'
import { recipes, type Recipe } from '@/data/recipes'
import { clone, exportBackup, parseBackup } from '@/utils/journalPersistence'
import { recipePhotoChars } from '@/utils/recipePhotoData'
import { planImage } from '@/utils/foodVisuals'
import { groupPlans } from '@/utils/planGroups'
import { confirmCustomRecipeDeletion } from '@/utils/recipeDeletion'

const date = '2026-10-04'
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='
const custom = (id = 'custom_r9'): Recipe => ({ ...clone(recipes[0]), id, name: '自建早餐', photo })
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 4, 12))
  const storage = new Map<string, string>()
  vi.stubGlobal('uni', { getStorageInfoSync: () => ({ keys: [...storage.keys()] }), getStorageSync: (key: string) => storage.get(key), setStorageSync: vi.fn((key: string, value: string) => storage.set(key, value)), showModal: vi.fn(), showToast: vi.fn() })
  setActivePinia(createPinia())
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

function setup() {
  const journal = useJournalStore(), plan = usePlanStore(); journal.refresh()
  journal.saveCustomRecipe(custom()); journal.saveCustomRecipe(custom('custom_other'))
  plan.addRecipeGroup(custom().name, custom().ingredients, custom().id)
  const image = () => planImage(groupPlans(journal.todayDay.plans, journal.todayDay.entries)[0], journal.data.customRecipes)
  return { journal, plan, image }
}

describe('custom recipe images in plans', () => {
  it('links the entire new dish by recipe ID, persists and backs up the photo reference without copying photo bytes into each ingredient', () => {
    const { journal, image } = setup()
    expect(journal.todayDay.plans.every(item => item.recipeId === custom().id)).toBe(true)
    expect(journal.todayDay.plans.every(item => !('photo' in item))).toBe(true)
    expect(image()).toBe(photo)
    const backup = parseBackup(exportBackup(journal.data))
    setActivePinia(createPinia()); const restored = useJournalStore(); restored.refresh()
    expect(restored.todayDay.plans).toEqual(backup.days[date].plans)
    expect(planImage(groupPlans(restored.todayDay.plans)[0], restored.data.customRecipes)).toBe(photo)
  })
  it('retains imagery after hiding/editing a source or editing actual intake, without changing planned grams', () => {
    const { journal, image } = setup(), before = clone(journal.todayDay.plans)
    journal.hideRecipes([custom().id]); expect(image()).toBe(photo)
    journal.saveCustomRecipe({ ...custom(), name: '改名后的搭配' }, custom().id); expect(image()).toBe(photo)
    journal.saveCustomRecipe({ ...custom(), ingredients: [{ foodId: 9, grams: 50 }] }, custom().id); expect(image()).toBe(photo)
    journal.planAction(date, before.map(item => item.id), 'eat')
    journal.updateEntry(date, journal.todayDay.entries[0].id, 33); expect(image()).toBe(photo)
    journal.undoDay(); expect(image()).toBe(photo)
    expect(journal.todayDay.plans.map(item => item.grams)).toEqual(before.map(item => item.grams))
  })
  it('uses only a unique complete legacy name/ingredient match, including hidden recipes', () => {
    const { journal } = setup()
    const legacy = groupPlans(journal.todayDay.plans.map(({ recipeId: _id, ...item }) => item))[0]
    expect(planImage(legacy, [custom()])).toBe(photo)
    expect(planImage(legacy, [custom(), custom('duplicate')])).toBe('')
    expect(planImage(groupPlans(legacy.items.slice(0, 1))[0], [custom()])).toBe('')
  })
  it('never falls back to a same-name source when an explicit source was deleted or references disagree', () => {
    const { journal, image } = setup()
    journal.deleteCustomRecipes([custom().id]); expect(image()).toBe('')
    const group = groupPlans(journal.todayDay.plans)[0]
    expect(planImage(groupPlans(group.items.map((item, i) => ({ ...item, recipeId: i ? 'custom_other' : custom().id })))[0], [custom(), custom('custom_other')])).toBe('')
  })
  it('rejects malformed optional references, while allowing old plans and dangling deleted sources', () => {
    const { journal } = setup(), backup = clone(journal.data)
    backup.days[date].plans[0].recipeId = 123 as unknown as string
    expect(() => exportBackup(backup)).toThrow('文字字段无效')
    journal.deleteCustomRecipes([custom().id]); expect(() => exportBackup(journal.data)).not.toThrow()
  })
})

describe('complete deletion and batch hidden management', () => {
  it('fully removes selected recipes/photos/hidden markers but preserves all day snapshots, profile, foods and grams memory', () => {
    const { journal, plan } = setup()
    journal.planAction(date, journal.todayDay.plans.map(item => item.id), 'eat')
    plan.rememberGrams(9, 40); journal.addEntry('2026-10-03', journal.allFoods[0], 100)
    journal.hideRecipes([custom().id, 'custom_other', 'r2'])
    const before = clone(journal.data), expected = clone(before)
    expected.customRecipes = []; expected.hiddenRecipeIds = ['r2']
    journal.deleteCustomRecipes([custom().id, 'custom_other', custom().id])
    expect(journal.data).toEqual(expected); expect(recipePhotoChars(journal.data.customRecipes)).toBe(0)
    setActivePinia(createPinia()); const restored = useJournalStore(); restored.refresh()
    expect(restored.data).toEqual(expected); expect(parseBackup(exportBackup(restored.data))).toEqual(expected)
    restored.restoreRecipes(['r2']); expect(restored.data.customRecipes).toEqual([])
  })
  it('preserves all persisted and in-memory data on failed deletion', () => {
    const { journal } = setup(); journal.hideRecipes([custom().id])
    const before = clone(journal.data), stored = uni.getStorageSync('journal-v2'), revision = journal.revision
    vi.mocked(uni.setStorageSync).mockImplementation(() => { throw new Error('full') })
    expect(() => journal.deleteCustomRecipes([custom().id])).toThrow('数据未保存')
    expect(journal.data).toEqual(before); expect(uni.getStorageSync('journal-v2')).toBe(stored); expect(journal.revision).toBe(revision)
  })
  it('rejects mixed preset/missing IDs atomically and does not resurrect a deleted recipe when an old edit is saved', () => {
    const { journal } = setup(), before = clone(journal.data)
    expect(() => journal.deleteCustomRecipes([custom().id, 'r2'])).toThrow('不能删除')
    expect(journal.data).toEqual(before)
    journal.deleteCustomRecipes([custom().id])
    expect(() => journal.saveCustomRecipe(custom(), custom().id)).toThrow('已变化')
    expect(journal.data.customRecipes.map(item => item.id)).toEqual(['custom_other'])
  })
  it('batch-restores only selected markers, including presets, keeping every recipe and other hidden item', () => {
    const { journal } = setup(), before = clone(journal.data.customRecipes)
    journal.hideRecipes([custom().id, 'custom_other', 'r2', 'legacy_missing'])
    journal.restoreRecipes([custom().id, 'r2', 'legacy_missing'])
    expect(journal.data.hiddenRecipeIds).toEqual(['custom_other']); expect(journal.data.customRecipes).toEqual(before)
  })
  it('does nothing when deletion confirmation is cancelled', () => {
    const { journal } = setup(), before = clone(journal.data), deleted = vi.fn()
    confirmCustomRecipeDeletion(journal, [custom().id], deleted)
    const options = vi.mocked(uni.showModal).mock.calls[0][0]!
    options.success?.({ confirm: false, cancel: true, errMsg: 'showModal:ok' })
    expect(journal.data).toEqual(before); expect(deleted).not.toHaveBeenCalled()
  })
  it('blocks a stale destructive confirmation after another data mutation', () => {
    const { journal } = setup(), failed = vi.fn(), deleted = vi.fn()
    confirmCustomRecipeDeletion(journal, [custom().id], deleted, failed)
    journal.hideRecipes([custom().id])
    vi.mocked(uni.showModal).mock.calls[0][0]!.success?.({ confirm: true, cancel: false, errMsg: 'showModal:ok' })
    expect(journal.data.customRecipes).toHaveLength(2); expect(deleted).not.toHaveBeenCalled(); expect(failed).toHaveBeenCalledWith(expect.stringContaining('数据已变化'))
  })
})
