import type { Recipe } from '@/data/recipes'
import type { FoodItem } from '@/types/journal'
import type { useJournalStore } from '@/store/journal'
import { calculatedRecipe, foodPortion, newId } from './nutrition'
import { validGrams } from './input'
import { clone } from './journalPersistence'

export function previewRecipeReplacement(source: Recipe, index: number, foodId: number | null, grams: number | string, catalog: readonly FoodItem[]) {
  const original = source.ingredients[index]
  const beforeFood = original && catalog.find(food => food.id === original.foodId)
  const afterFood = catalog.find(food => food.id === foodId)
  if (!beforeFood || !afterFood || beforeFood.id === afterFood.id || beforeFood.category !== afterFood.category || !validGrams(grams)) return null
  const ingredients = source.ingredients.map((item, position) => position === index ? { foodId: afterFood.id, grams: Number(grams) } : { ...item })
  return {
    beforeFood, afterFood,
    beforeKcal: foodPortion(beforeFood, original.grams).subtotalKcal,
    afterKcal: foodPortion(afterFood, Number(grams)).subtotalKcal,
    recipe: calculatedRecipe({ ...source, ingredients }, catalog),
  }
}

// A preview session can commit once. Failed writes remain retryable; stale drafts cannot overwrite newer data.
export function createRecipeReplacement(journal: ReturnType<typeof useJournalStore>, source: Recipe, index: number) {
  const original = clone(source), revision = journal.revision
  const editingId = journal.data.customRecipes.some(recipe => recipe.id === source.id) ? source.id : undefined
  let saved = false
  return {
    preview: (foodId: number | null, grams: number | string) => previewRecipeReplacement(original, index, foodId, grams, journal.allFoods),
    confirm(foodId: number | null, grams: number | string): Recipe | null {
      if (saved) return null
      if (journal.revision !== revision) throw new Error('数据已变化，请关闭后重新打开替换')
      const preview = previewRecipeReplacement(original, index, foodId, grams, journal.allFoods)
      if (!preview) throw new Error('请选择同类食材，并填写大于 0 且不超过 5000 的克数')
      const recipe = editingId ? preview.recipe : { ...preview.recipe, id: 'custom_' + newId(), name: source.name + '（我的搭配）' }
      journal.saveCustomRecipe(recipe, editingId)
      saved = true
      return recipe
    },
  }
}
