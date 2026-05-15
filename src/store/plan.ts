import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import foodsData from '@/static/foods.json'

const allFoods = foodsData as any[]

export interface PlanItem {
  id: string
  foodId: number
  foodName: string
  grams: number
  category: string
  kcal: number
  eaten: boolean
  groupName?: string      // 如果是从食谱添加的，标记食谱名
  children?: { foodId: number; name: string; grams: number; kcal: number; emoji: string }[]  // 食谱子项
}

export const usePlanStore = defineStore('plan', () => {
  const todayStr = computed(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  const planItems = ref<PlanItem[]>([])
  const gramsMemory = ref<Record<number, number>>({})

  const plannedTotal = computed(() => ({
    kcal: planItems.value.filter((p) => !p.eaten).reduce((s, p) => s + p.kcal, 0),
    count: planItems.value.filter((p) => !p.eaten).length,
  }))

  function loadPlan() {
    try {
      const data = uni.getStorageSync('meal-plan')
      if (data) {
        const parsed = JSON.parse(data)
        if (parsed.date === todayStr.value) {
          planItems.value = parsed.items
        } else {
          planItems.value = []
        }
      }
    } catch (_) { /* */ }
    try {
      const mem = uni.getStorageSync('grams-memory')
      if (mem) gramsMemory.value = JSON.parse(mem)
    } catch (_) { /* */ }
  }

  function savePlan() {
    uni.setStorageSync('meal-plan', JSON.stringify({ date: todayStr.value, items: planItems.value }))
  }

  function addToPlan(item: Omit<PlanItem, 'id' | 'eaten'>) {
    planItems.value.push({
      ...item,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      eaten: false,
    })
    savePlan()
  }

  function addRecipeGroup(recipeName: string, items: { foodId: number; name: string; grams: number; kcal: number; category: string; emoji: string }[]) {
    const groupId = `grp_${Date.now()}`
    items.forEach((item) => {
      planItems.value.push({
        id: `${groupId}_${item.foodId}`,
        foodId: item.foodId,
        foodName: item.name,
        grams: item.grams,
        category: item.category,
        kcal: item.kcal,
        eaten: false,
        groupName: recipeName,
        children: items,
      })
    })
    savePlan()
  }

  function removeFromPlan(id: string) {
    planItems.value = planItems.value.filter((p) => p.id !== id)
    savePlan()
  }

  function markEaten(id: string) {
    const item = planItems.value.find((p) => p.id === id)
    if (item) {
      item.eaten = true
      savePlan()
    }
  }

  function unmarkEaten(id: string) {
    const item = planItems.value.find((p) => p.id === id)
    if (item) {
      item.eaten = false
      savePlan()
    }
  }

  // 从记录页删除 → 计划页直接移除对应项
  function removeByFoodId(foodId: number) {
    planItems.value = planItems.value.filter((p) => p.foodId !== foodId)
    savePlan()
  }

  // 克数记忆
  function rememberGrams(foodId: number, grams: number) {
    gramsMemory.value[foodId] = grams
    uni.setStorageSync('grams-memory', JSON.stringify(gramsMemory.value))
  }

  function getRememberedGrams(foodId: number): number | null {
    return gramsMemory.value[foodId] || null
  }

  // 获取所有食材（供手动计划选择）
  const allFoodsList = allFoods

  return {
    planItems, plannedTotal, gramsMemory, allFoodsList,
    loadPlan, addToPlan, addRecipeGroup, removeFromPlan, markEaten, unmarkEaten, removeByFoodId,
    rememberGrams, getRememberedGrams, savePlan,
  }
})
