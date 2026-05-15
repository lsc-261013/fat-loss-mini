<template>
  <view class="home-page">
    <!-- 坚持天数 -->
    <view v-if="userStore.streakDays > 0" class="streak-bar" @tap="onStreakTap">
      <text class="streak-text">已坚持 {{ userStore.streakDays }} 天</text>
    </view>

    <!-- 摄入状态大卡 -->
    <view v-if="userStore.nutritionTarget" class="intake-card">
      <text class="intake-label">今日摄入</text>
      <view class="intake-big">
        <text class="intake-num" :class="{ over: intakeKcal > userStore.nutritionTarget.targetCalories }">{{ intakeKcal }}</text>
        <text class="intake-slash">/</text>
        <text class="intake-target">{{ userStore.nutritionTarget.targetCalories }}</text>
        <text class="intake-unit">千卡</text>
      </view>

      <view class="intake-progress-wrap">
        <view class="intake-progress-bg">
          <view class="intake-progress-fill" :style="{ width: progressPct + '%' }" :class="{ over: intakeKcal > userStore.nutritionTarget.targetCalories }" />
        </view>
        <text class="intake-pct">{{ progressPct }}%</text>
      </view>

      <view class="intake-remain" :class="{ over: remainingKcal < 0 }">
        {{ remainingKcal >= 0 ? '还可吃 ' + remainingKcal + ' 千卡' : '已超出 ' + Math.abs(remainingKcal) + ' 千卡' }}
      </view>

      <view class="macro-mini">
        <view class="mm-item">
          <text class="mm-val">{{ Math.round(recordsStore.todayTotal.carbs) }}</text>
          <text class="mm-label">碳水</text>
          <text class="mm-target">/{{ userStore.nutritionTarget.carbs }}g</text>
        </view>
        <view class="mm-item">
          <text class="mm-val">{{ Math.round(recordsStore.todayTotal.protein) }}</text>
          <text class="mm-label">蛋白质</text>
          <text class="mm-target">/{{ userStore.nutritionTarget.protein }}g</text>
        </view>
        <view class="mm-item">
          <text class="mm-val">{{ Math.round(recordsStore.todayTotal.fat) }}</text>
          <text class="mm-label">脂肪</text>
          <text class="mm-target">/{{ userStore.nutritionTarget.fat }}g</text>
        </view>
      </view>
    </view>

    <!-- 未填写资料 -->
    <view v-else class="empty-card">
      <text class="empty-title">尚未设置目标</text>
      <text class="empty-desc">前往「我的」页填写身体数据，自动计算每日热量目标</text>
    </view>

    <!-- 营养素缺口推荐 -->
    <view v-if="userStore.nutritionTarget && recommendations.length > 0" class="rec-card">
      <text class="rec-title">今日推荐</text>
      <text class="rec-sub">根据营养素缺口智能推荐</text>
      <view class="rec-list">
        <view v-for="rec in recommendations" :key="rec.food.id" class="rec-item">
          <text class="rec-emoji">{{ foodEmoji(rec.food.id) }}</text>
          <view class="rec-info">
            <text class="rec-name">{{ rec.food.name }}</text>
            <text class="rec-reason">{{ rec.reason }}</text>
          </view>
          <text class="rec-kcal">{{ rec.food.kcal }}千卡/100g</text>
        </view>
      </view>
    </view>

    <view v-else-if="userStore.nutritionTarget" class="empty-card">
      <text class="empty-desc">今日营养已均衡，继续保持</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUserStore } from '@/store/user'
import { useRecordsStore } from '@/store/records'
import foodsData from '@/static/foods.json'

const allFoods = foodsData as any[]
const userStore = useUserStore()
const recordsStore = useRecordsStore()

const emojiMap: Record<number,string> = {
  1:'🍚',2:'🍚',3:'🥟',4:'🍜',5:'🍞',6:'🍠',7:'🌽',8:'🥣',9:'🥣',10:'🍜',
  11:'🍗',12:'🥩',13:'🥚',14:'🦐',15:'🥩',16:'🧈',17:'🫘',18:'🐟',19:'🐟',
  21:'🥦',22:'🥬',23:'🥬',24:'🍅',25:'🥒',26:'🥔',27:'🫘',28:'🍆',29:'🫑',30:'🥕',
  31:'🍈',32:'🥬',33:'🍌',34:'🍎',35:'🍉',36:'🍑',37:'🫐',38:'🍐',39:'🍊',
  41:'🫒',42:'🫒',43:'🥑',44:'🥜',45:'🥜',46:'🫒',47:'🎃',
}
function foodEmoji(id: number) { return emojiMap[id] || '🍽️' }

