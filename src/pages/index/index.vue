<template>
  <view class="home-page">
    <view class="home-heading"><view><text class="page-eyebrow">一餐一餐，慢慢记</text><text class="today-title">今天的饮食</text></view><view class="date-pill"><AppIcon name="calendar" :size="16"/><text>{{ recordsStore.todayStr.slice(5).replace('-', ' / ') }}</text></view></view>
    <CalorieCard :target="userStore.nutritionTarget?.targetCalories" :consumed="recordsStore.todayTotal.kcal" :macros="macroPayload" />
    <view class="quick-actions"><button class="primary-action" @tap="openToday"><text class="button-plus">＋</text>记录饮食</button><button v-if="!userStore.nutritionTarget" class="profile-link" @tap="navigate('/pages/my/index')">设置参考目标</button></view>
    <view class="section-heading"><view><text class="section-title">{{ pendingPlanCount ? '待吃的这一餐' : '下一餐，吃点什么' }}</text><text class="section-note">{{ pendingPlanCount ? '计划先安排，吃过再确认' : '看看日常搭配，也可以直接记录' }}</text></view><button v-if="pendingPlanCount" class="text-link" @tap="journalNavigation.openToday('plan')">全部 {{ pendingPlanCount }} 项 ›</button></view>
    <view v-if="nextPlan" class="next-meal surface-panel" @tap="journalNavigation.openToday('plan')"><view class="meal-image"><FoodVisual :src="planImage(nextPlan)" :category="nextPlan.recipe ? 'dish' : nextPlan.items[0].category" :label="nextPlan.name" /></view><view class="meal-copy"><text class="pending-tag">{{ nextPlan.state === 'partial' ? '部分已吃' : '待吃' }}</text><text class="meal-name">{{ displayDishName(nextPlan.name) }}</text><text class="meal-meta">计划 {{ Math.round(nextPlan.kcal) }} 千卡</text><text class="meal-meta">{{ nextPlan.items.map(item => item.foodName).join(' · ') }}</text><button class="meal-next" @tap.stop="journalNavigation.openToday('plan')">查看计划 <AppIcon name="arrow" :size="17" /></button></view></view>
    <view v-else class="choose-meal surface-panel"><view class="choose-image"><FoodVisual src="/static/food/r2.jpg" label="鸡胸肉杂粮饭" /></view><view class="choose-copy"><text class="meal-name">从一道搭配开始</text><text class="meal-meta">选好这一餐，再按实际分量记下。</text><button class="meal-next" @tap="navigate('/pages/recipe/index')">挑选食谱 <AppIcon name="arrow" :size="17" /></button></view></view>
    <view class="rec-section" v-if="userStore.nutritionTarget && recommendations.length"><view class="section-heading"><text class="section-title">搭配参考</text><AppIcon name="leaf" /></view><text class="section-note">按今天的营养差额筛选</text><view class="recommendations"><view v-for="rec in recommendations" :key="rec.food.id" class="rec-row"><view class="rec-icon"><FoodVisual :category="rec.food.category" /></view><view class="rec-info"><text class="rec-name">{{ rec.food.name }}</text><text class="rec-reason">{{ rec.reason }} · {{ rec.food.kcal }} 千卡 / 100 g</text></view></view></view><text class="section-note end-note">分量按实际需要安排。</text></view>
    <view v-else-if="userStore.nutritionTarget" class="rec-section"><text class="section-title">搭配参考</text><text class="section-note">{{ incompleteNutrition(recordsStore.todayTotal) ? '部分营养数据未完善，暂不按营养差额推荐。' : '暂无进一步建议，按饥饿感和实际需要安排饮食。' }}</text></view>
    <view class="start-date"><text>开始记录后的第 {{ userStore.streakDays }} 天</text><picker mode="date" :value="userStore.startDate" start="1900-01-01" :end="journal.today" @change="onStartDatePick"><view class="start-date-action" role="button" aria-label="调整起始日">调整起始日</view></picker></view>
    <text class="image-note">食物图片为示意，热量按食材与分量计算。</text>
  </view>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import FoodVisual from '@/components/FoodVisual.vue'
