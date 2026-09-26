import type { UserProfile, NutritionTarget } from '@/types/journal'
import { validProfileNumber } from './input'
/**
 * Mifflin-St Jeor 公式 (女性)
 * BMR = 10 × 体重(kg) + 6.25 × 身高(cm) - 5 × 年龄 - 161
 */
export function calcBMR(weight: number, height: number, age: number): number {
  return Math.round(10 * weight + 6.25 * height - 5 * age - 161)
}

/** 维持热量 = BMR × 活动系数 */
export function calcMaintenance(bmr: number, activityLevel: number): number {
  return Math.round(bmr * activityLevel)
}

/** 减脂热量 = 维持 - 缺口(>70kg 减500，≤70kg 减300) */
export function calcTargetCalories(maintenance: number, weight: number): number {
  const deficit = weight > 70 ? 500 : 300
  return maintenance - deficit
}

export interface MacroResult {
  carbs: number
  protein: number
  fat: number
  carbPercent: number
  proteinPercent: number
  fatPercent: number
  cycleAdjustment: number
  cycleTip: string
}

// Phase selection is informational; evidence does not support a universal calorie increment.
export function calcMacros(targetCalories: number, cyclePhase: string | null): MacroResult {
  return {
    carbs: Math.round(targetCalories * .48 / 4), protein: Math.round(targetCalories * .28 / 4), fat: Math.round(targetCalories * .24 / 9),
    carbPercent: 48, proteinPercent: 28, fatPercent: 24, cycleAdjustment: 0,
    cycleTip: cyclePhase ? '周期不自动改变热量目标，可结合食欲和身体感受调整饮食。' : '',
  }
}
export function profileTarget(profile: UserProfile): NutritionTarget | null {
  const { weight, height, age, activityLevel, cyclePhase } = profile
  if (weight === null || height === null || age === null || !validProfileNumber('weight', weight) || !validProfileNumber('height', height) || !validProfileNumber('age', age)) return null
  const bmr = calcBMR(weight, height, age)
  const maintenance = calcMaintenance(bmr, activityLevel)
  const targetCalories = calcTargetCalories(maintenance, weight)
  if (targetCalories <= 0) return null
  return { bmr, maintenance, targetCalories, deficit: maintenance - targetCalories, ...calcMacros(targetCalories, cyclePhase) }
}
