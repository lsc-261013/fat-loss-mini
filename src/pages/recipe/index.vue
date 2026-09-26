<template>
  <page-meta :page-style="showRecipeBuilder ? 'overflow: hidden;' : ''" />
  <view class="recipe-page">
    <!-- Summary -->
    <view v-if="userStore.nutritionTarget" class="gap-card">
      <text class="gap-title">今天距参考目标</text>
      <view class="gap-numbers">
        <view class="gap-item">
          <text class="gap-value" :class="{ over: remainingKcal < 0 }">{{ Math.abs(remainingKcal) }}</text>
          <text class="gap-label">{{ remainingKcal >= 0 ? '千卡' : '高于目标 / 千卡' }}</text>
        </view>
        <view class="gap-divider" />
        <view class="gap-item">
          <text class="gap-value" :class="remainingCarbs !== null && remainingCarbs < 0 ? 'over' : 'ok'">{{ remainingCarbs === null ? '—' : Math.abs(remainingCarbs) }}</text>
          <text class="gap-label">{{ remainingCarbs === null ? '碳水未完善' : remainingCarbs >= 0 ? '碳水余量 g' : '碳水超出 g' }}</text>
        </view>
        <view class="gap-divider" />
        <view class="gap-item">
          <text class="gap-value" :class="remainingProtein !== null && remainingProtein < 0 ? 'over' : 'ok'">{{ remainingProtein === null ? '—' : Math.abs(remainingProtein) }}</text>
          <text class="gap-label">{{ remainingProtein === null ? '蛋白未完善' : remainingProtein >= 0 ? '蛋白余量 g' : '蛋白超出 g' }}</text>
        </view>
      </view>
    </view>

    <view class="section-header">
      <view><text class="section-title">全部食谱</text><text class="recipe-hint">加入今天计划，吃过再确认</text></view>
      <view style="display:flex;gap:12rpx;">
        <button class="section-mgr-btn" @tap="manageMode = !manageMode">{{ manageMode ? '完成' : '管理' }}</button>
        <button class="section-add-btn" @tap="showRecipeBuilder = true">自建</button>
      </view>
    </view>

    <view v-for="r in allRecipes" :key="r.id" class="meal-card" :class="{ 'card-manage': manageMode }" @tap="manageMode ? toggleSelect(r.id) : openDetail(r)">
      <view v-if="manageMode" class="manage-check" :class="{ checked: selectedIds.includes(r.id) }">
        <text v-if="selectedIds.includes(r.id)">✓</text>
      </view>
      <view class="meal-header">
        <view class="meal-title-row">
          <text class="meal-time-tag">{{ r.mealTime ? mealTimeLabel(r.mealTime) : '自定义' }}</text>
          <text class="meal-name">{{ r.name.replace(/^(早餐|午餐|晚餐|加餐)[：:]/, '') }}</text>
        </view>
        <view class="meal-type-badge" :class="r.type || 'standard'">{{ typeLabel(r.type || 'standard') }}</view>
      </view>

      <view class="meal-ingredients">
        <view v-for="ing in getIngredientLabels(r)" :key="ing.index" class="ingredient-chip">
          <text class="ing-text">{{ ing.name }} {{ ing.grams }}g</text>
        </view>
      </view>

      <view class="meal-footer">
        <text class="meal-kcal">{{ Math.round(r.totalKcal) }}千卡</text>
        <button v-if="!manageMode" class="meal-add-plan" @tap.stop="addRecipeToPlan(r)">加入计划</button>
        <button v-if="manageMode" class="meal-del-one" @tap.stop="deleteOneRecipe(r.id)">删除</button>
      </view>
    </view>

    <view v-if="manageMode && selectedIds.length > 0" class="manage-bar">
      <button class="manage-del-btn" @tap="batchDelete">删除选中 ({{ selectedIds.length }})</button>
    </view>

    <view v-if="allRecipes.length === 0" class="empty-card">
      <text class="empty-text">{{ emptyMessage }}</text>
    </view>

    <button v-if="deletedRecipes" class="secondary-action" @tap="undoRecipeDelete">撤销最近一次删除</button>
    <!-- Details -->
    <view v-if="detailRecipe" class="detail-overlay" @tap="detailRecipe = null">
      <view class="detail-panel" @tap.stop>
        <text class="detail-title">{{ detailRecipe.name }}</text>
        <text class="detail-kcal">≈ {{ Math.round(detailRecipe.totalKcal) }} 千卡</text>
        <text class="detail-sub">点击食材可替换；预设食谱会另存为我的搭配</text>
        <text v-if="detailRecipe.totalCarbs === null || detailRecipe.totalProtein === null || detailRecipe.totalFat === null" class="detail-sub">部分食材营养数据未完善，热量可正常计算。</text>

        <view class="detail-ingredients">
          <view
            v-for="ing in getIngredientLabels(detailRecipe)"
            :key="ing.index"
            class="detail-ing-row"
            @tap="showSwapOptions(ing)"
          >
            <view class="ing-icon-dot" :class="ing.category" />
            <text class="ding-name">{{ ing.name }}</text>
            <text class="ding-grams">{{ ing.grams }}g</text>
            <text class="ding-kcal">≈ {{ Math.round(ing.kcal) }}千卡</text>
            <text class="ding-swap-hint">替换 ›</text>
          </view>
        </view>

        <button class="detail-close" @tap="detailRecipe = null">关闭</button>
      </view>
    </view>

    <!-- 食材替换弹窗 -->
    <view v-if="swapping" class="detail-overlay" @tap="swapping = null">
      <view class="swap-panel" @tap.stop>
        <text class="swap-title">替换「{{ swapping.name }}」</text>

        <view class="swap-grams-row">
          <text class="swap-grams-label">克数</text>
          <view class="swap-stepper">
            <view class="ss-btn" @tap="swapGrams = Math.max(1, swapGrams - 10)">−</view>
            <input class="ss-input" type="number" v-model="swapGrams" />
            <view class="ss-btn" @tap="swapGrams = Number(swapGrams) + 10">+</view>
          </view>
          <text class="swap-preview">≈ {{ swapKcal }}千卡</text>
        </view>

        <text class="swap-hint">选一个同类食材替代</text>

        <view class="swap-list">
          <view
            v-for="alt in swapOptions"
            :key="alt.id"
            class="swap-item"
            @tap="doSwap(alt)"
          >
            <text class="swap-name">{{ alt.name }}</text>
            <text class="swap-kcal">{{ alt.kcal }}千卡/100g</text>
          </view>
        </view>

        <button class="detail-close" @tap="swapping = null">取消</button>
      </view>
    </view>

    <RecipeBuilder v-if="showRecipeBuilder" @close="showRecipeBuilder = false" />
  </view>
