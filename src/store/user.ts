import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { calcBMR, calcMaintenance, calcTargetCalories, calcMacros } from '@/utils/calculator'
import type { MacroResult } from '@/utils/calculator'

export interface UserProfile {
  height: number | null
  weight: number | null
  age: number | null
  activityLevel: number
  cyclePhase: string | null
}

export interface NutritionTarget extends MacroResult {
  bmr: number
  maintenance: number
  deficit: number
  targetCalories: number
}

export const useUserStore = defineStore('user', () => {
  const profile = ref<UserProfile>({
    height: null,
    weight: null,
    age: null,
    activityLevel: 1.2,
    cyclePhase: null,
  })

  const isProfileComplete = computed(() => {
    const { height, weight, age } = profile.value
    return height !== null && weight !== null && age !== null
  })

  const nutritionTarget = computed<NutritionTarget | null>(() => {
    if (!isProfileComplete.value) return null
    const { weight, height, age, activityLevel, cyclePhase } = profile.value
    const bmr = calcBMR(weight!, height!, age!)
    const maintenance = calcMaintenance(bmr, activityLevel)
    const targetCalories = calcTargetCalories(maintenance, weight!)
    const macros = calcMacros(targetCalories, cyclePhase!)
    return {
      bmr,
      maintenance,
      deficit: maintenance - targetCalories,
      targetCalories,
      ...macros,
    }
  })

  function saveToStorage() {
    const plain = { ...profile.value }
    uni.setStorageSync('user-profile', JSON.stringify(plain))
  }

  // 坚持天数
  const startDate = ref('')
  const streakDays = computed(() => {
    if (!startDate.value) return 0
    const start = new Date(startDate.value)
    const today = new Date()
    return Math.floor((today.getTime() - start.getTime()) / 86400000) + 1
  })

  function loadFromStorage() {
    try {
      const data = uni.getStorageSync('user-profile')
      if (data) {
        const parsed = JSON.parse(data)
        if (parsed && typeof parsed === 'object') {
          profile.value.height = parsed.height ?? null
          profile.value.weight = parsed.weight ?? null
          profile.value.age = parsed.age ?? null
          profile.value.activityLevel = parsed.activityLevel ?? 1.2
          profile.value.cyclePhase = parsed.cyclePhase ?? null
        }
      }
    } catch (_) {}
    // 首日记录
    try {
      const sd = uni.getStorageSync('start-date')
      if (sd) {
        startDate.value = sd
      } else {
        const today = new Date().toISOString().slice(0, 10)
        startDate.value = today
        uni.setStorageSync('start-date', today)
      }
    } catch (_) {}
  }

  function updateProfile(patch: Partial<UserProfile>) {
    Object.assign(profile.value, patch)
    saveToStorage()
  }

  return {
    profile,
    isProfileComplete,
    nutritionTarget,
    startDate,
    streakDays,
    saveToStorage,
    loadFromStorage,
    updateProfile,
  }
})
