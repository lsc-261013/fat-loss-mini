import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useJournalStore } from '../journal'
import { usePlanStore } from '../plan'
import { recipes } from '@/data/recipes'
import type { Recipe } from '@/data/recipes'
import foods from '@/static/foods.json'
import { clone, exportBackup, parseBackup, mergeBackup } from '@/utils/journalPersistence'
import { recipeImage } from '@/utils/foodVisuals'
import { defaultRecipeGrams, portionStep } from '@/utils/foodPortions'
import { emptyJournal } from '@/types/journal'
import { MAX_PHOTO_BYTES, MAX_RECIPE_PHOTO_CHARS } from '@/utils/recipePhotoData'

const date = '2026-10-04'
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='
const custom = (): Recipe => ({ ...clone(recipes[0]), id: 'custom_test', name: '我的早餐', photo })
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 4, 12))
  const storage = new Map<string, string>()
  vi.stubGlobal('uni', { getStorageInfoSync: () => ({ keys: [...storage.keys()] }), getStorageSync: (key: string) => storage.get(key), setStorageSync: vi.fn((key: string, value: string) => storage.set(key, value)) })
  setActivePinia(createPinia())
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('practical recipe starting amounts', () => {
  it('uses small oil, nut and spread amounts with usable increments', () => {
    for (const id of [41, 42, 46]) { const food = foods.find(food => food.id === id)!; expect(defaultRecipeGrams(food)).toBe(5); expect(portionStep(food)).toBe(1) }
    for (const [id, grams] of [[43, 50], [44, 15], [45, 10], [47, 15]]) expect(defaultRecipeGrams(foods.find(food => food.id === id)!)).toBe(grams)
    expect(portionStep(foods.find(food => food.id === 44)!)).toBe(5)
  })
  it('distinguishes dry oats/noodles, eggs, cooked rice and vegetables', () => {
    for (const [id, grams] of [[1, 150], [9, 40], [10, 60], [13, 50], [21, 150]]) expect(defaultRecipeGrams(foods.find(food => food.id === id)!)).toBe(grams)
    expect(foods.map(defaultRecipeGrams).every(grams => grams > 0 && grams <= 5000)).toBe(true)
  })
  it('keeps custom reference portions but never uses a whole oil package as a starting amount', () => {
    const food = { ...foods[0], id: 100000, customKey: 'custom_food', portionGrams: 125 }
    expect(defaultRecipeGrams(food)).toBe(125)
    expect(defaultRecipeGrams({ ...food, name: '花生油', category: 'fat', portionGrams: 100 })).toBe(5)
    expect(defaultRecipeGrams({ ...food, name: '橄榄油（冷榨）', category: 'fat', portionGrams: 100 })).toBe(5)
    expect(defaultRecipeGrams({ ...food, name: '核桃仁', category: 'fat', portionGrams: 100 })).toBe(15)
    expect(defaultRecipeGrams({ ...food, name: '花生酱', category: 'fat', portionGrams: 100 })).toBe(10)
    expect(defaultRecipeGrams({ ...food, name: '牛油果', category: 'fat', portionGrams: 100 })).toBe(50)
    expect(defaultRecipeGrams({ ...food, portionGrams: 0, category: 'vegetable' })).toBe(150)
  })
})