</template>

<script setup lang="ts">
import { useJournalStore } from '@/store/journal'
import { calculatedRecipe, foodPortion } from '@/utils/nutrition'
import { ref, computed } from 'vue'
import RecipeBuilder from '@/components/RecipeBuilder.vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { validGrams } from '@/utils/input'
import { useUserStore } from '@/store/user'
import { useRecordsStore } from '@/store/records'
import { usePlanStore } from '@/store/plan'
import { recipes } from '@/data/recipes'
import type { Recipe } from '@/data/recipes'


const allFoods = computed(() => journal.allFoods)
const emojiMap: Record<number, string> = {
  1:'🍚',2:'🍚',3:'🥟',4:'🍜',5:'🍞',6:'🍠',7:'🌽',8:'🥣',9:'🥣',10:'🍜',
  11:'🍗',12:'🥩',13:'🥚',14:'🦐',15:'🥩',16:'🧈',17:'🫘',18:'🐟',19:'🐟',
  21:'🥦',22:'🥬',23:'🥬',24:'🍅',25:'🥒',26:'🥔',27:'🫘',28:'🍆',29:'🫑',30:'🥕',
  31:'🍈',32:'🥬',33:'🍌',34:'🍎',35:'🍉',36:'🍑',37:'🫐',38:'🍐',39:'🍊',
  41:'🫒',42:'🫒',43:'🥑',44:'🥜',45:'🥜',46:'🫒',47:'🎃',
}

