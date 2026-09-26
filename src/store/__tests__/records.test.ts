import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useRecordsStore, type FoodItem } from '../records'
import { useJournalStore } from '../journal'
import { usePlanStore } from '../plan'
import { localDate, validGrams } from '@/utils/input'

const food: FoodItem = { id: 1, name: '白米饭', category: 'staple', kcal: 116, carbs: 25.9, protein: 2.6, fat: 0.3 }
let storage: Map<string, string>
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 24, 12))
  storage = new Map()
  vi.stubGlobal('uni', { getStorageInfoSync: () => ({ keys: [...storage.keys()] }), removeStorageSync: (key: string) => storage.delete(key), getStorageSync: vi.fn((key: string) => storage.get(key)), setStorageSync: vi.fn((key: string, value: string) => storage.set(key,value)) })
  setActivePinia(createPinia())
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('record safety and compatibility', () => {
  it('reads legacy records without changing their IDs or totals', () => {
    const legacy = { id: 'old', food, grams: 100, subtotalKcal: 116, subtotalCarbs: 25.9, subtotalProtein: 2.6, subtotalFat: .3, createdAt: 10 }
    storage.set('daily-record', JSON.stringify({date: localDate(), entries:[legacy]}))
    const records = useRecordsStore(); records.loadToday()
    expect(records.todayEntries).toEqual([legacy]); expect(records.todayTotal.kcal).toBe(116)
  })
  it('edits only one of two identical foods and persists it across reload', () => {
    const records = useRecordsStore()
    const first = records.addEntry(food, 100); const second = records.addEntry(food, 150)
    records.updateEntry(first.id, 200); records.loadToday()
    expect(records.todayTotal.kcal).toBe(406)
    expect(records.todayEntries.find(e => e.id === second.id)?.grams).toBe(150)
  })
  it('links a record to an exact plan without deleting other plans', () => {
    const plans = usePlanStore(); const records = useRecordsStore()
    plans.addToPlan({foodId: 1, foodName: food.name, grams:100, category:'staple',kcal:116})
    plans.addToPlan({foodId: 1, foodName: food.name, grams:200, category:'staple',kcal:232})
    const entry = records.addEntry(food,100,plans.planItems[0].id)
    records.addEntry(food,200,plans.planItems[1].id)
    records.removeEntry(entry.id)
    expect(plans.planItems).toHaveLength(2)
    expect(records.todayEntries[0].planItemId).toBe(plans.planItems[1].id)
  })
  it('restores deleted entries with original IDs and exact totals', () => {
    const records = useRecordsStore(); records.addEntry(food,123.4)
    const snapshot = [...records.todayEntries]; const total = records.todayTotal
    records.replaceEntries([]); records.replaceEntries(snapshot)
    expect(records.todayEntries).toEqual(snapshot); expect(records.todayTotal).toEqual(total)
  })
  it.each([0, -5, NaN, Infinity, 5001])('rejects invalid grams %s without writing', grams => {
    const records = useRecordsStore()
    expect(() => records.addEntry(food,grams)).toThrow()
    expect(useRecordsStore().todayEntries).toEqual([])
  })
  it('does not claim success or change state when storage is full', () => {
    const records = useRecordsStore(); records.addEntry(food,100)
    vi.mocked(uni.setStorageSync).mockImplementation(() => {throw new Error('Quota exceeded')})
    expect(() => records.updateEntry(records.todayEntries[0].id,200)).toThrow()
    expect(records.todayTotal.kcal).toBe(116)
    const plans = usePlanStore()
    expect(() => plans.addToPlan({foodId:1,foodName:food.name,grams:100,category:'staple',kcal:116})).toThrow()
    expect(plans.planItems).toEqual([])
  })
  it('clears yesterday in memory instead of showing it as today', () => {
    const records = useRecordsStore(); records.addEntry(food,100)
    vi.setSystemTime(new Date(2026,8,25,0,1)); records.loadToday()
    expect(records.todayEntries).toEqual([]); expect(records.todayStr).toBe('2026-09-25')
    expect(JSON.parse(storage.get('journal-v2')!).days['2026-09-24'].entries).toHaveLength(1)
  })
  it('prevents editing a stale row after midnight', () => {
    const records = useRecordsStore(); const entry = records.addEntry(food,100)
    vi.setSystemTime(new Date(2026,8,25,0,1))
    expect(() => records.updateEntry(entry.id,200)).toThrow()
    expect(JSON.parse(storage.get('journal-v2')!).days['2026-09-24'].entries[0].grams).toBe(100)
  })
  it('rejects an empty input while allowing valid decimal weights', () => {
    expect(validGrams('')).toBe(false); expect(validGrams(' ')).toBe(false); expect(validGrams('1.5')).toBe(true)
  })
  it('retains the exact previous day when saving a new day', () => {
    const records = useRecordsStore(); records.addEntry(food,100)
    const raw = storage.get('journal-v2')
    vi.setSystemTime(new Date(2026,8,25,12)); records.loadToday(); records.addEntry(food,200)
    expect(JSON.parse(storage.get('journal-v2')!).days['2026-09-24']).toEqual(JSON.parse(raw!).days['2026-09-24'])
    expect(records.todayEntries).toHaveLength(1)
    expect(records.todayTotal.kcal).toBe(232)
  })
  it('does not overwrite old data when backup cannot be saved', () => {
    const records = useRecordsStore(); records.addEntry(food,100)
    const raw = storage.get('journal-v2')
    vi.setSystemTime(new Date(2026,8,25,12))
    vi.mocked(uni.setStorageSync).mockImplementation(() => { throw new Error('Full') })
    expect(() => records.addEntry(food,200)).toThrow()
    expect(storage.get('journal-v2')).toBe(raw)
  })
  it('refuses to overwrite malformed saved data', () => {
    const records = useRecordsStore(); storage.set('daily-record', '{broken')
    records.loadToday()
    expect(() => records.addEntry(food,100)).toThrow()
    expect(storage.get('daily-record')).toBe('{broken')
  })
  it('keeps separate identities for repeated ingredients in a recipe', () => {
    const plans = usePlanStore()
    const item = {foodId:1,name:food.name,grams:100,kcal:116,category:'staple',emoji:''}
    plans.addRecipeGroup('test', [item,item])
    expect(new Set(plans.planItems.map(item => item.id)).size).toBe(2)
  })
})
