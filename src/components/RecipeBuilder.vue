<template>
  <view class="builder-overlay" @tap="close">
    <view class="builder-panel" @tap.stop>
      <view class="builder-header"><text class="builder-title">{{ recipe ? '编辑菜谱' : '自建菜谱' }}</text><button @tap="close" aria-label="关闭自建菜谱"><AppIcon name="close"/></button></view>
      <scroll-view class="builder-body" scroll-y>
        <view class="builder-content">
          <text class="field-label">菜谱名称</text>
          <input class="name-input" v-model="name" maxlength="50" placeholder="例如：鸡胸肉杂粮饭" aria-label="菜谱名称" />
          <view class="photo-field">
            <view class="photo-preview"><FoodVisual :src="photo" :label="name || '自建菜谱'" /></view>
            <view class="photo-copy"><text class="field-label">菜谱照片 <text class="muted">选填</text></text><text class="photo-hint">{{ photo ? '照片随菜谱保存，也会包含在备份中。' : '放一张自己的成品照，更容易找到这道菜。' }}</text><view class="photo-actions"><button :disabled="photoBusy" @tap="choosePhoto">{{ photoBusy ? '正在处理照片…' : photo ? '更换照片' : '添加照片' }}</button><button v-if="photo" class="remove-photo" :disabled="photoBusy" @tap="photo = ''; photoError = ''">移除</button></view></view>
          </view>
          <text v-if="photoError" class="error" role="alert">{{ photoError }}</text>
          <text v-if="recipe" class="edit-note">修改只影响这份菜谱，已加入的计划和饮食记录保持原样。</text>
          <view class="section-heading"><text class="field-label">已选食材 <text class="muted">{{ items.length }}</text></text><text class="muted">约 {{ Math.round(total) }} 千卡</text></view>
          <text v-if="hasUnknownMacros" class="muted">部分食材营养数据未完善，热量仍可计算。</text>
          <text v-if="!items.length" class="empty">从下方选择食材，设置分量后加入。</text>
          <view v-for="(item, index) in items" :key="index" class="selected-row">
            <view class="selected-info"><text>{{ foodName(item.foodId) }}</text><text class="muted">{{ item.grams }} g · {{ Math.round(portion(item.foodId, item.grams)) }} 千卡</text></view>
            <button @tap="edit(index)" :aria-label="'修改' + foodName(item.foodId) + '分量'">修改</button><button class="remove" @tap="remove(index)" :aria-label="'移除' + foodName(item.foodId)">移除</button>
          </view>
          <text class="field-label add-heading">添加食材</text>
          <view class="category-tabs"><button v-for="category in categories" :key="category.key" :class="{active: activeCategory === category.key}" @tap="activeCategory = category.key">{{ category.name }}</button></view>
          <view class="food-grid"><button v-for="food in visibleFoods" :key="food.id" class="food-option" :class="{selected: selectedFood?.id === food.id}" @tap="choose(food)"><view class="option-symbol"><FoodVisual :category="food.category" :label="food.name"/></view><text class="food-name">{{ food.name }}</text><text class="muted">{{ food.kcal }} 千卡 / 100 g</text></button></view>
        </view>
      </scroll-view>
      <view class="builder-footer">
        <view v-if="selectedFood" class="portion-editor">
          <view class="portion-heading"><text>{{ editingIndex === null ? '加入' : '修改' }} · {{ selectedFood.name }}</text><button @tap="clearSelection">取消选择</button></view>
          <view class="portion-controls"><button :aria-label="'减少' + stepGrams + '克'" @tap="step(-stepGrams)">−</button><input type="digit" v-model="grams" aria-label="食材克数" :adjust-position="true" :cursor-spacing="120"/><text class="muted">g</text><button :aria-label="'增加' + stepGrams + '克'" @tap="step(stepGrams)">＋</button><button class="portion-add" :disabled="!validGrams(grams)" @tap="add">{{ editingIndex === null ? '加入' : '更新' }}</button></view>
          <text class="portion-note">起始分量仅作参考，请按实际用量调整。</text>
          <text v-if="!validGrams(grams)" class="error">克数须大于 0 且不超过 5000</text>
        </view>
        <text v-if="saveError" class="error save-error" role="alert">{{ saveError }}</text>
        <view class="save-row"><view class="save-summary"><text>{{ items.length }} 种食材</text><text class="muted">合计约 {{ Math.round(total) }} 千卡</text></view><button class="save-button" :disabled="photoBusy" @tap="save">{{ recipe ? '保存修改' : '保存菜谱' }}</button></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import FoodVisual from './FoodVisual.vue'
import AppIcon from './AppIcon.vue'
import { foodCategories } from '@/utils/customFoods'
import type { FoodItem } from '@/types/journal'
import type { Recipe } from '@/data/recipes'
import { useJournalStore } from '@/store/journal'
import { foodPortion, newId, recipeNutrition } from '@/utils/nutrition'
import { validGrams } from '@/utils/input'
import { defaultRecipeGrams, portionStep } from '@/utils/foodPortions'
import { chooseRecipePhoto } from '@/utils/recipePhotos'

