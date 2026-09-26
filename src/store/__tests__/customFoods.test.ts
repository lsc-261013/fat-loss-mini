import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useJournalStore } from '../journal'
import { usePlanStore } from '../plan'
import { normalizeCustomFood, suggestCategory, type CustomFoodInput } from '@/utils/customFoods'
import { createEntry, foodPortion, recipeNutrition, sumEntries } from '@/utils/nutrition'
import { clone, exportBackup, mergeBackup, parseBackup } from '@/utils/journalPersistence'
import { validateJournal } from '@/utils/journalValidation'
import { emptyDay, emptyJournal } from '@/types/journal'
import foods from '@/static/foods.json'
const date = '2026-09-26'
const base: CustomFoodInput = { name: '测试酸奶', grams: '150', energy: '180', unit: 'kcal', category: 'protein', carbs: '', protein: '', fat: '' }
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 26, 12))
  const storage = new Map<string, string>()
  vi.stubGlobal('uni', { getStorageInfoSync: () => ({ keys: [...storage.keys()] }), getStorageSync: (key: string) => storage.get(key), setStorageSync: vi.fn((key: string, value: string) => storage.set(key, value)), removeStorageSync: (key: string) => storage.delete(key) })
  setActivePinia(createPinia())
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
describe('custom food input and normalization', () => {
  it('normalizes a known portion and preserves unknown vs explicit zero macros', () => {
    expect(normalizeCustomFood({ ...base, protein: '12', fat: '0' })).toMatchObject({ kcal: 120, portionGrams: 150, protein: 8, carbs: null, fat: 0 })
    const food = { ...normalizeCustomFood(base), id: 100000, customKey: 'x' }
    expect(foodPortion(food, 75)).toEqual({ subtotalKcal: 90, subtotalCarbs: null, subtotalProtein: null, subtotalFat: null })
  })
  it('converts kJ to kcal and permits zero-energy foods', () => {
    expect(normalizeCustomFood({ ...base, energy: '753.12', unit: 'kJ' }).kcal).toBe(120)
    expect(normalizeCustomFood({ ...base, energy: '0' }).kcal).toBe(0)
  })
  it.each([
    { grams: '' }, { grams: '0' }, { grams: '-1' }, { grams: '5001' },
    { energy: '' }, { energy: '-1' }, { energy: 'Infinity' }, { energy: '1501' },
    { name: '   ' }, { category: 'unknown' }, { protein: '-1' }, { fat: '151' },
    { carbs: '100', protein: '100' },
  ])('rejects malformed input %j', patch => { expect(() => normalizeCustomFood({ ...base, ...patch })).toThrow() })
  it.each([['低脂酸奶', 'protein'], ['蒸紫薯', 'staple'], ['秋葵', 'vegetable'], ['火龙果', 'fruit'], ['自榨橄榄油', 'fat'], ['核桃仁', 'fat'], ['油麦菜', 'vegetable'], ['南瓜籽', 'fat'], ['玉米油', 'fat'], ['蛋白棒', 'other'], ['水果沙拉', 'other'], ['不认识的食物', 'other']])('suggests category for %s without using calories', (name, expected) => { expect(suggestCategory(name)).toBe(expected) })
})
describe('custom food persistence and use', () => {
  it('persists the catalog and preserves old data when adding a food', () => {
    const store = useJournalStore(); store.refresh(); store.addEntry(date, foods[0], 100)
    const day = clone(store.todayDay), food = store.addCustomFood(base)
    expect(store.todayDay).toEqual(day); expect(store.allFoods.find(item => item.id === food.id)).toEqual(food)
    setActivePinia(createPinia()); const restored = useJournalStore(); restored.refresh()
    expect(restored.allFoods.find(item => item.id === food.id)).toEqual(food)
    expect(() => restored.addCustomFood({ ...base, name: '  测试酸奶 ' })).toThrow(/同名/)
  })
  it('keeps the catalog and records unchanged on failed storage', () => {
    const store = useJournalStore(); store.refresh(); const before = clone(store.data)
    vi.mocked(uni.setStorageSync).mockImplementation(() => { throw new Error('full') })
    expect(() => store.addCustomFood(base)).toThrow(); expect(store.data).toEqual(before)
  })
  it('keeps unknown totals unknown when combined with built-in foods and when editing', () => {
    const store = useJournalStore(); store.refresh(); const food = store.addCustomFood({ ...base, protein: '12', fat: '0' })
    const entry = store.addEntry(date, food, 75); store.addEntry(date, foods[0], 100)
    expect(sumEntries(store.todayDay.entries)).toMatchObject({ kcal: 206, carbs: null, protein: 8.6, fat: .3 })
    store.updateEntry(date, entry.id, 150)
    expect(sumEntries(store.todayDay.entries)).toMatchObject({ kcal: 296, carbs: null, protein: 14.6 })
    store.deleteEntries(date, [entry.id]); expect(sumEntries(store.todayDay.entries).carbs).toBe(25.9)
  })
  it('supports recipe → plan → eaten → revoke with precise heat and missing macros', () => {
    const store = useJournalStore(); store.refresh(); const food = store.addCustomFood(base), plan = usePlanStore()
    const ingredients = [{ foodId: food.id, grams: 150 }, { foodId: foods[0].id, grams: 100 }]
    const nutrition = recipeNutrition(ingredients, store.allFoods)
    expect(nutrition).toMatchObject({ totalKcal: 296, totalProtein: null, totalCarbs: null })
    store.mutate(next => next.customRecipes.push({ id: 'custom-test', name: '自定义搭配', type: 'standard', mealTime: 'lunch', description: '', ingredients, ...nutrition }))
    plan.addRecipeGroup('自定义搭配', ingredients)
    const ids = store.todayDay.plans.map(item => item.id)
    store.planAction(date, ids, 'eat'); expect(sumEntries(store.todayDay.entries)).toMatchObject({ kcal: 296, protein: null })
    store.planAction(date, ids, 'revoke'); expect(store.todayDay.entries).toEqual([])
    expect(store.todayDay.plans.every(item => !item.eaten)).toBe(true)
  })
})
describe('custom food backups and old data compatibility', () => {
  it('round-trips new backups and continues to accept old v2 backups without a catalog', () => {
    const old = emptyJournal(date); expect(parseBackup(exportBackup(old))).toEqual(old)
    expect(JSON.parse(exportBackup(old)).version).toBe(2)
    const store = useJournalStore(); store.refresh(); const food = store.addCustomFood(base); store.addEntry(date, food, 150)
    const backup = exportBackup(store.data)
    expect(JSON.parse(backup).version).toBe(3); expect(parseBackup(backup)).toEqual(store.data)
    const incoming = parseBackup(backup); store.importData(old, 'replace'); store.importData(incoming, 'replace')
    expect(store.allFoods.some(item => item.customKey === food.customKey)).toBe(true)
  })
  it('remaps colliding numeric IDs in plans, records, recipes and portion memory', () => {
    const store = useJournalStore(); store.refresh(); const localFood = store.addCustomFood(base)
    const incoming = emptyJournal(date), otherFood = { ...localFood, customKey: 'different-device', name: '另一种酸奶', kcal: 80 }
    incoming.customFoods = [otherFood]; incoming.days[date] = emptyDay(); incoming.gramsMemory[otherFood.id] = 250
    incoming.days[date].entries = [createEntry(otherFood, 100)]
    incoming.days[date].plans = [{ id: 'incoming-plan', foodId: otherFood.id, foodName: otherFood.name, category: otherFood.category, grams: 100, kcal: 80, eaten: false }]
    incoming.customRecipes = [{ id: 'incoming-recipe', name: '备份菜谱', type: 'standard', mealTime: 'lunch', description: '', ingredients: [{ foodId: otherFood.id, grams: 100 }], totalKcal: 80, totalCarbs: null, totalProtein: null, totalFat: null }]
    const before = clone(incoming), merged = mergeBackup(store.data, incoming)
    const newId = merged.customFoods!.find(food => food.customKey === otherFood.customKey)!.id
    expect(newId).not.toBe(localFood.id); expect(incoming).toEqual(before)
    expect(merged.days[date].entries[0].food.id).toBe(newId); expect(merged.days[date].plans[0].foodId).toBe(newId)
    expect(merged.customRecipes[0].ingredients[0].foodId).toBe(newId); expect(merged.gramsMemory[newId]).toBe(250)
    store.importData(merged, 'replace'); store.planAction(date, ['incoming-plan'], 'eat')
    expect(sumEntries(store.todayDay.entries).kcal).toBe(160)
    expect(mergeBackup(merged, incoming).customFoods).toHaveLength(2)
  })
  it('rejects conflicting identities, invalid catalog IDs and inconsistent unknown flags', () => {
    const store = useJournalStore(); store.refresh(); const food = store.addCustomFood(base)
    const incoming = clone(store.data); incoming.customFoods![0].kcal = 200
    expect(() => mergeBackup(store.data, incoming)).toThrow(/差异/)
    const invalid = clone(store.data); invalid.customFoods![0].id = 1
    expect(() => validateJournal(invalid)).toThrow()
    store.addEntry(date, food, 100); const badRecord = clone(store.data); badRecord.days[date].entries[0].subtotalCarbs = 0
    expect(() => validateJournal(badRecord)).toThrow(/不一致/)
  })
})
