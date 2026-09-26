<template>
  <view class="home-page">
    <view class="home-heading"><text class="today-title">今天</text><text class="today-date">{{ recordsStore.todayStr }}</text></view>
    <CalorieCard v-if="userStore.nutritionTarget" :target="userStore.nutritionTarget.targetCalories" :consumed="recordsStore.todayTotal.kcal" :macros="macroPayload" />
    <view v-else class="empty-card"><text class="empty-title">今天已记录 {{ intakeKcal }} 千卡</text><text class="empty-desc">填写身体数据后可查看参考目标。</text><button class="secondary-action" @tap="navigate('/pages/my/index')">设置参考目标</button></view>
    <button class="primary-action" @tap="openToday">记录饮食</button>
    <view class="rec-section" v-if="userStore.nutritionTarget && recommendations.length">
      <text class="section-title">搭配参考</text><text class="section-note">按今天的营养差额筛选</text>
      <view v-for="rec in recommendations" :key="rec.food.id" class="rec-row"><view class="rec-info"><text class="rec-name">{{ rec.food.name }}</text><text class="rec-reason">{{ rec.reason }}</text></view><text class="rec-kcal">{{ rec.food.kcal }} 千卡 / 100 g</text></view>
      <text class="section-note end-note">仅作食材参考，分量按实际需要安排。</text>
    </view>
    <view v-else-if="userStore.nutritionTarget" class="rec-section"><text class="section-title">搭配参考</text><text class="section-note">{{ incompleteNutrition(recordsStore.todayTotal) ? '部分食材营养数据未完善，暂不按营养差额推荐。' : '今天暂无进一步建议，按饥饿感和实际需要安排饮食。' }}</text></view>
    <view class="start-date"><text>开始记录后的第 {{ userStore.streakDays }} 天</text><picker mode="date" :value="userStore.startDate" start="1900-01-01" :end="journal.today" @change="onStartDatePick"><view class="start-date-action" role="button" aria-label="调整起始日">调整起始日</view></picker></view>
  </view>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import CalorieCard from '@/components/CalorieCard.vue'
import { useJournalStore } from '@/store/journal'
const journal = useJournalStore()
const navigate = (url: string) => uni.switchTab({ url })
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'
import { useRecordsStore } from '@/store/records'
import { incompleteNutrition } from '@/utils/nutrition'

const allFoods = computed(() => journal.allFoods)
const userStore = useUserStore()
const recordsStore = useRecordsStore()
onShow(() => recordsStore.loadToday())
onPullDownRefresh(() => { recordsStore.loadToday(); uni.stopPullDownRefresh() })


function onStartDatePick(event: { detail: { value: string } }) {
  try { userStore.setStartDate(event.detail.value); uni.showToast({ title: '起始日已更新', icon: 'none' }) }
  catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '日期未保存，请重试', icon: 'none' }) }
}

const intakeKcal = computed(() => Math.round(recordsStore.todayTotal.kcal))
const remainingKcal = computed(() => (userStore.nutritionTarget?.targetCalories || 0) - intakeKcal.value)

const macroPayload = computed(() => {
  const t = userStore.nutritionTarget, n = recordsStore.todayTotal
  return t ? { carbs: { target:t.carbs, consumed:n.carbs }, protein:{target:t.protein,consumed:n.protein}, fat:{target:t.fat,consumed:n.fat} } : undefined
})
function openToday() { journal.selectDate(journal.today); navigate('/pages/record/index') }
// 营养素缺口推荐
const recommendations = computed(() => {
  if (!userStore.nutritionTarget || incompleteNutrition(recordsStore.todayTotal)) return []
  const remaining = {
    carbs: userStore.nutritionTarget.carbs - recordsStore.todayTotal.carbs!,
    protein: userStore.nutritionTarget.protein - recordsStore.todayTotal.protein!,
    fat: userStore.nutritionTarget.fat - recordsStore.todayTotal.fat!,
    kcal: remainingKcal.value,
  }
  if (remaining.kcal <= 0) return []

  // 找最大缺口
  type Gap = { key: string; val: number; cat: string }
  const gaps: Gap[] = [
    { key: 'carbs', val: remaining.carbs, cat: 'staple' },
    { key: 'protein', val: remaining.protein, cat: 'protein' },
    { key: 'fat', val: remaining.fat, cat: 'fat' },
  ]
  gaps.sort((a, b) => b.val - a.val)

  const results: { food: any; reason: string }[] = []
  for (const gap of gaps) {
    if (gap.val <= 0) continue
    const foods = allFoods.value.filter((f: any) => f.category === gap.cat && !incompleteNutrition(f) && f.kcal > 0)
    if (!foods.length) continue
    // 选该营养素密度最高的 2 个
    const scored = foods.map((f: any) => {
      const perGram = (f[gap.key] || 0) / f.kcal
      return { food: f, score: perGram }
    })
    scored.sort((a: any, b: any) => b.score - a.score)
    const top = scored.slice(0, 2)
    for (const s of top) {
      const gName = gap.key === 'carbs' ? '碳水' : gap.key === 'protein' ? '蛋白质' : '脂肪'
      results.push({ food: s.food, reason: `补${gName}` })
    }
  }
  return results.slice(0, 6)
})
</script>
<style scoped>
.home-page { max-width:960rpx; margin:0 auto; padding:36rpx; padding-bottom:calc(32rpx + env(safe-area-inset-bottom)); }
.home-heading { display:flex; align-items:baseline; gap:20rpx; margin-bottom:12rpx; }.today-title { font-size:40rpx; font-weight:600; }.today-date { color:var(--muted); font-size:max(26rpx,13px); }
.primary-action { margin:0 0 48rpx; }.empty-card { padding:24rpx 0 36rpx; }.empty-title { display:block; font-size:36rpx; }.empty-desc { display:block; color:var(--muted); margin-top:16rpx; }
.section-title { display:block; font-size:max(34rpx,17px); font-weight:600; }.section-note { display:block; font-size:max(24rpx,12px); color:var(--muted); margin:10rpx 0 20rpx; }
.rec-row { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--line); padding:22rpx 0; gap:20rpx; }.rec-info { flex:1; min-width:0; }.rec-name { font-size:max(30rpx,15px); display:block; }.rec-reason { font-size:max(24rpx,12px); color:var(--muted); }.rec-kcal { font-size:max(24rpx,12px); color:var(--muted); }.end-note { margin-top:24rpx; }
.start-date { width:100%; padding:16rpx 0; margin-top:48rpx; display:flex; align-items:center; justify-content:space-between; gap:12rpx; border-top:1px solid var(--line); font-size:max(24rpx,12px); color:var(--muted); line-height:1.8; }.start-date-action { color:var(--brand); min-height:44px; display:flex; align-items:center; white-space:nowrap; }
</style>
