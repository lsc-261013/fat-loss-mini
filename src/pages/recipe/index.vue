<template>
  <view class="recipe-page">
    <!-- 缺口概览 -->
    <view v-if="userStore.nutritionTarget" class="gap-card">
      <text class="gap-title">今日剩余</text>
      <view class="gap-numbers">
        <view class="gap-item">
          <text class="gap-value" :class="{ over: remainingKcal < 0 }">{{ Math.abs(remainingKcal) }}</text>
          <text class="gap-label">{{ remainingKcal >= 0 ? '剩余千卡' : '已超千卡' }}</text>
        </view>
        <view class="gap-divider" />
        <view class="gap-item">
          <text class="gap-value" :class="remainingCarbs < 0 ? 'over' : 'ok'">{{ Math.abs(remainingCarbs) }}</text>
          <text class="gap-label">{{ remainingCarbs >= 0 ? '碳剩余g' : '碳已超g' }}</text>
        </view>
        <view class="gap-divider" />
        <view class="gap-item">
          <text class="gap-value" :class="remainingProtein < 0 ? 'over' : 'ok'">{{ Math.abs(remainingProtein) }}</text>
          <text class="gap-label">{{ remainingProtein >= 0 ? '蛋剩余g' : '蛋已超g' }}</text>
        </view>
      </view>
    </view>

    <view class="section-header">
      <text class="section-title">推荐食谱</text>
      <view style="display:flex;gap:12rpx;">
        <text class="section-mgr-btn" @tap="manageMode = !manageMode">{{ manageMode ? '完成' : '管理' }}</text>
        <text class="section-add-btn" @tap="showRecipeBuilder = true">+ 自建</text>
      </view>
    </view>

    <view v-for="r in allRecipes" :key="r.id" class="meal-card" :class="{ 'card-manage': manageMode }" @tap="manageMode ? toggleSelect(r.id) : openDetail(r)">
      <view v-if="manageMode" class="manage-check" :class="{ checked: selectedIds.includes(r.id) }">
        <text v-if="selectedIds.includes(r.id)">✓</text>
      </view>
      <view class="meal-header">
        <view class="meal-title-row">
          <text class="meal-time-tag">{{ r.mealTime ? mealTimeLabel(r.mealTime) : '自定义' }}</text>
          <text class="meal-name">{{ r.name }}</text>
        </view>
        <view class="meal-type-badge" :class="r.type || 'standard'">{{ typeLabel(r.type || 'standard') }}</view>
      </view>

      <view class="meal-ingredients">
        <view v-for="ing in getIngredientLabels(r)" :key="ing.foodId" class="ingredient-chip">
          <text class="ing-emoji">{{ ing.emoji }}</text>
          <text class="ing-text">{{ ing.name }} {{ ing.grams }}g</text>
        </view>
      </view>

      <view class="meal-footer">
        <text class="meal-kcal">{{ r.totalKcal }}千卡</text>
        <text class="meal-add-plan" @tap.stop="addRecipeToPlan(r)">+ 加入计划</text>
        <text v-if="!manageMode" class="meal-del-one" @tap.stop="deleteOneRecipe(r.id)">×</text>
      </view>
    </view>

    <view v-if="manageMode && selectedIds.length > 0" class="manage-bar">
      <button class="manage-del-btn" @tap="batchDelete">删除选中 ({{ selectedIds.length }})</button>
    </view>

    <view v-if="allRecipes.length === 0" class="empty-card">
      <text class="empty-text">{{ emptyMessage }}</text>
    </view>

    <!-- 食谱详情弹窗 -->
    <view v-if="detailRecipe" class="detail-overlay" @tap="detailRecipe = null">
      <view class="detail-panel" @tap.stop>
        <text class="detail-title">{{ detailRecipe.name }}</text>
        <text class="detail-kcal">≈ {{ detailRecipe.totalKcal }} 千卡</text>
        <text class="detail-sub">点击食材可替换</text>

        <view class="detail-ingredients">
          <view
            v-for="ing in getIngredientLabels(detailRecipe)"
            :key="ing.foodId"
            class="detail-ing-row"
            @tap="showSwapOptions(ing)"
          >
            <view class="ing-icon-dot" :class="ing.category" />
            <text class="ding-name">{{ ing.name }}</text>
            <text class="ding-grams">{{ ing.grams }}g</text>
            <text class="ding-kcal">≈ {{ ing.kcal }}千卡</text>
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
            <view class="ss-btn" @tap="swapGrams = swapGrams + 10">+</view>
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

    <!-- 自建菜谱弹窗 -->
    <view v-if="showRecipeBuilder" class="detail-overlay" @tap="showRecipeBuilder = false">
      <view class="swap-panel" @tap.stop style="max-height:85vh;overflow-y:auto;">
        <text class="swap-title">自建菜谱</text>

        <input class="builder-name-input" v-model="builderName" placeholder="输入菜谱名称" />

        <text class="swap-hint">已选食材</text>
        <view v-for="(item, idx) in builderItems" :key="idx" class="builder-chip">
          <text>{{ item.name }} {{ item.grams }}g ≈{{ item.kcal }}千卡</text>
          <text class="plan-del" @tap="removeBuilderItem(idx)">×</text>
        </view>

        <text class="swap-hint" style="margin-top:16rpx;">添加食材</text>
        <scroll-view scroll-y style="max-height:280rpx;">
          <view v-for="cat in [{k:'staple',l:'主食',emoji:'🍚'},{k:'protein',l:'蛋白质',emoji:'🍗'},{k:'vegetable',l:'蔬菜',emoji:'🥬'},{k:'fruit',l:'水果',emoji:'🍎'},{k:'fat',l:'油脂',emoji:'🫒'}]" :key="cat.k">
            <view class="builder-cat-head" @tap="toggleCat(cat.k)">
              <text class="builder-cat-emoji">{{ cat.emoji }}</text>
              <text class="builder-cat-label">{{ cat.l }}</text>
              <text class="builder-cat-arrow">{{ openCats.includes(cat.k) ? '▾' : '▸' }}</text>
            </view>
            <view v-if="openCats.includes(cat.k)" class="builder-food-grid">
              <view
                v-for="f in allFoods.filter((x:any) => x.category === cat.k)"
                :key="f.id"
                class="builder-food-chip"
                :class="{ selected: builderFoodId === f.id }"
                @tap="builderFoodId = f.id; builderGrams = planStore.getRememberedGrams(f.id) || 100"
              >
                <text class="bfc-emoji">{{ emojiMap[f.id] || '🍽️' }}</text>
                <text class="bfc-name">{{ f.name }}</text>
                <text class="bfc-kcal">{{ f.kcal }}/100g</text>
              </view>
            </view>
          </view>
        </scroll-view>

        <view v-if="builderFoodId" class="plan-grams-row">
          <text class="plan-grams-label">克数</text>
          <view class="plan-stepper">
            <view class="ps-btn" @tap="builderGrams = Math.max(1, builderGrams - 10)">−</view>
            <input class="ps-input" type="number" v-model="builderGrams" />
            <view class="ps-btn" @tap="builderGrams = builderGrams + 10">+</view>
          </view>
          <button class="plan-add-btn" style="border:none;background:#e8f5e9;color:#2e7d32;font-size:22rpx;padding:8rpx 14rpx;border-radius:8rpx;" @tap="addBuilderItem">加入</button>
        </view>

        <view class="plan-panel-btns" style="margin-top:20rpx;">
          <button class="pp-cancel" @tap="showRecipeBuilder = false; builderItems = []; builderName = '';">取消</button>
          <button class="pp-confirm" @tap="saveCustomRecipe">保存菜谱</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserStore } from '@/store/user'
