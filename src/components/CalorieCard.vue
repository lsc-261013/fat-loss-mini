<template>
  <view class="calorie-card" :class="{compact}">
    <view class="summary-top"><text class="label">{{ label }}</text><text class="summary-tag">{{ hasTarget ? '参考目标' : '按实际分量记录' }}</text></view>
    <view class="intake-line">
      <view class="intake-number"><text class="intake">{{ Math.round(consumed) }}</text><text class="unit">千卡</text></view>
      <view v-if="hasTarget" class="target"><text class="target-value">{{ target }}</text><text class="target-label">千卡 / 日</text></view>
    </view>
    <view v-if="hasTarget" class="intake-track"><view :style="{width: progress + '%'}" /></view>
    <view class="summary-bottom"><text v-if="hasTarget">{{ remaining >= 0 ? '距参考目标还差' : '高于参考目标' }} {{ Math.round(Math.abs(remaining)) }} 千卡</text><text v-else>未设置参考目标，也可以继续记录</text></view>
    <view v-if="macroList.length" class="macros">
      <view v-for="m in macroList" :key="m.key" class="macro">
        <view class="macro-label"><view class="macro-dot" :class="m.key" /><text>{{ m.label }}</text></view>
        <text class="macro-value">{{ m.consumed === null ? '未完善' : m.consumed }}<text v-if="m.consumed !== null" class="macro-unit"> g</text></text>
        <text v-if="m.target !== undefined" class="macro-goal">参考 {{ m.target }} g</text>
      </view>
    </view>
    <text v-if="macroList.some(m => m.consumed === null)" class="unknown-note">营养有未填写项；热量已计入。</text>
  </view>
</template>
<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(defineProps<{
  target?: number | null; consumed: number; compact?: boolean; label?: string
  macros?: { carbs: {target?: number; consumed: number | null}; protein: {target?: number; consumed: number | null}; fat: {target?: number; consumed: number | null} }
}>(), {compact:false, label:'今天已记录'})
const hasTarget = computed(() => typeof props.target === 'number' && props.target > 0)
const remaining = computed(() => (props.target || 0) - props.consumed)
const progress = computed(() => hasTarget.value ? Math.min(100, Math.max(0, props.consumed / props.target! * 100)) : 0)
const macroList = computed(() => !props.macros ? [] : (['carbs','protein','fat'] as const).map(key => ({key, label:{carbs:'碳水',protein:'蛋白质',fat:'脂肪'}[key], target:props.macros![key].target, consumed:props.macros![key].consumed === null ? null : Math.round(props.macros![key].consumed! * 10) / 10})))
</script>
<style scoped>
.calorie-card { padding:24px; border-radius:24px; background:var(--brand-deep); color:#fff; box-shadow:0 8px 24px #173e2e10; }
.summary-top,.intake-line,.summary-bottom { display:flex; justify-content:space-between; align-items:center; gap:12px; }
.label { font-size:14px; color:#e4eee6; }.summary-tag { font-size:11px; border:1px solid #ffffff29; border-radius:20px; padding:4px 10px; color:#d7e5d7; }
.intake-line { align-items:flex-end; margin-top:16px; }.intake-number { min-width:0; }.intake { font-size:52px; letter-spacing:-2px; font-weight:650; line-height:1.15; }.unit { font-size:12px; color:#d6e4d9; margin-left:8px; }
.target { text-align:right; }.target-value { display:block; font-size:20px; font-weight:500; }.target-label { display:block; font-size:11px; color:#c4d8ca; margin-top:2px; }
.intake-track { height:5px; border-radius:4px; overflow:hidden; background:#ffffff26; margin-top:18px; }.intake-track>view { height:100%; background:#c5d8a7; border-radius:4px; transition:width .24s ease; }
.summary-bottom { color:#d4e2d5; font-size:12px; margin-top:12px; }
.macros { display:flex; gap:12px; border-top:1px solid #ffffff20; margin-top:18px; padding-top:16px; }.macro { flex:1; min-width:0; }.macro-label { display:flex; align-items:center; gap:5px; color:#d4e2d5; font-size:12px; }.macro-dot { width:5px; height:5px; border-radius:50%; background:#e5c698; }.macro-dot.protein { background:#bdd8b4; }.macro-dot.fat { background:#d7b2a0; }
.macro-value { display:block; font-size:18px; margin-top:5px; font-weight:500; white-space:nowrap; }.macro-unit { font-size:11px; font-weight:400; color:#c4d8ca; }.macro-goal { display:block; font-size:11px; color:#b9cfbf; margin-top:3px; }
.unknown-note { display:block; font-size:12px; color:#d9dfc4; margin-top:12px; }
.compact { padding:16px 20px; border-radius:20px; }.compact .intake { font-size:36px; }.compact .intake-line { margin-top:6px; }.compact .summary-bottom { margin-top:6px; font-size:11px; }.compact .macros { padding-top:10px; margin-top:10px; }.compact .macro-label { font-size:11px; }.compact .macro-value { font-size:16px; margin-top:2px; }.compact .intake-track { margin-top:10px; }.compact .summary-tag { display:none; }
@media(max-width:350px) { .calorie-card { padding:20px; }.intake { font-size:44px; }.summary-tag { padding:4px 7px; font-size:10px; }.macros { gap:8px; }.macro-value { font-size:16px; } }
</style>
