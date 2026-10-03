import { recipes, type Recipe } from '@/data/recipes'
import type { PlanGroup } from './planGroups'
import { validRecipePhoto } from './recipePhotoData'
const signature = (ingredients: Recipe['ingredients']) => ingredients.map(item => `${item.foodId}:${item.grams}`).sort().join('|')
// Photos are presentation assets, never nutrition data. Altered recipes keep a neutral illustration.
export function recipeImage(recipe: Recipe): string {
  if (validRecipePhoto(recipe.photo)) return recipe.photo
  const preset = recipes.find(item => item.id === recipe.id && signature(item.ingredients) === signature(recipe.ingredients))
  return preset ? `/static/food/${preset.id}.jpg` : ''
}
export function planImage(group: PlanGroup): string {
  if (!group.recipe) return ''
  const preset = recipes.find(item => item.name === group.name && signature(item.ingredients) === signature(group.items.map(part => ({ foodId: part.foodId, grams: part.grams }))))
  return preset ? recipeImage(preset) : ''
}
export function displayDishName(name: string): string { return name.replace(/^(早餐|午餐|晚餐|加餐)[：:]/, '') }
