import type { FoodItem } from '@/types/journal'

// Starting amounts are editing conveniences, not dietary recommendations.
const presetGrams: Record<number, number> = {
  1: 150, 2: 150, 3: 100, 4: 150, 5: 70, 6: 150, 7: 150, 8: 250, 9: 40, 10: 60,
  11: 150, 12: 100, 13: 50, 14: 100, 15: 100, 16: 150, 17: 40, 18: 150, 19: 100,
  21: 150, 22: 150, 23: 150, 24: 150, 25: 150, 26: 150, 27: 150, 28: 150, 29: 100, 30: 100, 31: 200, 32: 100,
  33: 100, 34: 150, 35: 200, 36: 150, 37: 50, 38: 150, 39: 150,
  41: 5, 42: 5, 43: 50, 44: 15, 45: 10, 46: 5, 47: 15,
}
const isOil = (food: FoodItem) => food.category === 'fat' && /油(?:[（(].*[）)])?$/.test(food.name.trim())

export function defaultRecipeGrams(food: FoodItem): number {
  // Custom-food reference grams may describe an entire package; use small oil portions.
  if (isOil(food)) return 5
  if (food.category === 'fat') {
    if (/牛油果|鳄梨/.test(food.name)) return 50
    if (/花生酱|芝麻酱|坚果酱/.test(food.name)) return 10
    if (/坚果|核桃|花生|杏仁|腰果|巴旦木|瓜子|南瓜籽|芝麻/.test(food.name)) return 15
  }
  if (food.customKey && food.portionGrams && food.portionGrams > 0 && food.portionGrams <= 5000) return food.portionGrams
  if (presetGrams[food.id]) return presetGrams[food.id]
  return ({ staple: 150, protein: 100, vegetable: 150, fruit: 150, fat: 15 } as Record<string, number>)[food.category] || 100
}

export function portionStep(food: FoodItem | null): number {
  if (!food) return 10
  if (isOil(food)) return 1
  if (food.category === 'fat' || defaultRecipeGrams(food) <= 50) return 5
  return 10
}
