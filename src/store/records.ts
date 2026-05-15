import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface FoodItem {
  id: number
  name: string
  category: string
  kcal: number
  carbs: number
  protein: number
  fat: number
}

export interface MealEntry {
  id: string
  food: FoodItem
  grams: number
  subtotalKcal: number
  subtotalCarbs: number
  subtotalProtein: number
  subtotalFat: number
  createdAt: number
}

export const useRecordsStore = defineStore('records', () => {
  const todayStr = computed(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  const todayEntries = ref<MealEntry[]>([])

  const todayTotal = computed(() => ({
    kcal: todayEntries.value.reduce((s, e) => s + e.subtotalKcal, 0),
    carbs: todayEntries.value.reduce((s, e) => s + e.subtotalCarbs, 0),
    protein: todayEntries.value.reduce((s, e) => s + e.subtotalProtein, 0),
    fat: todayEntries.value.reduce((s, e) => s + e.subtotalFat, 0),
  }))

  function loadToday() {
    try {
      const data = uni.getStorageSync('daily-record')
      if (data) {
        const parsed = JSON.parse(data)
        if (parsed && parsed.date === todayStr.value && Array.isArray(parsed.entries)) {
          todayEntries.value = parsed.entries
        }
      }
    } catch (_) {
      // keep empty
    }
  }

  function saveToday() {
    uni.setStorageSync('daily-record', JSON.stringify({
      date: todayStr.value,
      entries: [...todayEntries.value],
    }))
  }

  function addEntry(food: FoodItem, grams: number) {
    const entry: MealEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      food,
      grams,
      subtotalKcal: Math.round(food.kcal * grams) / 100,
      subtotalCarbs: Math.round(food.carbs * grams * 10) / 1000,
      subtotalProtein: Math.round(food.protein * grams * 10) / 1000,
      subtotalFat: Math.round(food.fat * grams * 10) / 1000,
      createdAt: Date.now(),
    }
    todayEntries.value.push(entry)
    saveToday()
  }

  function removeEntry(id: string) {
    todayEntries.value = todayEntries.value.filter((e) => e.id !== id)
    saveToday()
  }

  return { todayStr, todayEntries, todayTotal, loadToday, addEntry, removeEntry }
})
