import { describe, expect, it } from 'vitest'
import { recipes } from '@/data/recipes'
import { recipeImage, planImage, displayDishName } from '../foodVisuals'
import { groupPlans } from '../planGroups'
import type { PlanItem } from '@/types/journal'

describe('food imagery only represents matching preset ingredients', () => {
  it('maps every preset to a local image', () => {
    for (const recipe of recipes) expect(recipeImage(recipe)).toBe(`/static/food/${recipe.id}.jpg`)
  })
  it('falls back for custom or changed recipes', () => {
    const recipe = recipes[0]
    expect(recipeImage({ ...recipe, id: 'custom_1' })).toBe('')
    expect(recipeImage({ ...recipe, ingredients: [{ foodId: 1, grams: 100 }] })).toBe('')
    expect(recipeImage({ ...recipe, ingredients: recipe.ingredients.map((part, i) => ({ ...part, grams: i === 0 ? part.grams + 10 : part.grams })) })).toBe('')
  })
  it('matches complete planned dishes and rejects uncertain legacy groups', () => {
    const recipe = recipes[0]
    const plans: PlanItem[] = recipe.ingredients.map((part, i) => ({ ...part, id: `grp_123_ab_${i}`, foodName: `food${i}`, kcal: 100, category: 'staple', eaten: false, groupName: recipe.name }))
    expect(planImage(groupPlans(plans)[0])).toBe('/static/food/r1.jpg')
    expect(planImage(groupPlans(plans.slice(0, 1))[0])).toBe('')
    expect(planImage(groupPlans(plans.map(p => ({ ...p, id: 'legacy_' + p.id })))[0])).toBe('')
  })
  it('keeps image matching independent of ingredient order', () => {
    expect(recipeImage({ ...recipes[0], ingredients: [...recipes[0].ingredients].reverse() })).toBe('/static/food/r1.jpg')
  })
  it('removes only a meal prefix from the displayed name', () => {
    expect(displayDishName('早餐：燕麦鸡蛋餐')).toBe('燕麦鸡蛋餐')
    expect(displayDishName('我的早餐搭配')).toBe('我的早餐搭配')
  })
})
