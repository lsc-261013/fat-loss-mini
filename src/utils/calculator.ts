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

/**
 * 三大宏量营养素分配
 * 默认：碳水48% 蛋白质28% 脂肪24%
 * 黄体期：碳水45% 蛋白质28% 脂肪27%，总热量 +50kcal
 */
export function calcMacros(targetCalories: number, cyclePhase: string | null): MacroResult {
  let carbPct = 0.48
  let proteinPct = 0.28
  let fatPct = 0.24
  let cycleAdjustment = 0
  let cycleTip = ''

  if (cyclePhase === 'luteal') {
    carbPct = 0.45
    proteinPct = 0.28
    fatPct = 0.27
    cycleAdjustment = 50
    cycleTip = '黄体期可适当增加健康脂肪摄入'
  }

  const adjustedCalories = targetCalories + cycleAdjustment

  return {
    carbs: Math.round((adjustedCalories * carbPct) / 4),
    protein: Math.round((adjustedCalories * proteinPct) / 4),
    fat: Math.round((adjustedCalories * fatPct) / 9),
    carbPercent: Math.round(carbPct * 100),
    proteinPercent: Math.round(proteinPct * 100),
    fatPercent: Math.round(fatPct * 100),
    cycleAdjustment,
    cycleTip,
  }
}
