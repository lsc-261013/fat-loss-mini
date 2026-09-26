import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useJournalStore } from './journal'
import { foodPortion, newId, planCalories } from '@/utils/nutrition'
import { validGrams } from '@/utils/input'
import { groupPlans } from '@/utils/planGroups'
import type { PlanItem } from '@/types/journal'
export type { PlanItem } from '@/types/journal'
export const usePlanStore = defineStore('plan', () => {
  const journal = useJournalStore()
  const foods = computed(() => journal.allFoods)
  const planItems = computed(() => journal.todayDay.plans)
  const gramsMemory = computed(() => journal.data.gramsMemory)
  const pending = computed(() => planItems.value.filter(p => !p.eaten && !journal.todayDay.entries.some(e => e.planItemId === p.id)))
  const plannedTotal = computed(() => ({ kcal: pending.value.reduce((s,p) => s+planCalories(p),0), count: groupPlans(planItems.value, journal.todayDay.entries).filter(group => group.pendingIds.length).length }))
  const loadPlan = () => journal.refresh()
  function addToPlan(item: Omit<PlanItem, 'id' | 'eaten'>) {
    journal.ensureLoaded()
    const food = foods.value.find(f => f.id === item.foodId)
    if (!food) throw new Error('无法识别食材')
    journal.refresh(); journal.addPlan(journal.today, food, item.grams)
  }
  function addRecipeGroup(name: string, items: { foodId: number; grams: number }[]) {
    journal.ensureLoaded()
    const groupId = 'grp_' + newId()
    const plans = items.map((item,index) => {
      const food = foods.value.find(f => f.id === item.foodId)
      if (!food) throw new Error('无法识别食材')
      return { id: groupId+'_'+index, foodId: food.id, foodName: food.name, category: food.category, grams: item.grams, kcal: foodPortion(food,item.grams).subtotalKcal, eaten: false, groupName: name }
    })
    journal.refresh(); journal.changeDay(journal.today, day => day.plans.push(...plans))
  }
  function replaceItems(items: PlanItem[]) { journal.changeDay(journal.today, day => { day.plans = items }) }
  function removeFromPlan(id: string) { journal.planAction(journal.today,[id],'remove') }
  function rememberGrams(foodId: number, grams: number) { if (validGrams(grams)) { try { journal.mutate(next => { next.gramsMemory[foodId] = grams }) } catch { /* Optional preference. */ } } }
  function getRememberedGrams(id: number) { return gramsMemory.value[id] || null }
  return { planItems, plannedTotal, gramsMemory, allFoodsList: foods, loadPlan, addToPlan, addRecipeGroup, replaceItems, removeFromPlan, rememberGrams, getRememberedGrams }
})
