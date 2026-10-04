import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useJournalStore } from '../journal'
import { usePlanStore } from '../plan'
import { recipes, type Recipe } from '@/data/recipes'
import { clone, exportBackup, parseBackup, mergeBackup } from '@/utils/journalPersistence'
import { emptyJournal } from '@/types/journal'
import { initialRecipeMeal } from '@/utils/recipeMeals'
import { recipePhotoChars, MAX_RECIPE_PHOTO_CHARS, RecipePhotoLimitError } from '@/utils/recipePhotoData'

const date = '2026-10-04'
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='
const custom = (): Recipe => ({ ...clone(recipes[0]), id: 'custom_r8', name: '收尾测试早餐', photo })
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 4, 12))
  const storage = new Map<string, string>()
  vi.stubGlobal('uni', { getStorageInfoSync: () => ({ keys: [...storage.keys()] }), getStorageSync: (key: string) => storage.get(key), setStorageSync: vi.fn((key: string, value: string) => storage.set(key, value)) })
  setActivePinia(createPinia())
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

function withHistory() {
  const journal = useJournalStore(), plan = usePlanStore(); journal.refresh()
  journal.saveCustomRecipe(custom())
  plan.addRecipeGroup(custom().name, custom().ingredients)
  journal.planAction(date, journal.todayDay.plans.map(item => item.id), 'eat')
  plan.rememberGrams(9, 40)
  journal.addEntry('2026-10-03', journal.allFoods[0], 100)
  return journal
}

describe('recipe meal selection', () => {
  it.each(['breakfast', 'lunch', 'dinner', 'snack'] as const)('seeds new %s recipes from the active meal, but preserves the original meal when editing', meal => {
    expect(initialRecipeMeal(null, meal)).toBe(meal)
    expect(initialRecipeMeal(custom(), meal)).toBe('breakfast')
  })
  it('uses a visible lunch default for all/custom filters and does not guess from the name', () => {
    expect(initialRecipeMeal(null, 'all')).toBe('lunch')
    expect(initialRecipeMeal(null, 'custom')).toBe('lunch')
    expect(initialRecipeMeal({ ...custom(), name: '早餐燕麦', mealTime: 'dinner' })).toBe('dinner')
  })
  it('persists a meal-only edit on the same ID without changing old plans/intake, photos or grams memory', () => {
    const journal = withHistory(), days = clone(journal.data.days), memory = clone(journal.data.gramsMemory)
    const before = clone(journal.data.customRecipes[0]), draft = { ...clone(before), mealTime: 'snack' as const }
    expect(journal.data.customRecipes[0]).toEqual(before)
    journal.saveCustomRecipe(draft, draft.id)
    expect(journal.data.customRecipes).toEqual([draft])
    expect(journal.data.days).toEqual(days); expect(journal.data.gramsMemory).toEqual(memory)
    setActivePinia(createPinia()); const restored = useJournalStore(); restored.refresh()
    expect(restored.data.customRecipes[0].mealTime).toBe('snack'); expect(restored.data.days).toEqual(days)
    expect(parseBackup(exportBackup(restored.data)).customRecipes[0]).toEqual(draft)
  })
  it('rejects an invalid meal without changing stored or in-memory data', () => {
    const journal = withHistory(), before = clone(journal.data), stored = uni.getStorageSync('journal-v2')
    expect(() => journal.saveCustomRecipe({ ...custom(), mealTime: 'all' as Recipe['mealTime'] }, custom().id)).toThrow('餐次无效')
    expect(journal.data).toEqual(before); expect(uni.getStorageSync('journal-v2')).toBe(stored)
  })
})

