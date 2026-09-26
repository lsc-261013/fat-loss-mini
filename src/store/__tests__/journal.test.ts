import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useJournalStore } from '../journal'
import { useUserStore } from '../user'
import { useRecordsStore } from '../records'
import { usePlanStore } from '../plan'
import { emptyDay, emptyJournal } from '@/types/journal'
import { clone, exportBackup, loadJournal, mergeBackup, parseBackup } from '@/utils/journalPersistence'
import { createEntry, sumEntries, recipeNutrition, planCalories } from '@/utils/nutrition'
import { recipes } from '@/data/recipes'
import foods from '@/static/foods.json'

let storage: Map<string, string>
const date = '2026-09-25', yesterday = '2026-09-24', food = foods[0]
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026,8,25,12)); storage = new Map()
  vi.stubGlobal('uni', { getStorageInfoSync: () => ({ keys: [...storage.keys()] }), getStorageSync: (key:string) => storage.get(key), setStorageSync: vi.fn((key:string,value:string) => storage.set(key,value)), removeStorageSync: (key:string) => storage.delete(key) })
  setActivePinia(createPinia())
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
describe('migration and history', () => {
  it('migrates current and archived days without changing legacy keys or historical calories', () => {
    const entry = { ...createEntry(food,100), subtotalKcal: 117.321 }
    storage.set('daily-record-backup-'+yesterday, JSON.stringify({date:yesterday, entries:[entry]}))
    storage.set('daily-record', JSON.stringify({date,entries:[createEntry(food,200)]}))
    const old = storage.get('daily-record-backup-'+yesterday)
    const store = useJournalStore(); store.refresh()
    expect(store.data.days[yesterday].entries[0].subtotalKcal).toBe(117.321)
    expect(store.data.days[yesterday].target).toBeNull()
    expect(storage.get('daily-record-backup-'+yesterday)).toBe(old)
    expect(store.todayDay.entries).toHaveLength(1)
  })
  it('refuses malformed archives without writing a new document', () => {
    storage.set('daily-record-backup-'+yesterday,'{bad')
    const store = useJournalStore(); store.refresh()
    expect(store.error).toBeTruthy(); expect(storage.has('journal-v2')).toBe(false)
    expect(() => store.addEntry(date, food, 100)).toThrow()
  })
  it('freezes previous targets and isolates history from home totals', () => {
    const store = useJournalStore(); store.refresh(); store.updateProfile({weight:65,height:165,age:30})
    store.addEntry(date,food,100); const target = clone(store.todayDay.target)
    vi.setSystemTime(new Date(2026,8,26,12)); store.refresh(); store.updateProfile({weight:60})
    store.selectDate(date); store.updateEntry(date,store.currentDay.entries[0].id,200)
    expect(store.currentDay.target).toEqual(target)
    expect(useRecordsStore().todayTotal.kcal).toBe(0)
    store.addEntry(yesterday,food,100); expect(store.data.days[yesterday].target).toBeNull()
  })
  it('does not change profile or current target when storage fails', () => {
    const store = useJournalStore(); store.refresh(); store.updateProfile({weight:65,height:165,age:30})
    const before = clone(store.data)
    vi.mocked(uni.setStorageSync).mockImplementation(() => { throw new Error('full') })
    expect(() => useUserStore().updateProfile({weight:70})).toThrow()
    expect(store.data).toEqual(before)
  })
  it('links a unique old eaten plan but does not guess among repeated foods', () => {
    const plans = [1,2].map(i => ({id:'p'+i,foodId:food.id,foodName:food.name,grams:100,category:food.category,kcal:food.kcal,eaten:true}))
    storage.set('meal-plan',JSON.stringify({date,items:plans}))
    storage.set('daily-record',JSON.stringify({date,entries:[createEntry(food,100)]}))
    expect(loadJournal().days[date].entries[0].planItemId).toBeUndefined()
    storage.set('meal-plan',JSON.stringify({date,items:plans.slice(0,1)}))
    expect(loadJournal().days[date].entries[0].planItemId).toBe('p1')
  })
})
describe('atomic plan management', () => {
  it('batch eat is idempotent, revoke is exact, remove keeps consumed records, undo restores', () => {
    const store = useJournalStore(); store.refresh()
    store.addPlan(date,food,100); store.addPlan(date,food,200)
    store.addEntry(date,food,50)
    const ids = store.todayDay.plans.map(p => p.id)
    store.planAction(date,ids,'eat'); store.planAction(date,ids,'eat')
    expect(store.todayDay.entries).toHaveLength(3)
    store.planAction(date,[ids[0]],'revoke')
    expect(store.todayDay.entries.map(e => e.grams)).toEqual([50,200])
    expect(store.todayDay.plans[0].eaten).toBe(false)
    store.planAction(date,[ids[1]],'remove'); expect(store.todayDay.entries).toHaveLength(2)
    store.undoDay(); expect(store.todayDay.plans).toHaveLength(2)
    store.planAction(date,ids,'revoke'); expect(store.todayDay.entries.map(e => e.grams)).toEqual([50])
  })
  it('a failed write leaves both records and plan state unchanged', () => {
    const store = useJournalStore(); store.refresh(); store.addPlan(date,food,100)
    const before = clone(store.data)
    vi.mocked(uni.setStorageSync).mockImplementation(() => { throw new Error('full') })
    expect(() => store.planAction(date,[store.todayDay.plans[0].id],'eat')).toThrow()
    expect(store.data).toEqual(before)
  })
  it('deleting linked entries resets plans; undo does not overwrite later actions', () => {
    const store = useJournalStore(); store.refresh(); store.addPlan(date,food,100)
    store.planAction(date,[store.todayDay.plans[0].id],'eat')
    store.deleteEntries(date,[store.todayDay.entries[0].id]); expect(store.todayDay.plans[0].eaten).toBe(false)
    store.undoDay(); expect(store.todayDay.plans[0].eaten).toBe(true)
    store.deleteEntries(date,[store.todayDay.entries[0].id]); store.addEntry(date,food,50)
    expect(() => store.undoDay()).toThrow(); expect(store.todayDay.entries[0].grams).toBe(50)
  })
  it('does not partially revoke when a legacy association is ambiguous', () => {
    const store = useJournalStore(); store.refresh(); store.addPlan(date,food,100)
    store.mutate(next => { next.days[date].plans[0].eaten = true })
    const before = clone(store.data)
    expect(() => store.planAction(date,[store.todayDay.plans[0].id],'revoke')).toThrow()
    expect(store.data).toEqual(before)
  })
})
describe('backup', () => {
  it('roundtrips profile, historical targets, recipes and exact stored subtotals', () => {
    const store = useJournalStore(); store.refresh(); store.updateProfile({weight:65,height:165,age:30}); store.addEntry(yesterday,food,123.4)
    store.mutate(next => { next.customRecipes = [recipes[0]]; next.hiddenRecipeIds = ['r2'] })
    expect(parseBackup(exportBackup(store.data))).toEqual(store.data)
  })
  it.each(['{}','null','{broken','{"format":"yikou-backup","version":99}','{"__proto__":{}}'])('rejects malformed backup %s', raw => { expect(() => parseBackup(raw)).toThrow() })
  it('rejects impossible dates, NaN-like values and duplicate record IDs', () => {
    const data = emptyJournal(date); data.days['2026-02-30'] = emptyDay(); expect(() => parseBackup(JSON.stringify({format:'yikou-backup',version:2,data}))).toThrow()
    delete data.days['2026-02-30']; data.days[date] = emptyDay(); const entry = createEntry(food,100); data.days[date].entries = [entry,entry]
    expect(() => exportBackup(data)).toThrow()
  })
  it('merges missing rows and dates, preserves local conflicts and profile', () => {
    const local = emptyJournal(date), incoming = emptyJournal(date)
    local.days[date] = emptyDay(); const entry = createEntry(food,100); local.days[date].entries = [entry]
    incoming.days[date] = emptyDay(); incoming.days[date].entries = [{...entry,grams:200},createEntry(food,50)]
    incoming.days[yesterday] = emptyDay(); incoming.profile.weight = 65
    const result = mergeBackup(local,incoming)
    expect(result.days[date].entries.map(e => e.grams)).toEqual([100,50]); expect(result.days[yesterday]).toBeDefined(); expect(result.profile.weight).toBeNull()
  })
  it('saves before import, rolls back exactly and disables rollback after editing', () => {
    const store = useJournalStore(); store.refresh(); store.addEntry(date,food,100)
    const before = clone(store.data), incoming = emptyJournal(date)
    store.importData(incoming,'replace'); expect(JSON.parse(storage.get('journal-before-import-v2')!).before).toEqual(before)
    expect(store.canUndoImport()).toBe(true); store.undoImport(); expect(store.data).toEqual(before)
    store.importData(incoming,'replace'); store.addEntry(date,food,50)
    expect(store.canUndoImport()).toBe(false); expect(() => store.undoImport()).toThrow()
  })
  it('does not import when the recovery copy cannot be persisted', () => {
    const store = useJournalStore(); store.refresh(); const before = clone(store.data)
    vi.mocked(uni.setStorageSync).mockImplementation(() => { throw new Error('full') })
    expect(() => store.importData(emptyJournal(date),'replace')).toThrow(); expect(store.data).toEqual(before)
  })
})
describe('nutrition consistency', () => {
  it('counts linked legacy plans as eaten and computes pending estimates without legacy rounding', () => {
    const store = useJournalStore(); store.refresh()
    store.addPlan(date,foods[8],40)
    const id = store.todayDay.plans[0].id
    store.mutate(next => { next.days[date].plans[0].kcal = 151 })
    expect(planCalories(store.todayDay.plans[0])).toBe(150.8)
    store.mutate(next => { next.days[date].entries.push(createEntry(foods[8],40,id)) })
    expect(usePlanStore().plannedTotal.count).toBe(0)
  })
  it.each(recipes)('$name: recipe → plan → consumed has identical nutrition', recipe => {
    const plans = usePlanStore(), store = useJournalStore(); store.refresh()
    plans.addRecipeGroup(recipe.name,recipe.ingredients)
    const total = recipeNutrition(recipe.ingredients)
    expect(plans.planItems.reduce((s,p) => s+p.kcal,0)).toBeCloseTo(total.totalKcal,8)
    store.planAction(date,plans.planItems.map(p => p.id),'eat')
    const sum = sumEntries(store.todayDay.entries)
    expect(sum.kcal).toBeCloseTo(total.totalKcal,8); expect(sum.carbs).toBeCloseTo(total.totalCarbs!,8)
    expect(sum.protein).toBeCloseTo(total.totalProtein!,8); expect(sum.fat).toBeCloseTo(total.totalFat!,8)
  })
})