const journal = useJournalStore()
const userStore = useUserStore()
const recordsStore = useRecordsStore()
const planStore = usePlanStore()
const detailRecipe = ref<Recipe | null>(null)
const swapping = ref<any>(null)
const swapOptions = ref<any[]>([])
const swapGrams = ref(100)
const swapKcal = computed(() => {
  if (!swapping.value) return 0
  const food = allFoods.value.find((f: any) => f.id === swapping.value.foodId)
  return food ? Math.round(food.kcal * swapGrams.value / 100) : 0
})

// 管理 + 隐藏食谱
const manageMode = ref(false)
const selectedIds = ref<string[]>([])
const hiddenRecipeIds = computed(() => new Set(journal.data.hiddenRecipeIds))

function toggleSelect(id: string) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

function batchDelete() {
  if (!selectedIds.value.length) return
  uni.showModal({ title: '删除食谱', content: '删除选中的 ' + selectedIds.value.length + ' 份食谱？本页可撤销最近一次删除。', success: res => { if (res.confirm) deleteRecipes([...selectedIds.value]) } })
}
const deletedRecipes = ref<string[] | null>(null)
function deleteRecipes(ids: string[]) {
  const next = new Set([...hiddenRecipeIds.value, ...ids])
  try { journal.mutate(data => { data.hiddenRecipeIds = [...next] }) }
  catch { uni.showToast({ title: '删除未保存，请重试', icon: 'none' }); return }
  deletedRecipes.value = ids
  selectedIds.value = []
  manageMode.value = false
  uni.showToast({ title: '已删除', icon: 'success' })
}

function deleteOneRecipe(id: string) {
  uni.showModal({ title: '删除食谱', content: '删除后可在本页撤销，已加入的计划不受影响。', success: res => { if (res.confirm) deleteRecipes([id]) } })
}
function undoRecipeDelete() {
  if (!deletedRecipes.value) return
  const next = [...hiddenRecipeIds.value].filter(id => !deletedRecipes.value!.includes(id))
  try { journal.mutate(data => { data.hiddenRecipeIds = next }) }
  catch { uni.showToast({ title: '恢复未保存，请重试', icon: 'none' }); return }
  deletedRecipes.value = null
  uni.showToast({ title: '已恢复', icon: 'success' })
}

// 自定义菜谱
const customRecipes = computed(() => journal.data.customRecipes)
const showRecipeBuilder = ref(false)
function loadCustomRecipes() { journal.refresh() }
onShow(() => { recordsStore.loadToday(); planStore.loadPlan() })
onPullDownRefresh(() => { recordsStore.loadToday(); planStore.loadPlan(); loadCustomRecipes(); uni.stopPullDownRefresh() })


// 合并系统+自定义
const allRecipes = computed(() => {
  const all = [...recipes, ...customRecipes.value.map(recipe => calculatedRecipe(recipe, allFoods.value))]
  return all.filter((r) => !hiddenRecipeIds.value.has(r.id))
})

function addRecipeToPlan(r: Recipe) {
  const items = r.ingredients.map((ing) => {
    const food = allFoods.value.find((f: any) => f.id === ing.foodId)
    return {
      foodId: ing.foodId,
      name: food?.name || '未知',
      grams: ing.grams,
      kcal: food ? foodPortion(food, ing.grams).subtotalKcal : 0,
      category: food?.category || 'staple',
      emoji: emojiMap[ing.foodId] || '🍽️',
    }
  })
  try { planStore.addRecipeGroup(r.name, items) }
  catch { uni.showToast({ title: '计划未保存，请检查存储后重试', icon: 'none' }); return }
  uni.showToast({ title: `已把「${r.name}」加入计划`, icon: 'none' })
}

