<template>
  <view class="my-page">
    <!-- 身体数据 -->
    <view class="form-card">
      <text class="section-title">身体数据</text>
      <view class="input-row">
        <text class="input-label">身高</text>
        <input class="field-input" type="number" placeholder="厘米" :value="store.profile.height"
          @input="update('height', Number($event.detail.value))" />
        <text class="input-unit">cm</text>
      </view>
      <view class="input-row">
        <text class="input-label">体重</text>
        <input class="field-input" type="digit" placeholder="公斤" :value="store.profile.weight"
          @input="update('weight', Number($event.detail.value))" />
        <text class="input-unit">kg</text>
      </view>
      <view class="input-row">
        <text class="input-label">年龄</text>
        <input class="field-input" type="number" placeholder="岁" :value="store.profile.age"
          @input="update('age', Number($event.detail.value))" />
        <text class="input-unit">岁</text>
      </view>
    </view>

    <!-- 活动与周期 -->
    <view class="form-card">
      <text class="section-title">活动与周期</text>
      <view class="picker-row">
        <text class="input-label">活动量</text>
        <picker :value="activityIndex" :range="activityOptions" @change="onActivityChange">
          <view class="picker-value">{{ activityOptions[activityIndex] }}<text class="picker-arrow">›</text></view>
        </picker>
      </view>
      <view class="picker-row">
        <text class="input-label">月经周期</text>
        <picker :value="cycleIndex" :range="cycleOptions" @change="onCycleChange">
          <view class="picker-value" :class="{ optional: !store.profile.cyclePhase }">
            {{ store.profile.cyclePhase ? cycleLabels[store.profile.cyclePhase] : '不选（可选）' }}
            <text class="picker-arrow">›</text>
          </view>
        </picker>
      </view>
    </view>

    <!-- 周期饮食建议 -->
    <view class="cycle-advice-card">
      <text class="advice-title">{{ adviceTitle }}</text>
      <text class="advice-text">{{ cycleAdvice }}</text>
    </view>

    <!-- 每日营养目标 -->
    <view v-if="store.nutritionTarget" class="result-card">
      <text class="section-title">每日营养目标</text>
      <view class="target-big">
        <text class="target-number">{{ store.nutritionTarget.targetCalories }}</text>
        <text class="target-unit">千卡/天</text>
      </view>
      <view class="target-detail">
        <text class="detail-text">BMR {{ store.nutritionTarget.bmr }} · 维持 {{ store.nutritionTarget.maintenance }}</text>
        <text v-if="store.profile.cyclePhase === 'luteal'" class="cycle-tip">
          黄体期 +50千卡
        </text>
      </view>
      <view class="macro-divider" />
      <view class="macro-grid">
        <view class="macro-block"><text class="macro-value">{{ store.nutritionTarget.carbs }}</text><text class="macro-tag">碳水</text><text class="macro-pct">{{ store.nutritionTarget.carbPercent }}%</text></view>
        <view class="macro-block"><text class="macro-value">{{ store.nutritionTarget.protein }}</text><text class="macro-tag">蛋白质</text><text class="macro-pct">{{ store.nutritionTarget.proteinPercent }}%</text></view>
        <view class="macro-block"><text class="macro-value">{{ store.nutritionTarget.fat }}</text><text class="macro-tag">脂肪</text><text class="macro-pct">{{ store.nutritionTarget.fatPercent }}%</text></view>
      </view>
    </view>
    <view v-else class="empty-card">
      <text class="empty-text">填写身高、体重、年龄后自动计算</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUserStore } from '@/store/user'

const store = useUserStore()

const activityOptions = ['几乎不动', '偶尔散步', '日常走动', '经常运动']
const activityValues = [1.2, 1.3, 1.4, 1.5]
const activityIndex = computed(() => activityValues.indexOf(store.profile.activityLevel))

const cycleKeys = [null, 'menstrual', 'follicular', 'luteal', 'ovulatory']
const cycleOptions = ['不选', '月经期', '卵泡期', '黄体期', '排卵期']
const cycleLabels: Record<string, string> = {
  menstrual: '月经期', follicular: '卵泡期', luteal: '黄体期', ovulatory: '排卵期',
}
const cycleIndex = computed(() => {
  const idx = cycleKeys.indexOf(store.profile.cyclePhase)
  return idx >= 0 ? idx : 0
})

const adviceTitle = ref('💡 生理期饮食建议')
const cycleAdvice = ref('选择你的生理周期，获取基于科学原理的个性化饮食建议。如：经期宜补铁、黄体期宜摄入健康脂肪。')

