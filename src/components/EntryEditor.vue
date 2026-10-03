<template>
  <view class="editor-overlay" @tap="$emit('close')">
    <view class="editor-panel" @tap.stop>
      <view class="editor-heading"><view class="editor-food"><FoodVisual :category="entry.food.category" /></view><view><text class="editor-eyebrow">调整实际分量</text><text class="editor-title">{{ entry.food.name }}</text></view><button class="editor-close" aria-label="关闭分量编辑" @tap="$emit('close')"><AppIcon name="close" /></button></view>
      <text class="page-caption">调整实际吃下的分量{{ entry.planItemId ? '，原计划保留' : '' }}</text>
      <view class="editor-input"><input type="digit" aria-label="记录克数" v-model="grams" placeholder="输入克数" focus /><text>克</text></view>
      <text class="page-caption">{{ validGrams(grams) ? '约 ' + Math.round(entry.food.kcal * Number(grams) / 100) + ' 千卡' : '请输入大于 0、且不超过 5000 的克数' }}</text>
      <view v-if="validGrams(grams)" class="change-preview"><text>当天合计</text><text>{{ Math.round(dayKcal) }} → <text class="next-total">{{ nextTotal }} 千卡</text></text></view>
      <text class="page-caption">保存后可在记录页撤销这次修改。</text>
      <button class="primary-action" :disabled="!validGrams(grams)" @tap="$emit('save', Number(grams))">保存修改</button>
      <button class="secondary-action" @tap="$emit('close')">取消</button>
    </view>
  </view>
</template>
<script setup lang="ts">
import FoodVisual from '@/components/FoodVisual.vue'
import AppIcon from '@/components/AppIcon.vue'
import { computed, ref } from 'vue'
import type { MealEntry } from '@/store/records'
import { validGrams } from '@/utils/input'
const props = defineProps<{ entry: MealEntry; dayKcal: number }>()
defineEmits<{ save: [grams: number]; close: [] }>()
const grams = ref(String(props.entry.grams))
const nextTotal = computed(() => Math.round(props.dayKcal - props.entry.subtotalKcal + props.entry.food.kcal * Number(grams.value) / 100))
</script>
<style scoped>

.editor-overlay { position:fixed; inset:0; bottom:var(--window-bottom,0px); z-index:1003; background:#1b30254d; display:flex; align-items:flex-end; }.editor-panel { width:100%; max-width:600px; margin:0 auto; max-height:85vh; overflow-y:auto; overscroll-behavior:contain; padding:24px 20px calc(24px + env(safe-area-inset-bottom)); background:#fff; border-radius:24px 24px 0 0; animation:content-in .2s ease; }
.editor-heading { display:flex; align-items:center; gap:12px; }.editor-food { width:52px; height:52px; overflow:hidden; border-radius:14px; flex-shrink:0; }.editor-heading>view:nth-child(2) { flex:1; min-width:0; }.editor-eyebrow { display:block; color:var(--muted); font-size:11px; }.editor-title { display:block; font-size:20px; font-weight:600; overflow-wrap:anywhere; }.editor-close { background:transparent; margin:0; padding:0; display:flex; align-items:center; justify-content:center; }
.editor-input { display:flex; align-items:center; gap:16px; margin-top:20px; border:1px solid #dce4d5; background:#f5f6ef; border-radius:16px; padding:12px 16px; }.editor-input input { height:44px; flex:1; min-width:0; font-size:30px; color:var(--brand); }.editor-input>text { font-size:14px; color:var(--muted); }.change-preview { display:flex; align-items:center; justify-content:space-between; gap:12px; background:#edf2e5; padding:16px; margin-top:20px; border-radius:14px; font-size:14px; }.next-total { font-weight:600; color:var(--brand); }.page-caption { font-size:12px; }

</style>