const remainingKcal = computed(() => {
  if (!userStore.nutritionTarget) return 0
  return userStore.nutritionTarget.targetCalories - Math.round(recordsStore.todayTotal.kcal)
})
const remainingCarbs = computed(() => {
  if (!userStore.nutritionTarget) return 0
  return recordsStore.todayTotal.carbs === null ? null : Math.round(userStore.nutritionTarget.carbs - recordsStore.todayTotal.carbs)
})
const remainingProtein = computed(() => {
  if (!userStore.nutritionTarget) return 0
  return recordsStore.todayTotal.protein === null ? null : Math.round(userStore.nutritionTarget.protein - recordsStore.todayTotal.protein)
})


const emptyMessage = computed(() => '暂无食谱，点击「+ 自建」创建')

function mealTimeLabel(t: string) {
  const map: Record<string, string> = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }
  return map[t] || ''
}
function typeLabel(t: string) {
  const map: Record<string, string> = { light: '轻量', standard: '标准', rich: '丰盛' }
  return map[t] || ''
}

function getIngredientLabels(r: Recipe) {
  return r.ingredients.map((ing, index) => {
    const food = allFoods.value.find((f: any) => f.id === ing.foodId)
    return {
      index,
      foodId: ing.foodId,
      name: food?.name || '未知',
      grams: ing.grams,
      kcal: food ? foodPortion(food, ing.grams).subtotalKcal : 0,
      category: food?.category || 'staple',
      emoji: emojiMap[ing.foodId] || '🍽️',
    }
  })
}

function openDetail(r: Recipe) {
  detailRecipe.value = r
}

function showSwapOptions(ing: any) {
  swapping.value = ing
  swapGrams.value = ing.grams
  // 同类食材作为替换选项
  swapOptions.value = allFoods.value.filter(
    (f: any) => f.category === ing.category && f.id !== ing.foodId
  )
}

function doSwap(alt: typeof allFoods.value[number]) {
  const g = Number(swapGrams.value)
  if (!validGrams(g)) { uni.showToast({ title: '克数须大于 0 且不超过 5000', icon: 'none' }); return }
  if (!detailRecipe.value || !swapping.value) return
  const source = detailRecipe.value
  const ingredients = source.ingredients.map((ing, index) => index === swapping.value.index ? { foodId: alt.id, grams: g } : {...ing})
  const updated: Recipe = calculatedRecipe({ ...source, ingredients }, allFoods.value)
  const index = customRecipes.value.findIndex(r => r.id === source.id)
  const next = [...customRecipes.value]
  if (index >= 0) next[index] = updated
  else { updated.id = 'custom_' + Date.now(); updated.name = source.name + '（我的搭配）'; next.push(updated) }
  try { journal.mutate(data => { data.customRecipes = next.map(recipe => calculatedRecipe(recipe, allFoods.value)) }) }
  catch { uni.showToast({ title: '替换未保存，请重试', icon: 'none' }); return }
  detailRecipe.value = calculatedRecipe(updated, allFoods.value); swapping.value = null
  uni.showToast({ title: index >= 0 ? '已保存替换' : '已另存为我的搭配', icon: 'none' })
}
</script>

<style scoped>


.ing-emoji { font-size:20rpx; }

