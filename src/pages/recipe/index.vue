<template>
  <page-meta :page-style="showRecipeBuilder || detailRecipe || swapping !== null || showHiddenRecipes ? 'overflow: hidden;' : ''" />
  <view class="recipe-page">
    <view class="page-heading"><view><text class="page-eyebrow">选一道，安排下一餐</text><text class="page-title">日常食谱</text></view><button class="create-button" @tap="openBuilder()"><AppIcon name="plus" :size="17"/>自建</button></view>
    <view v-if="userStore.nutritionTarget" class="gap-card"><text>今天{{ remainingKcal >= 0 ? '距参考目标还差' : '高于参考目标' }}</text><text class="gap-number">{{ Math.abs(remainingKcal) }} <text>千卡</text></text><text v-if="remainingCarbs === null || remainingProtein === null" class="gap-note">部分营养未完善</text></view>
    <view v-if="todayPlanCount && !lastAdded" class="plan-shortcut"><AppIcon name="book"/><view><text class="plan-shortcut-title">今天已安排 {{ todayPlanCount }} 项</text><text class="recipe-hint">{{ planStatusHint(todayPlanCount, planStore.plannedTotal.count) }}</text></view><button @tap="journalNavigation.openToday('plan')">查看计划 ›</button></view>
    <view v-if="lastAdded" :key="lastAddedId + todayPlanCount" class="added-receipt content-enter" role="status"><view class="success-icon"><AppIcon name="check" /></view><view class="receipt-copy"><text>已加入：{{ lastAdded }}</text><text class="recipe-hint">已保存到今天计划，尚未计入摄入</text></view><button @tap="journalNavigation.openToday('plan')">去计划 ›</button></view>
    <view class="filter-row"><view class="meal-filters"><button v-for="filter in mealFilters" :key="filter.key" :class="{active: mealFilter === filter.key}" @tap="mealFilter = filter.key; selectedIds = []">{{ filter.label }}</button></view><button class="manage-button" @tap="manageMode = !manageMode; selectedIds = []">{{ manageMode ? '完成' : '管理' }}</button></view>
    <view v-if="manageMode" class="hidden-entry"><button @tap="openManagement()">隐藏菜谱 ({{ hiddenRecipeIds.size }}) · 批量恢复 / 删除 ›</button><text class="recipe-hint">隐藏可恢复；完整删除仅适用于自建菜谱，已有计划和已吃保留。</text></view>
    <view class="recipe-grid">
      <view v-for="r in visibleRecipes" :key="r.id" class="meal-card surface-panel" :class="{selected:manageMode && selectedIds.includes(r.id)}">
        <view class="recipe-photo" @tap="manageMode ? toggleSelect(r.id) : openDetail(r)"><FoodVisual :src="recipeImage(r)" :label="r.name" :caption="recipeImage(r) ? '' : '我的搭配'"/><text class="meal-time-tag">{{ customRecipeIds.has(r.id) ? '自建 · ' + mealTimeLabel(r.mealTime) : mealTimeLabel(r.mealTime) }}</text><view v-if="manageMode" class="manage-check" :class="{checked:selectedIds.includes(r.id)}">{{ selectedIds.includes(r.id) ? '✓' : '' }}</view></view>
        <view class="meal-body"><view class="meal-title-row" @tap="manageMode ? toggleSelect(r.id) : openDetail(r)"><text class="meal-name">{{ displayDishName(r.name) }}</text><text class="meal-kcal">{{ Math.round(r.totalKcal) }}<text> 千卡</text></text></view><text class="meal-ingredients">{{ getIngredientLabels(r).map(ing => ing.name).join(' · ') }}</text><view class="meal-footer"><view class="meal-links"><button class="detail-link" @tap="openDetail(r)">配料与分量 ›</button><button v-if="!manageMode && customRecipeIds.has(r.id)" class="edit-link" :aria-label="'编辑菜谱' + r.name" @tap="openBuilder(r)">编辑</button></view><button v-if="!manageMode" class="meal-add-plan" :class="{added: lastAddedId === r.id}" @tap="addRecipeToPlan(r)"><AppIcon :name="lastAddedId === r.id ? 'check' : 'plus'" :size="16"/>{{ lastAddedId === r.id ? '再加一份' : '加入计划' }}</button></view></view>
      </view>
    </view>
    <view v-if="manageMode && selectedIds.length" class="manage-bar"><button class="manage-del-btn" @tap="batchDelete">隐藏选中 ({{ selectedIds.length }})</button><button v-if="selectedCustomIds.length" class="manage-del-btn permanent-delete" @tap="deletePermanently(selectedCustomIds)">删除自建 ({{ selectedCustomIds.length }})</button></view>
    <view v-if="!visibleRecipes.length" class="empty-card surface-panel"><view class="empty-picture"><FoodVisual /></view><text class="empty-title">{{ allRecipes.length ? '这个分类还没有食谱' : '留一份你的日常搭配' }}</text><text class="recipe-hint">{{ allRecipes.length ? '换个分类看看，或自己创建一份。' : '选择食材与分量，保存自己的菜谱。' }}</text><button class="secondary-action" @tap="openBuilder()">自建菜谱</button></view>
    <button v-if="deletedRecipes" class="secondary-action" @tap="undoRecipeDelete">撤销最近一次隐藏</button>
    <text class="image-note">食物图片为示意，热量来自配料计算。</text>
    <view v-if="detailRecipe" class="detail-overlay" @tap="detailRecipe = null"><view class="detail-panel content-enter" @tap.stop>
      <view class="detail-heading"><text>食谱详情</text><button aria-label="关闭食谱详情" @tap="detailRecipe = null"><AppIcon name="close"/></button></view><view class="detail-photo"><FoodVisual :src="recipeImage(detailRecipe)" :label="detailRecipe.name"/></view><text class="detail-title">{{ displayDishName(detailRecipe.name) }}</text><text class="detail-kcal">约 {{ Math.round(detailRecipe.totalKcal) }} 千卡 · {{ detailRecipe.ingredients.length }} 种配料</text><button v-if="customRecipeIds.has(detailRecipe.id)" class="detail-edit" @tap="openBuilder(detailRecipe)">编辑菜谱 · 修改配料或照片</button><text class="detail-sub">点击食材可替换；预设食谱会另存为我的搭配。</text><text v-if="detailRecipe.totalCarbs === null || detailRecipe.totalProtein === null || detailRecipe.totalFat === null" class="detail-sub">部分营养数据未完善，热量照常计算。</text>
      <view class="detail-ingredients"><view v-for="ing in getIngredientLabels(detailRecipe)" :key="ing.index" class="detail-ing-row" @tap="showSwapOptions(ing)"><view class="ingredient-icon"><FoodVisual :category="ing.category" /></view><view class="ding-info"><text class="ding-name">{{ ing.name }}</text><text class="ding-meta">{{ ing.grams }} g · {{ Math.round(ing.kcal) }} 千卡</text></view><text class="ding-swap-hint">替换 ›</text></view></view>
      <view v-if="lastAddedId === detailRecipe.id" class="detail-success"><AppIcon name="check" :size="17"/><text>已加入今天计划</text><button @tap="journalNavigation.openToday('plan')">去计划 ›</button></view><button class="primary-action" @tap="addRecipeToPlan(detailRecipe)">{{ lastAddedId === detailRecipe.id ? '再加一份到计划' : '整道加入今天计划' }}</button>
    </view></view>
    <RecipeReplacement v-if="swapping !== null && detailRecipe" :recipe="detailRecipe" :index="swapping" @saved="detailRecipe = $event" @close="swapping = null" />


    <RecipeBuilder v-if="showRecipeBuilder" :recipe="editingRecipe" :meal-filter="mealFilter" @manage-photos="openManagement(true)" @saved="onRecipeSaved" @close="closeBuilder" />
    <HiddenRecipes v-if="showHiddenRecipes" :editing="showRecipeBuilder" :photo-cleanup="photoCleanupMode" @close="showHiddenRecipes = false" @restored="onHiddenRestored" @deleted="onCustomDeleted" />
  </view>
