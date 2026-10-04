import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useJournalStore } from '../journal'
import { usePlanStore } from '../plan'
import { recipes, type Recipe } from '@/data/recipes'
import { clone, exportBackup, parseBackup } from '@/utils/journalPersistence'
import { calculatedRecipe, foodPortion } from '@/utils/nutrition'
import { createRecipeReplacement, previewRecipeReplacement } from '@/utils/recipeReplacement'
import { photoCleanupCategory, recipeManagementLists, confirmRecipePhotoRemoval } from '@/utils/recipePhotoManagement'
import { recipePhotoChars } from '@/utils/recipePhotoData'
import { groupPlans, planStatusHint } from '@/utils/planGroups'

const date = '2026-10-04'
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='
const custom = (): Recipe => ({ ...clone(recipes[0]), id: 'custom_r10', name: 'R10燕麦鸡蛋餐', photo })
let respond: (answer: { confirm: boolean; cancel: boolean }) => void
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 4, 12))
  const storage = new Map<string, string>()
  vi.stubGlobal('uni', {
    getStorageInfoSync: () => ({ keys: [...storage.keys()] }), getStorageSync: (key: string) => storage.get(key),
    setStorageSync: vi.fn((key: string, value: string) => storage.set(key, value)),
    showModal: vi.fn((options: { success: typeof respond }) => { respond = options.success }),
  })
  setActivePinia(createPinia())
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
function history() {
  const journal = useJournalStore(), plan = usePlanStore(); journal.refresh(); journal.saveCustomRecipe(custom())
  plan.addRecipeGroup(custom().name, custom().ingredients, custom().id)
  journal.planAction(date, [journal.todayDay.plans[0].id], 'eat')
  journal.addEntry('2026-10-03', journal.allFoods[0], 100)
  plan.rememberGrams(9, 40)
  return journal
}

describe('replacement preview and explicit save', () => {
  it('previews different candidates and grams without persisting, and uses the shared nutrition calculation', () => {
    const journal = history(), before = clone(journal.data), stored = uni.getStorageSync('journal-v2'), revision = journal.revision
    const session = createRecipeReplacement(journal, custom(), 0)
    for (const [id, grams] of [[1, 40], [2, 62.5], [1, 100]]) {
      const preview = session.preview(id, grams)!
      expect(preview.afterKcal).toBe(foodPortion(journal.allFoods.find(food => food.id === id)!, grams).subtotalKcal)
      expect(preview.recipe).toEqual(calculatedRecipe({ ...custom(), ingredients: [{ foodId: id, grams }, ...custom().ingredients.slice(1)] }, journal.allFoods))
    }
    // Closing without confirm has no write, including unchanged original calories/macros.
    expect(journal.data).toEqual(before); expect(journal.revision).toBe(revision); expect(uni.getStorageSync('journal-v2')).toBe(stored)
  })
  it.each([null, 9, 13, 99999])('rejects missing, same, other-category or unknown candidate %s', id => {
    const journal = history(), session = createRecipeReplacement(journal, custom(), 0), before = clone(journal.data)
    expect(session.preview(id, 40)).toBeNull(); expect(() => session.confirm(id, 40)).toThrow('请选择同类食材')
    expect(journal.data).toEqual(before)
  })
  it.each(['', 0, -1, 5001, 'oops'])('does not allow invalid grams %s to commit', grams => {
    const journal = history(), session = createRecipeReplacement(journal, custom(), 0), before = clone(journal.data)
    expect(session.preview(1, grams)).toBeNull(); expect(() => session.confirm(1, grams)).toThrow('克数')
    expect(journal.data).toEqual(before)
  })
  it('updates a custom recipe once, preserves photo, days and preferences, and round-trips via refresh and backup', () => {
    const journal = history(), days = clone(journal.data.days), memory = clone(journal.data.gramsMemory)
    const session = createRecipeReplacement(journal, custom(), 0), writes = vi.mocked(uni.setStorageSync).mock.calls.length
    const saved = session.confirm(1, 62.5)!
    expect(saved.id).toBe(custom().id); expect(saved.photo).toBe(photo); expect(saved.ingredients[0]).toEqual({ foodId: 1, grams: 62.5 })
    expect(session.confirm(2, 100)).toBeNull(); expect(vi.mocked(uni.setStorageSync).mock.calls.length).toBe(writes + 1)
    expect(journal.data.days).toEqual(days); expect(journal.data.gramsMemory).toEqual(memory)
    expect(parseBackup(exportBackup(journal.data)).customRecipes[0]).toEqual(saved)
    setActivePinia(createPinia()); const reloaded = useJournalStore(); reloaded.refresh()
    expect(reloaded.data.customRecipes[0]).toEqual(saved); expect(reloaded.data.days).toEqual(days)
  })
  it('saves a preset as one new custom recipe without changing the preset or existing custom sources', () => {
    const journal = history(), preset = clone(recipes[0]), before = clone(journal.data)
    const session = createRecipeReplacement(journal, recipes[0], 0), saved = session.confirm(1, 80)!
    expect(saved.id).toMatch(/^custom_/); expect(saved.id).not.toBe(preset.id); expect(saved.name).toBe(preset.name + '（我的搭配）')
    session.confirm(1, 80); expect(journal.data.customRecipes.length).toBe(2)
    expect(recipes[0]).toEqual(preset); expect(journal.data.customRecipes[0]).toEqual(before.customRecipes[0]); expect(journal.data.days).toEqual(before.days)
  })
  it('keeps a failed save retryable and leaves original storage/data unchanged', () => {
    const journal = history(), before = clone(journal.data), stored = uni.getStorageSync('journal-v2'), session = createRecipeReplacement(journal, custom(), 0)
    vi.mocked(uni.setStorageSync).mockImplementationOnce(() => { throw new Error('quota') })
    expect(() => session.confirm(1, 100)).toThrow(); expect(journal.data).toEqual(before); expect(uni.getStorageSync('journal-v2')).toBe(stored)
    expect(session.preview(1, 100)?.recipe.ingredients[0].grams).toBe(100)
    expect(session.confirm(1, 100)?.id).toBe(custom().id); expect(journal.data.customRecipes.length).toBe(1)
  })
  it('does not resurrect a source deleted while its replacement preview is open', () => {
    const journal = history(), session = createRecipeReplacement(journal, custom(), 0)
    journal.deleteCustomRecipes([custom().id]); const before = clone(journal.data)
    expect(() => session.confirm(1, 100)).toThrow('数据已变化'); expect(journal.data).toEqual(before)
  })
})

