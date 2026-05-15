export interface Recipe {
  id: string
  name: string
  type: 'light' | 'standard' | 'rich'
  mealTime: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  ingredients: { foodId: number; grams: number }[]
  totalKcal: number
  totalCarbs: number
  totalProtein: number
  totalFat: number
  description: string
}

export const recipes: Recipe[] = [
  {
    id: 'r1',
    name: '早餐：燕麦鸡蛋餐',
    type: 'standard',
    mealTime: 'breakfast',
    ingredients: [
      { foodId: 9, grams: 40 },
      { foodId: 13, grams: 100 },
      { foodId: 33, grams: 100 },
    ],
    totalKcal: 384,
    totalCarbs: 48,
    totalProtein: 20,
    totalFat: 14,
    description: '≈384大卡，高纤维饱腹早餐',
  },
  {
    id: 'r2',
    name: '午餐：鸡胸肉杂粮饭',
    type: 'standard',
    mealTime: 'lunch',
    ingredients: [
      { foodId: 11, grams: 150 },
      { foodId: 2, grams: 150 },
      { foodId: 21, grams: 200 },
    ],
    totalKcal: 478,
    totalCarbs: 52,
    totalProtein: 54,
    totalFat: 5,
    description: '≈478大卡，高蛋白午餐，补充蛋白质缺口',
  },
  {
    id: 'r3',
    name: '午餐：三文鱼轻食',
    type: 'light',
    mealTime: 'lunch',
    ingredients: [
      { foodId: 19, grams: 100 },
      { foodId: 25, grams: 150 },
      { foodId: 23, grams: 100 },
      { foodId: 42, grams: 5 },
    ],
    totalKcal: 352,
    totalCarbs: 8,
    totalProtein: 25,
    totalFat: 26,
    description: '≈352大卡，低碳水高蛋白午餐',
  },
  {
    id: 'r4',
    name: '晚餐：虾仁豆腐煲',
    type: 'light',
    mealTime: 'dinner',
    ingredients: [
      { foodId: 14, grams: 100 },
      { foodId: 16, grams: 200 },
      { foodId: 24, grams: 150 },
    ],
    totalKcal: 283,
    totalCarbs: 14,
    totalProtein: 36,
    totalFat: 10,
    description: '≈283大卡，低卡高蛋白晚餐',
  },
  {
    id: 'r5',
    name: '晚餐：牛肉蔬菜盘',
    type: 'rich',
    mealTime: 'dinner',
    ingredients: [
      { foodId: 15, grams: 120 },
      { foodId: 21, grams: 200 },
      { foodId: 30, grams: 100 },
      { foodId: 43, grams: 50 },
    ],
    totalKcal: 398,
    totalCarbs: 25,
    totalProtein: 35,
    totalFat: 19,
    description: '≈398大卡，丰盛晚餐，适合缺口较大时选择',
  },
  {
    id: 'r6',
    name: '加餐：坚果酸奶杯',
    type: 'light',
    mealTime: 'snack',
    ingredients: [
      { foodId: 44, grams: 15 },
      { foodId: 37, grams: 80 },
    ],
    totalKcal: 167,
    totalCarbs: 14,
    totalProtein: 4,
    totalFat: 11,
    description: '≈167大卡，健康脂肪加餐',
  },
  {
    id: 'r7',
    name: '午餐：猪肉白菜炖菜',
    type: 'standard',
    mealTime: 'lunch',
    ingredients: [
      { foodId: 3, grams: 100 },
      { foodId: 12, grams: 100 },
      { foodId: 22, grams: 200 },
      { foodId: 16, grams: 100 },
    ],
    totalKcal: 460,
    totalCarbs: 54,
    totalProtein: 38,
    totalFat: 11,
    description: '≈460大卡，河南家常风味，蛋白质和膳食纤维均衡',
  },
]
