import type { Recipe } from '@/data/recipes'
import type { MacroResult } from '@/utils/calculator'

export interface FoodItem { id: number; name: string; category: string; kcal: number; carbs: number | null; protein: number | null; fat: number | null; customKey?: string; portionGrams?: number }
export interface CustomFood extends FoodItem { customKey: string; portionGrams: number }
export interface MealEntry {
  id: string; food: FoodItem; grams: number; subtotalKcal: number; subtotalCarbs: number | null
  subtotalProtein: number | null; subtotalFat: number | null; createdAt: number; planItemId?: string
}
export interface PlanItem {
  id: string; foodId: number; foodName: string; grams: number; category: string; kcal: number; eaten: boolean
  groupName?: string
  children?: { foodId: number; name: string; grams: number; kcal: number; emoji: string }[]
}
export interface UserProfile { height: number | null; weight: number | null; age: number | null; activityLevel: number; cyclePhase: string | null }
export interface NutritionTarget extends MacroResult { bmr: number; maintenance: number; deficit: number; targetCalories: number }
export interface JournalDay {
  entries: MealEntry[]; plans: PlanItem[]; target: NutritionTarget | null
  targetSource: 'saved' | 'unknown'; targetUpdatedAt?: number
}
export interface JournalData {
  version: 2; days: Record<string, JournalDay>; profile: UserProfile; startDate: string
  gramsMemory: Record<string, number>; customRecipes: Recipe[]; hiddenRecipeIds: string[]
  customFoods?: CustomFood[]
}
export const emptyDay = (): JournalDay => ({ entries: [], plans: [], target: null, targetSource: 'unknown' })
export const emptyJournal = (date: string): JournalData => ({
  version: 2, days: {}, profile: { height: null, weight: null, age: null, activityLevel: 1.2, cyclePhase: null },
  startDate: date, gramsMemory: {}, customRecipes: [], hiddenRecipeIds: [],
})
