import type { Recipe } from '@/data/recipes'

export const recipeMeals: { key: Recipe['mealTime']; label: string }[] = [
  { key: 'breakfast', label: '早餐' }, { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' }, { key: 'snack', label: '加餐' },
]

export function initialRecipeMeal(recipe?: Recipe | null, filter = 'all'): Recipe['mealTime'] {
  return recipe?.mealTime || recipeMeals.find(meal => meal.key === filter)?.key || 'lunch'
}

export function recipeMealLabel(meal: Recipe['mealTime']): string {
  return recipeMeals.find(item => item.key === meal)?.label || ''
}