describe('photo management categories and atomic cleanup', () => {
  it.each(['visible', 'hidden', 'mixed'] as const)('routes quota cleanup correctly with %s photos and never duplicates lists', scenario => {
    const a = custom(), b = { ...custom(), id: 'custom_r10_b' }
    const hidden = scenario === 'hidden' ? [a.id, b.id] : scenario === 'mixed' ? [b.id] : []
    const lists = recipeManagementLists([a, b], hidden)
    expect(photoCleanupCategory([a, b], hidden)).toBe(scenario === 'hidden' ? 'hidden' : 'existing')
    expect(lists.existing.some(item => hidden.includes(item.id))).toBe(false)
    expect(lists.hidden.map(item => item.id)).toEqual(hidden)
    expect(lists.existing.filter(item => item.recipe.photo).length).toBe(scenario === 'hidden' ? 0 : scenario === 'mixed' ? 1 : 2)
  })
  it('distinguishes preset illustrations, no-photo recipes and unknown legacy hidden markers', () => {
    const a = custom(); delete a.photo
    const lists = recipeManagementLists([a], ['old_missing', a.id, recipes[0].id])
    expect(lists.hidden[0]).toEqual({ id: 'old_missing', recipe: undefined })
    expect(lists.existing.every(item => !item.recipe.photo)).toBe(true)
    expect(photoCleanupCategory([a], [a.id])).toBe('existing')
  })
  it.each([false, true])('cleans %s-hidden recipe only after confirmation, keeping historical snapshots and backup compatibility', hidden => {
    const journal = history(); if (hidden) journal.hideRecipes([custom().id])
    const before = clone(journal.data), saved = vi.fn(), error = vi.fn()
    confirmRecipePhotoRemoval(journal, custom(), saved, error); respond({ confirm: false, cancel: true })
    expect(journal.data).toEqual(before); expect(saved).not.toHaveBeenCalled()
    confirmRecipePhotoRemoval(journal, custom(), saved, error); respond({ confirm: true, cancel: false })
    expect(saved).toHaveBeenCalledTimes(1); expect(error).not.toHaveBeenCalled(); expect(recipePhotoChars(journal.data.customRecipes)).toBe(0)
    const expected = clone(before); delete expected.customRecipes[0].photo
    expect(journal.data).toEqual(expected); expect(parseBackup(exportBackup(journal.data))).toEqual(expected)
  })
  it('never reports freed space on write failure or a stale confirmation', () => {
    const journal = history(), before = clone(journal.data), saved = vi.fn(), error = vi.fn()
    confirmRecipePhotoRemoval(journal, custom(), saved, error)
    vi.mocked(uni.setStorageSync).mockImplementationOnce(() => { throw new Error('quota') }); respond({ confirm: true, cancel: false })
    expect(saved).not.toHaveBeenCalled(); expect(error).toHaveBeenCalled(); expect(journal.data).toEqual(before)
    confirmRecipePhotoRemoval(journal, custom(), saved, error); journal.hideRecipes([custom().id]); respond({ confirm: true, cancel: false })
    expect(saved).not.toHaveBeenCalled(); expect(journal.data.customRecipes[0].photo).toBe(photo)
  })
})

describe('plan hints follow actual pending groups', () => {
  it('handles no plans, partial recipe groups, all confirmed, revocation and historical labels', () => {
    const journal = useJournalStore(), plan = usePlanStore(); journal.refresh()
    const hint = () => { const groups = groupPlans(journal.todayDay.plans, journal.todayDay.entries); return planStatusHint(groups.length, groups.filter(group => group.pendingIds.length).length) }
    expect(hint()).not.toContain('已全部确认')
    plan.addRecipeGroup(custom().name, custom().ingredients, custom().id); journal.addPlan(date, journal.allFoods[0], 100)
    expect(hint()).toBe('2 项待吃 · 吃过再确认')
    journal.planAction(date, [journal.todayDay.plans[0].id], 'eat'); expect(hint()).toBe('2 项待吃 · 吃过再确认')
    journal.planAction(date, journal.todayDay.plans.map(item => item.id), 'eat'); expect(hint()).toBe('今天的计划已全部确认')
    expect(planStatusHint(2, 0, false)).toBe('当日的计划已全部确认')
    journal.planAction(date, [journal.todayDay.plans[0].id], 'revoke'); expect(hint()).toBe('1 项待吃 · 吃过再确认')
  })
})