import { useRecordsStore } from '@/store/records'
import { usePlanStore } from '@/store/plan'
import { recipes } from '@/data/recipes'
import type { Recipe } from '@/data/recipes'
import foodsData from '@/static/foods.json'

const allFoods = foodsData as any[]
const emojiMap: Record<number, string> = {
  1:'🍚',2:'🍚',3:'🥟',4:'🍜',5:'🍞',6:'🍠',7:'🌽',8:'🥣',9:'🥣',10:'🍜',
  11:'🍗',12:'🥩',13:'🥚',14:'🦐',15:'🥩',16:'🧈',17:'🫘',18:'🐟',19:'🐟',
  21:'🥦',22:'🥬',23:'🥬',24:'🍅',25:'🥒',26:'🥔',27:'🫘',28:'🍆',29:'🫑',30:'🥕',
  31:'🍈',32:'🥬',33:'🍌',34:'🍎',35:'🍉',36:'🍑',37:'🫐',38:'🍐',39:'🍊',
  41:'🫒',42:'🫒',43:'🥑',44:'🥜',45:'🥜',46:'🫒',47:'🎃',
}

const userStore = useUserStore()
const recordsStore = useRecordsStore()
const planStore = usePlanStore()
const detailRecipe = ref<Recipe | null>(null)
const swapping = ref<any>(null)
const swapOptions = ref<any[]>([])
const swapGrams = ref(100)
const swapKcal = computed(() => {
  if (!swapping.value) return 0
  const food = allFoods.find((f: any) => f.id === swapping.value.foodId)
  return food ? Math.round(food.kcal * swapGrams.value / 100) : 0
})

