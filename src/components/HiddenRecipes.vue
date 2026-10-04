<template>
  <view class="hidden-overlay" @tap="closeManagement">
    <view v-show="!secondary || secondaryCleanup" class="hidden-panel" @tap.stop>
      <view class="hidden-heading"><view><text class="hidden-title">食谱管理</text><text class="hidden-note">{{ secondaryCleanup ? '清理后返回这份编辑，草稿保留' : '编辑日常搭配，隐藏或恢复食谱' }}</text></view><view class="hidden-heading-actions"><button v-if="currentItems.length" class="hidden-manage" :aria-label="active === 'hidden' ? '管理隐藏菜谱' : '管理现有食谱'" @tap="manage = !manage; selected = []">{{ manage ? '完成管理' : '管理' }}</button><button aria-label="关闭食谱管理" @tap="closeManagement"><AppIcon name="close" /></button></view></view>
      <view class="management-controls">
        <view class="photo-budget"><view><text>照片已用 {{ formatSize(totalChars) }} KB</text><text class="budget-number">可用 {{ formatSize(MAX_RECIPE_PHOTO_CHARS - totalChars) }} KB</text></view><text class="hidden-note">隐藏照片 {{ formatSize(hiddenChars) }} KB · 内置示意图不占空间</text></view>
        <view class="management-tabs" role="group" aria-label="食谱管理类别"><button :class="{ active: active === 'hidden' }" :aria-pressed="active === 'hidden'" @tap="active = 'hidden'">隐藏食谱 ({{ hidden.length }})</button><button :class="{ active: active === 'existing' }" :aria-pressed="active === 'existing'" @tap="active = 'existing'">现有食谱 ({{ existing.length }})</button></view>
        <button v-if="active === 'existing'" class="photo-filter" :class="{ active: onlyPhotos }" :aria-pressed="onlyPhotos" @tap="onlyPhotos = !onlyPhotos">{{ onlyPhotos ? '✓ ' : '' }}只看有自选照片</button>
        <text v-else class="hidden-note">隐藏可恢复；完整删除仅适用于自建，已有计划和已吃保留。</text>
      </view>
      <scroll-view class="hidden-body" scroll-y>
        <view class="hidden-content">
          <text v-if="feedback" class="hidden-feedback" :class="{ error: failed }" role="status">{{ feedback }}</text>
          <view v-if="!currentItems.length" class="hidden-empty"><AppIcon name="dish" :size="32" /><text>{{ active === 'hidden' ? '没有隐藏的菜谱' : onlyPhotos ? '现有食谱没有自选照片' : '没有现有食谱' }}</text><text class="hidden-note">{{ active === 'hidden' ? '现有菜谱的照片可在旁边分类清理。' : onlyPhotos ? '可切换到隐藏食谱查看，或关闭筛选浏览全部。' : '可切换到隐藏食谱恢复菜谱。' }}</text></view>
          <view v-if="manage" class="hidden-selection"><button @tap="selected = selected.length === currentItems.length ? [] : currentItems.map(item => item.id)">{{ selected.length === currentItems.length ? '取消全选' : '全选' }}</button><text>已选 {{ selected.length }} 项</text></view>
          <view v-for="item in currentItems" :key="item.id" class="hidden-item">
            <view class="hidden-row" @tap="manage && toggle(item.id)"><button v-if="manage" class="hidden-selector" :aria-label="'选择' + (item.recipe?.name || '旧菜谱')" :aria-pressed="selected.includes(item.id)" @tap.stop="toggle(item.id)"><text class="hidden-check" :class="{ checked: selected.includes(item.id) }">{{ selected.includes(item.id) ? '✓' : '' }}</text></button><view class="hidden-photo"><FoodVisual :src="item.recipe ? recipeImage(item.recipe) : ''" :label="item.recipe?.name || '旧菜谱'" /></view><view class="hidden-copy"><text class="hidden-name">{{ item.recipe ? displayDishName(item.recipe.name) : '暂不可识别的旧菜谱' }}</text><text class="hidden-note">{{ item.recipe ? recipeMealLabel(item.recipe.mealTime) : '原菜谱已不在当前库中，恢复仅移除隐藏标记。' }}</text><text class="hidden-note">{{ item.recipe?.photo ? '自选照片 ' + formatSize(item.recipe.photo.length) + ' KB' : '无自选照片，不占照片配额' }}</text></view></view>
            <view v-if="!manage" class="hidden-actions"><template v-if="active === 'existing' && item.recipe"><button v-if="customIds.has(item.id)" :disabled="secondaryCleanup" :aria-label="'编辑菜谱' + item.recipe.name" @tap="openSecondary(item.recipe, false)">编辑菜谱</button><template v-else><button @tap="expanded = expanded === item.id ? '' : item.id">{{ expanded === item.id ? '收起配料' : '查看配料' }}</button><button :disabled="secondaryCleanup" @tap="openSecondary(item.recipe, true)">另存我的搭配</button></template></template><button v-if="active === 'hidden'" @tap="restore([item.id])">{{ item.recipe ? '恢复显示' : '移除隐藏标记' }}</button><button v-if="active === 'hidden' && customIds.has(item.id)" class="clear-photo" @tap="deleteRecipes([item.id])">删除菜谱</button><button v-if="item.recipe?.photo" class="photo-only" @tap="removePhoto(item.recipe)">仅移除照片</button></view>
            <view v-if="!manage && expanded === item.id && item.recipe" class="management-detail"><text class="hidden-note">约 {{ Math.round(item.recipe.totalKcal) }} 千卡 · {{ item.recipe.ingredients.length }} 种配料</text><view v-for="(part, index) in item.recipe.ingredients" :key="index"><text>{{ ingredientName(part.foodId) }} {{ part.grams }} g</text><text>{{ ingredientCalories(part.foodId, part.grams) }} 千卡</text></view></view>
          </view>
        </view>
      </scroll-view>
      <view class="hidden-footer"><view v-if="manage" class="hidden-batch"><button :disabled="!selected.length" @tap="active === 'hidden' ? restore(selected) : hideSelected()">{{ active === 'hidden' ? '恢复选中' : '隐藏选中' }} ({{ selected.length }})</button><button class="clear-photo" :disabled="!selectedCustom.length" @tap="deleteRecipes(selectedCustom)">删除自建 ({{ selectedCustom.length }})</button><text class="hidden-note">隐藏/恢复包含内置和自建；完整删除只包含选中的自建。</text></view><button @tap="closeManagement">{{ secondaryCleanup ? '返回这份编辑 · 草稿保留' : editing ? '返回原编辑 · 草稿保留' : '完成' }}</button></view>
    </view>
    <view v-if="secondary" v-show="!secondaryCleanup" class="secondary-editor" @tap.stop><RecipeBuilder :key="secondary.recipe.id + secondary.copy" :recipe="secondary.copy ? null : secondary.recipe" :seed="secondary.copy ? secondary.recipe : null" @close="secondary = null; secondaryCleanup = false" @saved="secondarySaved" @manage-photos="cleanSecondaryPhotos" /></view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import FoodVisual from './FoodVisual.vue'
