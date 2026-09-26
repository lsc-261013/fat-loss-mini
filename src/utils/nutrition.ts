import foods from '@/static/foods.json'
import type { FoodItem, MealEntry, PlanItem } from '@/types/journal'
import type { Recipe } from '@/data/recipes'
import { validGrams } from './input'

export const newId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
export const sumKnown = (values: (number | null)[]): number | null => values.some(value => value === null) ? null : values.reduce<number>((sum, value) => sum + value!, 0)
export const incompleteNutrition = (food: Pick<FoodItem, 'carbs' | 'protein' | 'fat'>) => food.carbs === null || food.protein === null || food.fat === null
export function foodPortion(food: FoodItem, grams: number) {
  if (!validGrams(grams)) throw new Error('克数须大于 0 且不超过 5000')
  return {
    subtotalKcal: Math.round(food.kcal * grams) / 100,
    subtotalCarbs: food.carbs === null ? null : Math.round(food.carbs * grams * 10) / 1000,
    subtotalProtein: food.protein === null ? null : Math.round(food.protein * grams * 10) / 1000,
    subtotalFat: food.fat === null ? null : Math.round(food.fat * grams * 10) / 1000,
  }
}
export function createEntry(food: FoodItem, grams: number, planItemId?: string): MealEntry {
  return { id: newId(), food: {...food}, grams, ...foodPortion(food, grams), createdAt: Date.now(), ...(planItemId ? { planItemId } : {}) }
}
export function sumEntries(entries: MealEntry[]) {
  return {
    kcal: entries.reduce((sum, entry) => sum + entry.subtotalKcal, 0),
    carbs: sumKnown(entries.map(entry => entry.subtotalCarbs)),
    protein: sumKnown(entries.map(entry => entry.subtotalProtein)),
    fat: sumKnown(entries.map(entry => entry.subtotalFat)),
  }
}
export function recipeNutrition(ingredients: Recipe['ingredients'], catalog: readonly FoodItem[] = foods) {
  const portions = ingredients.map(ingredient => {
    const food = catalog.find(food => food.id === ingredient.foodId)
    if (!food) throw new Error('食谱包含无法识别的食材')
    return foodPortion(food, ingredient.grams)
  })
  const roundedSum = (values: (number | null)[]) => { const sum = sumKnown(values); return sum === null ? null : Math.round(sum * 1000) / 1000 }
  return {
    totalKcal: Math.round(portions.reduce((sum, portion) => sum + portion.subtotalKcal, 0) * 100) / 100,
    totalCarbs: roundedSum(portions.map(portion => portion.subtotalCarbs)),
    totalProtein: roundedSum(portions.map(portion => portion.subtotalProtein)),
    totalFat: roundedSum(portions.map(portion => portion.subtotalFat)),
  }
}
export function calculatedRecipe(recipe: Recipe, catalog: readonly FoodItem[] = foods): Recipe { return { ...recipe, ...recipeNutrition(recipe.ingredients, catalog) } }
export function planCalories(plan: PlanItem): number {
  const food = foods.find(f => f.id === plan.foodId)
  return food && validGrams(plan.grams) ? foodPortion(food, plan.grams).subtotalKcal : plan.kcal
}
