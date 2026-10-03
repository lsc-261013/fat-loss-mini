<template>
  <view class="my-page">
    <view class="my-heading"><view><text class="page-eyebrow">身体资料与本机数据</text><text class="page-title">我的</text></view><view class="heading-mark"><AppIcon name="leaf" :size="30"/></view></view>
    <!-- Profile -->
    <view class="form-card">
      <text class="section-title">身体数据</text><text class="form-note">用于估算目标，目前适用于成年女性</text>
      <view class="input-row">
        <text class="input-label">身高</text>
        <input class="field-input" aria-label="身高，厘米" type="number" placeholder="厘米" :value="store.profile.height"
          @blur="onProfileBlur('height', $event)" />
        <text class="input-unit">cm</text>
      </view>
      <view class="input-row">
        <text class="input-label">体重</text>
        <input class="field-input" aria-label="体重，公斤" type="digit" placeholder="公斤" :value="store.profile.weight"
          @blur="onProfileBlur('weight', $event)" />
        <text class="input-unit">kg</text>
      </view>
      <view class="input-row">
        <text class="input-label">年龄</text>
        <input class="field-input" aria-label="年龄，岁" type="number" placeholder="岁" :value="store.profile.age"
          @blur="onProfileBlur('age', $event)" />
        <text class="input-unit">岁</text>
      </view>
    </view>

    <text v-if="profileError" class="field-error">{{ profileError }}</text><text v-else class="local-note">{{ saved ? '已保存到本机' : '填写后离开输入框会自动保存' }}</text>
    <!-- Activity -->
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
    <view v-if="store.profile.cyclePhase" class="cycle-advice-card">
      <text class="advice-title">{{ adviceTitle }}</text>
      <text class="advice-text">{{ cycleAdvice }}</text>
    </view>

    <!-- 每日参考目标 -->
    <view v-if="store.nutritionTarget" class="result-card">
      <text class="section-title">每日参考目标</text>
      <view class="target-big">
        <text class="target-number">{{ store.nutritionTarget.targetCalories }}</text>
        <text class="target-unit">千卡/天</text>
      </view>
      <view v-if="showTargetDetails" class="target-detail">
        <text class="detail-text">BMR {{ store.nutritionTarget.bmr }} · 维持 {{ store.nutritionTarget.maintenance }}</text>
        <text class="cycle-tip">估算参考值 · 周期选择不自动增减热量</text>
      </view>
      <button class="detail-toggle" @tap="showTargetDetails = !showTargetDetails">{{ showTargetDetails ? '收起计算说明' : '查看计算说明' }}</button><view class="macro-divider" />
      <view class="macro-grid">
        <view class="macro-block"><text class="macro-value">{{ store.nutritionTarget.carbs }}<text class="macro-unit"> g</text></text><text class="macro-tag">碳水</text><text class="macro-pct">{{ store.nutritionTarget.carbPercent }}%</text></view>
        <view class="macro-block"><text class="macro-value">{{ store.nutritionTarget.protein }}<text class="macro-unit"> g</text></text><text class="macro-tag">蛋白质</text><text class="macro-pct">{{ store.nutritionTarget.proteinPercent }}%</text></view>
        <view class="macro-block"><text class="macro-value">{{ store.nutritionTarget.fat }}<text class="macro-unit"> g</text></text><text class="macro-tag">脂肪</text><text class="macro-pct">{{ store.nutritionTarget.fatPercent }}%</text></view>
      </view>
    </view>
    <view v-else class="empty-card">
      <text class="empty-text">填写身高、体重、年龄后自动计算</text>
    </view>
    <text v-if="showTargetDetails" class="local-note">使用女性成人公式估算，非医疗处方。营养素按 48% / 28% / 24% 分配，克数取整可能产生小幅差额。调整资料只更新今天，历史目标保留。</text>
    <DataBackup />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import DataBackup from '@/components/DataBackup.vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { validProfileNumber } from '@/utils/input'
const profileError = ref('')
const saved = ref(false)
const showTargetDetails = ref(false)
import { useUserStore } from '@/store/user'

const store = useUserStore()
onShow(() => store.loadFromStorage())
onPullDownRefresh(() => { store.loadFromStorage(); uni.stopPullDownRefresh() })

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

const adviceTitle = ref('生理期饮食建议')
const cycleAdvice = ref('周期可选填，用于一般饮食提示。个体差异较大，不据此固定增加热量或改变营养素比例。')

const phaseLabels: Record<string, string> = { menstrual: '月经期', follicular: '卵泡期', luteal: '黄体期', ovulatory: '排卵期' }
const phaseTips: Record<string, string> = {
  menstrual: '经期注意规律进餐，可搭配瘦肉、豆类等含铁食物。食物温度按个人舒适程度选择；若经量过多或明显乏力，建议就医评估。',
  follicular: '按平时的食欲和活动量安排饮食，主食、蛋白质食物和蔬菜均衡搭配，无需因周期刻意加减餐。',
  ovulatory: '保持规律饮食和饮水，按个人感受安排活动。周期阶段本身不代表需要更多或更少的热量。',
  luteal: '部分人会感到更饿或短暂水肿，可按实际饥饿感安排加餐。研究尚不足以给每个人统一规定额外热量，因此不自动增加 50 千卡。',
}