// 管理 + 隐藏食谱
const manageMode = ref(false)
const selectedIds = ref<string[]>([])
const hiddenRecipeIds = ref<Set<string>>(new Set())

try {
  const d = uni.getStorageSync('hidden-recipes')
  if (d) hiddenRecipeIds.value = new Set(JSON.parse(d))
} catch (_) {}

function saveHidden() {
  uni.setStorageSync('hidden-recipes', JSON.stringify([...hiddenRecipeIds.value]))
}

function toggleSelect(id: string) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

function batchDelete() {
  selectedIds.value.forEach((id) => hiddenRecipeIds.value.add(id))
  // 也删自定义菜谱的源数据
  customRecipes.value = customRecipes.value.filter((r) => !selectedIds.value.includes(r.id))
  saveCustomRecipes()
  saveHidden()
  selectedIds.value = []
  manageMode.value = false
  uni.showToast({ title: '已删除', icon: 'success' })
}

function deleteOneRecipe(id: string) {
  hiddenRecipeIds.value.add(id)
  customRecipes.value = customRecipes.value.filter((r) => r.id !== id)
  saveCustomRecipes()
  saveHidden()
  uni.showToast({ title: '已删除', icon: 'success' })
}

// 自定义菜谱
const customRecipes = ref<Recipe[]>([])
const showRecipeBuilder = ref(false)
const builderName = ref('')
const builderItems = ref<{ foodId: number; name: string; grams: number; kcal: number; category: string }[]>([])
const builderFoodId = ref(0)
const builderGrams = ref(100)
const openCats = ref<string[]>(['staple', 'protein', 'vegetable', 'fruit', 'fat'])

function toggleCat(cat: string) {
  const idx = openCats.value.indexOf(cat)
  if (idx >= 0) openCats.value.splice(idx, 1)
  else openCats.value.push(cat)
}

function loadCustomRecipes() {
  try {
    const d = uni.getStorageSync('custom-recipes')
    if (d) customRecipes.value = JSON.parse(d)
  } catch (_) {}
}
function saveCustomRecipes() {
  uni.setStorageSync('custom-recipes', JSON.stringify(customRecipes.value))
}
loadCustomRecipes()


// 合并系统+自定义
const allRecipes = computed(() => {
  const all = [...recipes, ...customRecipes.value]
  return all.filter((r) => !hiddenRecipeIds.value.has(r.id))
})

function addRecipeToPlan(r: Recipe) {
  const items = r.ingredients.map((ing) => {
    const food = allFoods.find((f: any) => f.id === ing.foodId)
    return {
      foodId: ing.foodId,
      name: food?.name || '未知',
      grams: ing.grams,
      kcal: food ? Math.round(food.kcal * ing.grams / 100) : 0,
      category: food?.category || 'staple',
      emoji: emojiMap[ing.foodId] || '🍽️',
    }
  })
  planStore.addRecipeGroup(r.name, items)
  uni.showToast({ title: `已把「${r.name}」加入计划`, icon: 'none' })
}