describe('hidden recipe recovery and photo cleanup', () => {
  it('hides/restores preset and custom recipes without changing photos, historical snapshots or other hidden IDs', () => {
    const journal = withHistory(), days = clone(journal.data.days), recipe = clone(journal.data.customRecipes[0])
    journal.hideRecipes(['r2', 'legacy_missing'])
    journal.hideRecipes([recipe.id, recipe.id, 'r1'])
    expect(journal.data.hiddenRecipeIds).toEqual(['r2', 'legacy_missing', recipe.id, 'r1'])
    expect(recipePhotoChars(journal.data.customRecipes)).toBe(photo.length)
    journal.restoreRecipes([recipe.id, 'r1'])
    expect(journal.data.hiddenRecipeIds).toEqual(['r2', 'legacy_missing'])
    expect(journal.data.customRecipes[0]).toEqual(recipe); expect(journal.data.days).toEqual(days)
    setActivePinia(createPinia()); const restored = useJournalStore(); restored.refresh()
    expect(restored.data.hiddenRecipeIds).toEqual(['r2', 'legacy_missing']); expect(restored.data.customRecipes[0]).toEqual(recipe)
  })
  it('removes only the hidden recipe photo and keeps its text, exact ingredients, hidden state, history and memory', () => {
    const journal = withHistory(); journal.hideRecipes([custom().id])
    const before = clone(journal.data), expected = clone(before); delete expected.customRecipes[0].photo
    journal.removeRecipePhoto(custom().id)
    expect(journal.data).toEqual(expected); expect(recipePhotoChars(journal.data.customRecipes)).toBe(0)
    setActivePinia(createPinia()); const restored = useJournalStore(); restored.refresh()
    expect(restored.data).toEqual(expected)
    // Restoring the old hide action must not resurrect a cleared photo.
    restored.restoreRecipes([custom().id]); expect(restored.data.customRecipes[0].photo).toBeUndefined()
    expect(restored.data.days).toEqual(before.days)
  })
  it.each(['hide', 'restore', 'clear', 'meal'] as const)('retains persisted and memory data when %s fails to save', action => {
    const journal = withHistory(); journal.hideRecipes([custom().id])
    const before = clone(journal.data), stored = uni.getStorageSync('journal-v2'), revision = journal.revision
    vi.mocked(uni.setStorageSync).mockImplementation(() => { throw new Error('full') })
    expect(() => {
      if (action === 'hide') journal.hideRecipes(['r2'])
      if (action === 'restore') journal.restoreRecipes([custom().id])
      if (action === 'clear') journal.removeRecipePhoto(custom().id)
      if (action === 'meal') journal.saveCustomRecipe({ ...custom(), mealTime: 'dinner' }, custom().id)
    }).toThrow('数据未保存')
    expect(journal.data).toEqual(before); expect(uni.getStorageSync('journal-v2')).toBe(stored); expect(journal.revision).toBe(revision)
  })
  it('counts hidden photos toward the real budget, releases space and permits a new photo after cleanup', () => {
    const journal = withHistory(), days = clone(journal.data.days)
    const bounded = 'data:image/jpeg;base64,/9j/' + 'A'.repeat(40000)
    const full = Array.from({ length: Math.floor(MAX_RECIPE_PHOTO_CHARS / bounded.length) }, (_, i) => ({ ...custom(), id: 'budget_' + i, photo: bounded }))
    journal.mutate(next => { next.customRecipes = full; next.hiddenRecipeIds = [full[0].id] })
    const before = clone(journal.data), used = recipePhotoChars(full)
    expect(() => journal.saveCustomRecipe({ ...custom(), photo: bounded })).toThrow(RecipePhotoLimitError)
    expect(journal.data).toEqual(before)
    journal.removeRecipePhoto(full[0].id)
    expect(recipePhotoChars(journal.data.customRecipes)).toBe(used - bounded.length)
    journal.saveCustomRecipe({ ...custom(), photo: bounded })
    expect(recipePhotoChars(journal.data.customRecipes)).toBe(used)
    expect(journal.data.days).toEqual(days); expect(journal.data.hiddenRecipeIds).toEqual([full[0].id])
  })
  it('exports/restores hidden state and cleared photos; merging retains the existing local cleanup', () => {
    const journal = withHistory(); journal.hideRecipes([custom().id, 'r2'])
    const photographed = parseBackup(exportBackup(journal.data))
    journal.removeRecipePhoto(custom().id)
    const cleared = parseBackup(exportBackup(journal.data))
    journal.importData(photographed, 'replace'); expect(journal.data).toEqual(photographed)
    journal.importData(cleared, 'replace'); expect(journal.data).toEqual(cleared)
    expect(mergeBackup(cleared, photographed)).toEqual(cleared)
    // Existing merge behavior deliberately preserves the local hidden-state settings.
    const merged = mergeBackup(emptyJournal(date), cleared)
    expect(merged.customRecipes[0].photo).toBeUndefined(); expect(merged.hiddenRecipeIds).toEqual([])
  })
  it('supports no-photo recipes and unknown legacy hidden markers without deleting recipe content', () => {
    const journal = withHistory(); journal.removeRecipePhoto(custom().id)
    const before = clone(journal.data)
    journal.removeRecipePhoto(custom().id); expect(journal.data).toEqual(before)
    journal.hideRecipes(['legacy_missing']); journal.restoreRecipes(['legacy_missing'])
    expect(journal.data).toEqual(before)
    expect(() => journal.removeRecipePhoto('missing')).toThrow('菜谱已变化'); expect(journal.data).toEqual(before)
  })
})
