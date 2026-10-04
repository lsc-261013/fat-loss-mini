<template>
  <view class="hidden-overlay" @tap="emit('close')">
    <view class="hidden-panel" @tap.stop>
      <view class="hidden-heading"><view><text class="hidden-title">隐藏菜谱</text><text class="hidden-note">恢复显示，或只清理照片</text></view><button aria-label="关闭隐藏菜谱" @tap="emit('close')"><AppIcon name="close" /></button></view>
      <scroll-view class="hidden-body" scroll-y>
        <view class="hidden-content">
          <view class="photo-budget"><text>菜谱照片编码占用</text><text class="budget-number">{{ formatSize(totalChars) }} / {{ formatSize(MAX_RECIPE_PHOTO_CHARS) }} KiB</text><text class="hidden-note">其中隐藏菜谱 {{ formatSize(hiddenChars) }} KiB。按实际编码大小计算，图片数量不是固定上限。</text></view>
          <text class="hidden-note">隐藏只从食谱列表移除，不释放照片空间。移除照片保留菜谱文字、配料、历史计划和已吃记录；已有备份或导入前副本可能仍包含照片。</text>
          <text v-if="feedback" class="hidden-feedback" :class="{ error: failed }" role="status">{{ feedback }}</text>
          <view v-if="!hidden.length" class="hidden-empty"><AppIcon name="dish" :size="32" /><text>没有隐藏的菜谱</text><text class="hidden-note">可见菜谱的照片，可在「编辑」中移除。</text></view>
          <view v-for="item in hidden" :key="item.id" class="hidden-item">
            <view class="hidden-row"><view class="hidden-photo"><FoodVisual :src="item.recipe ? recipeImage(item.recipe) : ''" :label="item.recipe?.name || '旧菜谱'" /></view><view class="hidden-copy"><text class="hidden-name">{{ item.recipe ? displayDishName(item.recipe.name) : '暂不可识别的旧菜谱' }}</text><text class="hidden-note">{{ item.recipe ? recipeMealLabel(item.recipe.mealTime) : '原菜谱已不在当前库中，恢复仅移除隐藏标记。' }}</text><text class="hidden-note">{{ item.recipe?.photo ? '照片编码 ' + formatSize(item.recipe.photo.length) + ' KiB' : '无自选照片，不占照片配额' }}</text></view></view>
            <view class="hidden-actions"><button @tap="restore(item.id, !!item.recipe)">{{ item.recipe ? '恢复显示' : '移除隐藏标记' }}</button><button v-if="item.recipe?.photo" class="clear-photo" @tap="removePhoto(item.recipe)">移除照片</button></view>
          </view>
        </view>
      </scroll-view>
      <view class="hidden-footer"><button @tap="emit('close')">{{ editing ? '返回编辑 · 草稿保留' : '完成' }}</button></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppIcon from './AppIcon.vue'
import FoodVisual from './FoodVisual.vue'
import { useJournalStore } from '@/store/journal'
import { recipes, type Recipe } from '@/data/recipes'
import { recipeImage, displayDishName } from '@/utils/foodVisuals'
import { recipeMealLabel } from '@/utils/recipeMeals'
import { recipePhotoChars, MAX_RECIPE_PHOTO_CHARS } from '@/utils/recipePhotoData'