/* 管理模式 */
.card-manage { position:relative; }
.manage-check.checked { border-color:#28745b; background:#e8f5e9; }
.manage-bar { position:fixed; bottom:0; left:0; right:0; background:#fff; padding:16rpx 24rpx; border-top:1px solid #eee; padding-bottom:calc(16rpx + env(safe-area-inset-bottom)); z-index:50; }
.manage-del-btn { background:#ac513b; color:#fff; border:none; border-radius:12rpx; font-size:28rpx; height:80rpx; line-height:80rpx; width:100%; }
.manage-del-btn::after { border:none; }

.gap-numbers { display: flex; align-items: center; justify-content: space-around; }
.gap-item { display: flex; flex-direction: column; align-items: center; gap: 4rpx; }
.gap-value { font-size: 32rpx; font-weight: 700; }
.gap-value.over { color: #ac513b; }
.gap-value.ok { color: #28745b; }
.gap-label { font-size: 20rpx; color: #68766f; }
.gap-divider { width: 1px; height: 48rpx; background: #eee; }


/* 食谱卡片 */
.meal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16rpx; }
.meal-title-row { display: flex; flex-direction: column; gap: 4rpx; }
.meal-time-tag { font-size: 22rpx; color: #68766f; }
.ing-dot { width: 8rpx; height: 8rpx; border-radius: 50%; flex-shrink: 0; }
.ing-dot.staple { background: #8b6914; }
.ing-dot.protein { background: #c0392b; }
.ing-dot.vegetable { background: #2e7d32; }
.ing-dot.fruit { background: #e67e22; }
.ing-dot.fat { background: #f9a825; }
.meal-kcal { font-size: 26rpx; font-weight: 600; color: #233c33; }
.meal-desc { font-size: 22rpx; color: #68766f; display: block; margin-top: 4rpx; }

/* 食谱详情弹窗 */
.detail-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,.4); z-index: 100;
  display: flex; align-items: flex-end; justify-content: center;
}
.detail-panel, .swap-panel {
  background: #fff; border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 24rpx 40rpx; width: 100%;
  max-height: 70vh; overflow-y: auto;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
}
.detail-title { font-size: 32rpx; font-weight: 600; display: block; text-align: center; }
.detail-kcal { font-size: 24rpx; color: #28745b; display: block; text-align: center; margin-top: 4rpx; }
.detail-sub { font-size: 22rpx; color: #68766f; display: block; text-align: center; margin: 8rpx 0 20rpx; }
.detail-ingredients { margin-bottom: 24rpx; }
.detail-ing-row {
  display: flex; align-items: center; gap: 12rpx;
  padding: 16rpx 0; border-bottom: 1px solid #f5f5f5;
}
.ing-icon-dot { width: 10rpx; height: 10rpx; border-radius: 50%; flex-shrink: 0; }
.ing-icon-dot.staple { background: #8b6914; }
.ing-icon-dot.protein { background: #c0392b; }
.ing-icon-dot.vegetable { background: #2e7d32; }
.ing-icon-dot.fruit { background: #e67e22; }
.ing-icon-dot.fat { background: #f9a825; }
.ding-name { flex: 1; font-size: 26rpx; color: #233c33; }
.ding-grams { font-size: 24rpx; color: #4d4d4d; }
.ding-kcal { font-size: 22rpx; color: #68766f; width: 80rpx; text-align: right; }
.ding-swap-hint { font-size: 22rpx; color: #28745b; }

.detail-close {
  width: 100%; height: 80rpx; line-height: 80rpx;
  text-align: center; background: #f5f5f5; border-radius: 16rpx;
  font-size: 28rpx; color: #4d4d4d; border: none;
}
.detail-close::after { border: none; }

/* 替换弹窗 */
.swap-title { font-size: 30rpx; font-weight: 600; display: block; text-align: center; }
.swap-hint { font-size: 22rpx; color: #68766f; display: block; text-align: center; margin: 6rpx 0 20rpx; }
.swap-list { margin-bottom: 24rpx; }
.swap-item {
  display: flex; justify-content: space-between;
  padding: 20rpx 0; border-bottom: 1px solid #f5f5f5;
}
.swap-name { font-size: 26rpx; color: #233c33; font-weight: 500; }
.swap-kcal { font-size: 22rpx; color: #68766f; }

/* 替换弹窗克数调整 */
.swap-grams-row { display:flex; align-items:center; gap:12rpx; padding:16rpx 0; margin-bottom:8rpx; }
.swap-grams-label { font-size:24rpx; color:#4d4d4d; }
.swap-stepper { display:flex; align-items:center; border:1px solid #e0e0e0; border-radius:10rpx; overflow:hidden; }
.ss-btn { width:48rpx; height:52rpx; display:flex; align-items:center; justify-content:center; background:#f8f8f8; font-size:28rpx; color:#4d4d4d; }
.ss-input { width:80rpx; height:52rpx; text-align:center; font-size:26rpx; font-weight:600; }
.swap-preview { font-size:22rpx; color:#28745b; }

.empty-card { background: #fff; border-radius: 16rpx; padding: 48rpx; text-align: center; }
.empty-text { font-size: 26rpx; color: #68766f; }

.gap-label { font-size:max(24rpx,12px); }

.detail-overlay { z-index: 1002; bottom: var(--window-bottom, 0px); }
.detail-panel, .swap-panel { box-sizing: border-box; max-height: 85vh; overflow-y: auto; padding-bottom: calc(32rpx + env(safe-area-inset-bottom)); }
.manage-bar { position: static; margin-bottom: 24rpx; border-radius: 20rpx; }
.recipe-page { max-width:960rpx; margin:0 auto; padding:24rpx 36rpx 48rpx; }
.meal-card { padding:28rpx 0; margin:0; border-bottom:1px solid var(--line); background:#fff; border-radius:0; box-shadow:none; }
.gap-card { padding:24rpx; background:var(--wash); border-radius:12rpx; margin-bottom:36rpx; box-shadow:none; }
.gap-title { font-size:max(24rpx,12px); color:var(--muted); display:block; margin-bottom:16rpx; }
.section-title { font-size:max(34rpx,17px); font-weight:600; display:block; margin:0; }
.section-header { display:flex; justify-content:space-between; align-items:center; gap:12rpx; margin-bottom:0; }
.section-add-btn { font-size:max(26rpx,13px); color:var(--brand); background:var(--wash); padding:0 20rpx; border-radius:10rpx; border:0; margin:0; min-height:44px; line-height:44px; }
.section-mgr-btn { font-size:max(26rpx,13px); color:var(--brand); padding:0 12rpx; background:transparent; border:0; margin:0; min-height:44px; line-height:44px; }
.meal-add-plan { font-size:max(26rpx,13px); color:var(--brand); background:#edf4ef; padding:0 22rpx; border-radius:10rpx; border:0; margin:0 0 0 auto; min-height:44px; line-height:44px; }
.meal-del-one { font-size:max(26rpx,13px); color:#a34831; background:transparent; margin-left:auto; min-height:44px; line-height:44px; }
.meal-footer { display:flex; align-items:center; gap:16rpx; padding-top:8rpx; border:0; }
.ingredient-chip { display:inline-flex; background:transparent; padding:0; border-radius:0; }
.meal-ingredients { display:flex; flex-wrap:wrap; column-gap:20rpx; row-gap:4rpx; margin:12rpx 0; }
.ing-text { font-size:max(26rpx,13px); color:var(--muted); }
.meal-name { font-size:max(34rpx,17px); font-weight:600; color:var(--ink); }
.meal-type-badge { font-size:max(22rpx,11px); color:var(--muted); padding:0; background:transparent; }
.meal-type-badge.light { color:var(--muted); background:transparent; }
.meal-type-badge.standard { color:var(--muted); background:transparent; }
.meal-type-badge.rich { color:var(--muted); background:transparent; }
.recipe-hint { display:block; color:var(--muted); font-size:max(22rpx,11px); margin-top:6rpx; }
.manage-check { position:absolute; top:32rpx; right:0; width:40rpx; height:40rpx; border:1px solid #9aaa9f; border-radius:6rpx; display:flex; align-items:center; justify-content:center; }
.card-manage .meal-header { padding-right:60rpx; }
.meal-title-row { min-width:0; }.meal-name { overflow-wrap:anywhere; }
.detail-panel,.swap-panel { max-width:960rpx; overscroll-behavior:contain; }
.detail-title,.swap-title { font-size:max(34rpx,17px); }
.detail-sub,.detail-kcal,.swap-hint,.swap-preview,.swap-kcal,.ding-grams,.ding-kcal,.ding-swap-hint { font-size:max(24rpx,12px); }
.ding-name,.swap-name { font-size:max(26rpx,13px); min-width:0; overflow-wrap:anywhere; }
.bfc-kcal { font-size:max(22rpx,11px); color:var(--muted); }
.ss-btn { width:44px; height:44px; }.ss-input { height:44px; }
.detail-ing-row,.swap-item { min-height:44px; }
</style>
