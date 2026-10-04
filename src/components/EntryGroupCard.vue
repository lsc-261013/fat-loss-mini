<template>
  <view class="intake-card" :class="{ selected }">
    <view class="intake-heading" @tap="manage && emit('select')">
      <button v-if="manage" class="intake-selector" :aria-label="'选择' + group.name" :aria-pressed="selected" @tap.stop="emit('select')"><text class="intake-check" :class="{ checked: selected }">{{ selected ? '✓' : '' }}</text></button>
      <view class="intake-photo"><FoodVisual :src="entryGroupImage(group, customRecipes)" :category="group.dish ? 'dish' : group.entries[0].food.category" :label="group.name" /></view>
      <view class="intake-copy"><text class="intake-name">{{ displayDishName(group.name) }}</text><text class="intake-meta">{{ group.dish ? group.entries.length + ' 条食材明细' : group.entries[0].grams + ' g' }}</text><text v-if="!group.dish && group.entries[0].planItemId" class="intake-meta">来自计划 · 份次单独显示</text><text v-if="!group.dish && incompleteNutrition(group.entries[0].food)" class="intake-meta">营养未完善，热量已计入</text></view>
      <view class="intake-total"><text class="intake-meta">实际摄入</text><text>{{ Math.round(group.kcal) }} <text class="kcal-unit">千卡</text></text><button v-if="!group.dish && !manage" class="intake-edit" @tap.stop="emit('edit', group.entries[0])">修改</button></view>
    </view>
    <view v-if="group.dish" class="intake-details">
      <view v-for="entry in visibleEntries" :key="entry.id" class="intake-ingredient">
        <view class="ingredient-copy"><text>{{ entry.food.name }}</text><text class="intake-meta">{{ entry.grams }} g{{ incompleteNutrition(entry.food) ? ' · 营养未完善' : '' }}</text></view>
        <text class="ingredient-kcal">{{ Math.round(entry.subtotalKcal) }} <text>千卡</text></text><button v-if="!manage" class="intake-edit" :aria-label="'修改' + entry.food.name + '实际分量'" @tap.stop="emit('edit', entry)">修改</button>
      </view>
      <button v-if="group.entries.length > 4" class="intake-expand" :aria-expanded="expanded" @tap.stop="expanded = !expanded">{{ expanded ? '收起食材明细 −' : '展开全部 ' + group.entries.length + ' 条明细 ＋' }}</button>
    </view>
  </view>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import FoodVisual from './FoodVisual.vue'
import type { Recipe } from '@/data/recipes'
import type { MealEntry } from '@/types/journal'
import type { EntryGroup } from '@/utils/entryGroups'
import { entryGroupImage, displayDishName } from '@/utils/foodVisuals'
import { incompleteNutrition } from '@/utils/nutrition'
const props = defineProps<{ group: EntryGroup; customRecipes: Recipe[]; manage: boolean; selected: boolean }>()
const emit = defineEmits<{ select: []; edit: [entry: MealEntry] }>()
const expanded = ref(false)
const visibleEntries = computed(() => expanded.value || props.group.entries.length <= 4 ? props.group.entries : props.group.entries.slice(0, 3))
</script>
<style scoped>
.intake-card { background:var(--surface); border:1px solid var(--line); border-radius:18px; margin-top:12px; padding:16px; }.intake-card.selected { border-color:var(--brand); background:#f5f7f0; }.intake-heading { display:flex; align-items:center; gap:10px; }.intake-photo { width:48px; height:48px; overflow:hidden; border-radius:12px; flex-shrink:0; }.intake-copy { flex:1; min-width:0; }.intake-name { display:block; font-size:16px; font-weight:600; line-height:1.5; overflow-wrap:anywhere; }.intake-meta { display:block; color:var(--muted); font-size:11px; line-height:1.6; margin-top:3px; }.intake-total { flex-shrink:0; text-align:right; font-size:18px; font-weight:600; color:var(--brand); }.intake-total .intake-meta { font-weight:400; margin-top:0; }.kcal-unit { font-size:10px; font-weight:400; }.intake-details { border-top:1px solid var(--line); margin-top:12px; padding-top:4px; }.intake-ingredient { display:flex; align-items:center; gap:10px; min-height:54px; padding:6px 0; }.ingredient-copy { flex:1; min-width:0; font-size:13px; line-height:1.5; overflow-wrap:anywhere; }.ingredient-kcal { flex-shrink:0; font-size:13px; white-space:nowrap; }.ingredient-kcal text { font-size:10px; color:var(--muted); }.intake-edit { margin:0; min-height:44px; line-height:44px; padding:0 2px; color:var(--brand); background:transparent; font-size:12px; flex-shrink:0; }.intake-expand { margin:4px 0 0; padding:0; min-height:44px; line-height:44px; background:var(--wash); color:var(--brand); font-size:12px; border-radius:10px; width:100%; }.intake-selector { margin:0; padding:0; width:28px; min-height:44px; display:flex; align-items:center; justify-content:flex-start; background:transparent; flex-shrink:0; }.intake-check { width:20px; height:20px; line-height:20px; border:1px solid #8d9b85; border-radius:6px; color:var(--brand); font-size:13px; }.intake-check.checked { background:var(--brand); border-color:var(--brand); color:#fff; }
@media(max-width:350px) { .intake-card { padding:12px; }.intake-heading { gap:8px; }.intake-photo { width:36px; height:40px; }.intake-name { font-size:14px; }.intake-total { font-size:16px; }.intake-ingredient { gap:8px; }.ingredient-copy { font-size:12px; }.ingredient-kcal { font-size:12px; }.intake-selector { width:22px; } }
</style>
