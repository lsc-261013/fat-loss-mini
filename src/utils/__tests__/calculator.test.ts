import { describe, it, expect } from 'vitest'
import { calcBMR, calcMaintenance, calcTargetCalories, calcMacros } from '../calculator'

describe('calcBMR', () => {
  it('标准女性: 65kg 165cm 30岁', () => {
    expect(calcBMR(65, 165, 30)).toBe(1370)
  })

  it('超重女性: 80kg 160cm 25岁', () => {
    expect(calcBMR(80, 160, 25)).toBe(1514)
  })

  it('偏瘦女性: 50kg 158cm 22岁', () => {
    // 10*50 + 6.25*158 - 5*22 - 161 = 500 + 987.5 - 110 - 161 = 1217
    expect(calcBMR(50, 158, 22)).toBe(1217)
  })
})

describe('calcMaintenance', () => {
  it('久坐 BMR1500 → 1800', () => {
    expect(calcMaintenance(1500, 1.2)).toBe(1800)
  })

  it('轻度活动 BMR1500 → 1950', () => {
    expect(calcMaintenance(1500, 1.3)).toBe(1950)
  })
})

describe('calcTargetCalories', () => {
  it('体重≤70kg: 维持2000 → 减脂1700 (缺口300)', () => {
    expect(calcTargetCalories(2000, 65)).toBe(1700)
  })

  it('体重>70kg: 维持2200 → 减脂1700 (缺口500)', () => {
    expect(calcTargetCalories(2200, 75)).toBe(1700)
  })
})

describe('calcMacros', () => {
  it('正常日 1700kcal 碳48%蛋28%脂24%', () => {
    const r = calcMacros(1700, null)
    expect(r.carbs).toBe(Math.round(1700 * 0.48 / 4))
    expect(r.protein).toBe(Math.round(1700 * 0.28 / 4))
    expect(r.fat).toBe(Math.round(1700 * 0.24 / 9))
    expect(r.cycleAdjustment).toBe(0)
    expect(r.cycleTip).toBe('')
  })

  it('黄体期 1700kcal → 1750kcal 碳45%脂27%', () => {
    const r = calcMacros(1700, 'luteal')
    expect(r.cycleAdjustment).toBe(50)
    expect(r.cycleTip).toContain('黄体期')
    expect(r.carbs).toBe(Math.round(1750 * 0.45 / 4))
    expect(r.protein).toBe(Math.round(1750 * 0.28 / 4))
    expect(r.fat).toBe(Math.round(1750 * 0.27 / 9))
  })
})