function addBuilderItem() {
  if (!builderFoodId.value) return
  const food = allFoods.find((f: any) => f.id === builderFoodId.value)
  if (!food) return
  const g = Number(builderGrams.value) || 100
  builderItems.value.push({
    foodId: food.id,
    name: food.name,
    grams: g,
    kcal: Math.round(food.kcal * g / 100),
    category: food.category,
  })
  builderFoodId.value = 0
  builderGrams.value = 100
}

function removeBuilderItem(idx: number) {
  builderItems.value.splice(idx, 1)
}

function saveCustomRecipe() {
  if (!builderName.value.trim() || builderItems.value.length === 0) {
    uni.showToast({ title: '请填写菜名并添加食材', icon: 'none' })
    return
  }
  const totalKcal = builderItems.value.reduce((s, i) => s + i.kcal, 0)
  const totalCarbs = builderItems.value.reduce((s, i) => {
    const f = allFoods.find((f: any) => f.id === i.foodId)
    return s + Math.round((f?.carbs || 0) * i.grams / 100)
  }, 0)
  const totalProtein = builderItems.value.reduce((s, i) => {
    const f = allFoods.find((f: any) => f.id === i.foodId)
    return s + Math.round((f?.protein || 0) * i.grams / 100)
  }, 0)
  const totalFat = builderItems.value.reduce((s, i) => {
    const f = allFoods.find((f: any) => f.id === i.foodId)
    return s + Math.round((f?.fat || 0) * i.grams / 100)
  }, 0)
  customRecipes.value.push({
    id: 'custom_' + Date.now(),
    name: builderName.value.trim(),
    type: 'standard',
    mealTime: 'lunch',
    ingredients: builderItems.value.map((i) => ({ foodId: i.foodId, grams: i.grams })),
    totalKcal,
    totalCarbs,
    totalProtein,
    totalFat,
    description: `${builderItems.value.length}种食材`,
  })
  saveCustomRecipes()
  showRecipeBuilder.value = false
  builderName.value = ''
  builderItems.value = []
  uni.showToast({ title: '菜谱已保存', icon: 'success' })
}

const remainingKcal = computed(() => {
  if (!userStore.nutritionTarget) return 0
  return userStore.nutritionTarget.targetCalories - Math.round(recordsStore.todayTotal.kcal)
})
const remainingCarbs = computed(() => {
  if (!userStore.nutritionTarget) return 0
  return Math.round(userStore.nutritionTarget.carbs - recordsStore.todayTotal.carbs)
})
const remainingProtein = computed(() => {
  if (!userStore.nutritionTarget) return 0
  return Math.round(userStore.nutritionTarget.protein - recordsStore.todayTotal.protein)
})

