import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useJournalStore } from './journal'
import { profileTarget } from '@/utils/calculator'
import { localDate, validDate, recordingDays } from '@/utils/input'
export type { UserProfile, NutritionTarget } from '@/types/journal'
export const useUserStore = defineStore('user', () => {
  const journal = useJournalStore()
  const profile = computed(() => journal.data.profile)
  const nutritionTarget = computed(() => profileTarget(profile.value))
  const isProfileComplete = computed(() => !!nutritionTarget.value)
  const startDate = computed(() => journal.data.startDate)
  const streakDays = computed(() => recordingDays(startDate.value, journal.today))
  const loadFromStorage = () => journal.refresh()
  const updateProfile = journal.updateProfile
  function setStartDate(date: string) {
    if (!validDate(date) || date > localDate()) throw new Error('请选择今天或之前的有效日期')
    journal.mutate(next => { next.startDate = date })
    journal.refresh()
  }
  const resetStartDate = () => setStartDate(localDate())
  return { profile, nutritionTarget, isProfileComplete, startDate, streakDays, loadFromStorage, updateProfile, resetStartDate, setStartDate }
})
