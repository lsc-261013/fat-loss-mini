import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useJournalStore } from './journal'
import { localDate } from '@/utils/input'
import { sumEntries } from '@/utils/nutrition'
import type { FoodItem, MealEntry } from '@/types/journal'
export type { FoodItem, MealEntry } from '@/types/journal'
export const useRecordsStore = defineStore('records', () => {
  const journal = useJournalStore()
  const todayStr = computed(() => journal.today)
  const todayEntries = computed(() => journal.todayDay.entries)
  const todayTotal = computed(() => sumEntries(todayEntries.value))
  const loadToday = () => journal.refresh()
  function guard() { if (journal.today !== localDate()) { journal.refresh(); throw new Error('日期已变化，请重试') } }
  function addEntry(food: FoodItem, grams: number, planItemId?: string) { guard(); return journal.addEntry(journal.today, food, grams, planItemId) }
  function removeEntry(id: string) { guard(); journal.deleteEntries(journal.today, [id]) }
  function updateEntry(id: string, grams: number) { guard(); journal.updateEntry(journal.today, id, grams) }
  function replaceEntries(entries: MealEntry[]) { guard(); journal.changeDay(journal.today, day => { day.entries = entries; day.plans.forEach(p => { if (p.eaten && !entries.some(e => e.planItemId === p.id)) p.eaten = false }) }) }
  return { todayStr, todayEntries, todayTotal, loadToday, addEntry, removeEntry, updateEntry, replaceEntries }
})