</template>
<script setup lang="ts">
import FoodVisual from '@/components/FoodVisual.vue'
import AppIcon from '@/components/AppIcon.vue'
import { recipeImage, displayDishName } from '@/utils/foodVisuals'
import { confirmCustomRecipeDeletion } from '@/utils/recipeDeletion'

import { useJournalStore } from '@/store/journal'
import { calculatedRecipe, foodPortion } from '@/utils/nutrition'
import { ref, computed } from 'vue'
import RecipeBuilder from '@/components/RecipeBuilder.vue'
import HiddenRecipes from '@/components/HiddenRecipes.vue'
import RecipeReplacement from '@/components/RecipeReplacement.vue'
import { recipeMeals, recipeMealLabel } from '@/utils/recipeMeals'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'
import { useRecordsStore } from '@/store/records'
import { usePlanStore } from '@/store/plan'
import { useJournalNavigation } from '@/store/journalNavigation'
import { groupPlans, planStatusHint } from '@/utils/planGroups'
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
const journalNavigation = useJournalNavigation()
const lastAdded = ref('')
const lastAddedId = ref('')
const mealFilter = ref('all')
const mealFilters = [{ key: 'all', label: '全部' }, ...recipeMeals, { key: 'custom', label: '自建' }]
const visibleRecipes = computed(() => allRecipes.value.filter(recipe => mealFilter.value === 'all' || (mealFilter.value === 'custom' ? customRecipeIds.value.has(recipe.id) : recipe.mealTime === mealFilter.value)))
const todayPlanCount = computed(() => groupPlans(journal.todayDay.plans, journal.todayDay.entries).length)
const detailRecipe = ref<Recipe | null>(null)
const swapping = ref<number | null>(null)