import RecipeBuilder from './RecipeBuilder.vue'
import { useJournalStore } from '@/store/journal'
import type { Recipe } from '@/data/recipes'
import { recipeImage, displayDishName } from '@/utils/foodVisuals'
import { confirmCustomRecipeDeletion } from '@/utils/recipeDeletion'
import { recipeMealLabel } from '@/utils/recipeMeals'
import { recipePhotoChars, MAX_RECIPE_PHOTO_CHARS } from '@/utils/recipePhotoData'
import { recipeManagementLists, photoCleanupCategory, formatPhotoSpace, confirmRecipePhotoRemoval, confirmRecipeHiding, type RecipeManagementCategory } from '@/utils/recipePhotoManagement'
import { foodPortion } from '@/utils/nutrition'

const props = defineProps<{ editing?: boolean; photoCleanup?: boolean }>()
const emit = defineEmits<{ close: []; restored: [ids: string[]]; deleted: [ids: string[]] }>()
const journal = useJournalStore()
const feedback = ref(''), failed = ref(false)
const manage = ref(false), selected = ref<string[]>([])
const secondary = ref<{ recipe: Recipe; copy: boolean } | null>(null), secondaryCleanup = ref(false), expanded = ref('')
const customIds = computed(() => new Set(journal.data.customRecipes.map(recipe => recipe.id)))
const selectedCustom = computed(() => selected.value.filter(id => customIds.value.has(id)))
const lists = computed(() => recipeManagementLists(journal.data.customRecipes, journal.data.hiddenRecipeIds))
const hidden = computed(() => lists.value.hidden), existing = computed(() => lists.value.existing)
const active = ref<RecipeManagementCategory>(props.photoCleanup ? photoCleanupCategory(journal.data.customRecipes, journal.data.hiddenRecipeIds) : 'hidden')
const onlyPhotos = ref(!!props.photoCleanup)
const currentItems = computed(() => active.value === 'hidden' ? hidden.value : existing.value.filter(item => !onlyPhotos.value || item.recipe.photo))
watch([active, onlyPhotos], () => { selected.value = []; manage.value = false; expanded.value = ''; feedback.value = ''; failed.value = false })
watch(currentItems, value => { selected.value = selected.value.filter(id => value.some(item => item.id === id)); if (!value.length) manage.value = false })
function toggle(id: string) { selected.value = selected.value.includes(id) ? selected.value.filter(item => item !== id) : [...selected.value, id] }
const totalChars = computed(() => recipePhotoChars(journal.data.customRecipes))
const hiddenChars = computed(() => recipePhotoChars(journal.data.customRecipes.filter(item => journal.data.hiddenRecipeIds.includes(item.id))))
const formatSize = formatPhotoSpace
const ingredientName = (id: number) => journal.allFoods.find(food => food.id === id)?.name || '未知食材'
function ingredientCalories(id: number, grams: number) { const food = journal.allFoods.find(food => food.id === id); return food ? Math.round(foodPortion(food, grams).subtotalKcal) : '未完善' }
function closeManagement() { if (secondaryCleanup.value) secondaryCleanup.value = false; else if (!secondary.value) emit('close') }
function openSecondary(recipe: Recipe, copy: boolean) { if (!secondary.value) secondary.value = { recipe, copy } }
function secondarySaved(recipe: Recipe) {
  active.value = 'existing'; onlyPhotos.value = false; selected.value = []; manage.value = false
  nextTick(() => { feedback.value = '已保存：' + recipe.name + '。已有摄入与计划的数值保留。'; failed.value = false })
}
function cleanSecondaryPhotos() { active.value = photoCleanupCategory(journal.data.customRecipes, journal.data.hiddenRecipeIds); onlyPhotos.value = true; selected.value = []; manage.value = false; secondaryCleanup.value = true }
function hideSelected() {
  confirmRecipeHiding(journal, selected.value, ids => { feedback.value = ids.length + ' 份已移到隐藏食谱，可切换分类恢复。'; failed.value = false; selected.value = [] }, message => { feedback.value = message; failed.value = true })
}
// Nest above an open builder without dismissing its unsaved draft.
// #ifdef H5
let previousOverflow = ''
onMounted(() => { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden' })
onUnmounted(() => { document.body.style.overflow = previousOverflow })
// #endif
function run(action: () => void, message: string): boolean {
  try { action(); feedback.value = message; failed.value = false; return true }
  catch (error) { feedback.value = error instanceof Error ? error.message : '操作未保存，请重试；原数据保留'; failed.value = true; return false }
}
function restore(ids: string[]) {
  const targets = [...ids]
  if (!targets.length) return
  if (run(() => journal.restoreRecipes(targets), targets.length + ' 项已恢复或移除隐藏标记，照片和历史记录保持原样。')) {
    selected.value = []; emit('restored', targets)
  }
}
function deleteRecipes(ids: string[]) {
  confirmCustomRecipeDeletion(journal, ids, deleted => {
    feedback.value = deleted.length + ' 份菜谱已完整删除，已有计划和已吃保留。'
    failed.value = false; selected.value = []; emit('deleted', deleted)
  }, message => { feedback.value = message; failed.value = true })
}
function removePhoto(recipe: Recipe) {
  confirmRecipePhotoRemoval(journal, recipe,
    () => { feedback.value = '照片已移除，空间已更新；菜谱及历史记录保留。'; failed.value = false },
    message => { feedback.value = message; failed.value = true })
}
</script>

<style scoped>
.hidden-overlay { position:fixed; inset:0; z-index:1200; background:#1b30254d; display:flex; align-items:flex-end; justify-content:center; }.hidden-panel { width:100%; max-width:600px; height:86vh; height:86dvh; max-height:760px; background:var(--surface); border-radius:24px 24px 0 0; display:flex; flex-direction:column; overflow:hidden; }.hidden-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 20px; border-bottom:1px solid var(--line); flex-shrink:0; }.hidden-title { display:block; font-size:20px; font-weight:600; }.hidden-heading button { display:flex; align-items:center; justify-content:center; margin:0; padding:0; background:transparent; }.hidden-body { flex:1; height:0; min-height:0; }.hidden-content { padding:16px 20px 24px; }.hidden-note { display:block; font-size:12px; color:var(--muted); line-height:1.7; margin-top:4px; overflow-wrap:anywhere; }.photo-budget { padding:14px; border:1px solid #dce4d5; background:#eff3e9; border-radius:14px; margin-bottom:14px; font-size:13px; }.budget-number { display:block; color:var(--brand); font-size:20px; font-weight:600; margin-top:4px; }.hidden-feedback { display:block; background:#edf2e5; color:var(--brand); padding:12px; border-radius:12px; font-size:12px; line-height:1.7; margin:14px 0; }.hidden-feedback.error { background:#fbede6; color:#934c36; }.hidden-item { padding:16px 0; border-bottom:1px solid var(--line); }.hidden-row { display:flex; align-items:center; gap:12px; }.hidden-photo { width:72px; height:72px; border-radius:12px; overflow:hidden; flex-shrink:0; }.hidden-copy { flex:1; min-width:0; }.hidden-name { display:block; font-size:15px; font-weight:550; overflow-wrap:anywhere; }.hidden-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:10px; flex-wrap:wrap; }.hidden-actions button { min-height:44px; line-height:44px; margin:0; padding:0 14px; font-size:13px; color:var(--brand); background:var(--wash); border-radius:12px; }.hidden-actions .clear-photo { color:#9e543f; background:#faeee6; }.hidden-empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:36px 0; font-size:16px; }.hidden-footer { padding:12px 20px calc(18px + env(safe-area-inset-bottom)); border-top:1px solid var(--line); flex-shrink:0; }.hidden-footer button { margin:0; min-height:48px; line-height:48px; font-size:14px; background:var(--wash); color:var(--brand); border-radius:12px; }
@media(max-width:350px) { .hidden-heading,.hidden-content { padding-left:16px; padding-right:16px; }.hidden-footer { padding-left:16px; padding-right:16px; }.hidden-photo { width:60px; height:68px; }.budget-number { font-size:18px; } }
.hidden-heading-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }.hidden-heading .hidden-manage { font-size:12px; min-height:44px; color:var(--brand); padding:0 4px; }.hidden-selection { display:flex; align-items:center; justify-content:space-between; margin:12px 0; background:var(--wash); border-radius:10px; font-size:12px; padding:0 10px; }.hidden-selection button { margin:0; padding:0 6px; min-height:44px; line-height:44px; font-size:12px; color:var(--brand); background:transparent; }.hidden-row .hidden-selector { padding:0; margin:0; min-width:32px; min-height:44px; display:flex; align-items:center; justify-content:center; background:transparent; flex-shrink:0; }.hidden-check { width:20px; height:20px; line-height:20px; border:1px solid #8d9b85; border-radius:6px; font-size:13px; }.hidden-check.checked { background:var(--brand); color:#fff; border-color:var(--brand); }.hidden-actions .photo-only { background:transparent; color:var(--muted); padding:0 4px; font-size:12px; }.hidden-batch { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; }.hidden-batch button { flex:1; min-width:0; padding:0 6px; font-size:12px; }.hidden-batch .clear-photo { color:#974833; background:#f7e3dc; }.hidden-batch .hidden-note { width:100%; }.hidden-batch button[disabled] { opacity:.45; }
@media(max-width:350px) { .hidden-title { font-size:18px; }.hidden-heading .hidden-note { font-size:11px; }.hidden-row { gap:8px; }.hidden-selector+.hidden-photo { width:48px; height:56px; } }
.management-controls { padding:12px 20px 0; flex-shrink:0; }.management-controls .photo-budget { margin-bottom:10px; padding:10px 12px; }.photo-budget>view { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }.photo-budget .budget-number { font-size:14px; margin:0; }.management-tabs { display:flex; gap:8px; }.management-tabs button { flex:1; min-width:0; margin:0; padding:0 6px; min-height:44px; line-height:44px; font-size:13px; border-radius:12px; color:var(--muted); background:var(--wash); }.management-tabs .active { background:var(--brand); color:#fff; }.photo-filter { margin:6px 0 0; padding:0 10px; min-height:44px; line-height:44px; font-size:12px; color:var(--muted); background:transparent; text-align:left; }.photo-filter.active { color:var(--brand); }.hidden-content { padding-top:0; }.hidden-heading .hidden-note { font-size:11px; }.hidden-actions .photo-only { color:var(--brand); }
@media(max-width:350px) { .management-controls { padding-left:16px; padding-right:16px; }.management-tabs button { font-size:12px; } }
.secondary-editor { position:fixed; inset:0; z-index:1; }.hidden-actions button[disabled] { opacity:.45; }.management-detail { padding:10px 12px; background:var(--wash); border-radius:12px; margin-top:8px; font-size:12px; line-height:1.8; }.management-detail>view { display:flex; justify-content:space-between; gap:8px; margin-top:4px; }.management-detail>view>text:first-child { min-width:0; overflow-wrap:anywhere; }
</style>