import AppIcon from '@/components/AppIcon.vue'
import { planImage, displayDishName } from '@/utils/foodVisuals'
import CalorieCard from '@/components/CalorieCard.vue'
import { useJournalStore } from '@/store/journal'
import { useJournalNavigation } from '@/store/journalNavigation'
import { groupPlans } from '@/utils/planGroups'
const journal = useJournalStore()
const journalNavigation = useJournalNavigation()
const pendingPlans = computed(() => groupPlans(journal.todayDay.plans, journal.todayDay.entries).filter(group => group.pendingIds.length))
const pendingPlanCount = computed(() => pendingPlans.value.length)
const nextPlan = computed(() => pendingPlans.value[0])
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
  return { carbs: { target:t?.carbs, consumed:n.carbs }, protein:{target:t?.protein,consumed:n.protein}, fat:{target:t?.fat,consumed:n.fat} }
})
function openToday() { journalNavigation.openToday('record') }
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

.home-page { max-width:620px; margin:0 auto; padding:24px 20px 28px; padding-bottom:calc(28px + env(safe-area-inset-bottom)); }
.home-heading { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }.page-eyebrow { display:block; color:var(--muted); font-size:12px; margin-bottom:4px; }.today-title { font-size:26px; font-weight:650; letter-spacing:-.5px; }.date-pill { display:flex; gap:7px; align-items:center; color:var(--brand); background:#edf0e7; padding:7px 11px; border-radius:24px; font-size:12px; }
.quick-actions { display:flex; align-items:center; gap:14px; margin:16px 0 28px; }.primary-action { flex:1; margin:0; display:flex; gap:8px; align-items:center; justify-content:center; }.button-plus { font-size:23px; font-weight:400; }.profile-link { background:transparent; margin:0; padding:0 4px; font-size:12px; color:var(--brand); }
.section-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }.section-title { display:block; font-size:19px; font-weight:650; }.section-note { display:block; color:var(--muted); font-size:12px; margin-top:4px; }.text-link { background:transparent; margin:0; padding:0; font-size:12px; color:var(--brand); white-space:nowrap; }
.next-meal { display:flex; padding:12px; gap:16px; }.meal-image { width:38%; min-height:155px; flex-shrink:0; border-radius:14px; overflow:hidden; }.meal-copy { flex:1; min-width:0; padding:2px 0; }.pending-tag { display:inline-block; color:#856138; background:#f6edde; font-size:10px; border-radius:5px; padding:2px 6px; margin-bottom:6px; }.meal-name { display:block; font-size:17px; font-weight:600; overflow-wrap:anywhere; line-height:1.5; }.meal-meta { display:block; font-size:12px; color:var(--muted); margin-top:5px; }.meal-next { display:flex; align-items:center; gap:8px; background:transparent; color:var(--brand); font-size:13px; margin:5px 0 0; padding:0; text-align:left; }
.choose-meal { overflow:hidden; }.choose-image { height:155px; }.choose-copy { padding:16px 18px 12px; }.choose-copy .meal-next { min-height:40px; }
.rec-section { margin-top:28px; }.recommendations { margin-top:12px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }.rec-row { display:flex; align-items:center; gap:10px; }.rec-icon { width:44px; height:44px; border-radius:12px; overflow:hidden; flex-shrink:0; }.rec-info { min-width:0; }.rec-name { display:block; font-size:14px; }.rec-reason { display:block; font-size:11px; color:var(--muted); }.end-note { margin-top:14px; }
.start-date { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:26px; padding-top:12px; border-top:1px solid var(--line); font-size:12px; color:var(--muted); }.start-date-action { display:flex; align-items:center; min-height:44px; color:var(--brand); }.image-note { display:block; color:var(--muted); font-size:11px; margin-top:8px; }
@media(max-width:350px) { .home-page { padding:20px 16px 28px; }.today-title { font-size:24px; }.quick-actions { gap:8px; }.next-meal { gap:12px; }.meal-name { font-size:15px; } }

</style>
