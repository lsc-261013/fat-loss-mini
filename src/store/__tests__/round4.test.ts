import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useJournalStore } from '../journal'
import { usePlanStore } from '../plan'
import { useUserStore } from '../user'
import { useJournalNavigation } from '../journalNavigation'
import { groupPlans, planGroupAction } from '@/utils/planGroups'
import { recordingDays } from '@/utils/input'
import { clone, exportBackup, parseBackup } from '@/utils/journalPersistence'
import { recipes } from '@/data/recipes'
import foods from '@/static/foods.json'
import { sumEntries, recipeNutrition } from '@/utils/nutrition'

const date = '2026-09-26'
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 26, 12))
  const storage = new Map<string, string>()
  vi.stubGlobal('uni', { getStorageInfoSync: () => ({ keys: [...storage.keys()] }), getStorageSync: (key: string) => storage.get(key), setStorageSync: vi.fn((key: string, value: string) => storage.set(key, value)) })
  setActivePinia(createPinia())
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('recording start date', () => {
  it.each([
    ['2026-09-26', '2026-09-26', 1], ['2026-09-20', '2026-09-26', 7],
    ['2024-02-28', '2024-03-01', 3], ['2025-12-31', '2026-01-01', 2],
    ['2026-03-07', '2026-03-09', 3],
  ])('counts inclusive calendar dates %s → %s', (start, today, expected) => {
    expect(recordingDays(start, today)).toBe(expected)
  })
  it('persists the date without changing existing records, updates after midnight', () => {
    const journal = useJournalStore(); journal.refresh(); journal.addEntry(date, foods[0], 100)
    const before = clone(journal.todayDay), user = useUserStore()
    user.setStartDate('2026-09-20'); expect(user.streakDays).toBe(7)
    expect(journal.todayDay).toEqual(before)
    setActivePinia(createPinia()); const restored = useUserStore(); restored.loadFromStorage()
    expect(restored.startDate).toBe('2026-09-20'); expect(restored.streakDays).toBe(7)
    vi.setSystemTime(new Date(2026, 8, 27, 0, 1)); restored.loadFromStorage()
    expect(restored.streakDays).toBe(8)
  })
  it('rejects invalid/future dates and leaves the saved date intact on write failure', () => {
    const journal = useJournalStore(); journal.refresh(); const user = useUserStore()
    for (const invalid of ['2026-09-27', '2026-02-30', 'bad', '1899-01-01']) expect(() => user.setStartDate(invalid)).toThrow()
    const before = clone(journal.data)
    vi.mocked(uni.setStorageSync).mockImplementation(() => { throw new Error('full') })
    expect(() => user.setStartDate('2026-09-20')).toThrow(); expect(journal.data).toEqual(before)
  })
})