watch(() => store.profile.cyclePhase, (phase) => {
  if (phase && phaseLabels[phase]) {
    adviceTitle.value = `${phaseLabels[phase]}饮食建议`
    cycleAdvice.value = phaseTips[phase] || ''
  } else {
    adviceTitle.value = '生理期饮食建议'
    cycleAdvice.value = '周期可选填，用于一般饮食提示。个体差异较大，不据此固定增加热量或改变营养素比例。'
  }
}, { immediate: true })

function onProfileBlur(key: 'height' | 'weight' | 'age', event: Event) {
  update(key, String((event as unknown as { detail: { value: string } }).detail.value))
}
function update(key: 'height' | 'weight' | 'age', raw: string) {
  const val = raw.trim() === '' ? null : Number(raw)
  if (val !== null && !validProfileNumber(key, val)) {
    profileError.value = {height: '身高请输入 100–230 cm', weight: '体重请输入 25–300 kg', age: '年龄请输入 18–100 的整数'}[key]
    return
  }
  try { store.updateProfile({ [key]: val }); profileError.value = ''; saved.value = true }
  catch { profileError.value = '保存失败，请重试；上次保存的数据仍保留。' }
}
function onActivityChange(e: any) {
  try { store.updateProfile({ activityLevel: activityValues[e.detail.value] }); saved.value = true; profileError.value = '' }
  catch { profileError.value = '保存失败，请重试；上次保存的数据仍保留。' }
}
function onCycleChange(e: any) {
  try { store.updateProfile({ cyclePhase: cycleKeys[e.detail.value] }); saved.value = true; profileError.value = '' }
  catch { profileError.value = '保存失败，请重试；上次保存的数据仍保留。' }
}

</script>

<style scoped>
.my-page { margin:0 auto; }
.form-card { border-bottom:1px solid var(--line); }.section-title { display:block; margin-bottom:12rpx; }.form-note { display:block; color:var(--muted); }
.input-row,.picker-row { display:flex; align-items:center; gap:12rpx; }.input-label { flex-shrink:0; }.field-input { flex:1; min-width:0; background:var(--wash); text-align:right; }.input-unit { color:var(--muted); text-align:right; }
.picker-row { justify-content:space-between; }.picker-value { display:flex; align-items:center; gap:16rpx; min-height:44px; }.picker-arrow,.optional { color:var(--muted); }
.cycle-advice-card { background:var(--wash); }.advice-title { display:block; font-size:max(28rpx,14px); margin-bottom:12rpx; }.advice-text { color:var(--muted); line-height:1.8; }
.result-card { border-bottom:1px solid var(--line); }.target-big { padding:12rpx 0; }.target-unit { color:var(--muted); margin-left:12rpx; }.target-detail { margin:12rpx 0; }.detail-text,.cycle-tip { display:block; font-size:max(24rpx,12px); color:var(--muted); line-height:1.8; }
.detail-toggle { margin:0; padding:0; background:transparent; text-align:left; color:var(--brand); font-size:max(24rpx,12px); line-height:44px; }.macro-divider { height:1px; background:var(--line); margin:12rpx 0 24rpx; }.macro-grid { display:flex; }.macro-block { flex:1; }.macro-value { display:block; font-weight:500; }.macro-unit,.macro-tag,.macro-pct { color:var(--muted); font-weight:400; }.macro-tag { display:block; margin-top:4rpx; }.macro-pct { margin-top:2rpx; }
.empty-card { color:var(--muted); }

.my-page { max-width:620px; padding:24px 20px 36px; }.my-heading { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }.page-title { display:block; font-size:26px; font-weight:650; }.page-eyebrow { display:block; font-size:12px; color:var(--muted); margin-bottom:4px; }.heading-mark { display:flex; align-items:center; justify-content:center; width:56px; height:56px; background:#e8eee0; border-radius:50%; }
.form-card { background:var(--surface); border:1px solid var(--line); border-radius:20px; padding:20px; margin-bottom:16px; }.section-title { font-size:17px; font-weight:600; }.form-note { font-size:12px; margin-bottom:8px; }.input-row,.picker-row { min-height:60px; padding:8px 0; }.input-label { width:64px; font-size:14px; }.field-input { height:46px; border-radius:12px; padding:0 14px; font-size:16px; }.input-unit { width:26px; font-size:12px; }.picker-value { font-size:14px; }.local-note { font-size:12px; margin:12px 2px 20px; }
.cycle-advice-card { border-radius:16px; padding:16px; margin-bottom:16px; }.advice-text { font-size:13px; }.result-card { background:#edf2e5; border:1px solid #dce5d3; border-radius:20px; padding:20px; }.target-number { font-size:38px; font-weight:600; color:var(--brand-deep); }.target-unit { font-size:12px; }.macro-value { font-size:19px; }.macro-unit,.macro-tag,.macro-pct { font-size:12px; }.empty-card { background:var(--wash); border-radius:16px; padding:18px; font-size:13px; line-height:1.8; }
@media(max-width:350px) { .my-page { padding:20px 16px 28px; }.form-card,.result-card { padding:16px; }.input-label { width:60px; }.picker-value { font-size:13px; } }
</style>
