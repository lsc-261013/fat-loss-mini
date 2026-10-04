<template>
  <view class="replacement-overlay" @tap="emit('close')">
    <view class="replacement-panel" @tap.stop>
      <view class="replacement-heading"><text>替换食材</text><button aria-label="关闭食材替换" @tap="emit('close')"><AppIcon name="close" /></button></view>
      <view class="replacement-summary">
        <text class="replacement-before">原食材：{{ originalFood?.name }} · {{ original.grams }} g · {{ Math.round(originalKcal) }} 千卡</text>
        <view class="replacement-amount"><text>新分量</text><view class="replacement-stepper"><button aria-label="替换分量减少10克" @tap="step(-10)">−</button><input type="digit" v-model="grams" aria-label="替换食材克数" :cursor-spacing="110"/><text>g</text><button aria-label="替换分量增加10克" @tap="step(10)">＋</button></view></view>
        <text v-if="!validGrams(grams)" class="replacement-error" role="alert">克数须大于 0 且不超过 5000</text>
        <view class="replacement-preview" aria-live="polite"><template v-if="preview"><text class="replacement-new">替换为：{{ preview.afterFood.name }} · {{ grams }} g</text><text>食材 {{ Math.round(preview.beforeKcal) }} → {{ Math.round(preview.afterKcal) }} 千卡</text><text class="replacement-total">菜谱合计 {{ Math.round(recipe.totalKcal) }} → {{ Math.round(preview.recipe.totalKcal) }} 千卡</text></template><text v-else>{{ selectedId === null ? '先选一个同类食材，下方会预览新热量。' : '填写有效克数后查看替换预览。' }}</text></view>
        <text class="replacement-note">{{ isCustom ? '确认后更新这份菜谱，旧计划和已吃的数值保留。' : '确认后另存为我的搭配，原预设与旧记录保留。' }}</text>
      </view>
      <scroll-view class="replacement-list" scroll-y><view class="replacement-options"><button v-for="food in options" :key="food.id" class="replacement-option" :class="{ selected: selectedId === food.id }" :aria-pressed="selectedId === food.id" @tap="selectedId = food.id; error = ''"><view><text class="replacement-name">{{ food.name }}</text><text class="replacement-reference">{{ food.kcal }} 千卡 / 100 g</text></view><text class="replacement-check">{{ selectedId === food.id ? '✓' : '' }}</text></button><text v-if="!options.length" class="replacement-note">暂无其他同类食材，可返回自建编辑中调整配料。</text></view></scroll-view>
      <view class="replacement-footer"><text v-if="error" class="replacement-error" role="alert">{{ error }}</text><view><button class="replacement-cancel" @tap="emit('close')">取消</button><button class="replacement-confirm" :disabled="!preview || saving" @tap="confirm">确认替换</button></view></view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { Recipe } from '@/data/recipes'