describe('whole recipe plans', () => {
  it('previews a today destination once without changing historical entries', () => {
    const journal = useJournalStore(); journal.refresh()
    journal.addEntry('2026-09-25', foods[0], 100)
    const before = clone(journal.data)
    journal.selectDate('2026-09-25')
    uni.switchTab = vi.fn()
    const navigation = useJournalNavigation()
    navigation.openToday('plan')
    expect(journal.selectedDate).toBe(date)
    expect(navigation.consume()).toBe('plan')
    expect(navigation.consume()).toBeNull()
    expect(journal.data).toEqual(before)
    expect(uni.switchTab).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/record/index' }))
  })
  function setup() {
    const journal = useJournalStore(), plan = usePlanStore(); journal.refresh()
    plan.addRecipeGroup(recipes[0].name, recipes[0].ingredients)
    return { journal, plan, groups: () => groupPlans(journal.todayDay.plans, journal.todayDay.entries) }
  }
  it('edits actual portions independently from plans, persists them and undoes precisely', () => {
    const { journal, groups } = setup(), group = groups()[0]
    journal.planAction(date, planGroupAction(groups(), [group.id], 'eat').ids, 'eat')
    const before = clone(journal.todayDay), first = before.entries[0]
    journal.updateEntry(date, first.id, 50)
    expect(journal.todayDay.plans).toEqual(before.plans)
    expect(sumEntries(journal.todayDay.entries).kcal).toBeCloseTo(421.5)
    expect(journal.todayDay.entries.slice(1)).toEqual(before.entries.slice(1))
    expect(JSON.parse(uni.getStorageSync('journal-v2')).days[date].entries[0].grams).toBe(50)
    expect(journal.undo?.label).toBe('已修改分量')
    journal.undoDay()
    expect(journal.todayDay).toEqual(before)
    expect(JSON.parse(uni.getStorageSync('journal-v2')).days[date].entries).toEqual(before.entries)
  })
  it('keeps repeated dishes and independent foods separate, preserves IDs through backups', () => {
    const { journal, plan, groups } = setup()
    plan.addRecipeGroup(recipes[0].name, recipes[0].ingredients)
    journal.addPlan(date, foods[0], 100)
    expect(groups()).toHaveLength(3); expect(groups()[0].id).not.toBe(groups()[1].id)
    expect(plan.plannedTotal.count).toBe(3)
    const copy = parseBackup(exportBackup(journal.data)).days[date]
    expect(groupPlans(copy.plans, copy.entries)).toEqual(groups())
  })
  it('groups known legacy IDs but never guesses among names or unknown IDs', () => {
    const { journal, groups } = setup()
    journal.mutate(next => { next.days[date].plans[0].id = 'unknown-legacy'; next.days[date].plans[1].id = 'also-unknown' })
    expect(groups()).toHaveLength(3)
    expect(groups().filter(group => group.recipe)).toHaveLength(1)
  })
  it('recognizes original GitHub recipe IDs without changing legacy flags or adding missing ingredients', () => {
    const { journal, groups } = setup()
    journal.mutate(next => {
      next.days[date].plans.forEach((item, index) => { item.id = `grp_1750000000000_${item.foodId}`; item.eaten = index === 0 })
      const second = next.days[date].plans.map(item => ({ ...item, id: item.id.replace('1750000000000', '1750000000001'), eaten: false }))
      next.days[date].plans.push(...second)
    })
    const before = clone(journal.data)
    expect(groups()).toHaveLength(2); expect(groups()[0].state).toBe('partial')
    expect(groups()[1].state).toBe('pending'); expect(journal.data).toEqual(before)
  })
  it('eats and revokes one complete dish atomically with precise nutrition and undo', () => {
    const { journal, plan, groups } = setup()
    plan.addRecipeGroup(recipes[0].name, recipes[0].ingredients)
    journal.addEntry(date, foods[0], 50)
    const before = sumEntries(journal.todayDay.entries), group = groups()[0]
    const action = planGroupAction(groups(), [group.id], 'eat')
    expect(action.count).toBe(1); expect(action.ids).toHaveLength(recipes[0].ingredients.length)
    journal.planAction(date, action.ids, 'eat'); journal.planAction(date, action.ids, 'eat')
    const total = sumEntries(journal.todayDay.entries), recipe = recipeNutrition(recipes[0].ingredients)
    expect(total.kcal - before.kcal).toBeCloseTo(recipe.totalKcal)
    expect(total.protein! - before.protein!).toBeCloseTo(recipe.totalProtein!)
    expect(groups().map(group => group.state)).toEqual(['eaten', 'pending'])
    journal.planAction(date, planGroupAction(groups(), [group.id], 'revoke').ids, 'revoke')
    expect(sumEntries(journal.todayDay.entries)).toEqual(before)
    journal.undoDay(); expect(groups()[0].state).toBe('eaten')
    journal.planAction(date, planGroupAction(groups(), [group.id], 'remove').ids, 'remove')
    expect(groups()).toHaveLength(1); expect(sumEntries(journal.todayDay.entries)).toEqual(total)
    journal.undoDay(); expect(groups()).toHaveLength(2)
  })
  it('handles partial dishes without double counting the eaten ingredients', () => {
    const { journal, groups } = setup(), group = groups()[0]
    journal.planAction(date, [group.items[0].id], 'eat')
    expect(groups()[0].state).toBe('partial')
    const rest = planGroupAction(groups(), [group.id], 'eat')
    expect(rest.count).toBe(1); expect(rest.ids).toHaveLength(group.items.length - 1)
    journal.planAction(date, rest.ids, 'eat')
    expect(sumEntries(journal.todayDay.entries).kcal).toBeCloseTo(group.kcal)
    journal.deleteEntries(date, [journal.todayDay.entries[0].id])
    expect(groups()[0].state).toBe('partial')
    expect(groups()[0].pendingKcal).toBeCloseTo(group.items[0].kcal)
  })
  it('does not partially revoke an ambiguous legacy dish or commit a failed batch', () => {
    const { journal, groups } = setup(), group = groups()[0]
    journal.planAction(date, [group.items[0].id], 'eat')
    journal.mutate(next => { next.days[date].plans[1].eaten = true })
    const before = clone(journal.data)
    expect(() => journal.planAction(date, planGroupAction(groups(), [group.id], 'revoke').ids, 'revoke')).toThrow()
    expect(journal.data).toEqual(before)
    vi.mocked(uni.setStorageSync).mockImplementation(() => { throw new Error('full') })
    expect(() => journal.planAction(date, planGroupAction(groups(), [group.id], 'eat').ids, 'eat')).toThrow()
    expect(journal.data).toEqual(before)
  })
  it('selects multiple dishes by visible row count, uses raw calories before rounding', () => {
    const { journal, plan, groups } = setup()
    const ingredients = [{ name: '馒头', grams: 100 }, { name: '猪瘦肉', grams: 100 }, { name: '大白菜', grams: 200 }, { name: '豆腐', grams: 100 }].map(item => ({ foodId: foods.find(food => food.name === item.name)!.id, grams: item.grams }))
    plan.addRecipeGroup('猪肉白菜炖菜', ingredients)
    const action = planGroupAction(groups(), groups().map(group => group.id), 'eat')
    expect(action.count).toBe(2); expect(action.ids).toHaveLength(7)
    expect(groups().reduce((sum, group) => sum + group.kcal, 0)).toBeCloseTo(856.8)
    journal.planAction(date, action.ids, 'eat')
    expect(sumEntries(journal.todayDay.entries).kcal).toBeCloseTo(856.8)
    expect(plan.plannedTotal.count).toBe(0)
  })
})