describe('recipe editing and portable photos', () => {
  it('updates the original ID without duplicating or changing existing plans, actual intake or memory', () => {
    const journal = useJournalStore(), plan = usePlanStore(); journal.refresh()
    journal.saveCustomRecipe(custom()); plan.addRecipeGroup(custom().name, custom().ingredients)
    journal.planAction(date, journal.todayDay.plans.map(item => item.id), 'eat')
    plan.rememberGrams(41, 100)
    const before = clone(journal.todayDay), memory = clone(journal.data.gramsMemory)
    const draft = clone(journal.data.customRecipes[0]); draft.name = '燕麦早餐改版'; draft.ingredients[0].grams = 50
    expect(journal.data.customRecipes[0].ingredients[0].grams).toBe(40)
    journal.saveCustomRecipe(draft, draft.id)
    expect(journal.data.customRecipes).toHaveLength(1)
    expect(journal.data.customRecipes[0]).toMatchObject({ id: 'custom_test', name: '燕麦早餐改版', totalKcal: 421.5, photo })
    expect(journal.todayDay).toEqual(before); expect(journal.data.gramsMemory).toEqual(memory)
    setActivePinia(createPinia()); const restored = useJournalStore(); restored.refresh()
    expect(restored.data.customRecipes).toEqual(journal.data.customRecipes); expect(restored.todayDay).toEqual(before)
  })
  it('rejects missing or mismatched editing IDs and duplicate creates', () => {
    const journal = useJournalStore(); journal.refresh(); journal.saveCustomRecipe(custom())
    const before = clone(journal.data)
    expect(() => journal.saveCustomRecipe(custom(), 'missing')).toThrow()
    expect(() => journal.saveCustomRecipe({ ...custom(), id: 'changed' }, 'custom_test')).toThrow()
    expect(() => journal.saveCustomRecipe(custom())).toThrow()
    expect(journal.data).toEqual(before)
  })
  it('retains all data when storage fails while editing the name, ingredients and photo', () => {
    const journal = useJournalStore(); journal.refresh(); journal.saveCustomRecipe(custom())
    const before = clone(journal.data), draft = { ...custom(), name: '新名字', ingredients: [{ foodId: 41, grams: 5 }] }
    delete draft.photo
    vi.mocked(uni.setStorageSync).mockImplementation(() => { throw new Error('full') })
    expect(() => journal.saveCustomRecipe(draft, draft.id)).toThrow(); expect(journal.data).toEqual(before)
  })
  it('includes the photo in export/restore/merge, and accepts old recipes without photos', () => {
    const journal = useJournalStore(); journal.refresh(); journal.saveCustomRecipe(custom())
    const backup = parseBackup(exportBackup(journal.data))
    expect(backup).toEqual(journal.data); expect(recipeImage(backup.customRecipes[0])).toBe(photo)
    expect(mergeBackup(emptyJournal(date), backup).customRecipes[0].photo).toBe(photo)
    journal.importData(backup, 'replace'); expect(journal.data.customRecipes[0].photo).toBe(photo)
    const old = { ...custom() }; delete old.photo; journal.saveCustomRecipe(old, old.id)
    expect(parseBackup(exportBackup(journal.data)).customRecipes[0].photo).toBeUndefined()
    expect(recipeImage(journal.data.customRecipes[0])).toBe('')
  })
  it.each(['https://example.com/photo.jpg', 'wxfile://tmp_photo.jpg', 'blob:photo', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,bm90LWEtcGhvdG8='])('rejects non-portable or invalid photo %s without replacing a recipe', invalid => {
    const journal = useJournalStore(); journal.refresh(); journal.saveCustomRecipe(custom()); const before = clone(journal.data)
    expect(() => journal.saveCustomRecipe({ ...custom(), photo: invalid }, 'custom_test')).toThrow()
    expect(journal.data).toEqual(before)
  })
  it('bounds photo size and the combined photo budget, leaving existing records intact', () => {
    const journal = useJournalStore(); journal.refresh(); const before = clone(journal.data)
    const large = 'data:image/jpeg;base64,/9j/' + 'A'.repeat(4 * Math.ceil((MAX_PHOTO_BYTES + 3) / 3))
    expect(() => journal.saveCustomRecipe({ ...custom(), photo: large })).toThrow()
    const bounded = 'data:image/jpeg;base64,/9j/' + 'A'.repeat(40000)
    expect(() => journal.mutate(next => { next.customRecipes = Array.from({ length: Math.ceil(MAX_RECIPE_PHOTO_CHARS / bounded.length) + 1 }, (_, i) => ({ ...custom(), id: 'custom_' + i, photo: bounded })) })).toThrow()
    expect(journal.data).toEqual(before)
  })
})
