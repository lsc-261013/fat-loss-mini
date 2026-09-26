<template>
  <view class="editor-overlay" @tap="$emit('close')">
    <view class="editor-panel" @tap.stop>
      <text class="editor-title">修改 {{ entry.food.name }}</text>
      <text class="page-caption">只调整这条记录的分量</text>
      <view class="editor-input"><input type="digit" aria-label="记录克数" v-model="grams" placeholder="输入克数" focus /><text>克</text></view>
      <text class="page-caption">{{ validGrams(grams) ? '约 ' + Math.round(entry.food.kcal * Number(grams) / 100) + ' 千卡' : '请输入大于 0、且不超过 5000 的克数' }}</text>
      <button class="primary-action" :disabled="!validGrams(grams)" @tap="$emit('save', Number(grams))">保存修改</button>
      <button class="secondary-action" @tap="$emit('close')">取消</button>
    </view>
  </view>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import type { MealEntry } from '@/store/records'
import { validGrams } from '@/utils/input'
const props = defineProps<{ entry: MealEntry }>()
defineEmits<{ save: [grams: number]; close: [] }>()
const grams = ref(String(props.entry.grams))
</script>
<style scoped>
.editor-overlay { position: fixed; inset: 0; bottom: var(--window-bottom, 0px); z-index: 1003; background: rgba(23, 45, 34, .4); display: flex; align-items: flex-end; }
.editor-panel { width: 100%; max-width:960rpx; margin:0 auto; max-height:85vh; overflow-y:auto; overscroll-behavior:contain; padding: 36rpx; padding-bottom: calc(32rpx + env(safe-area-inset-bottom)); background: #fff; border-radius: 24rpx 24rpx 0 0; }
.editor-title { font-size: 36rpx; font-weight: 600; }
.editor-input { display: flex; align-items: center; gap: 20rpx; margin-top: 28rpx; background: var(--wash); border-radius: 16rpx; padding: 20rpx; }
.editor-input input { height: 72rpx; flex: 1; font-size: 40rpx; }
</style>
