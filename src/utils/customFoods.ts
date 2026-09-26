import type { CustomFood, FoodItem } from '@/types/journal'
import { validGrams } from './input'
import { newId } from './nutrition'

export const foodCategories = [
  { key: 'staple', label: '主食' }, { key: 'protein', label: '蛋白质' },
  { key: 'vegetable', label: '蔬菜' }, { key: 'fruit', label: '水果' },
  { key: 'fat', label: '油脂' }, { key: 'other', label: '其他' },
]
export interface CustomFoodInput {
  name: string; grams: string | number; energy: string | number; unit: 'kcal' | 'kJ'; category: string
  carbs: string | number; protein: string | number; fat: string | number
}
export function suggestCategory(name: string): string {
  const value = name.trim()
  // Composite foods cannot be reliably classified from a single ingredient name.
  if (/奶茶|饮料|饮品|饼干|蛋糕|巧克力|沙拉|披萨|汉堡|蛋白棒|方便面|火锅/.test(value)) return 'other'
  const normalized = value.replace(/油麦菜/g, '青菜').replace(/核桃/g, '坚果').replace(/南瓜籽/g, '瓜子').replace(/玉米油/g, '食用油')
  const matches = [
    ['fat', /油|核桃|坚果|花生|芝麻|瓜子|南瓜籽|牛油果/],
    ['protein', /肉|鱼|虾|蟹|鸡蛋|鸭蛋|鹌鹑蛋|豆腐|豆干|豆皮|牛奶|酸奶|豆浆/],
    ['staple', /米饭|米线|面条|面包|馒头|燕麦|玉米|红薯|紫薯|土豆|粥|藜麦|荞麦/],
    ['vegetable', /白菜|青菜|菠菜|生菜|西兰花|花菜|芹菜|油麦菜|黄瓜|番茄|西红柿|茄子|辣椒|青椒|萝卜|冬瓜|南瓜|蘑菇|香菇|金针菇|木耳|海带|秋葵|芦笋/],
    ['fruit', /苹果|香蕉|橙|橘|柚|桃|梨|葡萄|草莓|蓝莓|西瓜|哈密瓜|芒果|菠萝|猕猴桃|火龙果|樱桃|荔枝/],
  ] as const
  const categories = matches.filter(([, pattern]) => pattern.test(normalized)).map(([category]) => category)
  return categories.length === 1 ? categories[0] : 'other'
}
export function nextCustomFoodId(catalog: readonly FoodItem[]): number {
  const id = catalog.reduce((max, food) => Math.max(max, food.id), 99999) + 1
  if (!Number.isSafeInteger(id) || id > 1e8) throw new Error('食材编号已达上限，请先备份并检查数据')
  return id
}
export function normalizeCustomFood(input: CustomFoodInput): Omit<CustomFood, 'id' | 'customKey'> {
  const name = input.name.trim(), grams = Number(input.grams), energy = Number(input.energy)
  if (!name || name.length > 50) throw new Error('食材名称请填写 1–50 个字')
  if (!validGrams(input.grams)) throw new Error('已知分量须大于 0 且不超过 5000 克')
  if (!String(input.energy).trim() || !Number.isFinite(energy) || energy < 0) throw new Error('请填写有效的热量，允许为 0')
  if (!['kcal', 'kJ'].includes(input.unit)) throw new Error('请选择热量单位')
  if (!foodCategories.some(category => category.key === input.category)) throw new Error('请选择食材分类')
  const kcal = energy / (input.unit === 'kJ' ? 4.184 : 1) / grams * 100
  if (kcal > 1000) throw new Error('换算后超过每100克1000千卡，请核对分量和千焦/千卡单位')
  const macro = (value: string | number): number | null => {
    if (!String(value).trim()) return null
    const amount = Number(value)
    if (!Number.isFinite(amount) || amount < 0 || amount > grams) throw new Error('营养克数须在 0 到已知分量之间')
    return Math.round(amount / grams * 100 * 1000) / 1000
  }
  const carbs = macro(input.carbs), protein = macro(input.protein), fat = macro(input.fat)
  if ((carbs ?? 0) + (protein ?? 0) + (fat ?? 0) > 100.1) throw new Error('三项营养总克数不能超过食材分量，请核对标签')
  return { name, category: input.category, kcal: Math.round(kcal * 10000) / 10000, carbs, protein, fat, portionGrams: grams }
}
export function createCustomFood(input: CustomFoodInput, catalog: readonly FoodItem[]): CustomFood {
  const food = normalizeCustomFood(input)
  if (catalog.some(existing => existing.name.trim().toLowerCase() === food.name.toLowerCase())) throw new Error('已有同名食材，请加上品牌或做法以区分')
  return { ...food, id: nextCustomFoodId(catalog), customKey: 'food_' + newId() }
}