// 管理 + 隐藏食谱
const manageMode = ref(false)
const showHiddenRecipes = ref(false)
const photoCleanupMode = ref(false)
function openManagement(forPhotos = false) { photoCleanupMode.value = forPhotos; showHiddenRecipes.value = true }
const selectedIds = ref<string[]>([])
const selectedCustomIds = computed(() => selectedIds.value.filter(id => customRecipeIds.value.has(id)))
const hiddenRecipeIds = computed(() => new Set(journal.data.hiddenRecipeIds))

function toggleSelect(id: string) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

function batchDelete() {
  if (!selectedIds.value.length) return
  const ids = [...selectedIds.value]
  uni.showModal({ title: '隐藏食谱', content: '从列表隐藏选中的 ' + ids.length + ' 份食谱？照片仍占空间，可在「隐藏菜谱」恢复或清理照片，历史计划和已吃不受影响。', confirmText: '隐藏', success: res => { if (res.confirm) deleteRecipes(ids) } })
}
const deletedRecipes = ref<string[] | null>(null)
function deleteRecipes(ids: string[]) {
  const newlyHidden = ids.filter(id => !hiddenRecipeIds.value.has(id))
  if (!newlyHidden.length) return
  try { journal.hideRecipes(newlyHidden) }
  catch { uni.showToast({ title: '隐藏未保存，请重试', icon: 'none' }); return }
  deletedRecipes.value = newlyHidden
  selectedIds.value = []
  manageMode.value = false
  uni.showToast({ title: '已隐藏，可恢复', icon: 'success' })
}

function undoRecipeDelete() {
  if (!deletedRecipes.value) return
  try { journal.restoreRecipes(deletedRecipes.value) }
  catch { uni.showToast({ title: '恢复未保存，请重试', icon: 'none' }); return }
  deletedRecipes.value = null
  uni.showToast({ title: '已恢复', icon: 'success' })
}

// 自定义菜谱
const customRecipes = computed(() => journal.data.customRecipes)
const showRecipeBuilder = ref(false)
const editingRecipe = ref<Recipe | null>(null)
const customRecipeIds = computed(() => new Set(customRecipes.value.map(recipe => recipe.id)))
function openBuilder(recipe?: Recipe) {
  editingRecipe.value = recipe || null; detailRecipe.value = null; swapping.value = null
  showRecipeBuilder.value = true
}
function closeBuilder() { showRecipeBuilder.value = false; editingRecipe.value = null }
function onRecipeSaved(recipe: Recipe) {
  if (mealFilter.value !== 'all' && mealFilter.value !== 'custom' && mealFilter.value !== recipe.mealTime) mealFilter.value = recipe.mealTime
  else if (!editingRecipe.value && mealFilter.value === 'all') mealFilter.value = 'custom'
  manageMode.value = false; selectedIds.value = []
  if (lastAddedId.value === recipe.id) lastAddedId.value = ''
}
function onHiddenRestored(ids: string[]) {
  selectedIds.value = []
  if (deletedRecipes.value) deletedRecipes.value = deletedRecipes.value.filter(item => !ids.includes(item))
  if (!deletedRecipes.value?.length) deletedRecipes.value = null
  if (!showRecipeBuilder.value) mealFilter.value = 'all'
}
function onCustomDeleted(ids: string[]) {
  selectedIds.value = selectedIds.value.filter(id => !ids.includes(id))
  if (deletedRecipes.value) deletedRecipes.value = deletedRecipes.value.filter(id => !ids.includes(id))
  if (!deletedRecipes.value?.length) deletedRecipes.value = null
  if (ids.includes(lastAddedId.value)) { lastAddedId.value = ''; lastAdded.value = '' }
  if (detailRecipe.value && ids.includes(detailRecipe.value.id)) detailRecipe.value = null
}
function deletePermanently(ids: string[]) {
  confirmCustomRecipeDeletion(journal, ids, deleted => {
    onCustomDeleted(deleted)
    uni.showToast({ title: '菜谱已删除，历史记录保留', icon: 'none' })
  })
}
function loadCustomRecipes() { journal.refresh() }
onShow(() => { recordsStore.loadToday(); planStore.loadPlan(); lastAdded.value = ''; lastAddedId.value = '' })
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
  try { planStore.addRecipeGroup(r.name, items, r.id) }
  catch { uni.showToast({ title: '计划未保存，请检查存储后重试', icon: 'none' }); return }
  lastAdded.value = displayDishName(r.name); lastAddedId.value = r.id
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

