import { recipes, type Recipe } from '@/data/recipes'
import type { PlanGroup } from './planGroups'
import type { EntryGroup } from './entryGroups'
import { validRecipePhoto } from './recipePhotoData'
const signature = (ingredients: Recipe['ingredients']) => ingredients.map(item => `${item.foodId}:${item.grams}`).sort().join('|')
// Photos are presentation assets, never nutrition data. Altered recipes keep a neutral illustration.
export function recipeImage(recipe: Recipe): string {
  if (validRecipePhoto(recipe.photo)) return recipe.photo
  const preset = recipes.find(item => item.id === recipe.id && signature(item.ingredients) === signature(recipe.ingredients))
  return preset ? `/static/food/${preset.id}.jpg` : ''
}
export function planImage(group: PlanGroup, customRecipes: readonly Recipe[] = []): string {
  if (!group.recipe) return ''
  const catalog = [...recipes, ...customRecipes]
  const planned = signature(group.items.map(part => ({ foodId: part.foodId, grams: part.grams })))
  const sourceIds = new Set(group.items.map(item => item.recipeId))
  if (sourceIds.size === 1 && group.items[0].recipeId) {
    const custom = customRecipes.find(item => item.id === group.items[0].recipeId)
    // A user-selected photo belongs to the dish, not to one exact serving weight.
    if (custom) return recipeImage(custom)
    const source = catalog.find(item => item.id === group.items[0].recipeId)
    return source && signature(source.ingredients) === planned ? recipeImage(source) : ''
  }
  // Never substitute a same-name recipe for a missing or inconsistent source ID.
  if (group.items.some(item => item.recipeId)) return ''
  const matches = catalog.filter(item => item.name === group.name && signature(item.ingredients) === planned)
  return matches.length === 1 ? recipeImage(matches[0]) : ''
}
export function displayDishName(name: string): string { return name.replace(/^(早餐|午餐|晚餐|加餐)[：:]/, '') }
export function entryGroupImage(group: EntryGroup, customRecipes: readonly Recipe[] = []): string {
  if (!group.dish) return ''
  if (group.recipeId) {
    const source = [...recipes, ...customRecipes].find(recipe => recipe.id === group.recipeId)
    return source ? recipeImage(source) : ''
  }
  return group.plan ? planImage(group.plan, customRecipes) : ''
}