function onStreakTap() {
  uni.showModal({
    title: '修改起始日期',
    content: '将坚持天数重置为今天开始？',
    success: (res: any) => {
      if (res.confirm) {
        const today = new Date().toISOString().slice(0, 10)
        uni.setStorageSync('start-date', today)
        userStore.loadFromStorage()
        uni.showToast({ title: '已重置为今天', icon: 'success' })
      }
    },
  })
}

const intakeKcal = computed(() => Math.round(recordsStore.todayTotal.kcal))
const remainingKcal = computed(() => (userStore.nutritionTarget?.targetCalories || 0) - intakeKcal.value)
const progressPct = computed(() => {
  if (!userStore.nutritionTarget) return 0
  return Math.min(100, Math.round((intakeKcal.value / userStore.nutritionTarget.targetCalories) * 100))
})

// 营养素缺口推荐
const recommendations = computed(() => {
  if (!userStore.nutritionTarget) return []
  const remaining = {
    carbs: userStore.nutritionTarget.carbs - recordsStore.todayTotal.carbs,
    protein: userStore.nutritionTarget.protein - recordsStore.todayTotal.protein,
    fat: userStore.nutritionTarget.fat - recordsStore.todayTotal.fat,
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
    const foods = allFoods.filter((f: any) => f.category === gap.cat)
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
.home-page { padding: 24rpx; padding-bottom: 48rpx; }

.streak-bar { text-align: center; padding: 12rpx; margin-bottom: 12rpx; }
.streak-text { font-size: 26rpx; font-weight: 600; color: #e67e22; }

/* 摄入状态卡 */
.intake-card { background: #fff; border-radius: 20rpx; padding: 32rpx 24rpx; margin-bottom: 20rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,.04); }
.intake-label { font-size: 24rpx; color: #8c8c8c; display: block; margin-bottom: 12rpx; }
.intake-big { display: flex; align-items: baseline; justify-content: center; margin-bottom: 20rpx; }
.intake-num { font-size: 72rpx; font-weight: 700; color: #07c160; }
.intake-num.over { color: #e74c3c; }
.intake-slash { font-size: 36rpx; color: #ccc; margin: 0 8rpx; }
.intake-target { font-size: 40rpx; font-weight: 600; color: #4d4d4d; }
.intake-unit { font-size: 24rpx; color: #8c8c8c; margin-left: 6rpx; }
.intake-progress-wrap { display: flex; align-items: center; gap: 12rpx; margin-bottom: 12rpx; }
.intake-progress-bg { flex: 1; height: 12rpx; border-radius: 6rpx; background: #e8e8e8; overflow: hidden; }
.intake-progress-fill { height: 100%; border-radius: 6rpx; background: #07c160; transition: width 300ms; }
.intake-progress-fill.over { background: #e74c3c; }
.intake-pct { font-size: 22rpx; color: #8c8c8c; width: 56rpx; text-align: right; }
.intake-remain { text-align: center; font-size: 26rpx; font-weight: 500; color: #07c160; margin-bottom: 20rpx; }
.intake-remain.over { color: #e74c3c; }
.macro-mini { display: flex; justify-content: space-around; border-top: 1px solid #f0f0f0; padding-top: 16rpx; }
.mm-item { text-align: center; }
.mm-val { font-size: 32rpx; font-weight: 700; color: #1a1a1a; }
.mm-label { font-size: 20rpx; color: #8c8c8c; display: block; }
.mm-target { font-size: 20rpx; color: #8c8c8c; }

.empty-card { background: #fff; border-radius: 16rpx; padding: 60rpx 24rpx; text-align: center; }
.empty-title { font-size: 28rpx; font-weight: 600; color: #1a1a1a; display: block; margin-bottom: 8rpx; }
.empty-desc { font-size: 24rpx; color: #8c8c8c; }

/* 推荐卡片 */
.rec-card { background: #fff; border-radius: 16rpx; padding: 24rpx; box-shadow: 0 2rpx 12rpx rgba(0,0,0,.04); }
.rec-title { font-size: 28rpx; font-weight: 600; color: #1a1a1a; display: block; margin-bottom: 4rpx; }
.rec-sub { font-size: 22rpx; color: #8c8c8c; display: block; margin-bottom: 16rpx; }
.rec-list { }
.rec-item { display: flex; align-items: center; gap: 12rpx; padding: 14rpx 0; border-bottom: 1px solid #f8f8f8; }
.rec-emoji { font-size: 32rpx; }
.rec-info { flex: 1; display: flex; flex-direction: column; gap: 2rpx; }
.rec-name { font-size: 26rpx; color: #1a1a1a; font-weight: 500; }
.rec-reason { font-size: 22rpx; color: #07c160; }
.rec-kcal { font-size: 22rpx; color: #8c8c8c; }
</style>