const recommendedRecipes = computed<Recipe[]>(() => {
  if (!userStore.nutritionTarget) return []
  const kcal = remainingKcal.value
  if (kcal <= 0) return []
  const scored = recipes.map((r) => {
    let score = 0
    if (r.totalKcal <= kcal + 50) score += 30
    else if (r.totalKcal <= kcal + 150) score += 15
    if (remainingProtein.value > 10 && r.totalProtein >= remainingProtein.value * 0.5) score += 25
    if (kcal > 400 && r.type === 'rich') score += 15
    if (kcal <= 200 && r.type === 'light') score += 15
    return { recipe: r, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 3).map((s) => s.recipe)
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
  return r.ingredients.map((ing) => {
    const food = allFoods.find((f: any) => f.id === ing.foodId)
    return {
      foodId: ing.foodId,
      name: food?.name || '未知',
      grams: ing.grams,
      kcal: food ? Math.round(food.kcal * ing.grams / 100) : 0,
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
  // 同类食材作为替换选项
  swapOptions.value = allFoods.filter(
    (f: any) => f.category === ing.category && f.id !== ing.foodId
  )
}

function doSwap(alt: any) {
  const g = Number(swapGrams.value) || 100
  const kcal = Math.round(alt.kcal * g / 100)
  uni.showToast({
    title: `已替换为${alt.name} ${g}g ≈${kcal}千卡`,
    icon: 'none',
    duration: 2000,
  })
  swapping.value = null
  detailRecipe.value = null
}
</script>

<style scoped>
.recipe-page { padding: 24rpx 24rpx 48rpx; }

.section-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16rpx; }
.section-title { font-size:26rpx; font-weight:600; color:#1a1a1a; }
.section-add-btn { font-size:24rpx; color:#07c160; font-weight:500; padding:6rpx 16rpx; border:1px solid #07c160; border-radius:20rpx; }

.meal-add-plan {
  font-size:22rpx; color:#07c160; font-weight:500;
  padding:6rpx 14rpx; border:1px solid #07c160; border-radius:16rpx;
  margin-left:12rpx;
}
.ing-emoji { font-size:20rpx; }

.builder-name-input {
  width:100%; height:72rpx; border:1px solid #e0e0e0; border-radius:12rpx;
  padding:0 16rpx; font-size:28rpx; margin:16rpx 0;
}
.builder-chip {
  display:flex; align-items:center; justify-content:space-between;
  background:#f8f8f8; padding:10rpx 16rpx; border-radius:8rpx; margin-bottom:6rpx;
  font-size:24rpx; color:#4d4d4d;
}

/* 折叠分类 */
.builder-cat-head { display:flex; align-items:center; gap:8rpx; padding:14rpx 0; }
.builder-cat-emoji { font-size:26rpx; }
.builder-cat-label { font-size:24rpx; color:#4d4d4d; font-weight:500; flex:1; }
.builder-cat-arrow { font-size:20rpx; color:#8c8c8c; }
.builder-food-grid { display:flex; flex-wrap:wrap; gap:8rpx; margin-bottom:12rpx; }
.builder-food-chip {
  width:calc((100% - 24rpx)/4); background:#f8f8f8; border-radius:12rpx;
  padding:12rpx 4rpx 10rpx; display:flex; flex-direction:column; align-items:center; gap:2rpx;
}
.builder-food-chip.selected { background:#e8f5e9; }
.bfc-emoji { font-size:28rpx; }
.bfc-name { font-size:20rpx; color:#4d4d4d; font-weight:500; }
.bfc-kcal { font-size:18rpx; color:#999; }

/* 管理模式 */
.section-mgr-btn {
  font-size:24rpx; color:#8c8c8c; font-weight:500;
  padding:6rpx 16rpx; border:1px solid #ccc; border-radius:20rpx;
}
.card-manage { position:relative; }
.manage-check {
  position:absolute; top:12rpx; right:12rpx; z-index:5;
  width:36rpx; height:36rpx; border-radius:50%; border:2rpx solid #ccc;
  display:flex; align-items:center; justify-content:center; font-size:22rpx; color:#07c160;
}
.manage-check.checked { border-color:#07c160; background:#e8f5e9; }
.manage-bar { position:fixed; bottom:0; left:0; right:0; background:#fff; padding:16rpx 24rpx; border-top:1px solid #eee; padding-bottom:calc(16rpx + env(safe-area-inset-bottom)); z-index:50; }
.manage-del-btn { background:#e74c3c; color:#fff; border:none; border-radius:12rpx; font-size:28rpx; height:80rpx; line-height:80rpx; width:100%; }
.manage-del-btn::after { border:none; }
.meal-del-one { font-size:24rpx; color:#ccc; padding:4rpx 8rpx; }

.gap-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,.04);
}
.gap-title { font-size: 26rpx; font-weight: 600; color: #1a1a1a; display: block; margin-bottom: 16rpx; }
.gap-numbers { display: flex; align-items: center; justify-content: space-around; }
.gap-item { display: flex; flex-direction: column; align-items: center; gap: 4rpx; }
.gap-value { font-size: 32rpx; font-weight: 700; }
.gap-value.over { color: #e74c3c; }
.gap-value.ok { color: #07c160; }
.gap-label { font-size: 20rpx; color: #8c8c8c; }
.gap-divider { width: 1px; height: 48rpx; background: #eee; }

.section-title { font-size: 26rpx; font-weight: 600; color: #1a1a1a; display: block; margin-bottom: 16rpx; }

/* 食谱卡片 */
.meal-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,.04);
}
.meal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16rpx; }
.meal-title-row { display: flex; flex-direction: column; gap: 4rpx; }
.meal-time-tag { font-size: 22rpx; color: #8c8c8c; }
.meal-name { font-size: 28rpx; font-weight: 600; color: #1a1a1a; }
.meal-type-badge { font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 4rpx; font-weight: 500; }
.meal-type-badge.light { background: #e8f5e9; color: #2e7d32; }
.meal-type-badge.standard { background: #fbf3e4; color: #8b6914; }
.meal-type-badge.rich { background: #fde8e8; color: #c0392b; }
.meal-ingredients { display: flex; flex-wrap: wrap; gap: 8rpx; margin-bottom: 16rpx; }
.ingredient-chip { display: flex; align-items: center; gap: 6rpx; background: #f8f8f8; padding: 6rpx 12rpx; border-radius: 6rpx; }
.ing-dot { width: 8rpx; height: 8rpx; border-radius: 50%; flex-shrink: 0; }
.ing-dot.staple { background: #8b6914; }
.ing-dot.protein { background: #c0392b; }
.ing-dot.vegetable { background: #2e7d32; }
.ing-dot.fruit { background: #e67e22; }
.ing-dot.fat { background: #f9a825; }
.ing-text { font-size: 22rpx; color: #4d4d4d; }
.meal-footer { border-top: 1px solid #f0f0f0; padding-top: 14rpx; }
.meal-kcal { font-size: 26rpx; font-weight: 600; color: #1a1a1a; }
.meal-desc { font-size: 22rpx; color: #8c8c8c; display: block; margin-top: 4rpx; }

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
.detail-kcal { font-size: 24rpx; color: #07c160; display: block; text-align: center; margin-top: 4rpx; }
.detail-sub { font-size: 22rpx; color: #8c8c8c; display: block; text-align: center; margin: 8rpx 0 20rpx; }
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
.ding-name { flex: 1; font-size: 26rpx; color: #1a1a1a; }
.ding-grams { font-size: 24rpx; color: #4d4d4d; }
.ding-kcal { font-size: 22rpx; color: #8c8c8c; width: 80rpx; text-align: right; }
.ding-swap-hint { font-size: 22rpx; color: #07c160; }

.detail-close {
  width: 100%; height: 80rpx; line-height: 80rpx;
  text-align: center; background: #f5f5f5; border-radius: 16rpx;
  font-size: 28rpx; color: #4d4d4d; border: none;
}
.detail-close::after { border: none; }

/* 替换弹窗 */
.swap-title { font-size: 30rpx; font-weight: 600; display: block; text-align: center; }
.swap-hint { font-size: 22rpx; color: #8c8c8c; display: block; text-align: center; margin: 6rpx 0 20rpx; }
.swap-list { margin-bottom: 24rpx; }
.swap-item {
  display: flex; justify-content: space-between;
  padding: 20rpx 0; border-bottom: 1px solid #f5f5f5;
}
.swap-name { font-size: 26rpx; color: #1a1a1a; font-weight: 500; }
.swap-kcal { font-size: 22rpx; color: #8c8c8c; }

/* 替换弹窗克数调整 */
.swap-grams-row { display:flex; align-items:center; gap:12rpx; padding:16rpx 0; margin-bottom:8rpx; }
.swap-grams-label { font-size:24rpx; color:#4d4d4d; }
.swap-stepper { display:flex; align-items:center; border:1px solid #e0e0e0; border-radius:10rpx; overflow:hidden; }
.ss-btn { width:48rpx; height:52rpx; display:flex; align-items:center; justify-content:center; background:#f8f8f8; font-size:28rpx; color:#4d4d4d; }
.ss-input { width:80rpx; height:52rpx; text-align:center; font-size:26rpx; font-weight:600; }
.swap-preview { font-size:22rpx; color:#07c160; }

.empty-card { background: #fff; border-radius: 16rpx; padding: 48rpx; text-align: center; }
.empty-text { font-size: 26rpx; color: #8c8c8c; }
</style>
