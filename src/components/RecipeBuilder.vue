<template>
  <view class="builder-overlay" @tap="close">
    <view class="builder-panel" @tap.stop>
      <view class="builder-header"><text class="builder-title">自建菜谱</text><button @tap="close" aria-label="关闭自建菜谱">关闭</button></view>
      <scroll-view class="builder-body" scroll-y>
        <view class="builder-content">
          <text class="field-label">菜谱名称</text>
          <input class="name-input" v-model="name" maxlength="50" placeholder="例如：鸡胸肉杂粮饭" aria-label="菜谱名称" />
          <view class="section-heading"><text class="field-label">已选食材 <text class="muted">{{ items.length }}</text></text><text class="muted">约 {{ Math.round(total) }} 千卡</text></view>
          <text v-if="hasUnknownMacros" class="muted">部分食材营养数据未完善，热量仍可计算。</text>
          <text v-if="!items.length" class="empty">从下方选择食材，设置分量后加入。</text>
          <view v-for="(item, index) in items" :key="index" class="selected-row">
            <view class="selected-info"><text>{{ foodName(item.foodId) }}</text><text class="muted">{{ item.grams }} g · {{ Math.round(portion(item.foodId, item.grams)) }} 千卡</text></view>
            <button @tap="edit(index)" :aria-label="'修改' + foodName(item.foodId) + '分量'">修改</button><button class="remove" @tap="remove(index)" :aria-label="'移除' + foodName(item.foodId)">移除</button>
          </view>
          <text class="field-label add-heading">添加食材</text>
          <view class="category-tabs"><button v-for="category in categories" :key="category.key" :class="{active: activeCategory === category.key}" @tap="activeCategory = category.key">{{ category.name }}</button></view>
          <view class="food-grid"><button v-for="food in visibleFoods" :key="food.id" class="food-option" :class="{selected: selectedFood?.id === food.id}" @tap="choose(food)"><text class="food-name">{{ food.name }}</text><text class="muted">{{ food.kcal }} 千卡 / 100 g</text></button></view>
        </view>
      </scroll-view>
      <view class="builder-footer">
        <view v-if="selectedFood" class="portion-editor">
          <view class="portion-heading"><text>{{ editingIndex === null ? '加入' : '修改' }} · {{ selectedFood.name }}</text><button @tap="clearSelection">取消选择</button></view>
          <view class="portion-controls"><button aria-label="减少10克" @tap="step(-10)">−</button><input type="digit" v-model="grams" aria-label="食材克数" :adjust-position="true" :cursor-spacing="120"/><text class="muted">g</text><button aria-label="增加10克" @tap="step(10)">＋</button><button class="portion-add" :disabled="!validGrams(grams)" @tap="add">{{ editingIndex === null ? '加入' : '更新' }}</button></view>
          <text v-if="!validGrams(grams)" class="error">克数须大于 0 且不超过 5000</text>
        </view>
        <view class="save-row"><view class="save-summary"><text>{{ items.length }} 种食材</text><text class="muted">合计约 {{ Math.round(total) }} 千卡</text></view><button class="save-button" @tap="save">保存菜谱</button></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { foodCategories } from '@/utils/customFoods'
import type { FoodItem } from '@/types/journal'
import type { Recipe } from '@/data/recipes'
import { useJournalStore } from '@/store/journal'
import { usePlanStore } from '@/store/plan'
import { foodPortion, newId, recipeNutrition } from '@/utils/nutrition'
import { validGrams } from '@/utils/input'