const props = defineProps<{ recipe?: Recipe | null }>()
const emit = defineEmits<{ close: []; saved: [recipe: Recipe] }>()
// #ifdef H5
let previousOverflow = ''
onMounted(() => { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden' })
onUnmounted(() => { document.body.style.overflow = previousOverflow })
// #endif
const journal = useJournalStore()
const foods = computed(() => journal.allFoods)
const name = ref(props.recipe?.name || '')
const items = ref<Recipe['ingredients']>((props.recipe?.ingredients || []).map(item => ({ ...item })))
const photo = ref(props.recipe?.photo || '')
const photoBusy = ref(false), photoError = ref(''), saveError = ref('')
let alive = true
onUnmounted(() => { alive = false })
const original = JSON.stringify({ name: name.value, items: items.value, photo: photo.value })
const changed = computed(() => original !== JSON.stringify({ name: name.value, items: items.value, photo: photo.value }))
const selectedFood = ref<FoodItem | null>(null)
const editingIndex = ref<number | null>(null)
const grams = ref<number | string>(100)
const activeCategory = ref('staple')
const stepGrams = computed(() => portionStep(selectedFood.value))
const categories = foodCategories.map(category => ({ key: category.key, name: category.label }))
const visibleFoods = computed(() => foods.value.filter(food => food.category === activeCategory.value))
const hasUnknownMacros = computed(() => { const total = recipeNutrition(items.value, foods.value); return total.totalCarbs === null || total.totalProtein === null || total.totalFat === null })
const total = computed(() => recipeNutrition(items.value, foods.value).totalKcal)
const foodName = (id: number) => foods.value.find(food => food.id === id)?.name || '未知食材'
const portion = (id: number, amount: number) => foodPortion(foods.value.find(food => food.id === id)!, amount).subtotalKcal
function clearSelection() { selectedFood.value = null; editingIndex.value = null; grams.value = 100 }
function choose(food: FoodItem) {
  selectedFood.value = food; editingIndex.value = null; grams.value = defaultRecipeGrams(food)
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
  if (!changed.value && !selectedFood.value) { emit('close'); return }
  uni.showModal({ title: '放弃这次编辑？', content: props.recipe ? '本次修改还没有保存，退出后保留原菜谱。' : '这份菜谱还没有保存，退出后需重新填写。', confirmText: '放弃编辑', cancelText: '继续编辑', success: result => { if (result.confirm) emit('close') } })
}
async function choosePhoto() {
  if (photoBusy.value) return
  photoBusy.value = true; photoError.value = ''
  try { const selected = await chooseRecipePhoto(); if (alive && selected) photo.value = selected }
  catch (error) { if (alive) photoError.value = error instanceof Error ? error.message : '照片处理失败，请重新选择' }
  finally { if (alive) photoBusy.value = false }
}
function save() {
  if (photoBusy.value) return
  saveError.value = ''
  if (selectedFood.value) { uni.showToast({ title: '请先确认当前食材，或取消选择', icon: 'none' }); return }
  if (!name.value.trim() || !items.value.length) { uni.showToast({ title: '请填写菜名并添加食材', icon: 'none' }); return }
  const previousDescription = props.recipe?.description
  const description = previousDescription && !/^\d+种食材$/.test(previousDescription) ? previousDescription : `${items.value.length}种食材`
  const recipe: Recipe = { ...props.recipe, id: props.recipe?.id || 'custom_' + newId(), name: name.value.trim(), type: props.recipe?.type || 'standard', mealTime: props.recipe?.mealTime || 'lunch', ingredients: items.value.map(item => ({ ...item })), ...recipeNutrition(items.value, foods.value), description }
  if (photo.value) recipe.photo = photo.value
  else delete recipe.photo
  try { journal.saveCustomRecipe(recipe, props.recipe?.id) }
  catch (error) { saveError.value = error instanceof Error && !(error instanceof TypeError) ? error.message : '食谱未保存，请重试；填写内容已保留'; return }
  emit('saved', recipe); emit('close'); uni.showToast({ title: props.recipe ? '菜谱已更新' : '菜谱已保存', icon: 'success' })
}
</script>

<style scoped>
.builder-overlay { position:fixed; inset:0; z-index:1100; display:flex; align-items:flex-end; justify-content:center; }
.builder-panel { width:100%; height:94vh; height:94dvh; background:#fff; display:flex; flex-direction:column; overflow:hidden; }
.builder-header { display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #e9ece9; flex-shrink:0; }.builder-title { font-weight:600; }
button { margin:0; padding:0 12rpx; min-height:44px; line-height:44px; font-size:max(26rpx,13px); color:#28745b; background:transparent; border-radius:6px; }
.builder-body { flex:1; height:0; min-height:0; }
.field-label { display:block; font-weight:500; }.name-input { height:48px; padding:0 20rpx; border:1px solid #dce2de; font-size:max(28rpx,14px); }
.muted { line-height:1.6; }.section-heading { display:flex; justify-content:space-between; align-items:center; gap:12rpx; }.empty { display:block; margin:20rpx 0 32rpx; color:#6b756f; line-height:1.7; }
.selected-row { display:flex; align-items:center; gap:4rpx; padding:12rpx 0; border-bottom:1px solid #edf0ed; }.selected-info { flex:1; min-width:0; font-size:max(28rpx,14px); overflow-wrap:anywhere; }.selected-info text { display:block; }.remove { color:#7b635b; }
.add-heading { margin-top:32rpx; }.category-tabs { display:flex; border-bottom:1px solid #e2e7e3; margin:12rpx 0 24rpx; }.category-tabs button { white-space:nowrap; border-bottom:2px solid transparent; }.category-tabs .active { border-bottom-color:#28745b; font-weight:600; }
.food-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }.food-option { text-align:left; border:1px solid #e4e9e5; line-height:1.5; color:#26352c; }.food-option text { display:block; }.food-name { margin-bottom:6rpx; overflow-wrap:anywhere; }
.builder-footer { flex-shrink:0; border-top:1px solid #e2e7e3; background:#fff; }.save-row { display:flex; align-items:center; gap:24rpx; }.save-summary { flex:1; }.save-summary text { display:block; }.save-button { color:#fff; font-weight:500; }
.portion-editor { padding-bottom:20rpx; margin-bottom:16rpx; border-bottom:1px solid #e8ede9; }.portion-heading { display:flex; align-items:center; justify-content:space-between; gap:8rpx; font-size:max(26rpx,13px); }.portion-heading>text { min-width:0; overflow-wrap:anywhere; }.portion-heading button { flex-shrink:0; color:#6b756f; }.portion-controls { display:flex; align-items:center; gap:12rpx; }.portion-controls input { flex:1; min-width:0; width:0; height:44px; text-align:center; border:1px solid #dce2de; font-size:16px; }.portion-controls button { min-width:44px; box-sizing:border-box; background:#f3f5f3; }.portion-controls .portion-add { padding:0 24rpx; }.error { display:block; color:#a34831; font-size:12px; margin-top:8rpx; }

.builder-overlay { background:#1b30254d; }.builder-panel { max-width:600px; border-radius:24px 24px 0 0; }.builder-header { padding:12px 20px; }.builder-title { font-size:20px; }.builder-content { padding:20px; }.builder-header button { display:flex; align-items:center; justify-content:center; padding:0; }.field-label { font-size:14px; }.name-input { border-color:var(--line); border-radius:12px; margin:10px 0 24px; }.muted { color:var(--muted); font-size:12px; }.empty { background:var(--wash); border-radius:12px; padding:16px; font-size:13px; }
.category-tabs { overflow-x:auto; border:0; gap:6px; padding:2px 0 8px; }.category-tabs button { flex:none; min-width:44px; padding:0 12px; border:0; border-radius:20px; background:var(--wash); color:var(--muted); line-height:44px; min-height:44px; font-size:13px; transition:background .18s,color .18s; }.category-tabs .active { background:var(--brand); color:#fff; }
.food-grid { gap:12px; }.food-option { border-color:var(--line); border-radius:14px; padding:14px; }.food-option.selected { border-color:var(--brand); background:#eff4e8; }.option-symbol { width:36px; height:36px; border-radius:10px; overflow:hidden; margin-bottom:10px; }.food-name { font-size:14px; }.selected-row button { color:var(--brand); font-size:12px; }.selected-row .remove { color:#9e543f; }.builder-footer { padding:14px 20px calc(18px + env(safe-area-inset-bottom)); }.save-button { background:var(--brand); border-radius:12px; padding:0 24px; }.portion-controls input { border-radius:12px; }.portion-controls button { border-radius:10px; }.portion-controls .portion-add { color:var(--brand); background:#eaf0e2; }.save-summary { font-size:13px; }
@media(max-width:350px) { .builder-content { padding:16px; }.builder-footer { padding-left:16px; padding-right:16px; }.food-option { padding:12px; }.portion-controls { gap:6px; }.portion-controls .portion-add { padding:0 12px; }.category-tabs button { padding:0 10px; } }
.photo-field { display:flex; gap:14px; align-items:center; margin-bottom:20px; padding:12px; background:var(--wash); border-radius:14px; }.photo-preview { width:90px; height:90px; flex-shrink:0; overflow:hidden; border-radius:12px; }.photo-copy { flex:1; min-width:0; }.photo-hint { display:block; font-size:12px; color:var(--muted); line-height:1.6; margin-top:4px; }.photo-actions { display:flex; align-items:center; flex-wrap:wrap; gap:4px; margin-top:2px; }.photo-actions button { padding:0 8px; font-size:13px; }.photo-actions .remove-photo { color:#9e543f; }.portion-note { display:block; font-size:11px; line-height:1.6; color:var(--muted); margin-top:8px; }.save-error { margin-bottom:12px; line-height:1.6; }button[disabled] { opacity:.5; }
.edit-note { display:block; font-size:12px; line-height:1.7; color:var(--muted); margin-bottom:20px; }
@media(max-width:350px) { .photo-field { padding:10px; gap:10px; }.photo-preview { width:72px; height:80px; } }
</style>