defineProps<{ editing?: boolean }>()
const emit = defineEmits<{ close: []; restored: [id: string] }>()
const journal = useJournalStore()
const feedback = ref(''), failed = ref(false)
const hidden = computed(() => [...new Set(journal.data.hiddenRecipeIds)].map(id => ({
  id, recipe: journal.data.customRecipes.find(item => item.id === id) || recipes.find(item => item.id === id),
})))
const totalChars = computed(() => recipePhotoChars(journal.data.customRecipes))
const hiddenChars = computed(() => recipePhotoChars(journal.data.customRecipes.filter(item => journal.data.hiddenRecipeIds.includes(item.id))))
const formatSize = (chars: number) => (chars / 1024).toFixed(chars ? 1 : 0)
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
function restore(id: string, known: boolean) {
  if (run(() => journal.restoreRecipes([id]), known ? '已恢复到食谱列表，照片和分量保持原样。' : '已移除旧隐藏标记，现有菜谱与记录保持原样。')) emit('restored', id)
}
function removePhoto(recipe: Recipe) {
  const id = recipe.id, revision = journal.revision
  uni.showModal({ title: '移除这份菜谱的照片？', content: `「${recipe.name}」会改用默认图，释放约 ${formatSize(recipe.photo?.length || 0)} KiB 照片编码占用。菜谱文字、配料、隐藏状态、历史计划和已吃记录保留。此操作不能直接撤销照片，可从已有备份恢复。`, confirmText: '移除照片', confirmColor: '#9e543f', success: result => {
    if (!result.confirm) return
    if (revision !== journal.revision) { feedback.value = '数据已变化，请重新选择要清理的照片。'; failed.value = true; return }
    run(() => journal.removeRecipePhoto(id), '照片已移除，菜谱及历史记录保留；照片占用已更新。')
  } })
}
</script>

<style scoped>
.hidden-overlay { position:fixed; inset:0; z-index:1200; background:#1b30254d; display:flex; align-items:flex-end; justify-content:center; }.hidden-panel { width:100%; max-width:600px; height:86vh; height:86dvh; max-height:760px; background:var(--surface); border-radius:24px 24px 0 0; display:flex; flex-direction:column; overflow:hidden; }.hidden-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 20px; border-bottom:1px solid var(--line); flex-shrink:0; }.hidden-title { display:block; font-size:20px; font-weight:600; }.hidden-heading button { display:flex; align-items:center; justify-content:center; margin:0; padding:0; background:transparent; }.hidden-body { flex:1; height:0; min-height:0; }.hidden-content { padding:16px 20px 24px; }.hidden-note { display:block; font-size:12px; color:var(--muted); line-height:1.7; margin-top:4px; overflow-wrap:anywhere; }.photo-budget { padding:14px; border:1px solid #dce4d5; background:#eff3e9; border-radius:14px; margin-bottom:14px; font-size:13px; }.budget-number { display:block; color:var(--brand); font-size:20px; font-weight:600; margin-top:4px; }.hidden-feedback { display:block; background:#edf2e5; color:var(--brand); padding:12px; border-radius:12px; font-size:12px; line-height:1.7; margin:14px 0; }.hidden-feedback.error { background:#fbede6; color:#934c36; }.hidden-item { padding:16px 0; border-bottom:1px solid var(--line); }.hidden-row { display:flex; align-items:center; gap:12px; }.hidden-photo { width:72px; height:72px; border-radius:12px; overflow:hidden; flex-shrink:0; }.hidden-copy { flex:1; min-width:0; }.hidden-name { display:block; font-size:15px; font-weight:550; overflow-wrap:anywhere; }.hidden-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:10px; flex-wrap:wrap; }.hidden-actions button { min-height:44px; line-height:44px; margin:0; padding:0 14px; font-size:13px; color:var(--brand); background:var(--wash); border-radius:12px; }.hidden-actions .clear-photo { color:#9e543f; background:#faeee6; }.hidden-empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:36px 0; font-size:16px; }.hidden-footer { padding:12px 20px calc(18px + env(safe-area-inset-bottom)); border-top:1px solid var(--line); flex-shrink:0; }.hidden-footer button { margin:0; min-height:48px; line-height:48px; font-size:14px; background:var(--wash); color:var(--brand); border-radius:12px; }
@media(max-width:350px) { .hidden-heading,.hidden-content { padding-left:16px; padding-right:16px; }.hidden-footer { padding-left:16px; padding-right:16px; }.hidden-photo { width:60px; height:68px; }.budget-number { font-size:18px; } }
</style>