import { useJournalStore } from '@/store/journal'
import { foodPortion } from '@/utils/nutrition'
import { validGrams } from '@/utils/input'
import { createRecipeReplacement } from '@/utils/recipeReplacement'
import AppIcon from './AppIcon.vue'
const props = defineProps<{ recipe: Recipe; index: number }>()
const emit = defineEmits<{ close: []; saved: [recipe: Recipe] }>()
const journal = useJournalStore()
// #ifdef H5
let previousOverflow = ''
onMounted(() => { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden' })
onUnmounted(() => { document.body.style.overflow = previousOverflow })
// #endif
const session = createRecipeReplacement(journal, props.recipe, props.index)
const original = props.recipe.ingredients[props.index]
const originalFood = computed(() => journal.allFoods.find(food => food.id === original.foodId))
const originalKcal = computed(() => originalFood.value ? foodPortion(originalFood.value, original.grams).subtotalKcal : 0)
const isCustom = journal.data.customRecipes.some(recipe => recipe.id === props.recipe.id)
const grams = ref<number | string>(original.grams), selectedId = ref<number | null>(null)
const saving = ref(false), error = ref('')
const options = computed(() => journal.allFoods.filter(food => food.category === originalFood.value?.category && food.id !== original.foodId))
const preview = computed(() => session.preview(selectedId.value, grams.value))
function step(delta: number) { grams.value = Math.max(1, Math.min(5000, (Number(grams.value) || 0) + delta)) }
function confirm() {
  if (!preview.value || saving.value) return
  saving.value = true; error.value = ''
  try {
    const saved = session.confirm(selectedId.value, grams.value)
    if (!saved) return
    emit('saved', saved); emit('close')
    uni.showToast({ title: isCustom ? '已保存替换' : '已另存为我的搭配', icon: 'none' })
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '替换未保存，请重试；选择已保留' }
  finally { saving.value = false }
}
</script>
<style scoped>
.replacement-overlay { position:fixed; inset:0; bottom:var(--window-bottom,0px); z-index:1100; background:#1b30254d; display:flex; align-items:flex-end; justify-content:center; }.replacement-panel { width:100%; max-width:600px; height:86vh; height:86dvh; max-height:760px; display:flex; flex-direction:column; background:var(--surface); border-radius:24px 24px 0 0; overflow:hidden; }.replacement-heading { display:flex; align-items:center; justify-content:space-between; padding:12px 20px; font-size:20px; font-weight:600; border-bottom:1px solid var(--line); flex-shrink:0; }.replacement-heading button { display:flex; align-items:center; justify-content:center; margin:0; padding:0; background:transparent; }.replacement-summary { padding:12px 20px; flex-shrink:0; }.replacement-before,.replacement-note { display:block; color:var(--muted); font-size:12px; line-height:1.7; overflow-wrap:anywhere; }.replacement-amount { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:10px 0; font-size:13px; }.replacement-stepper { display:flex; align-items:center; border:1px solid var(--line); border-radius:12px; overflow:hidden; }.replacement-stepper button { width:44px; min-height:44px; line-height:44px; padding:0; margin:0; background:var(--wash); color:var(--brand); }.replacement-stepper input { width:66px; height:44px; text-align:center; font-size:16px; }.replacement-stepper>text { font-size:12px; padding-right:8px; color:var(--muted); }.replacement-preview { padding:12px; border-radius:14px; background:var(--wash); font-size:12px; line-height:1.7; margin-bottom:8px; }.replacement-preview text { display:block; overflow-wrap:anywhere; }.replacement-new { font-size:14px; font-weight:500; }.replacement-total { color:var(--brand); font-weight:600; margin-top:4px; }.replacement-list { flex:1; min-height:0; height:0; }.replacement-options { padding:0 20px 12px; }.replacement-option { display:flex; align-items:center; gap:12px; justify-content:space-between; width:100%; min-height:60px; margin:0 0 8px; padding:8px 12px; text-align:left; background:transparent; border:1px solid var(--line); border-radius:12px; line-height:1.6; }.replacement-option>view { flex:1; min-width:0; }.replacement-name { display:block; font-size:14px; color:var(--ink); overflow-wrap:anywhere; }.replacement-reference { display:block; color:var(--muted); font-size:11px; }.replacement-option.selected { border-color:var(--brand); background:#eff3e9; }.replacement-check { color:var(--brand); width:18px; flex-shrink:0; }.replacement-footer { padding:12px 20px calc(16px + env(safe-area-inset-bottom)); border-top:1px solid var(--line); flex-shrink:0; }.replacement-footer>view { display:flex; gap:10px; }.replacement-footer button { flex:1; min-width:0; margin:0; padding:0 8px; line-height:48px; min-height:48px; font-size:14px; border-radius:12px; }.replacement-cancel { background:var(--wash); color:var(--brand); }.replacement-confirm { background:var(--brand); color:#fff; }.replacement-confirm[disabled] { opacity:.45; }.replacement-error { display:block; font-size:12px; color:#934c36; line-height:1.7; margin-bottom:8px; }
@media(max-width:350px) { .replacement-heading,.replacement-summary,.replacement-options,.replacement-footer { padding-left:16px; padding-right:16px; }.replacement-heading { font-size:18px; }.replacement-preview { padding:10px; } }
</style>
