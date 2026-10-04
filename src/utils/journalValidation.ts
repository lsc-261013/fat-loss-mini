import type { JournalData } from '@/types/journal'
import { validDate, validGrams } from './input'
import foods from '@/static/foods.json'
import { foodCategories } from './customFoods'
import { validRecipePhoto, MAX_RECIPE_PHOTO_CHARS, RecipePhotoLimitError } from './recipePhotoData'
import { recipePortionId } from './planGroups'

function ensure(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message) }
function object(value: unknown): asserts value is Record<string, unknown> { ensure(value && typeof value === 'object' && !Array.isArray(value), '备份结构不完整') }
function text(value: unknown, max = 300): asserts value is string { ensure(typeof value === 'string' && value.length > 0 && value.length <= max, '备份文字字段无效') }
function number(value: unknown, min = 0, max = 1e8): asserts value is number { ensure(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, '备份数值字段无效') }
function nullableNumber(value: unknown) { if (value !== null) number(value) }
function array(value: unknown, max = 50000): asserts value is unknown[] { ensure(Array.isArray(value) && value.length <= max, '备份列表无效或过大') }
function unique(list: unknown[]) {
  const ids = list.map(value => { object(value); text(value.id); return value.id })
  ensure(new Set(ids).size === ids.length, '备份包含重复编号，请检查文件')
}
export function validateJournal(value: unknown): asserts value is JournalData {
  object(value); ensure(value.version === 2, '不支持这个备份版本')
  const catalogIds = new Set(foods.map(food => food.id))
  if (value.customFoods !== undefined) {
    array(value.customFoods, 10000)
    const keys = new Set<string>()
    for (const food of value.customFoods) {
      object(food); number(food.id, 100000); ensure(Number.isInteger(food.id) && !catalogIds.has(food.id), '自定义食材编号重复或无效')
      text(food.customKey); ensure(!keys.has(food.customKey), '自定义食材标识重复'); keys.add(food.customKey); catalogIds.add(food.id)
      text(food.name, 50); ensure(food.name.trim(), '食材名称不能为空'); ensure(foodCategories.some(category => category.key === food.category), '食材分类无效')
      number(food.kcal, 0, 1000); ensure(validGrams(food.portionGrams), '食材参考分量无效')
      for (const key of ['carbs', 'protein', 'fat']) if (food[key] !== null) number(food[key], 0, 100)
      ensure(Number(food.carbs) + Number(food.protein) + Number(food.fat) <= 100.1, '食材营养总克数无效')
    }
  }
  object(value.days); ensure(Object.keys(value.days).length <= 36525, '备份日期数量过多')
  for (const [date, day] of Object.entries(value.days)) {
    ensure(validDate(date), '备份日期格式无效'); object(day)
    array(day.entries); unique(day.entries); array(day.plans); unique(day.plans)
    ensure(day.targetSource === 'saved' || day.targetSource === 'unknown', '备份目标来源无效')
    if (day.target !== null) {
      object(day.target)
      for (const key of ['bmr', 'maintenance', 'deficit', 'targetCalories', 'carbs', 'protein', 'fat', 'carbPercent', 'proteinPercent', 'fatPercent', 'cycleAdjustment']) number(day.target[key], key === 'deficit' ? -10000 : 0)
      ensure(typeof day.target.cycleTip === 'string', '目标说明无效')
      ensure((day.target.targetCalories as number) > 0, '热量目标无效')
    }
    if (day.targetUpdatedAt !== undefined) number(day.targetUpdatedAt, 0, 1e15)
    for (const entry of day.entries) {
      object(entry); number(entry.grams, 0, 1e6); number(entry.createdAt, 0, 1e15)
      number(entry.subtotalKcal)
      for (const key of ['subtotalCarbs', 'subtotalProtein', 'subtotalFat']) nullableNumber(entry[key])
      object(entry.food); text(entry.food.name); text(entry.food.category); number(entry.food.id, 1)
      number(entry.food.kcal)
      if (entry.food.customKey !== undefined) text(entry.food.customKey)
      for (const key of ['carbs', 'protein', 'fat']) {
        nullableNumber(entry.food[key])
        if (entry.food[key] === null) ensure(typeof entry.food.customKey === 'string', '只有自定义食材允许未填写营养')
        const subtotal = 'subtotal' + key[0].toUpperCase() + key.slice(1)
        ensure((entry[subtotal] === null) === (entry.food[key] === null), '记录营养缺失状态不一致')
      }
      if (entry.planItemId !== undefined) text(entry.planItemId)
      if (entry.dish !== undefined) {
        object(entry.dish); text(entry.dish.id); text(entry.dish.name)
        ensure(typeof entry.planItemId === 'string' && recipePortionId(entry.planItemId) === entry.dish.id, '记录菜份关联无效')
        if (entry.dish.recipeId !== undefined) text(entry.dish.recipeId)
      }
    }
    for (const plan of day.plans) {
      object(plan); number(plan.foodId, 1); text(plan.foodName); text(plan.category)
      if (plan.foodId >= 100000) ensure(catalogIds.has(plan.foodId), '计划缺少对应的自定义食材')
      number(plan.grams, 0, 1e6); number(plan.kcal); ensure(typeof plan.eaten === 'boolean', '计划状态无效')
      if (plan.groupName !== undefined) text(plan.groupName)
      // Recipe references are optional and may outlive a deleted recipe.
      if (plan.recipeId !== undefined) text(plan.recipeId)
    }
  }
  object(value.profile)
  for (const key of ['height', 'weight', 'age']) if (value.profile[key] !== null) number(value.profile[key], 0, 10000)
  number(value.profile.activityLevel, 1, 3)
  ensure(value.profile.cyclePhase === null || ['menstrual', 'follicular', 'luteal', 'ovulatory'].includes(String(value.profile.cyclePhase)), '周期字段无效')
  ensure(typeof value.startDate === 'string' && validDate(value.startDate), '开始日期无效')
  object(value.gramsMemory)
  for (const [key, grams] of Object.entries(value.gramsMemory)) { ensure(/^\d+$/.test(key), '分量记忆编号无效'); number(grams, 0, 1e6) }
  array(value.hiddenRecipeIds); value.hiddenRecipeIds.forEach(id => text(id)); array(value.customRecipes, 10000); unique(value.customRecipes)
  if (value.deletedRecipeIds !== undefined) {
    array(value.deletedRecipeIds, 10000); value.deletedRecipeIds.forEach(id => text(id))
    ensure(new Set(value.deletedRecipeIds).size === value.deletedRecipeIds.length, '备份包含重复删除标记')
  }
  let photoChars = 0
  for (const recipe of value.customRecipes) {
    object(recipe); text(recipe.name); ensure(typeof recipe.description === 'string', '食谱描述无效')
    if (recipe.photo !== undefined) {
      ensure(validRecipePhoto(recipe.photo), '食谱照片无效或过大，请使用本应用压缩后的照片')
      photoChars += recipe.photo.length
    }
    ensure(['light', 'standard', 'rich'].includes(String(recipe.type)), '食谱类型无效')
    ensure(['breakfast', 'lunch', 'dinner', 'snack'].includes(String(recipe.mealTime)), '餐次无效')
    array(recipe.ingredients, 1000)
    for (const ingredient of recipe.ingredients) {
      object(ingredient); number(ingredient.foodId, 1)
      ensure(catalogIds.has(ingredient.foodId), '自建食谱含无法识别的食材')
      ensure(validGrams(ingredient.grams), '自建食谱分量无效')
    }
    number(recipe.totalKcal)
    for (const key of ['totalCarbs', 'totalProtein', 'totalFat']) nullableNumber(recipe[key])
  }
  if (photoChars > MAX_RECIPE_PHOTO_CHARS) throw new RecipePhotoLimitError()
}