const mealTimeLabel = recipeMealLabel
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

function showSwapOptions(ing: { index: number }) { swapping.value = ing.index }
</script>
<style scoped>

.recipe-page { max-width:820px; margin:0 auto; padding:24px 20px 32px; }.page-heading { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; }.page-eyebrow { display:block; font-size:12px; color:var(--muted); margin-bottom:4px; }.page-title { display:block; font-size:26px; font-weight:650; letter-spacing:-.5px; }.create-button { display:flex; align-items:center; gap:4px; background:#e9eee3; color:var(--brand); padding:0 13px; line-height:44px; margin:0; border-radius:12px; font-size:13px; }
.gap-card { display:flex; align-items:center; gap:10px; flex-wrap:wrap; color:var(--muted); font-size:12px; margin-bottom:18px; }.gap-number { font-size:18px; color:var(--ink); font-weight:600; }.gap-number text { font-size:12px; font-weight:400; }.gap-note { color:#846b4f; }
.plan-shortcut,.added-receipt { display:flex; align-items:center; gap:10px; padding:10px 14px; border:1px solid #dce4d5; background:#eff3e9; border-radius:14px; margin-bottom:18px; }.plan-shortcut>view,.receipt-copy { flex:1; min-width:0; }.plan-shortcut-title { display:block; font-size:13px; font-weight:500; }.plan-shortcut button,.added-receipt button { background:transparent; color:var(--brand); padding:0; margin:0; line-height:44px; font-size:12px; white-space:nowrap; }
.added-receipt { position:sticky; top:calc(var(--window-top,0px) + 8px); z-index:5; box-shadow:0 4px 14px #26352c0c; }.receipt-copy>text:first-child { display:block; font-size:13px; overflow-wrap:anywhere; }.success-icon { display:flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:50%; background:#dce9d3; flex-shrink:0; }
.recipe-hint { display:block; font-size:11px; color:var(--muted); line-height:1.7; margin-top:3px; }.filter-row { display:flex; align-items:center; gap:8px; margin-bottom:16px; }.meal-filters { display:flex; flex:1; min-width:0; overflow-x:auto; gap:8px; padding:2px 0; }.meal-filters button { margin:0; flex-shrink:0; padding:0 13px; line-height:44px; min-height:44px; border-radius:20px; font-size:12px; background:transparent; color:var(--muted); }.meal-filters .active { color:#fff; background:var(--brand); }.manage-button { background:transparent; color:var(--brand); font-size:12px; padding:0 2px; margin:0; }
.recipe-grid { display:grid; grid-template-columns:minmax(0,1fr); gap:20px; }.meal-card { overflow:hidden; }.meal-card.selected { border-color:var(--brand); }.recipe-photo { height:190px; position:relative; overflow:hidden; }.meal-time-tag { position:absolute; left:14px; top:14px; font-size:11px; color:#48533f; background:#fffef2ed; padding:4px 9px; border-radius:20px; }.manage-check { position:absolute; right:14px; top:14px; width:24px; height:24px; border:1px solid #8d9b85; border-radius:8px; background:#fffffff2; text-align:center; color:#fff; }.manage-check.checked { background:var(--brand); border-color:var(--brand); }
.meal-body { padding:16px 18px 12px; }.meal-title-row { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }.meal-name { font-size:18px; font-weight:650; flex:1; min-width:0; overflow-wrap:anywhere; line-height:1.5; }.meal-kcal { font-size:18px; font-weight:600; color:var(--brand); white-space:nowrap; line-height:1.5; }.meal-kcal text { font-size:11px; font-weight:400; }.meal-ingredients { display:block; margin-top:6px; color:var(--muted); font-size:12px; line-height:1.8; }.meal-footer { display:flex; align-items:center; justify-content:space-between; gap:8px; padding-top:12px; }.detail-link { color:var(--muted); background:transparent; font-size:12px; padding:0; margin:0; text-align:left; }.meal-add-plan { display:flex; align-items:center; justify-content:center; gap:5px; background:#eaf0e3; color:var(--brand); font-size:13px; border-radius:12px; padding:0 12px; margin:0; line-height:44px; }.meal-add-plan.added { background:#e0ebd7; }.meal-del-one { margin:0; font-size:13px; color:#9e543f; background:#faeee6; }
.manage-bar { margin-top:16px; }.manage-del-btn { color:#fff; background:#9e543f; width:100%; font-size:14px; border-radius:12px; }.empty-card { padding:24px; text-align:center; }.empty-picture { height:120px; width:140px; border-radius:50%; overflow:hidden; margin:0 auto 20px; }.empty-title { display:block; font-size:17px; font-weight:600; }.image-note { display:block; margin-top:20px; color:var(--muted); font-size:11px; }
.detail-overlay { position:fixed; inset:0; bottom:var(--window-bottom,0px); z-index:1002; background:#1b30254d; display:flex; align-items:flex-end; justify-content:center; }.detail-panel { width:100%; max-width:600px; max-height:88vh; overflow-y:auto; overscroll-behavior:contain; background:var(--surface); border-radius:24px 24px 0 0; padding:12px 20px calc(24px + env(safe-area-inset-bottom)); }.detail-heading { display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--muted); }.detail-heading button { display:flex; align-items:center; justify-content:center; background:transparent; margin:0; padding:0; }.detail-photo { height:155px; border-radius:16px; overflow:hidden; margin:4px 0 16px; }.detail-title { display:block; font-size:22px; font-weight:650; overflow-wrap:anywhere; }.detail-kcal { display:block; font-size:14px; color:var(--brand); margin-top:5px; }.detail-sub { display:block; color:var(--muted); font-size:12px; line-height:1.7; margin-top:10px; }.detail-ingredients { margin:12px 0; }.detail-ing-row { display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--line); }.ingredient-icon { width:40px; height:40px; overflow:hidden; border-radius:12px; flex-shrink:0; }.ding-info { flex:1; min-width:0; }.ding-name { display:block; font-size:14px; overflow-wrap:anywhere; }.ding-meta { display:block; font-size:12px; color:var(--muted); margin-top:2px; }.ding-swap-hint { color:var(--brand); font-size:12px; white-space:nowrap; }.detail-success { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--brand); }.detail-success button { margin-left:auto; background:transparent; font-size:12px; color:var(--brand); }
@media(min-width:700px) { .recipe-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }.recipe-photo { height:190px; } }
@media(max-width:350px) { .recipe-page { padding:20px 16px 28px; }.page-title { font-size:24px; }.recipe-photo { height:165px; }.meal-body { padding:14px 14px 10px; }.meal-name { font-size:16px; }.meal-kcal { font-size:16px; }.meal-add-plan { padding:0 10px; font-size:12px; }.detail-panel { padding-left:16px; padding-right:16px; }.receipt-copy>text:first-child { font-size:12px; } }

.meal-links { display:flex; align-items:center; flex-wrap:wrap; column-gap:12px; }.edit-link { margin:0; padding:0; min-height:44px; line-height:44px; background:transparent; color:var(--brand); font-size:12px; }.detail-edit { margin:12px 0 0; padding:0 12px; line-height:44px; min-height:44px; background:var(--wash); color:var(--brand); font-size:13px; border-radius:12px; }
@media(max-width:350px) { .meal-links { column-gap:10px; }.meal-footer { gap:6px; } }
.hidden-entry { padding:12px 14px; border:1px solid var(--line); background:var(--wash); border-radius:14px; margin-bottom:16px; }.hidden-entry button { margin:0; padding:0; min-height:44px; line-height:1.7; background:transparent; color:var(--brand); font-size:13px; text-align:left; white-space:normal; }
.manage-bar .permanent-delete { background:#f7e3dc; color:#974833; }.manage-bar { display:flex; gap:8px; flex-wrap:wrap; }.manage-bar button { flex:1; min-width:0; font-size:12px; }
</style>