const emit = defineEmits<{ close: [] }>()
// #ifdef H5
let previousOverflow = ''
onMounted(() => { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden' })
onUnmounted(() => { document.body.style.overflow = previousOverflow })
// #endif
const journal = useJournalStore(), plan = usePlanStore()
const foods = computed(() => journal.allFoods)
const name = ref('')
const items = ref<Recipe['ingredients']>([])
const selectedFood = ref<FoodItem | null>(null)
const editingIndex = ref<number | null>(null)
const grams = ref<number | string>(100)
const activeCategory = ref('staple')
const categories = foodCategories.map(category => ({ key: category.key, name: category.label }))
const visibleFoods = computed(() => foods.value.filter(food => food.category === activeCategory.value))
const hasUnknownMacros = computed(() => { const total = recipeNutrition(items.value, foods.value); return total.totalCarbs === null || total.totalProtein === null || total.totalFat === null })
const total = computed(() => recipeNutrition(items.value, foods.value).totalKcal)
const foodName = (id: number) => foods.value.find(food => food.id === id)?.name || '未知食材'
const portion = (id: number, amount: number) => foodPortion(foods.value.find(food => food.id === id)!, amount).subtotalKcal
function clearSelection() { selectedFood.value = null; editingIndex.value = null; grams.value = 100 }
function choose(food: FoodItem) {
  selectedFood.value = food; editingIndex.value = null; grams.value = plan.getRememberedGrams(food.id) || 100
}
function step(delta: number) { grams.value = Math.max(1, Math.min(5000, (Number(grams.value) || 0) + delta)) }
function edit(index: number) {
  const item = items.value[index]
  selectedFood.value = foods.value.find(food => food.id === item.foodId)!
  editingIndex.value = index; grams.value = item.grams
}
function remove(index: number) {
  items.value.splice(index, 1)
  if (editingIndex.value === index) clearSelection()
  else if (editingIndex.value !== null && editingIndex.value > index) editingIndex.value--
}
function add() {
  if (!selectedFood.value || !validGrams(grams.value)) return
  const item = { foodId: selectedFood.value.id, grams: Number(grams.value) }
  if (editingIndex.value === null) items.value.push(item)
  else items.value.splice(editingIndex.value, 1, item)
  clearSelection()
}
function close() {
  if (!name.value.trim() && !items.value.length && !selectedFood.value) { emit('close'); return }
  uni.showModal({ title: '放弃这次编辑？', content: '这份菜谱还没有保存，退出后需重新填写。', confirmText: '放弃编辑', cancelText: '继续编辑', success: result => { if (result.confirm) emit('close') } })
}
function save() {
  if (selectedFood.value) { uni.showToast({ title: '请先确认当前食材，或取消选择', icon: 'none' }); return }
  if (!name.value.trim() || !items.value.length) { uni.showToast({ title: '请填写菜名并添加食材', icon: 'none' }); return }
  const recipe: Recipe = { id: 'custom_' + newId(), name: name.value.trim(), type: 'standard', mealTime: 'lunch', ingredients: items.value.map(item => ({ ...item })), ...recipeNutrition(items.value, foods.value), description: `${items.value.length}种食材` }
  try { journal.mutate(data => { data.customRecipes.push(recipe) }) }
  catch { uni.showToast({ title: '食谱未保存，请重试', icon: 'none' }); return }
  emit('close'); uni.showToast({ title: '菜谱已保存', icon: 'success' })
}
</script>

<style scoped>
.builder-overlay { position:fixed; inset:0; z-index:1100; background:rgba(25,31,28,.4); display:flex; align-items:flex-end; justify-content:center; }
.builder-panel { width:100%; max-width:960rpx; height:94vh; height:94dvh; background:#fff; border-radius:24rpx 24rpx 0 0; display:flex; flex-direction:column; overflow:hidden; }
.builder-header { display:flex; align-items:center; justify-content:space-between; padding:12rpx 32rpx; border-bottom:1px solid #e9ece9; flex-shrink:0; }.builder-title { font-size:max(34rpx,18px); font-weight:600; }
button { margin:0; padding:0 12rpx; min-height:44px; line-height:44px; font-size:max(26rpx,13px); color:#28745b; background:transparent; border-radius:6px; }
.builder-body { flex:1; height:0; min-height:0; }.builder-content { padding:28rpx 32rpx 32rpx; }
.field-label { display:block; font-size:max(28rpx,14px); font-weight:500; }.name-input { height:48px; margin:12rpx 0 32rpx; padding:0 20rpx; border:1px solid #dce2de; border-radius:8rpx; font-size:max(28rpx,14px); }
.muted { color:#6b756f; font-size:max(24rpx,12px); line-height:1.6; }.section-heading { display:flex; justify-content:space-between; align-items:center; gap:12rpx; }.empty { display:block; margin:20rpx 0 32rpx; font-size:max(26rpx,13px); color:#6b756f; line-height:1.7; }
.selected-row { display:flex; align-items:center; gap:4rpx; padding:12rpx 0; border-bottom:1px solid #edf0ed; }.selected-info { flex:1; min-width:0; font-size:max(28rpx,14px); overflow-wrap:anywhere; }.selected-info text { display:block; }.remove { color:#7b635b; }
.add-heading { margin-top:32rpx; }.category-tabs { display:flex; border-bottom:1px solid #e2e7e3; margin:12rpx 0 24rpx; }.category-tabs button { flex:1; padding:0 4rpx; white-space:nowrap; border-radius:0; color:#6b756f; border-bottom:2px solid transparent; }.category-tabs .active { color:#28745b; border-bottom-color:#28745b; font-weight:600; }
.food-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16rpx; }.food-option { padding:20rpx; text-align:left; border:1px solid #e4e9e5; line-height:1.5; color:#26352c; }.food-option text { display:block; }.food-name { font-size:max(28rpx,14px); margin-bottom:6rpx; overflow-wrap:anywhere; }.food-option.selected { border-color:#28745b; background:#f0f6f2; }
.builder-footer { flex-shrink:0; border-top:1px solid #e2e7e3; background:#fff; padding:16rpx 32rpx calc(20rpx + env(safe-area-inset-bottom)); }.save-row { display:flex; align-items:center; gap:24rpx; }.save-summary { flex:1; font-size:max(26rpx,13px); }.save-summary text { display:block; }.save-button { color:#fff; background:#28745b; padding:0 40rpx; font-weight:500; }
.portion-editor { padding-bottom:20rpx; margin-bottom:16rpx; border-bottom:1px solid #e8ede9; }.portion-heading { display:flex; align-items:center; justify-content:space-between; gap:8rpx; font-size:max(26rpx,13px); }.portion-heading>text { min-width:0; overflow-wrap:anywhere; }.portion-heading button { flex-shrink:0; color:#6b756f; }.portion-controls { display:flex; align-items:center; gap:12rpx; }.portion-controls input { flex:1; min-width:0; width:0; height:44px; text-align:center; border:1px solid #dce2de; border-radius:6px; font-size:16px; }.portion-controls button { min-width:44px; box-sizing:border-box; background:#f3f5f3; }.portion-controls .portion-add { background:#e8f2ec; color:#28745b; padding:0 24rpx; }.error { display:block; color:#a34831; font-size:12px; margin-top:8rpx; }
</style>