const phaseLabels: Record<string, string> = { menstrual: '月经期', follicular: '卵泡期', luteal: '黄体期', ovulatory: '排卵期' }
const phaseTips: Record<string, string> = {
  menstrual: '经期铁流失较多，建议多吃瘦牛肉、猪瘦肉、菠菜、鸡蛋等富铁食物。避免生冷冰饮，选择温热小米粥、杂粮饭等。',
  follicular: '卵泡期代谢回升，体力恢复。建议增加优质碳水如燕麦、红薯，搭配鸡胸肉、虾仁等低脂蛋白质。',
  ovulatory: '排卵期雌激素达峰值，代谢旺盛。建议多吃西兰花、番茄、蓝莓等高纤维蔬果，搭配三文鱼、核桃等抗炎食材。',
  luteal: '黄体期易食欲增加和水肿，每日+50千卡。优先选牛油果、三文鱼、坚果等健康脂肪，搭配杂粮饭、香蕉等缓释碳水。',
}

watch(() => store.profile.cyclePhase, (phase) => {
  if (phase && phaseLabels[phase]) {
    adviceTitle.value = `💡 ${phaseLabels[phase]}饮食建议`
    cycleAdvice.value = phaseTips[phase] || ''
  } else {
    adviceTitle.value = '💡 生理期饮食建议'
    cycleAdvice.value = '选择你的生理周期，获取基于科学原理的个性化饮食建议。如：经期宜补铁、黄体期宜摄入健康脂肪。'
  }
}, { immediate: true })

function update(key: string, val: number) {
  if (isNaN(val)) return
  store.updateProfile({ [key]: val })
}
function onActivityChange(e: any) {
  store.updateProfile({ activityLevel: activityValues[e.detail.value] })
}
function onCycleChange(e: any) {
  store.updateProfile({ cyclePhase: cycleKeys[e.detail.value] })
}

</script>

<style scoped>
.my-page { padding: 24rpx; }
.form-card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,.04); }
.section-title { font-size: 28rpx; font-weight: 600; color: #1a1a1a; display: block; margin-bottom: 20rpx; }
.input-row { display: flex; align-items: center; padding: 8rpx 0; }
.input-row + .input-row { border-top: 1px solid #f5f5f5; }
.input-label { font-size: 26rpx; color: #4d4d4d; width: 80rpx; }
.field-input { flex: 1; height: 72rpx; font-size: 28rpx; color: #1a1a1a; text-align: right; }
.input-unit { font-size: 24rpx; color: #8c8c8c; width: 48rpx; text-align: right; }
.picker-row { display: flex; align-items: center; justify-content: space-between; padding: 16rpx 0; }
.picker-row + .picker-row { border-top: 1px solid #f5f5f5; }
.picker-value { font-size: 26rpx; color: #1a1a1a; display: flex; align-items: center; gap: 4rpx; }
.picker-value.optional { color: #8c8c8c; }
.picker-arrow { font-size: 24rpx; color: #ccc; }
.result-card { background: #fff; border-radius: 16rpx; padding: 24rpx; }
.target-big { text-align: center; padding: 16rpx 0; }
.target-number { font-size: 64rpx; font-weight: 700; color: #07c160; }
.target-unit { font-size: 28rpx; color: #8c8c8c; margin-left: 8rpx; }
.target-detail { text-align: center; margin-bottom: 16rpx; }
.detail-text { font-size: 24rpx; color: #8c8c8c; }
.cycle-tip { display: block; font-size: 22rpx; color: #e67e22; margin-top: 4rpx; }
.macro-divider { height: 1px; background: #f0f0f0; margin: 16rpx 0; }
.macro-grid { display: flex; justify-content: space-around; }
.macro-block { text-align: center; }
.macro-value { font-size: 36rpx; font-weight: 700; color: #1a1a1a; display: block; }
.macro-tag { font-size: 22rpx; color: #8c8c8c; display: block; margin-top: 4rpx; }
.macro-pct { font-size: 20rpx; color: #8c8c8c; margin-top: 2rpx; }
.cycle-advice-card { background: #FFF3E0; border-radius: 16rpx; padding: 20rpx 24rpx; margin-bottom: 16rpx; border-left: 4rpx solid #E67E22; }
.advice-title { font-size: 26rpx; font-weight: 600; color: #E67E22; display: block; margin-bottom: 8rpx; }
.advice-text { font-size: 24rpx; color: #4d4d4d; line-height: 1.6; }

.empty-card { background: #fff; border-radius: 16rpx; padding: 48rpx; text-align: center; }
.empty-text { font-size: 26rpx; color: #8c8c8c; }
</style>
