<template>
  <view class="calorie-card">
    <view class="intake-line">
      <view><text class="label">已摄入</text><view><text class="intake">{{ Math.round(consumed) }}</text><text class="unit">千卡</text></view></view>
      <view class="target"><text>参考目标 {{ target }} 千卡</text><text class="remaining" :class="{ over: remaining < 0 }">{{ remaining >= 0 ? '还差' : '高于目标' }} {{ Math.round(Math.abs(remaining)) }} 千卡</text></view>
    </view>
    <view class="intake-track"><view :style="{ width: Math.min(100, Math.max(0, consumed / target * 100)) + '%' }" /></view>
    <view v-if="macros" class="macros">
      <view v-for="m in macroList" :key="m.key" class="macro">
        <text class="label">{{ m.label }}</text><text class="macro-value">{{ m.consumed === null ? '未完善' : m.consumed }}<text class="macro-unit"> / {{ m.target }} g</text></text>
        <view v-if="m.consumed !== null" class="macro-track"><view :style="{ width: m.pct + '%' }" /></view>
      </view>
    </view>
    <text v-if="macroList.some(m => m.consumed === null)" class="page-caption">部分食材营养未填写，对应总量暂不计算；热量已计入。</text>
  </view>
</template>
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  target: number
  consumed: number
  macros?: {
    carbs: { target: number; consumed: number | null }
    protein: { target: number; consumed: number | null }
    fat: { target: number; consumed: number | null }
  }
}>()

const remaining = computed(() => props.target - props.consumed)

const macroList = computed(() => {
  if (!props.macros) return []
  return (['carbs', 'protein', 'fat'] as const).map(key => {
    const macro = props.macros![key]
    return { key, label: { carbs: '碳水', protein: '蛋白质', fat: '脂肪' }[key], target: macro.target,
      consumed: macro.consumed === null ? null : Math.round(macro.consumed * 10) / 10,
      pct: macro.consumed === null ? 0 : Math.min(Math.round(macro.consumed / macro.target * 100), 100) }
  })
})
</script>
<style scoped>
.calorie-card { padding: 24rpx 0 32rpx; }
.intake-line { display:flex; align-items:center; justify-content:space-between; gap:20rpx; }
.label { display:block; color:var(--muted); font-size:max(24rpx,12px); }
.intake { font-size:max(76rpx,36px); line-height:1.35; font-weight:600; letter-spacing:-2rpx; }
.unit { color:var(--muted); font-size:max(24rpx,12px); margin-left:12rpx; }
.target { text-align:right; font-size:max(24rpx,12px); color:var(--muted); }
.remaining { display:block; margin-top:8rpx; color:var(--ink); }.remaining.over { color:#ac513b; }
.intake-track { height:8rpx; border-radius:4rpx; background:var(--line); overflow:hidden; margin:20rpx 0 26rpx; }
.intake-track>view { height:100%; background:var(--brand); border-radius:4rpx; }
.macros { display:flex; gap:28rpx; }.macro { flex:1; min-width:0; }
.macro-value { display:block; font-size:max(27rpx,13px); margin-top:6rpx; white-space:nowrap; }
.macro-unit { color:var(--muted); font-size:max(22rpx,11px); }
.macro-track { height:4rpx; background:var(--line); margin-top:10rpx; }.macro-track>view { height:100%; background:#9cafa2; }
@media(max-width:350px) { .macros { gap:16rpx; } }
</style>
